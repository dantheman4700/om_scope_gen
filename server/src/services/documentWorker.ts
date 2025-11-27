import { Worker, Job } from 'bullmq';
import { sql } from '../db';
import { connection, DocumentJobData, GenerationJobData } from './queue';
import { extractDocument } from './documentExtractor';
import { storeChunksWithEmbeddings } from './embeddingService';
import { generateDocument } from './documentGenerator';

/**
 * Worker for processing document extraction and embedding jobs
 */
export function startDocumentWorker() {
  const worker = new Worker<DocumentJobData>(
    'document-processing',
    async (job: Job<DocumentJobData>) => {
      console.log(`Processing job ${job.id}: ${job.data.type}`);
      
      try {
        if (job.data.type === 'extract-document') {
          await processExtraction(job);
        } else if (job.data.type === 'embed-document') {
          await processEmbedding(job);
        }
      } catch (error) {
        console.error(`Job ${job.id} failed:`, error);
        throw error;
      }
    },
    {
      connection,
      concurrency: 2,
    }
  );

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err.message);
  });

  return worker;
}

/**
 * Process document extraction job
 */
async function processExtraction(job: Job<DocumentJobData>) {
  if (job.data.type !== 'extract-document') return;
  
  const { documentId, listingId, filePath, mimeType } = job.data;
  
  // Update status to processing
  await sql`
    UPDATE listing_documents 
    SET extraction_status = 'processing'
    WHERE id = ${documentId}
  `;
  
  try {
    // Extract text from document
    const result = await extractDocument(filePath, mimeType);
    
    // Update document with extracted text
    await sql`
      UPDATE listing_documents 
      SET 
        extraction_status = 'completed',
        extracted_text = ${result.text},
        metadata = ${JSON.stringify(result.metadata)}
      WHERE id = ${documentId}
    `;
    
    // Automatically queue embedding job if text was extracted
    if (result.text.length > 0) {
      // Store chunks with embeddings directly
      const chunkCount = await storeChunksWithEmbeddings(documentId, listingId, result.text);
      console.log(`Created ${chunkCount} chunks for document ${documentId}`);
    }
    
    return { success: true, textLength: result.text.length };
  } catch (error: any) {
    // Update status to failed
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
 * Process document embedding job (if called separately)
 */
async function processEmbedding(job: Job<DocumentJobData>) {
  if (job.data.type !== 'embed-document') return;
  
  const { documentId, listingId } = job.data;
  
  // Get the document's extracted text
  const [doc] = await sql`
    SELECT extracted_text FROM listing_documents WHERE id = ${documentId}
  `;
  
  if (!doc || !doc.extracted_text) {
    throw new Error('Document not found or no extracted text');
  }
  
  // Store chunks with embeddings
  const chunkCount = await storeChunksWithEmbeddings(documentId, listingId, doc.extracted_text);
  
  return { success: true, chunkCount };
}

/**
 * Worker for processing document generation jobs
 */
export function startGenerationWorker() {
  const worker = new Worker<GenerationJobData>(
    'document-generation',
    async (job: Job<GenerationJobData>) => {
      console.log(`Processing generation job ${job.id}`);
      
      try {
        if (job.data.type === 'generate-document') {
          await processGeneration(job);
        }
      } catch (error) {
        console.error(`Generation job ${job.id} failed:`, error);
        throw error;
      }
    },
    {
      connection,
      concurrency: 1, // Generation is resource-intensive
    }
  );

  worker.on('completed', (job) => {
    console.log(`Generation job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Generation job ${job?.id} failed:`, err.message);
  });

  return worker;
}

/**
 * Process document generation job
 */
async function processGeneration(job: Job<GenerationJobData>) {
  if (job.data.type !== 'generate-document') return;
  
  const { generatedDocId, listingId, templateId } = job.data;
  
  // Update status to processing
  await sql`
    UPDATE generated_documents 
    SET generation_status = 'processing'
    WHERE id = ${generatedDocId}
  `;
  
  try {
    // Generate the document
    const result = await generateDocument(generatedDocId, listingId, templateId);
    
    // Update with generated paths
    await sql`
      UPDATE generated_documents 
      SET 
        generation_status = 'completed',
        pdf_path = ${result.pdfPath},
        docx_path = ${result.docxPath},
        variables_used = ${JSON.stringify(result.variablesUsed)}
      WHERE id = ${generatedDocId}
    `;
    
    return { success: true, ...result };
  } catch (error: any) {
    // Update status to failed
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

