export interface DocumentJob {
   
  organizationId: string;
   
  documentId: string;
   
  jobType?: "ingest" | "delete-vectors";
   
  source: "pdf" | "docx" | "text" | "url";
   
  fileKey: string;
   
  mimeType: string;
   
  fileName: string;

  title?: string;
   
  sourceUrl?: string;
   
  content?: string;
   
  fetchMode?: "single" | "crawl";
   
  crawlDepth?: number;
   
  syncFrequency?: string;

  notificationRunId?: string;

  notificationCompletionType?: "KNOWLEDGE_UPLOAD_COMPLETED" | "KNOWLEDGE_REINDEX_COMPLETED";

  notificationFailureType?: "KNOWLEDGE_INGESTION_FAILED";
   
  metadata?: Record<string, unknown>;
}

export interface Chunk {
  text: string;
  index: number;
  startPos: number;
  endPos: number;
}
