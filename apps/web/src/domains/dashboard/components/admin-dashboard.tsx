import { MetricCard } from "../components/metric-card";
import { Card } from "@/shared/ui/card";
import {
  MessageSquare,
  Globe,
  Bot,
  Clock,
  UserCheck,
  BookOpen,
  QrCode,
} from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/shared/ui/chart";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { useAnalyticsSummary, useAnalyticsTrends } from "../hooks/use-analytics";
import { Loader } from "@/shared/ui/loader";

const messageChartConfig = {
  ai: {
    label: "AI Messages",
    color: "#845C6C",
  },
  agent: {
    label: "Agent Messages",
    color: "#2F6D6B",
  },
};

const conversationChartConfig = {
  started: {
    label: "Started",
    color: "#845C6C",
  },
  resolved: {
    label: "Resolved",
    color: "#10b981",
  },
  closed: {
    label: "Closed",
    color: "#f59e0b",
  },
};

const formatDuration = (ms?: number | null) => {
  if (!ms) return "—";
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
};

export function AdminDashboard() {
  const { data: summary, isLoading: summaryLoading } = useAnalyticsSummary();
  const { data: trends, isLoading: trendsLoading } = useAnalyticsTrends(7);

  if (summaryLoading || trendsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Support operations and team performance insights.
        </p>
      </div>

      {/* Main Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Conversations Started"
          value={summary?.totalConversations || 0}
          icon={MessageSquare}
          description="Last 30 days"
        />
        <MetricCard
          title="AI Deflection Rate"
          value={`${summary?.aiDeflectionRate ?? 100}%`}
          changeType="positive"
          icon={Bot}
          description="AI responses without fallback"
        />
        <MetricCard
          title="Widget Loads"
          value={summary?.widgetLoads || 0}
          icon={Globe}
          description={`Conversion ${summary?.widgetConversionRate ?? 0}%`}
        />
        <MetricCard
          title="Agent Assignments"
          value={summary?.agentAssignments || 0}
          icon={UserCheck}
          description="Last 30 days"
        />
        <MetricCard
          title="First Response"
          value={formatDuration(summary?.avgFirstResponseTimeMs)}
          icon={Clock}
          description="Avg time to first reply"
        />
        <MetricCard
          title="AI Messages"
          value={summary?.aiMessages || 0}
          icon={Bot}
          description="Total AI replies"
        />
        <MetricCard
          title="Knowledge Views"
          value={summary?.knowledgeViews || 0}
          icon={BookOpen}
          description="Docs opened"
        />
        <MetricCard
          title="QR Scans"
          value={summary?.qrScans || 0}
          icon={QrCode}
          description="Chat entry scans"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Message Volume (Last 7 Days)</h3>
          <div className="h-87.5 w-full">
            <ChartContainer config={messageChartConfig} className="h-full w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends?.messages || []}>
                  <defs>
                    <linearGradient id="colorAi" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#845C6C" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#845C6C" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorAgent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2F6D6B" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2F6D6B" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                    tickFormatter={(str) => {
                      const date = new Date(str);
                      return date.toLocaleDateString('en-US', { weekday: 'short' });
                    }}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="ai"
                    stroke="#845C6C"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorAi)"
                    stackId="messages"
                  />
                  <Area
                    type="monotone"
                    dataKey="agent"
                    stroke="#2F6D6B"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorAgent)"
                    stackId="messages"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Conversation Outcomes (Last 7 Days)</h3>
          <div className="h-87.5 w-full">
            <ChartContainer config={conversationChartConfig} className="h-full w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends?.conversations || []}>
                  <defs>
                    <linearGradient id="colorStarted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#845C6C" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#845C6C" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorClosed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    tickFormatter={(str) => {
                      const date = new Date(str);
                      return date.toLocaleDateString("en-US", { weekday: "short" });
                    }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="started"
                    stroke="#845C6C"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorStarted)"
                  />
                  <Area
                    type="monotone"
                    dataKey="resolved"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorResolved)"
                  />
                  <Area
                    type="monotone"
                    dataKey="closed"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorClosed)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
