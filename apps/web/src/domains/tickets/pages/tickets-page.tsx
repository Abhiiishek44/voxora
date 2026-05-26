import { useEffect, useState } from "react";
import {
  Ticket as TicketIcon,
  AlertCircle,
  Plus,
  Tag,
  MessageSquare,
  ClipboardList,
  RefreshCw,
  Search,
  CheckCircle,
  Clock,
  User,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { membersApi } from "@/domains/member/api/members.api";
import type { Ticket } from "../types/types";
import type { Member } from "@/domains/member/types/types";
import {
  useTickets,
  useCreateTicket,
  useUpdateTicket,
  useAddTicketNote,
  useAssignTicket,
  useUpdateTicketStatus,
} from "../hooks";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Label } from "@/shared/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/ui/dialog";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/shared/ui/pagination";

export function TicketsPage() {
  // State for members (for assignment dropdown)
  const [members, setMembers] = useState<Member[]>([]);

  // State for filters
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [assignedToFilter, setAssignedToFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // State for creating a ticket
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTicketTitle, setNewTicketTitle] = useState("");
  const [newTicketDesc, setNewTicketDesc] = useState("");
  const [newTicketPriority, setNewTicketPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [newTicketTags, setNewTicketTags] = useState("");

  // State for viewing ticket details (drawer/modal)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [newNoteContent, setNewNoteContent] = useState("");

  // React Query Hooks
  const {
    data: ticketsData,
    isLoading: loading,
    refetch: refetchTickets,
    isRefetching: refreshing,
  } = useTickets({
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
    assignedTo: assignedToFilter || undefined,
    page: currentPage,
    limit: 10,
  });

  const tickets = ticketsData?.data?.tickets || [];
  const totalTickets = ticketsData?.data?.total || 0;
  const totalPages = ticketsData?.data?.pages || 1;

  const createTicketMutation = useCreateTicket();
  const assignTicketMutation = useAssignTicket();
  const updateStatusMutation = useUpdateTicketStatus();
  const updateTicketMutation = useUpdateTicket();
  const addNoteMutation = useAddTicketNote();

  const fetchMembers = async () => {
    try {
      const response = await membersApi.listMembers();
      if (response.success && response.data?.members) {
        // Filter out pending/inactive members
        const activeMembers = response.data.members.filter(
          (m) => m.inviteStatus === "active" && m.user
        );
        setMembers(activeMembers);
      }
    } catch (error) {
      console.error("Failed to fetch members:", error);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  // Handle Ticket Assignment
  const handleAssignTicket = (ticketId: string, memberUserId: string | null) => {
    assignTicketMutation.mutate(
      { ticketId, memberId: memberUserId },
      {
        onSuccess: (res) => {
          if (res.success && res.data?.ticket) {
            const updated = res.data.ticket;
            if (selectedTicket && selectedTicket.id === ticketId) {
              setSelectedTicket(updated);
            }
          }
        },
      }
    );
  };

  // Handle Ticket Status Change
  const handleUpdateStatus = (ticketId: string, status: "open" | "in_progress" | "resolved" | "closed") => {
    updateStatusMutation.mutate(
      { ticketId, status },
      {
        onSuccess: (res) => {
          if (res.success && res.data?.ticket) {
            const updated = res.data.ticket;
            if (selectedTicket && selectedTicket.id === ticketId) {
              setSelectedTicket(updated);
            }
          }
        },
      }
    );
  };

  // Handle Ticket Priority Change
  const handleUpdatePriority = (ticketId: string, priority: "low" | "medium" | "high" | "urgent") => {
    updateTicketMutation.mutate(
      { ticketId, data: { priority } },
      {
        onSuccess: (res) => {
          if (res.success && res.data?.ticket) {
            const updated = res.data.ticket;
            if (selectedTicket && selectedTicket.id === ticketId) {
              setSelectedTicket(updated);
            }
          }
        },
      }
    );
  };

  // Handle Creating Ticket
  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicketTitle.trim()) return;

    const tagsArray = newTicketTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    createTicketMutation.mutate(
      {
        title: newTicketTitle,
        description: newTicketDesc || undefined,
        priority: newTicketPriority,
        tags: tagsArray,
      },
      {
        onSuccess: () => {
          setIsCreateOpen(false);
          setNewTicketTitle("");
          setNewTicketDesc("");
          setNewTicketPriority("medium");
          setNewTicketTags("");
        },
      }
    );
  };

  // Handle Adding a Note
  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !newNoteContent.trim()) return;

    addNoteMutation.mutate(
      { ticketId: selectedTicket.id, content: newNoteContent },
      {
        onSuccess: (res) => {
          if (res.success && res.data?.ticket) {
            setSelectedTicket(res.data.ticket);
            setNewNoteContent("");
          }
        },
      }
    );
  };

  // Get status color matching design theme
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 border border-primary/20 text-primary dark:text-primary-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Open
          </span>
        );
      case "in_progress":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-warning/10 border border-warning/20 text-warning">
            <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />
            In Progress
          </span>
        );
      case "resolved":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-success/10 border border-success/20 text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Resolved
          </span>
        );
      case "closed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-secondary/10 border border-secondary/20 text-secondary-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
            Closed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted/40 border border-border text-muted-foreground capitalize">
            {status}
          </span>
        );
    }
  };

  // Get priority color matching design theme
  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "low":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted border border-border text-muted-foreground capitalize">
            Low
          </span>
        );
      case "medium":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 border border-primary/20 text-primary dark:text-primary-foreground capitalize">
            Medium
          </span>
        );
      case "high":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-warning/10 border border-warning/20 text-warning capitalize">
            High
          </span>
        );
      case "urgent":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-destructive/10 border border-destructive/20 text-destructive animate-pulse capitalize">
            <span className="h-1 w-1 rounded-full bg-destructive animate-ping mr-1" />
            Urgent
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted/40 border border-border text-muted-foreground capitalize">
            {priority}
          </span>
        );
    }
  };

  // Filter local tickets by search query on title/number
  const filteredTickets = tickets.filter((t) => {
    const term = searchQuery.toLowerCase().trim();
    if (!term) return true;
    return (
      t.title.toLowerCase().includes(term) ||
      (t.ticketNumber && t.ticketNumber.toLowerCase().includes(term))
    );
  });

  // Calculate metrics
  const openCount = tickets.filter((t) => t.status === "open").length;
  const inProgressCount = tickets.filter((t) => t.status === "in_progress").length;
  const unassignedCount = tickets.filter((t) => !t.assignedTo).length;

  // Generate pagination items using custom Pagination components
  const renderPaginationItems = () => {
    const items = [];
    
    // Previous page button
    items.push(
      <PaginationItem key="prev">
        <PaginationPrevious
          onClick={() => {
            if (currentPage > 1) setCurrentPage(currentPage - 1);
          }}
          className={currentPage === 1 ? "opacity-40 pointer-events-none" : "cursor-pointer"}
        />
      </PaginationItem>
    );

    // Dynamic numeric links and ellipses
    for (let i = 1; i <= totalPages; i++) {
      if (totalPages <= 5 || i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink
              isActive={currentPage === i}
              onClick={() => setCurrentPage(i)}
              className="cursor-pointer"
            >
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      } else if (
        (i === 2 && currentPage > 3) ||
        (i === totalPages - 1 && currentPage < totalPages - 2)
      ) {
        items.push(
          <PaginationItem key={`ellipsis-${i}`}>
            <PaginationEllipsis />
          </PaginationItem>
        );
      }
    }

    // Next page button
    items.push(
      <PaginationItem key="next">
        <PaginationNext
          onClick={() => {
            if (currentPage < totalPages) setCurrentPage(currentPage + 1);
          }}
          className={currentPage === totalPages ? "opacity-40 pointer-events-none" : "cursor-pointer"}
        />
      </PaginationItem>
    );

    return items;
  };

  return (
    <div className="space-y-6">
      {/* Upper header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <TicketIcon className="h-6 w-6 text-primary" />
            Tickets Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage customer support inquiries, assign tickets, and track resolution.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchTickets()}
            disabled={refreshing}
            className="cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="cursor-pointer">
                <Plus className="h-4 w-4 mr-1.5" />
                Create Ticket
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg bg-card border-border">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <TicketIcon className="h-5 w-5 text-primary" />
                  Create Support Ticket
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateTicket} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="title">Ticket Title</Label>
                  <Input
                    id="title"
                    required
                    placeholder="Short summary of the issue..."
                    value={newTicketTitle}
                    onChange={(e) => setNewTicketTitle(e.target.value)}
                    className="cursor-text"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="description">Detailed Description</Label>
                  <Textarea
                    id="description"
                    rows={4}
                    placeholder="Steps to reproduce, user context, or support notes..."
                    value={newTicketDesc}
                    onChange={(e) => setNewTicketDesc(e.target.value)}
                    className="cursor-text"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="priority">Priority</Label>
                    <select
                      id="priority"
                      value={newTicketPriority}
                      onChange={(e) => setNewTicketPriority(e.target.value as any)}
                      className="w-full h-8 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="tags">Tags (comma separated)</Label>
                    <Input
                      id="tags"
                      placeholder="bug, billing, v1"
                      value={newTicketTags}
                      onChange={(e) => setNewTicketTags(e.target.value)}
                      className="cursor-text"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateOpen(false)}
                    className="cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createTicketMutation.isPending} className="cursor-pointer">
                    {createTicketMutation.isPending ? "Creating..." : "Create Ticket"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card/60 backdrop-blur-sm p-5 shadow-sm hover:shadow-md transition-all duration-300 hover:border-primary/20">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">Total Tickets</p>
              <h4 className="text-2xl font-extrabold tracking-tight mt-0.5">{totalTickets}</h4>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card/60 backdrop-blur-sm p-5 shadow-sm hover:shadow-md transition-all duration-300 hover:border-sky-500/20">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-500">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">Open Tickets</p>
              <h4 className="text-2xl font-extrabold tracking-tight mt-0.5">{openCount}</h4>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card/60 backdrop-blur-sm p-5 shadow-sm hover:shadow-md transition-all duration-300 hover:border-amber-500/20">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <User className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">Unassigned</p>
              <h4 className="text-2xl font-extrabold tracking-tight mt-0.5">{unassignedCount}</h4>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card/60 backdrop-blur-sm p-5 shadow-sm hover:shadow-md transition-all duration-300 hover:border-emerald-500/20">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
              <CheckCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">Active in Progress</p>
              <h4 className="text-2xl font-extrabold tracking-tight mt-0.5">{inProgressCount}</h4>
            </div>
          </div>
        </div>
      </div>

      {/* Main filter container */}
      <div className="rounded-xl border border-border bg-card shadow-sm p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {/* Quick status filter buttons */}
          <div className="flex items-center gap-1 overflow-x-auto pb-2 md:pb-0">
            {[
              { label: "All", value: "" },
              { label: "Open", value: "open" },
              { label: "In Progress", value: "in_progress" },
              { label: "Resolved", value: "resolved" },
              { label: "Closed", value: "closed" },
            ].map((tab) => (
              <Button
                key={tab.value}
                variant={statusFilter === tab.value ? "secondary" : "ghost"}
                size="sm"
                onClick={() => {
                  setStatusFilter(tab.value);
                  setCurrentPage(1);
                }}
                className="cursor-pointer shrink-0 rounded-lg text-xs"
              >
                {tab.label}
              </Button>
            ))}
          </div>

          {/* Search and select inputs */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ticket title or #..."
                className="pl-9 cursor-text h-8 text-xs"
              />
            </div>

            <select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-8 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>

            <select
              value={assignedToFilter}
              onChange={(e) => {
                setAssignedToFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-8 max-w-[180px] rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">All Assignments</option>
              <option value="unassigned">Unassigned</option>
              {members.map((m) => (
                <option key={m.user._id} value={m.user._id}>
                  {m.user.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tickets List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle className="h-10 w-10 text-muted-foreground/45 mb-3" />
            <h5 className="font-semibold text-base">No tickets found</h5>
            <p className="text-sm text-muted-foreground mt-1">
              Try adjusting your filter settings or create a new support ticket.
            </p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground">
                  <th className="p-3 w-[100px]">Ticket #</th>
                  <th className="p-3">Title</th>
                  <th className="p-3 w-[120px]">Status</th>
                  <th className="p-3 w-[120px]">Priority</th>
                  <th className="p-3 w-[180px]">Assigned Agent</th>
                  <th className="p-3 w-[100px]">Source</th>
                  <th className="p-3 w-[100px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-sm">
                {filteredTickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    onClick={() => setSelectedTicket(ticket)}
                    className="hover:bg-muted/50 dark:hover:bg-muted/30 cursor-pointer select-none transition-all duration-150 group/row border-b border-border/40 last:border-0"
                  >
                    <td className="p-3 font-mono text-xs font-semibold text-primary/80">
                      #{ticket.ticketNumber || ticket.id.slice(-6).toUpperCase()}
                    </td>
                    <td className="p-3 font-medium text-foreground">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-semibold tracking-tight text-foreground group-hover/row:text-primary transition-colors">
                          {ticket.title}
                        </span>
                        {ticket.tags && ticket.tags.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            {ticket.tags.map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent text-accent-foreground border border-primary/20 transition-all hover:bg-accent/80"
                              >
                                <Tag className="h-2.5 w-2.5 opacity-70" />
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-3">{getStatusBadge(ticket.status)}</td>
                    <td className="p-3">{getPriorityBadge(ticket.priority)}</td>
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={ticket.assignedTo?.id || ""}
                        onChange={(e) =>
                          handleAssignTicket(ticket.id, e.target.value || null)
                        }
                        className="h-7 w-full cursor-pointer rounded-lg border border-border/80 bg-background/50 hover:bg-background px-2 py-0.5 text-xs shadow-sm transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary"
                      >
                        <option value="">Unassigned</option>
                        {members.map((m) => (
                          <option key={m.user._id} value={m.user._id}>
                            {m.user.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80 capitalize">
                        {ticket.source}
                      </span>
                    </td>
                    <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => setSelectedTicket(ticket)}
                        className="cursor-pointer"
                      >
                        Details
                        <ChevronRight className="h-3 w-3 ml-0.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination using shared Pagination components */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between border-t border-border/40 pt-4 mt-4 gap-4">
            <p className="text-xs text-muted-foreground">
              Showing page {currentPage} of {totalPages}
            </p>
            <Pagination className="w-auto mx-0">
              <PaginationContent>
                {renderPaginationItems()}
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>

      {/* Sliding Dialog/Modal for Ticket Details & Internal Activity */}
      {selectedTicket && (
        <Dialog
          open={!!selectedTicket}
          onOpenChange={(open) => {
            if (!open) setSelectedTicket(null);
          }}
        >
          <DialogContent className="sm:max-w-5xl md:max-w-6xl w-[92vw] max-h-[90vh] flex flex-col p-0 overflow-hidden bg-card border-border">
            <DialogHeader className="px-6 py-4 border-b border-border bg-muted/20 shrink-0">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-muted-foreground">
                    Ticket #{selectedTicket.ticketNumber || selectedTicket.id.slice(-6).toUpperCase()}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {selectedTicket.conversationId && (
                      <a
                        href={`/dashboard/conversations/inbox/chat/${selectedTicket.conversationId}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 transition-all mr-4 shadow-sm"
                      >
                        View Inbox Chat
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  <TicketIcon className="h-5 w-5 text-primary" />
                  {selectedTicket.title}
                </DialogTitle>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Main notes and activity feed */}
              <div className="md:col-span-2 space-y-6 flex flex-col min-h-[400px]">
                {/* Description block */}
                <div className="space-y-1.5">
                  <h5 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    Description
                  </h5>
                  <div className="rounded-lg bg-muted/40 p-4 border border-border/40 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {selectedTicket.description || (
                      <span className="italic text-muted-foreground">No description provided.</span>
                    )}
                  </div>
                </div>

                {/* Tag list */}
                {selectedTicket.tags && selectedTicket.tags.length > 0 && (
                  <div className="space-y-1.5">
                    <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Categorization Tags
                    </h5>
                    <div className="flex flex-wrap gap-2">
                      {selectedTicket.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent text-accent-foreground border border-primary/20 transition-all hover:bg-accent/80"
                        >
                          <Tag className="h-3 w-3 opacity-70" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes/Activity history */}
                <div className="flex-1 space-y-3 flex flex-col min-h-0">
                  <h5 className="text-sm font-semibold text-foreground flex items-center gap-1.5 shrink-0">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    Internal Notes & Activity Log
                  </h5>

                  <div className="flex-1 overflow-y-auto border border-border rounded-lg bg-background p-3 min-h-[200px] space-y-3">
                    {selectedTicket.notes && selectedTicket.notes.length > 0 ? (
                      <div className="space-y-3">
                        {selectedTicket.notes.map((note) => (
                          <div
                            key={note.id}
                            className={`p-4 rounded-xl border text-sm leading-relaxed transition-all shadow-sm ${
                              note.authorType === "ai"
                                ? "bg-gradient-to-br from-violet-500/5 to-indigo-500/5 border-violet-500/20 dark:border-violet-500/30 shadow-violet-500/5"
                                : "bg-muted/40 border-border/60"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-semibold text-foreground flex items-center gap-1.5">
                                {note.authorType === "ai" && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm scale-90 uppercase tracking-wider">
                                    AI
                                  </span>
                                )}
                                {note.author}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(note.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-foreground whitespace-pre-wrap">{note.content}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-center h-full">
                        <MessageSquare className="h-8 w-8 text-muted-foreground/35 mb-2" />
                        <p className="text-xs text-muted-foreground">
                          No notes have been added to this ticket yet.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Add a note form */}
                <form onSubmit={handleAddNote} className="space-y-3 shrink-0">
                  <Textarea
                    placeholder="Type an internal note to log progress..."
                    rows={2}
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    className="cursor-text text-sm"
                  />
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={addNoteMutation.isPending || !newNoteContent.trim()}
                      className="cursor-pointer"
                    >
                      {addNoteMutation.isPending ? "Adding Note..." : "Add Internal Note"}
                    </Button>
                  </div>
                </form>
              </div>

              {/* Sidebar metadata & status controls */}
              <div className="space-y-6 border-l border-border pl-0 md:pl-6">
                {/* Status card */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Ticket Status
                  </Label>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(selectedTicket.status)}
                  </div>
                  <select
                    value={selectedTicket.status}
                    onChange={(e) =>
                      handleUpdateStatus(selectedTicket.id, e.target.value as any)
                    }
                    className="w-full h-8 cursor-pointer rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>

                {/* Priority selector */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Priority Level
                  </Label>
                  <div className="flex items-center gap-2">
                    {getPriorityBadge(selectedTicket.priority)}
                  </div>
                  <select
                    value={selectedTicket.priority}
                    onChange={(e) =>
                      handleUpdatePriority(selectedTicket.id, e.target.value as any)
                    }
                    className="w-full h-8 cursor-pointer rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                {/* Assign Agent card */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Assigned Agent
                  </Label>
                  <div className="text-xs text-foreground mb-1.5 flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {selectedTicket.assignedTo ? (
                      <div>
                        <p className="font-semibold">{selectedTicket.assignedTo.name}</p>
                        <p className="text-muted-foreground text-[10px]">{selectedTicket.assignedTo.email}</p>
                      </div>
                    ) : (
                      <span className="italic text-muted-foreground font-medium">Unassigned / Awaiting Claim</span>
                    )}
                  </div>
                  <select
                    value={selectedTicket.assignedTo?.id || ""}
                    onChange={(e) =>
                      handleAssignTicket(selectedTicket.id, e.target.value || null)
                    }
                    className="w-full h-8 cursor-pointer rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.user._id} value={m.user._id}>
                        {m.user.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Metadata card */}
                <div className="space-y-3 rounded-lg border border-border/80 bg-muted/30 p-4">
                  <h6 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    Metadata Details
                  </h6>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Source:</span>
                      <span className="font-medium capitalize">{selectedTicket.source}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Created At:</span>
                      <span className="font-medium text-right">
                        {new Date(selectedTicket.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last Updated:</span>
                      <span className="font-medium text-right">
                        {new Date(selectedTicket.updatedAt).toLocaleString()}
                      </span>
                    </div>
                    {selectedTicket.resolvedAt && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Resolved At:</span>
                        <span className="font-medium text-right text-success">
                          {new Date(selectedTicket.resolvedAt).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {selectedTicket.closedAt && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Closed At:</span>
                        <span className="font-medium text-right text-muted-foreground">
                          {new Date(selectedTicket.closedAt).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedTicket(null)}
                    className="w-full cursor-pointer"
                  >
                    Close Drawer
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
