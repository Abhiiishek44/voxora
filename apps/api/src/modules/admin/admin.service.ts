import mongoose from "mongoose";
import crypto from "crypto";
import { Widget, Membership, MembershipRole } from "@shared/models";
import logger from "@shared/utils/logger";
import { DEFAULT_WIDGET_SUGGESTIONS } from "@shared/constants/widget-defaults";

const DEFAULT_WIDGET_SETTINGS = {
  backgroundColor: "#845C6C",
  appearance: {
    theme: "dark" as const,
    primaryColor: "#845C6C",
    welcomeMessage: "Hi there! How can we help you today?",
  },
  behavior: {
    autoOpen: false,
    showOnMobile: true,
    showOnDesktop: true,
  },
  ai: {
    enabled: true,
    model: "gpt-4o-mini",
    fallbackToAgent: true,
  },
  conversation: {
    collectUserInfo: {
      name: true,
      email: true,
      phone: false,
    },
  },
  features: {
    endUserDomAccess: false,
  },
  suggestions: DEFAULT_WIDGET_SUGGESTIONS,
};

function withWidgetConfigDefaults(input: any): any {
  const output = { ...input };
  output.appearance = {
    ...DEFAULT_WIDGET_SETTINGS.appearance,
    ...(input.appearance || {}),
  };
  delete output.logoUrl;
  delete output.appearance.logoUrl;
  output.behavior = { ...DEFAULT_WIDGET_SETTINGS.behavior, ...(input.behavior || {}) };
  output.ai = { ...DEFAULT_WIDGET_SETTINGS.ai, ...(input.ai || {}) };
  output.conversation = {
    collectUserInfo: {
      ...DEFAULT_WIDGET_SETTINGS.conversation.collectUserInfo,
      ...(input.conversation?.collectUserInfo || {}),
    },
  };
  output.features = { ...DEFAULT_WIDGET_SETTINGS.features, ...(input.features || {}) };
  // suggestions: use caller's value if provided (even empty array), otherwise keep defaults
  if (Array.isArray(input.suggestions)) {
    output.suggestions = input.suggestions.slice(0, 4).map((s: any) => ({
      text: String(s.text || "").trim(),
      showOutside: Boolean(s.showOutside),
    })).filter((s: any) => s.text.length > 0);
  } else if (!output.suggestions) {
    output.suggestions = DEFAULT_WIDGET_SETTINGS.suggestions;
  }
  return output;
}

export class AdminService {
  // ═══════════════════════════════════════════════════
  //  AGENT MANAGEMENT (via Membership)
  // ═══════════════════════════════════════════════════

  async getAgents(
    organizationId: string,
    options: { page: number; limit: number; status?: string; search?: string },
  ) {
    const { page, limit, status, search } = options;

    const memberQuery: any = {
      organizationId,
      role: "agent",
      inviteStatus: { $in: ["active", "pending"] },
    };

    if (status) memberQuery["$lookup.status"] = status;

    const members = await Membership.find(memberQuery)
      .populate("userId", "name email avatar status lastSeen isActive")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Membership.countDocuments(memberQuery);

    return {
      agents: members.map((m) => ({
        membershipId: m._id,
        user: m.userId,
        role: m.role,
        inviteStatus: m.inviteStatus,
        invitedAt: m.invitedAt,
        activatedAt: m.activatedAt,
      })),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit,
      },
    };
  }

  async getAgentById(organizationId: string, userId: string) {
    if (!mongoose.Types.ObjectId.isValid(userId)) throw new Error("Invalid user ID");

    const membership = await Membership.findOne({ userId, organizationId })
      .populate("userId", "name email avatar status lastSeen");

    return membership;
  }

  async updateAgent(organizationId: string, userId: string, updateData: any) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return { success: false, message: "Invalid user ID", statusCode: 400 };
    }

    const updateFields: any = {};

    if (updateData.role) updateFields.role = updateData.role as MembershipRole;

    const membership = await Membership.findOneAndUpdate(
      { userId, organizationId },
      updateFields,
      { new: true, runValidators: true },
    )
      .populate("userId", "name email avatar status");

    if (!membership) {
      return { success: false, message: "Agent not found in this organization", statusCode: 404 };
    }

    return { success: true, data: membership };
  }

  async deleteAgent(organizationId: string, userId: string) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return { success: false, message: "Invalid user ID", statusCode: 400 };
    }

    const membership = await Membership.findOne({ userId, organizationId });
    if (!membership) {
      return { success: false, message: "Agent not found", statusCode: 404 };
    }

    if (membership.role === "owner") {
      return { success: false, message: "Cannot remove the organization owner", statusCode: 403 };
    }

    await Membership.findByIdAndDelete(membership._id);
    return { success: true };
  }

  // ═══════════════════════════════════════════════════
  //  WIDGET MANAGEMENT
  // ═══════════════════════════════════════════════════

  async createWidget(organizationId: string, widgetData: any) {
    const normalizedWidgetData = withWidgetConfigDefaults(widgetData || {});
    const existingWidget = await Widget.findOne({ organizationId });

    if (existingWidget) {
      const updated = await Widget.findOneAndUpdate(
        { organizationId },
        { ...normalizedWidgetData, organizationId },
        { new: true, runValidators: true },
      );
      return updated;
    }

    const widget = new Widget({
      ...normalizedWidgetData,
      organizationId,
    });

    await widget.save();

    logger.info("Widget created successfully", {
      widgetId: widget._id,
      organizationId,
      displayName: widget.displayName,
    });

    return widget;
  }

  async getWidget(organizationId: string) {
    let widget = await Widget.findOne({ organizationId });

    if (!widget) {
      widget = new Widget({
        organizationId,
        displayName: "InteraOne AI",
        ...DEFAULT_WIDGET_SETTINGS,
        publicKey: crypto.randomBytes(16).toString("hex"),
      });
      await widget.save();
      logger.info(`Auto-created default widget for org ${organizationId}`);
    } else {
      const normalizedExisting = withWidgetConfigDefaults(widget.toObject());
      const needsBackfill =
        !widget.appearance ||
        !widget.behavior ||
        !widget.ai ||
        !widget.conversation ||
        !widget.features;

      if (needsBackfill) {
        await Widget.updateOne({ _id: widget._id }, normalizedExisting, {
          runValidators: true,
        });
        const refreshedWidget = await Widget.findById(widget._id);
        if (refreshedWidget) widget = refreshedWidget;
      }
    }

    return widget;
  }

  async updateWidget(organizationId: string, updateData: any) {
    const normalizedUpdateData = withWidgetConfigDefaults(updateData || {});
    const allowedUpdates = {
      displayName: normalizedUpdateData.displayName,
      appearance: normalizedUpdateData.appearance,
      behavior: normalizedUpdateData.behavior,
      ai: normalizedUpdateData.ai,
      conversation: normalizedUpdateData.conversation,
      features: normalizedUpdateData.features,
      suggestions: normalizedUpdateData.suggestions,
    };

    const cleanUpdates = Object.fromEntries(
      Object.entries(allowedUpdates).filter(([_, v]) => v !== undefined),
    );

    let widget = await Widget.findOneAndUpdate({ organizationId }, cleanUpdates, {
      new: true,
      runValidators: true,
    });

    if (!widget) {
      widget = new Widget({
        organizationId,
        displayName: normalizedUpdateData.displayName || "InteraOne AI",
        appearance: normalizedUpdateData.appearance,
        behavior: normalizedUpdateData.behavior,
        ai: normalizedUpdateData.ai,
        conversation: normalizedUpdateData.conversation,
        features: normalizedUpdateData.features,
        publicKey: crypto.randomBytes(16).toString("hex"),
      });
      await widget.save();
    }

    return widget;
  }

  // ═══════════════════════════════════════════════════
  //  ANALYTICS & STATS
  // ═══════════════════════════════════════════════════

  async getDashboardStats(organizationId: string) {
    const totalAgents = await Membership.countDocuments({
      organizationId,
      role: "agent",
      inviteStatus: "active",
    });

    const pendingInvites = await Membership.countDocuments({
      organizationId,
      inviteStatus: "pending",
    });

    // Online agents — join through populated user
    const agentMemberships = await Membership.find({
      organizationId,
      role: "agent",
      inviteStatus: "active",
    }).populate("userId", "status");

    const onlineAgents = agentMemberships.filter(
      (m) => (m.userId as any)?.status === "online",
    ).length;

    const recentMembers = await Membership.find({
      organizationId,
      inviteStatus: { $in: ["active", "pending"] },
    })
      .populate("userId", "name email")
      .select("role inviteStatus createdAt")
      .sort({ createdAt: -1 })
      .limit(5);

    return {
      overview: { totalAgents, onlineAgents, pendingInvites },
      recentAgents: recentMembers.map((m: any) => ({
        _id: m._id,
        name: m.userId?.name,
        email: m.userId?.email,
        role: m.role,
        inviteStatus: m.inviteStatus,
        createdAt: m.createdAt,
      })),
    };
  }
}
