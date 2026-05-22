import { buildContext } from "./context-builder.service";
import { getDefaultProvider } from "../../../infrastructure/providers/llm";
import { LLMMessage } from "../../../infrastructure/providers/llm/types";
import {
  publishResponse,
  publishEscalation,
} from "../../../infrastructure/queue/reply.queue";
import { AIJobData } from "../chat.types";
import { getAllTools } from "../../agents/tools";
import {
  getConversationGate,
  invalidateConversationGate,
} from "../../../infrastructure/cache";
import { detectEscalation } from "../routing/escalation.handler";
import { publishStreamWithSeq } from "../services/stream.service";

function shouldSkipConversation(gate: {
  status?: string;
  assignedTo?: string | null;
  metadata?: { escalatedAt?: string | null; humanJoinedAt?: string | null };
} | null): boolean {
  if (!gate) return false;
  if (gate.metadata?.escalatedAt || gate.metadata?.humanJoinedAt || gate.assignedTo) {
    return true;
  }
  return ["active", "resolved", "closed"].includes(gate.status || "");
}




export async function runPipeline(job: AIJobData): Promise<void> {
  const { conversationId, content } = job;

  const gate = await getConversationGate(conversationId);
  if (shouldSkipConversation(gate)) {
    console.log(
      `[Pipeline] Skipping job - conversation ${conversationId} already escalated/closed/assigned`,
    );
    return;
  }

  console.log(`\n[Pipeline] --- NEW JOB ----------------------------------------`);
  console.log(`[Pipeline] conversationId : ${conversationId}`);
  console.log(`[Pipeline] messageId      : ${job.messageId}`);
  console.log(`[Pipeline] organizationId : ${job.organizationId}`);
  console.log(`[Pipeline] fallbackToAgent: ${job.fallbackToAgent ?? true}`);
  console.log(`[Pipeline] collectUserInfo: ${JSON.stringify(job.collectUserInfo ?? {})}`);
  console.log(`[Pipeline] content        : ${content.slice(0, 120).replace(/\n/g, " ")}`);

  // -- 1. Context -------------------------------------------------------------
  const context = await buildContext(
    conversationId,
    job.organizationId,
    content,
    job.companyName,
    job.messageId,
    job.fallbackToAgent,
    job.collectUserInfo,
  );

  console.log(`[Pipeline] turnCount      : ${context.turnCount}`);

  // -- 2. Build message thread for LLM ----------------------------------------
  const messages: LLMMessage[] = [
    { role: "system", content: context.systemPrompt },
    ...context.messages.map((m) => ({
      role: m.role as LLMMessage["role"],
      content: m.content,
    })),
  ];

  // -- 3. Generate response ----------------------------------------------------
  let generatedText: string;
  let usage:
    | {
        promptTokens?: number;
        completionTokens?: number;
        totalTokens?: number;
      }
    | undefined;
  try {
    const provider = getDefaultProvider();
    const generated = await provider.generate(messages, {
      tools: getAllTools(),
      toolContext: {
        organizationId: job.organizationId,
        conversationId: job.conversationId,
        messageId: job.messageId,
      },
      onStream: (chunk, isThought = false) => {
        publishStreamWithSeq({
          conversationId,
          messageId: job.messageId,
          chunk,
          isThought,
        }).catch((err) =>
          console.error("[Pipeline] Stream publish failed:", err.message),
        );
      },
    });
    generatedText = generated.text;
    usage = generated.usage;
  } catch (providerErr) {
    console.error("[Pipeline] LLM provider threw an error:", providerErr);
    const canEscalate = job.fallbackToAgent !== false;
    const fallback =
      "I'm sorry - I'm having trouble connecting right now. Please try again in a moment." +
      (canEscalate
        ? " If you need immediate help, I can connect you to a human agent."
        : "");
    await publishResponse({ conversationId, content: fallback });
    return;
  }

  console.log(
    `[Pipeline] raw LLM response: ${generatedText.slice(0, 200).replace(/\n/g, " ")}`,
  );

  // -- 4. Route: check for escalation sentinels -------------------------------
  const escalation = detectEscalation(generatedText);

  if (escalation) {
    console.log(`[Pipeline] Escalation detected - reason: "${escalation.reason}"`);
    const canEscalate = job.fallbackToAgent !== false;

    if (canEscalate) {
      if (escalation.cleanText) {
        await publishResponse({ conversationId, content: escalation.cleanText, usage });
      }
      await publishEscalation({
        conversationId,
        reason: escalation.reason,
      });
      invalidateConversationGate(conversationId).catch(() => undefined);
    } else {
      console.log(
        "[Pipeline] Escalation blocked - fallbackToAgent disabled or no team; sending fallback.",
      );
      await publishResponse({
        conversationId,
        content:
          "I wasn't able to fully resolve this. Unfortunately I'm not able to connect you to a human agent right now, " +
          "but please try again or reach out through another support channel.",
      });
    }
    return;
  }

  // -- 5. Publish regular response ---------------------------------------------
  await publishResponse({ conversationId, content: generatedText, usage });
}
