import { AnalyticsEvent, Conversation } from "@shared/models";
import dayjs from "dayjs";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";

dayjs.extend(isSameOrBefore);

export class AnalyticsService {
  static async getOwnerSummary(organizationId: string, days = 30) {
    const startDate = dayjs().subtract(days - 1, "days").startOf("day").toDate();

    const [conversationAgg, usersServedAgg, resolutionAgg, questionAgg, widgetLoadAgg, sourceAgg, tokenAgg] =
      await Promise.all([
        Conversation.aggregate([
          {
            $match: {
              organizationId,
              createdAt: { $gte: startDate },
            },
          },
          {
            $group: {
              _id: null,
              totalConversations: { $sum: 1 },
              resolvedConversations: {
                $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] },
              },
              escalatedConversations: {
                $sum: {
                  $cond: [
                    {
                      $or: [
                        { $ne: ["$assignedTo", null] },
                        { $ifNull: ["$metadata.escalatedAt", false] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ]),
        Conversation.aggregate([
          {
            $match: {
              organizationId,
              createdAt: { $gte: startDate },
              "visitor.sessionId": { $exists: true, $ne: "" },
            },
          },
          {
            $group: {
              _id: "$visitor.sessionId",
            },
          },
          { $count: "totalUsersServed" },
        ]),
        Conversation.aggregate([
          {
            $match: {
              organizationId,
              createdAt: { $gte: startDate },
              status: { $in: ["resolved", "closed"] },
              closedAt: { $ne: null },
            },
          },
          {
            $project: {
              resolutionMs: { $subtract: ["$closedAt", "$createdAt"] },
            },
          },
          {
            $group: {
              _id: null,
              avgResolutionTimeMs: { $avg: "$resolutionMs" },
            },
          },
        ]),
        Conversation.aggregate([
          {
            $match: {
              organizationId,
              createdAt: { $gte: startDate },
              "metadata.customer.initialMessage": { $exists: true, $type: "string", $ne: "" },
            },
          },
          {
            $project: {
              question: {
                $toLower: {
                  $trim: { input: "$metadata.customer.initialMessage" },
                },
              },
            },
          },
          {
            $group: {
              _id: "$question",
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
          { $limit: 5 },
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
              type: "widget_load",
              eventTime: { $gte: startDate },
            },
          },
          {
            $count: "widgetLoads",
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
              eventTime: { $gte: startDate },
              $or: [
                { channel: "widget" },
                { type: "qr_scan" },
              ],
            },
          },
          {
            $project: {
              source: {
                $cond: [{ $eq: ["$type", "qr_scan"] }, "qr", "widget"],
              },
            },
          },
          {
            $group: {
              _id: "$source",
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
              eventTime: { $gte: startDate },
              type: { $in: ["ai_response", "ai_token_usage"] },
            },
          },
          {
            $project: {
              promptTokens: { $ifNull: ["$metadata.promptTokens", 0] },
              completionTokens: { $ifNull: ["$metadata.completionTokens", 0] },
              totalTokens: {
                $ifNull: [
                  "$metadata.totalTokens",
                  {
                    $add: [
                      { $ifNull: ["$metadata.promptTokens", 0] },
                      { $ifNull: ["$metadata.completionTokens", 0] },
                    ],
                  },
                ],
              },
              estimatedCostUsd: { $ifNull: ["$metadata.estimatedCostUsd", 0] },
            },
          },
          {
            $group: {
              _id: null,
              promptTokens: { $sum: "$promptTokens" },
              completionTokens: { $sum: "$completionTokens" },
              totalTokens: { $sum: "$totalTokens" },
              estimatedCostUsd: { $sum: "$estimatedCostUsd" },
            },
          },
        ]),
      ]);

    const conv = conversationAgg[0] || {
      totalConversations: 0,
      resolvedConversations: 0,
      escalatedConversations: 0,
    };

    const humanEscalationRate = conv.totalConversations > 0
      ? Math.round((conv.escalatedConversations / conv.totalConversations) * 100)
      : 0;

    const source = { widget: 0, qr: 0 };
    sourceAgg.forEach((row) => {
      if (row._id in source) {
        source[row._id as "widget" | "qr"] = row.count;
      }
    });

    const ai = tokenAgg[0] || {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
    };

    return {
      totalConversations: conv.totalConversations,
      resolvedConversations: conv.resolvedConversations,
      totalUsersServed: usersServedAgg[0]?.totalUsersServed || 0,
      humanEscalationRate,
      avgResolutionTimeMs: resolutionAgg[0]?.avgResolutionTimeMs
        ? Math.round(resolutionAgg[0].avgResolutionTimeMs)
        : null,
      widgetLoads: widgetLoadAgg[0]?.widgetLoads || 0,
      mostAskedQuestions: questionAgg.map((q) => ({ question: q._id, count: q.count })),
      source,
      aiCost: {
        promptTokens: ai.promptTokens,
        completionTokens: ai.completionTokens,
        totalTokens: ai.totalTokens,
        estimatedCostUsd: Number(ai.estimatedCostUsd || 0),
      },
    };
  }

  static async getOwnerTrends(organizationId: string, days = 7) {
    const startDate = dayjs().subtract(days - 1, "days").startOf("day").toDate();
    const endDate = dayjs().endOf("day");

    const [eventRows, aiCostRows] = await Promise.all([
      AnalyticsEvent.aggregate([
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
                "conversation_resolved",
                "conversation_closed",
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
            eventTime: { $gte: startDate },
            type: { $in: ["ai_response", "ai_token_usage"] },
          },
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: "%Y-%m-%d", date: "$eventTime" } },
            },
            promptTokens: { $sum: { $ifNull: ["$metadata.promptTokens", 0] } },
            completionTokens: { $sum: { $ifNull: ["$metadata.completionTokens", 0] } },
            totalTokens: {
              $sum: {
                $ifNull: [
                  "$metadata.totalTokens",
                  {
                    $add: [
                      { $ifNull: ["$metadata.promptTokens", 0] },
                      { $ifNull: ["$metadata.completionTokens", 0] },
                    ],
                  },
                ],
              },
            },
            estimatedCostUsd: { $sum: { $ifNull: ["$metadata.estimatedCostUsd", 0] } },
          },
        },
        { $sort: { "_id.date": 1 } },
      ]),
    ]);

    const dates: string[] = [];
    let cursor = dayjs(startDate);
    while (cursor.isSameOrBefore(endDate, "day")) {
      dates.push(cursor.format("YYYY-MM-DD"));
      cursor = cursor.add(1, "day");
    }

    const conversationStatus = dates.map((date) => ({ date, started: 0, resolved: 0, opened: 0 }));
    const messageVolume = dates.map((date) => ({ date, ai: 0, agent: 0 }));
    const aiCost = dates.map((date) => ({ date, promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0 }));

    const statusByDate = new Map(conversationStatus.map((row) => [row.date, row]));
    const messageByDate = new Map(messageVolume.map((row) => [row.date, row]));
    const costByDate = new Map(aiCost.map((row) => [row.date, row]));

    eventRows.forEach((row) => {
      const date = row._id.date as string;
      const type = row._id.type as string;
      const category = row._id.category as string;
      const count = row.count as number;

      if (type === "message_sent") {
        const target = messageByDate.get(date);
        if (target && (category === "ai" || category === "agent")) {
          target[category] += count;
        }
      }

      if (type === "conversation_started" || type === "conversation_resolved" || type === "conversation_closed") {
        const target = statusByDate.get(date);
        if (target) {
          if (type === "conversation_started") target.started += count;
          if (type === "conversation_resolved") target.resolved += count;
          if (type === "conversation_closed") target.resolved += count;
        }
      }
    });

    aiCostRows.forEach((row) => {
      const date = row._id.date as string;
      const target = costByDate.get(date);
      if (!target) return;

      target.promptTokens += row.promptTokens || 0;
      target.completionTokens += row.completionTokens || 0;
      target.totalTokens += row.totalTokens || 0;
      target.estimatedCostUsd += row.estimatedCostUsd || 0;
    });

    let runningOpen = 0;
    conversationStatus.forEach((row) => {
      runningOpen += row.started;
      runningOpen -= row.resolved;
      row.opened = Math.max(runningOpen, 0);
    });

    return {
      conversationStatus,
      messageVolume,
      aiCost,
    };
  }

}
