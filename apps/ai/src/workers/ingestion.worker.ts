import { Worker, Queue } from "bullmq";
import config from "../config";
import { DocumentJob } from "../modules/ingestion/ingestion.types";
import { runIngestionPipeline } from "../modules/ingestion/pipelines/file.pipeline";
import { runUrlIngestionPipeline } from "../modules/ingestion/pipelines/url.pipeline";
import { runTextIngestionPipeline } from "../modules/ingestion/pipelines/text.pipeline";
import { vectorStore } from "../infrastructure/vector";
import { connectDB, KnowledgeModel } from "../infrastructure/db";
import { getBullMQConnection } from "../infrastructure/queue/bullmq.client";
import { getSyncDelay } from "../modules/ingestion/utils/sync-delays";
import { cacheRedis } from "../infrastructure/cache/redis.client";
import logger from "../utils/logger";
import { publishKnowledgeNotificationEvent } from "../infrastructure/events/knowledge-notification.publisher";

export const INGESTION_QUEUE = "document-ingestion";
const URL_LOCK_TTL_SECONDS = parseInt(process.env.URL_INGEST_LOCK_TTL_SECONDS || "3600", 10);
const LOCK_RETRY_DELAY_MS = 60_000;

export function startIngestionWorker() {
  const connection = getBullMQConnection();


  const ingestionQueue = new Queue<DocumentJob>(INGESTION_QUEUE, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  });

  const worker = new Worker<DocumentJob, void, string>(
    INGESTION_QUEUE,
    async (job) => {
      const { source, jobType } = job.data;


      if (jobType === "delete-vectors") {
        await vectorStore.deleteByDocumentId(job.data.documentId, job.data.organizationId);
        logger.info("Deleted document vectors", {
          jobId: job.id,
          queue: INGESTION_QUEUE,
          documentId: job.data.documentId,
          organizationId: job.data.organizationId,
        });
        return;
      }

      if (source === "url") {
        const lockKey = `ingestion:url:lock:${job.data.documentId}`;
        const lockValue = job.id ?? "1";

        const lockAcquired = await cacheRedis.set(lockKey, lockValue, "EX", URL_LOCK_TTL_SECONDS, "NX");
        if (!lockAcquired) {
          const retryJobId = `ingest-lock-retry:${job.data.documentId}`;
          try {
            await ingestionQueue.add("ingest", job.data, {
              delay: LOCK_RETRY_DELAY_MS,
              jobId: retryJobId,
              removeOnComplete: true,
              removeOnFail: true,
            });
          } catch (err: any) {
            logger.warn("URL ingestion lock retry already scheduled", {
              jobId: job.id,
              queue: INGESTION_QUEUE,
              documentId: job.data.documentId,
              organizationId: job.data.organizationId,
              error: err,
            });
          }
          logger.info("URL ingestion skipped due to active lock", {
            jobId: job.id,
            queue: INGESTION_QUEUE,
            documentId: job.data.documentId,
            organizationId: job.data.organizationId,
          });
          return;
        }

        try {
          await runUrlIngestionPipeline(job.data);
        } finally {
          await cacheRedis.del(lockKey).catch(() => undefined);
        }
        return;
      }

      if (source === "text") {
        await runTextIngestionPipeline(job.data);
        return;
      }

      // pdf / docx
      await runIngestionPipeline(job.data);
    },
    {
      connection,
      concurrency: config.worker.ingestionConcurrency,
    },
  );

  worker.on("completed", async (job) => {
    logger.info("Ingestion job completed", {
      jobId: job.id,
      queue: INGESTION_QUEUE,
      documentId: job.data.documentId,
      organizationId: job.data.organizationId,
      source: job.data.source,
      jobType: job.data.jobType,
      attemptsMade: job.attemptsMade,
    });

    if (job.data.jobType !== "delete-vectors" && job.data.notificationCompletionType) {
      await publishKnowledgeNotificationEvent({
        eventId: job.data.notificationRunId,
        type: job.data.notificationCompletionType,
        organizationId: job.data.organizationId,
        documentId: job.data.documentId,
        title: job.data.title || job.data.fileName || "Knowledge source",
      });
    }

    // Self-schedule URL re-crawl based on syncFrequency (skip for delete-vectors jobs)
    if (job.data.jobType !== "delete-vectors" && job.data.source === "url") {
      await connectDB();
      const doc = await (KnowledgeModel as any).findOne(
        {
          _id: job.data.documentId,
          organizationId: job.data.organizationId,
        },
        {
          isPaused: 1,
          syncFrequency: 1,
          sourceUrl: 1,
          fetchMode: 1,
          crawlDepth: 1,
          title: 1,
        },
      ).lean();

      if (!doc) {
        logger.info("Skipping re-crawl because document was deleted", {
          jobId: job.id,
          queue: INGESTION_QUEUE,
          documentId: job.data.documentId,
          organizationId: job.data.organizationId,
        });
        return;
      }

      if (doc.isPaused) {
        logger.info("Skipping re-crawl because source is paused", {
          jobId: job.id,
          queue: INGESTION_QUEUE,
          documentId: job.data.documentId,
          organizationId: job.data.organizationId,
        });
        return;
      }

      const syncFrequency = doc.syncFrequency || job.data.syncFrequency;
      const delay = getSyncDelay(syncFrequency);
      if (!delay) return;

      const nextJob: DocumentJob = {
        ...job.data,
        sourceUrl: doc.sourceUrl || job.data.sourceUrl,
        fetchMode: doc.fetchMode || job.data.fetchMode,
        crawlDepth: doc.crawlDepth ?? job.data.crawlDepth,
        syncFrequency,
        fileName: doc.title || job.data.fileName,
        title: doc.title || job.data.title,
        notificationRunId: undefined,
        notificationCompletionType: undefined,
      };

      if (!nextJob.sourceUrl) {
        logger.warn("Skipping re-crawl because sourceUrl is missing", {
          jobId: job.id,
          queue: INGESTION_QUEUE,
          documentId: job.data.documentId,
          organizationId: job.data.organizationId,
        });
        return;
      }

      const recrawlJobId = `recrawl:${job.data.documentId}`;
      const existing = await ingestionQueue.getJob(recrawlJobId);
      if (existing) {
        await existing.remove();
      }

      await ingestionQueue.add("ingest", nextJob, { delay, jobId: recrawlJobId });
      logger.info("Re-crawl scheduled", {
        jobId: job.id,
        queue: INGESTION_QUEUE,
        recrawlJobId,
        documentId: job.data.documentId,
        organizationId: job.data.organizationId,
        sourceUrl: nextJob.sourceUrl,
        delayMs: delay,
      });
    }
  });
  worker.on("failed", async (job, err) => {
    logger.error("Ingestion job failed", {
      jobId: job?.id,
      queue: INGESTION_QUEUE,
      documentId: job?.data.documentId,
      organizationId: job?.data.organizationId,
      source: job?.data.source,
      jobType: job?.data.jobType,
      attemptsMade: job?.attemptsMade,
      error: err,
    });
    if (job && job.data.jobType !== "delete-vectors" && job.data.notificationFailureType) {
      await publishKnowledgeNotificationEvent({
        eventId: job.data.notificationRunId,
        type: job.data.notificationFailureType,
        organizationId: job.data.organizationId,
        documentId: job.data.documentId,
        title: job.data.title || job.data.fileName || "Knowledge source",
        message: `Failed to index '${job.data.title || job.data.fileName || "Knowledge source"}'.`,
        metadata: {
          error: err.message,
        },
      });
    }
  });
  worker.on("error", (err) =>
    logger.error("Ingestion worker error", { queue: INGESTION_QUEUE, error: err }),
  );

  logger.info("Ingestion worker started", {
    queue: INGESTION_QUEUE,
    concurrency: config.worker.ingestionConcurrency,
  });

  return worker;
}
