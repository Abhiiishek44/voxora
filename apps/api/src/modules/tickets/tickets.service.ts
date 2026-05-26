import { Types } from "mongoose";
import { Ticket, ITicket, Conversation, Contact } from "@shared/models";
import { enqueueTicketLifecycleEmail } from "@shared/queues/email.queue";
import logger from "@shared/core/logger";
import type { TicketEmailEvent } from "@shared/utils/email";

interface CreateTicketInput {
  organizationId: string;
  conversationId?: string;
  contactId?: string;
  title: string;
  description?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  status?: "open" | "in_progress" | "resolved" | "closed";
  source?: "ai" | "agent" | "api";
  tags?: string[];
}

interface UpdateTicketInput {
  title?: string;
  description?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  status?: "open" | "in_progress" | "resolved" | "closed";
  assignedTo?: string | null;
  tags?: string[];
}

interface CloseTicketInput {
  resolutionNote?: string;
}

interface ListTicketsOptions {
  status?: string;
  priority?: string;
  assignedTo?: string;
  limit?: number;
  page?: number;
}

export class TicketsService {
  // ─── Create ────────────────────────────────────────────────────────────────

  async createTicket(input: CreateTicketInput): Promise<ITicket> {
    if (input.conversationId && !Types.ObjectId.isValid(input.conversationId)) {
      throw new Error("Invalid conversationId");
    }
    if (input.contactId && !Types.ObjectId.isValid(input.contactId)) {
      throw new Error("Invalid contactId");
    }

    // Auto-assign logic: if the ticket is created within an existing conversation
    // that is already assigned to a human agent, automatically assign the ticket to them.
    let assignedTo: Types.ObjectId | null = null;
    if (input.conversationId) {
      const conversation = await Conversation.findById(input.conversationId)
        .select("assignedTo")
        .lean();
      if (conversation?.assignedTo) {
        assignedTo = conversation.assignedTo;
      }
    }

    const ticket = await Ticket.create({
      organizationId: new Types.ObjectId(input.organizationId),
      ...(input.conversationId ? { conversationId: new Types.ObjectId(input.conversationId) } : {}),
      ...(input.contactId ? { contactId: new Types.ObjectId(input.contactId) } : {}),
      title: input.title.trim(),
      description: input.description?.trim(),
      status: input.status || "open",
      priority: input.priority || "medium",
      source: input.source || "ai",
      tags: (input.tags || []).map((t) => t.trim()).filter(Boolean).slice(0, 20),
      notes: [],
      metadata: {},
      ...(input.status === "resolved" ? { resolvedAt: new Date() } : {}),
      ...(input.status === "closed" ? { closedAt: new Date() } : {}),
      ...(assignedTo ? { assignedTo } : {}),
    });

    const createdEvent: TicketEmailEvent =
      input.status === "resolved" ? "resolved" : input.status === "closed" ? "closed" : "created";
    await this.notifyTicketLifecycle(ticket, createdEvent);
    return ticket;
  }

  // ─── List ──────────────────────────────────────────────────────────────────

  async listTickets(organizationId: string, options: ListTicketsOptions = {}) {
    const { status, priority, assignedTo, limit = 50, page = 1 } = options;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { organizationId };
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (assignedTo) filter.assignedTo = assignedTo;

    const [tickets, total] = await Promise.all([
      Ticket.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("assignedTo", "name email")
        .lean(),
      Ticket.countDocuments(filter),
    ]);

    return {
      tickets: tickets.map(this.formatTicket),
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  // ─── Get by ID ─────────────────────────────────────────────────────────────

  async getTicketById(organizationId: string, ticketId: string) {
    if (!Types.ObjectId.isValid(ticketId)) return null;

    const ticket = await Ticket.findOne({ _id: ticketId, organizationId })
      .populate("assignedTo", "name email")
      .lean();

    return ticket ? this.formatTicket(ticket) : null;
  }

  // ─── Update ────────────────────────────────────────────────────────────────

  async updateTicket(organizationId: string, ticketId: string, input: UpdateTicketInput) {
    if (!Types.ObjectId.isValid(ticketId)) return null;

    const previous = await Ticket.findOne({ _id: ticketId, organizationId })
      .select("status title priority")
      .lean();
    if (!previous) return null;

    const setOps: Record<string, unknown> = {};
    if (input.title !== undefined) setOps.title = input.title.trim();
    if (input.description !== undefined) setOps.description = input.description.trim();
    if (input.priority !== undefined) setOps.priority = input.priority;
    if (input.status !== undefined) {
      setOps.status = input.status;
      if (input.status === "resolved" && previous.status !== "resolved") {
        setOps.resolvedAt = new Date();
      }
      if (input.status === "closed" && previous.status !== "closed") {
        setOps.closedAt = new Date();
      }
    }
    if (input.tags !== undefined) setOps.tags = input.tags.map((t) => t.trim()).filter(Boolean).slice(0, 20);
    if ("assignedTo" in input) {
      setOps.assignedTo = input.assignedTo ? new Types.ObjectId(input.assignedTo) : null;
    }

    const ticket = await Ticket.findOneAndUpdate(
      { _id: ticketId, organizationId },
      { $set: setOps },
      { new: true },
    )
      .populate("assignedTo", "name email")
      .lean();

    if (!ticket) return null;

    let event: TicketEmailEvent = "updated";
    if (input.status === "resolved" && previous.status !== "resolved") event = "resolved";
    if (input.status === "closed" && previous.status !== "closed") event = "closed";
    await this.notifyTicketLifecycle(ticket, event, this.buildUpdateSummary(input));

    return this.formatTicket(ticket);
  }

  // ─── Close ─────────────────────────────────────────────────────────────────

  async closeTicket(organizationId: string, ticketId: string, input: CloseTicketInput = {}) {
    if (!Types.ObjectId.isValid(ticketId)) return null;

    const previous = await Ticket.findOne({ _id: ticketId, organizationId }).select("status").lean();
    if (!previous) return null;

    const now = new Date();
    const ticket = await Ticket.findOneAndUpdate(
      { _id: ticketId, organizationId },
      {
        $set: {
          status: "closed",
          closedAt: now,
          ...(input.resolutionNote ? { resolutionNote: input.resolutionNote.trim() } : {}),
        },
        $push: {
          notes: {
            id: `note-${Date.now()}`,
            author: "AI Assistant",
            authorType: "ai",
            content: input.resolutionNote || "Ticket closed by AI.",
            createdAt: now,
          },
        },
      },
      { new: true },
    )
      .populate("assignedTo", "name email")
      .lean();

    if (!ticket) return null;
    if (previous.status !== "closed") {
      await this.notifyTicketLifecycle(ticket, "closed", input.resolutionNote);
    }

    return this.formatTicket(ticket);
  }

  // ─── Add Note ──────────────────────────────────────────────────────────────

  async addNote(organizationId: string, ticketId: string, content: string, author = "Agent") {
    if (!Types.ObjectId.isValid(ticketId)) return null;

    const ticket = await Ticket.findOneAndUpdate(
      { _id: ticketId, organizationId },
      {
        $push: {
          notes: {
            id: `note-${Date.now()}`,
            author,
            authorType: "agent",
            content: content.trim(),
            createdAt: new Date(),
          },
        },
      },
      { new: true },
    ).lean();

    return ticket ? this.formatTicket(ticket) : null;
  }

  // ─── Format ────────────────────────────────────────────────────────────────

  private formatTicket(ticket: any) {
    return {
      id: ticket._id.toString(),
      ticketNumber: ticket.ticketNumber,
      organizationId: ticket.organizationId?.toString(),
      conversationId: ticket.conversationId?.toString() || null,
      contactId: ticket.contactId?.toString() || null,
      title: ticket.title,
      description: ticket.description || null,
      status: ticket.status,
      priority: ticket.priority,
      source: ticket.source,
      assignedTo: ticket.assignedTo
        ? {
            id: ticket.assignedTo._id?.toString() || ticket.assignedTo.toString(),
            name: ticket.assignedTo.name,
            email: ticket.assignedTo.email,
          }
        : null,
      tags: ticket.tags || [],
      notes: (ticket.notes || []).map((n: any) => ({
        id: n.id,
        author: n.author,
        authorType: n.authorType,
        content: n.content,
        createdAt: n.createdAt,
      })),
      resolutionNote: ticket.resolutionNote || null,
      resolvedAt: ticket.resolvedAt || null,
      closedAt: ticket.closedAt || null,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
    };
  }

  private buildUpdateSummary(input: UpdateTicketInput): string {
    const changes: string[] = [];
    if (input.status) changes.push(`Status changed to ${input.status.replace(/_/g, " ")}.`);
    if (input.priority) changes.push(`Priority changed to ${input.priority}.`);
    if (input.title !== undefined) changes.push("The ticket subject was updated.");
    if (input.description !== undefined) changes.push("Additional issue details were updated.");
    if ("assignedTo" in input) changes.push("The ticket assignment was updated.");
    if (input.tags !== undefined) changes.push("Ticket categories were updated.");
    return changes.join(" ") || "Your support request has been updated.";
  }

  private async notifyTicketLifecycle(
    ticket: any,
    event: TicketEmailEvent,
    detail?: string,
  ): Promise<void> {
    try {
      const recipient = await this.getNotificationRecipient(ticket);
      if (!recipient) {
        logger.info("[Tickets] Notification skipped: no visitor email", {
          ticketNumber: ticket.ticketNumber,
          event,
        });
        return;
      }

      const queued = await enqueueTicketLifecycleEmail(recipient.email, event, {
        name: recipient.name || "there",
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        status: String(ticket.status).replace(/_/g, " "),
        priority: ticket.priority,
        ...(event === "updated" ? { updateSummary: detail } : {}),
        ...(event === "resolved" || event === "closed" ? { resolutionNote: detail } : {}),
      });

      if (!queued) {
        logger.warn("[Tickets] Notification email disabled or not queued", {
          ticketNumber: ticket.ticketNumber,
          event,
        });
      }
    } catch (error: any) {
      logger.error("[Tickets] Failed to queue lifecycle notification", {
        ticketNumber: ticket.ticketNumber,
        event,
        error: error?.message || error,
      });
    }
  }

  private async getNotificationRecipient(
    ticket: any,
  ): Promise<{ name: string; email: string } | null> {
    if (ticket.contactId) {
      const contact = await Contact.findOne({
        _id: ticket.contactId,
        organizationId: ticket.organizationId,
      })
        .select("name email")
        .lean();
      if (contact?.email) {
        return { name: contact.name || "there", email: contact.email };
      }
    }

    if (ticket.conversationId) {
      const conversation = await Conversation.findOne({
        _id: ticket.conversationId,
        organizationId: ticket.organizationId,
      })
        .select("visitor.name visitor.email")
        .lean();
      const email = conversation?.visitor?.email?.trim().toLowerCase();
      if (email && email !== "anonymous@temp.local") {
        const name = conversation?.visitor?.name;
        return {
          name: name && name !== "Anonymous User" ? name : "there",
          email,
        };
      }
    }

    return null;
  }
}
