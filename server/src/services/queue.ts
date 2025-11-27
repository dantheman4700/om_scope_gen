/**
 * Simple in-memory job queue for document processing
 * Suitable for low-volume use (~300 jobs/day)
 */

import { sql } from '../db';
import { extractDocument } from './documentExtractor';
import { storeChunksWithEmbeddings } from './embeddingService';
import { generateDocument } from './documentGenerator';
import { env } from '../config/env';

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

// Simple queue implementation
type Job = DocumentJobData | GenerationJobData;
const jobQueue: Job[] = [];
let isProcessing = false;

/**
 * Process jobs one at a time
 */
async function processQueue() {
  if (isProcessing || jobQueue.length === 0) return;
  
  isProcessing = true;
  
  while (jobQueue.length > 0) {
    const job = jobQueue.shift()!;
    
    try {
      console.log(`\n📄 Processing job: ${job.type}`);
      
      if (job.type === 'extract-document') {
        await processExtraction(job);
      } else if (job.type === 'embed-document') {
        await processEmbedding(job);
      } else if (job.type === 'generate-document') {
        await processGeneration(job);
      }
      
      console.log(`✅ Job completed: ${job.type}\n`);
    } catch (error: any) {
      console.error(`❌ Job failed: ${job.type}`, error.message);
      console.error(error.stack);
    }
  }
  
  isProcessing = false;
}

/**
 * Process document extraction
 */
async function processExtraction(job: ExtractDocumentJob) {
  const { documentId, listingId, filePath, mimeType } = job;
  
  console.log(`   Document ID: ${documentId}`);
  console.log(`   File: ${filePath}`);
  console.log(`   MIME: ${mimeType}`);
  
  // Update status to processing
  await sql`
    UPDATE listing_documents 
    SET extraction_status = 'processing'
    WHERE id = ${documentId}
  `;
  
  try {
    // Step 1: Extract text from document
    console.log(`   Extracting text...`);
    const result = await extractDocument(filePath, mimeType);
    console.log(`   Extracted ${result.text.length} characters (${result.metadata.wordCount} words)`);
    console.log(`   Method: ${result.metadata.extractionMethod}`);
    
    if (result.text.length === 0) {
      console.log(`   ⚠️ No text extracted from document`);
      await sql`
        UPDATE listing_documents 
        SET 
          extraction_status = 'completed',
          extracted_text = '',
          metadata = ${JSON.stringify(result.metadata)},
          error_message = 'No text could be extracted from this document'
        WHERE id = ${documentId}
      `;
      return;
    }
    
    // Step 2: Create embeddings (if OpenAI key is configured)
    let chunkCount = 0;
    if (env.OPENAI_API_KEY) {
      console.log(`   Creating embeddings...`);
      try {
        chunkCount = await storeChunksWithEmbeddings(documentId, listingId, result.text);
        console.log(`   Created ${chunkCount} chunks with embeddings`);
      } catch (embedError: any) {
        console.error(`   ⚠️ Embedding failed:`, embedError.message);
        // Continue - document is still extracted, just no embeddings
      }
    } else {
      console.log(`   ⚠️ Skipping embeddings (OPENAI_API_KEY not configured)`);
    }
    
    // Step 3: Update status to completed
    await sql`
      UPDATE listing_documents 
      SET 
        extraction_status = 'completed',
        extracted_text = ${result.text},
        metadata = ${JSON.stringify({ ...result.metadata, chunkCount })}
      WHERE id = ${documentId}
    `;
    
  } catch (error: any) {
    console.error(`   ❌ Extraction failed:`, error.message);
    await sql`
      UPDATE listing_documents 
      SET 
        extraction_status = 'failed',
        error_message = ${error.message || 'Unknown error'}
      WHERE id = ${documentId}
    `;
    throw error;
  }
}

/**
 * Process document embedding (standalone)
 */
async function processEmbedding(job: EmbedDocumentJob) {
  const { documentId, listingId } = job;
  
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for embeddings');
  }
  
  const [doc] = await sql`
    SELECT extracted_text FROM listing_documents WHERE id = ${documentId}
  `;
  
  if (!doc?.extracted_text) {
    throw new Error('Document not found or no extracted text');
  }
  
  const chunkCount = await storeChunksWithEmbeddings(documentId, listingId, doc.extracted_text);
  console.log(`   Created ${chunkCount} chunks for document ${documentId}`);
}

/**
 * Process document generation
 */
async function processGeneration(job: GenerateDocumentJob) {
  const { generatedDocId, listingId, templateId } = job;
  
  console.log(`   Generated Doc ID: ${generatedDocId}`);
  console.log(`   Template ID: ${templateId}`);
  
  await sql`
    UPDATE generated_documents 
    SET generation_status = 'processing'
    WHERE id = ${generatedDocId}
  `;
  
  try {
    console.log(`   Generating document...`);
    const result = await generateDocument(generatedDocId, listingId, templateId);
    console.log(`   PDF: ${result.pdfPath || 'not generated'}`);
    console.log(`   DOCX: ${result.docxPath || 'not generated'}`);
    
    await sql`
      UPDATE generated_documents 
      SET 
        generation_status = 'completed',
        pdf_path = ${result.pdfPath},
        docx_path = ${result.docxPath},
        variables_used = ${JSON.stringify(result.variablesUsed)}
      WHERE id = ${generatedDocId}
    `;
  } catch (error: any) {
    console.error(`   ❌ Generation failed:`, error.message);
    await sql`
      UPDATE generated_documents 
      SET 
        generation_status = 'failed',
        error_message = ${error.message || 'Unknown error'}
      WHERE id = ${generatedDocId}
    `;
    throw error;
  }
}

// Public API - queue jobs for processing
export async function queueDocumentExtraction(data: Omit<ExtractDocumentJob, 'type'>) {
  console.log(`📥 Queued extraction job for document ${data.documentId}`);
  jobQueue.push({ ...data, type: 'extract-document' });
  // Process async (don't await) - use setTimeout to ensure it runs after current stack
  setTimeout(() => processQueue(), 0);
  return { id: data.documentId };
}

export async function queueDocumentEmbedding(data: Omit<EmbedDocumentJob, 'type'>) {
  console.log(`📥 Queued embedding job for document ${data.documentId}`);
  jobQueue.push({ ...data, type: 'embed-document' });
  setTimeout(() => processQueue(), 0);
  return { id: data.documentId };
}

export async function queueDocumentGeneration(data: Omit<GenerateDocumentJob, 'type'>) {
  console.log(`📥 Queued generation job for document ${data.generatedDocId}`);
  jobQueue.push({ ...data, type: 'generate-document' });
  setTimeout(() => processQueue(), 0);
  return { id: data.generatedDocId };
}

// Get queue status
export function getQueueStatus() {
  return {
    pending: jobQueue.length,
    isProcessing,
  };
}
