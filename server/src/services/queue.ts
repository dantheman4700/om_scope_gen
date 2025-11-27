import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../config/env';

// Redis connection for BullMQ
const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

// Document processing queue
export const documentQueue = new Queue('document-processing', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

// Document generation queue
export const generationQueue = new Queue('document-generation', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 50,
    removeOnFail: 25,
  },
});

// Job types
export interface ExtractDocumentJob {
  type: 'extract-document';
  documentId: string;
  listingId: string;
  filePath: string;
  mimeType: string;
}

export interface EmbedDocumentJob {
  type: 'embed-document';
  documentId: string;
  listingId: string;
}

export interface GenerateDocumentJob {
  type: 'generate-document';
  generatedDocId: string;
  listingId: string;
  templateId: string;
}

export type DocumentJobData = ExtractDocumentJob | EmbedDocumentJob;
export type GenerationJobData = GenerateDocumentJob;

// Add job helper functions
export async function queueDocumentExtraction(data: Omit<ExtractDocumentJob, 'type'>) {
  return documentQueue.add('extract-document', { ...data, type: 'extract-document' as const });
}

export async function queueDocumentEmbedding(data: Omit<EmbedDocumentJob, 'type'>) {
  return documentQueue.add('embed-document', { ...data, type: 'embed-document' as const });
}

export async function queueDocumentGeneration(data: Omit<GenerateDocumentJob, 'type'>) {
  return generationQueue.add('generate-document', { ...data, type: 'generate-document' as const });
}

// Export connection for workers
export { connection };

