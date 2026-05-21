import { AnalyticsEvent } from "@shared/models";
import dayjs from "dayjs";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";

dayjs.extend(isSameOrBefore);

export class AnalyticsService {
  /**
   * Get a summary of key metrics for an organization
   */
  static async getSummary(organizationId: string) {
    const thirtyDaysAgo = dayjs().subtract(30, "days").toDate();

    const [stats, messageByCategory, firstResponseAvg] = await Promise.all([
      AnalyticsEvent.aggregate([
        {
          $addFields: {
            eventTime: { $ifNull: ["$occurredAt", "$createdAt"] },
          },
        },
        {
          $match: {
            organizationId,
            eventTime: { $gte: thirtyDaysAgo },
          },
        },
        {
          $group: {
            _id: "$type",
            count: { $sum: 1 },
          },
        },
      ]),
      AnalyticsEvent.aggregate([
        {
          $addFields: {
            eventTime: { $ifNull: ["$occurredAt", "$createdAt"] },
          },
        },
        {
          $match: {
            organizationId,
            type: "message_sent",
            eventTime: { $gte: thirtyDaysAgo },
          },
        },
        {
          $group: {
            _id: "$category",
            count: { $sum: 1 },
          },
        },
      ]),
      AnalyticsEvent.aggregate([
        {
          $addFields: {
            eventTime: { $ifNull: ["$occurredAt", "$createdAt"] },
          },
        },
        {
          $match: {
            organizationId,
            type: "agent_first_response",
            eventTime: { $gte: thirtyDaysAgo },
          },
        },
        {
          $group: {
            _id: null,
            avgResponseTimeMs: { $avg: "$metadata.responseTimeMs" },
          },
        },
      ]),
    ]);

    const summary: Record<string, number> = {
      message_sent: 0,
      fallback_triggered: 0,
      widget_load: 0,
      conversation_started: 0,
      conversation_closed: 0,
      conversation_resolved: 0,
      agent_assigned: 0,
      ai_response: 0,
      knowledge_view: 0,
      qr_scan: 0,
    };

    stats.forEach((s) => {
      if (s._id in summary) {
        summary[s._id] = s.count;
      }
    });

    const messageCounts: Record<string, number> = { ai: 0, agent: 0 };
    messageByCategory.forEach((row) => {
      if (row._id in messageCounts) {
        messageCounts[row._id] = row.count;
      }
    });

    const aiResponses = summary.ai_response || 0;
    const fallbacks = summary.fallback_triggered || 0;
    const deflectionRate = aiResponses > 0
      ? Math.round(((aiResponses - fallbacks) / aiResponses) * 100)
      : 100;

    const widgetLoads = summary.widget_load || 0;
    const conversationStarts = summary.conversation_started || 0;
    const widgetConversionRate = widgetLoads > 0
      ? Math.round((conversationStarts / widgetLoads) * 100)
      : 0;

    const avgResponseTimeMs = firstResponseAvg[0]?.avgResponseTimeMs
      ? Math.round(firstResponseAvg[0].avgResponseTimeMs)
      : null;

    return {
      totalConversations: conversationStarts,
      fallbacks,
      aiDeflectionRate: deflectionRate,
      widgetLoads,
      widgetConversionRate,
      conversationsResolved: summary.conversation_resolved,
      conversationsClosed: summary.conversation_closed,
      agentAssignments: summary.agent_assigned,
      aiMessages: messageCounts.ai,
      agentMessages: messageCounts.agent,
      knowledgeViews: summary.knowledge_view,
      qrScans: summary.qr_scan,
      avgFirstResponseTimeMs: avgResponseTimeMs,
    };
  }

  /**
   * Get daily volume trends for charts
   */
  static async getTrends(organizationId: string, days = 7) {
    const startDate = dayjs().subtract(days, "days").startOf("day").toDate();
    const endDate = dayjs().endOf("day");

    const trends = await AnalyticsEvent.aggregate([
      {
        $addFields: {
          eventTime: { $ifNull: ["$occurredAt", "$createdAt"] },
        },
      },
      {
        $match: {
          organizationId,
          eventTime: { $gte: startDate },
          type: {
            $in: [
              "message_sent",
              "conversation_started",
              "conversation_closed",
              "conversation_resolved",
              "agent_assigned",
            ],
          },
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$eventTime" } },
            type: "$type",
            category: "$category",
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.date": 1 } },
    ]);

    const dates: string[] = [];
    let cursor = dayjs(startDate);
    while (cursor.isSameOrBefore(endDate, "day")) {
      dates.push(cursor.format("YYYY-MM-DD"));
      cursor = cursor.add(1, "day");
    }

    const messages = dates.map((date) => ({ date, ai: 0, agent: 0 }));
    const conversations = dates.map((date) => ({ date, started: 0, resolved: 0, closed: 0 }));
    const assignments = dates.map((date) => ({ date, assigned: 0 }));

    const messageIndex = new Map(messages.map((row) => [row.date, row]));
    const conversationIndex = new Map(conversations.map((row) => [row.date, row]));
    const assignmentIndex = new Map(assignments.map((row) => [row.date, row]));

    trends.forEach((row) => {
      const date = row._id.date as string;
      const type = row._id.type as string;
      const category = row._id.category as string;
      const count = row.count as number;

      if (type === "message_sent") {
        const target = messageIndex.get(date);
        if (target && (category === "ai" || category === "agent")) {
          target[category] += count;
        }
      }

      if (type === "conversation_started" || type === "conversation_resolved" || type === "conversation_closed") {
        const target = conversationIndex.get(date);
        if (target) {
          if (type === "conversation_started") target.started += count;
          if (type === "conversation_resolved") target.resolved += count;
          if (type === "conversation_closed") target.closed += count;
        }
      }

      if (type === "agent_assigned") {
        const target = assignmentIndex.get(date);
        if (target) target.assigned += count;
      }
    });

    return {
      messages,
      conversations,
      assignments,
    };
  }
}
