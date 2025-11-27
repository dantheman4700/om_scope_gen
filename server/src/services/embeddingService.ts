import OpenAI from 'openai';
import { sql } from '../db';
import { env } from '../config/env';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

// Embedding model configuration
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

// Chunking configuration
const CHUNK_SIZE = 800; // tokens (approximately 3200 characters)
const CHUNK_OVERLAP = 100; // tokens overlap between chunks

export interface TextChunk {
  content: string;
  index: number;
  metadata: {
    startChar: number;
    endChar: number;
  };
}

/**
 * Split text into overlapping chunks for embedding
 */
export function chunkText(text: string): TextChunk[] {
  const chunks: TextChunk[] = [];
  
  // Approximate 4 characters per token
  const chunkSizeChars = CHUNK_SIZE * 4;
  const overlapChars = CHUNK_OVERLAP * 4;
  
  // Clean and normalize text
  const cleanedText = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  if (cleanedText.length === 0) {
    return [];
  }
  
  // If text is small enough, return as single chunk
  if (cleanedText.length <= chunkSizeChars) {
    return [{
      content: cleanedText,
      index: 0,
      metadata: {
        startChar: 0,
        endChar: cleanedText.length,
      },
    }];
  }
  
  let startIndex = 0;
  let chunkIndex = 0;
  
  while (startIndex < cleanedText.length) {
    let endIndex = startIndex + chunkSizeChars;
    
    // Try to break at sentence or paragraph boundary
    if (endIndex < cleanedText.length) {
      // Look for paragraph break
      const paragraphBreak = cleanedText.lastIndexOf('\n\n', endIndex);
      if (paragraphBreak > startIndex + chunkSizeChars / 2) {
        endIndex = paragraphBreak + 2;
      } else {
        // Look for sentence break
        const sentenceBreak = findSentenceBreak(cleanedText, startIndex + chunkSizeChars / 2, endIndex);
        if (sentenceBreak > startIndex) {
          endIndex = sentenceBreak;
        }
      }
    } else {
      endIndex = cleanedText.length;
    }
    
    const chunkContent = cleanedText.slice(startIndex, endIndex).trim();
    
    if (chunkContent.length > 0) {
      chunks.push({
        content: chunkContent,
        index: chunkIndex,
        metadata: {
          startChar: startIndex,
          endChar: endIndex,
        },
      });
      chunkIndex++;
    }
    
    // Move start position with overlap
    startIndex = endIndex - overlapChars;
    
    // Prevent infinite loop
    if (startIndex >= cleanedText.length - 10) {
      break;
    }
  }
  
  return chunks;
}

/**
 * Find a good sentence break point
 */
function findSentenceBreak(text: string, minIndex: number, maxIndex: number): number {
  const sentenceEnders = ['. ', '? ', '! ', '.\n', '?\n', '!\n'];
  
  let bestBreak = -1;
  
  for (const ender of sentenceEnders) {
    let idx = text.lastIndexOf(ender, maxIndex);
    if (idx > minIndex && idx > bestBreak) {
      bestBreak = idx + ender.length;
    }
  }
  
  return bestBreak;
}

/**
 * Create embeddings for text chunks using OpenAI
 */
export async function createEmbeddings(chunks: TextChunk[]): Promise<number[][]> {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for embeddings');
  }
  
  if (chunks.length === 0) {
    return [];
  }
  
  // Batch embed all chunks
  const texts = chunks.map(c => c.content);
  
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
    dimensions: EMBEDDING_DIMENSIONS,
  });
  
  return response.data.map(d => d.embedding);
}

/**
 * Store document chunks with embeddings in the database
 */
export async function storeChunksWithEmbeddings(
  documentId: string,
  listingId: string,
  text: string
): Promise<number> {
  // Chunk the text
  const chunks = chunkText(text);
  
  if (chunks.length === 0) {
    return 0;
  }
  
  // Create embeddings
  const embeddings = await createEmbeddings(chunks);
  
  // Store chunks in database
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = embeddings[i];
    
    // Convert embedding array to pgvector format
    const embeddingStr = `[${embedding.join(',')}]`;
    
    await sql`
      INSERT INTO document_chunks (
        document_id,
        listing_id,
        chunk_index,
        content,
        embedding,
        metadata
      ) VALUES (
        ${documentId},
        ${listingId},
        ${chunk.index},
        ${chunk.content},
        ${embeddingStr}::vector,
        ${JSON.stringify(chunk.metadata)}
      )
    `;
  }
  
  return chunks.length;
}

/**
 * Search for similar chunks using vector similarity
 */
export async function searchSimilarChunks(
  query: string,
  listingId: string,
  limit: number = 5
): Promise<Array<{ content: string; similarity: number; documentId: string }>> {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for embeddings');
  }
  
  // Create embedding for query
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: query,
    dimensions: EMBEDDING_DIMENSIONS,
  });
  
  const queryEmbedding = response.data[0].embedding;
  const embeddingStr = `[${queryEmbedding.join(',')}]`;
  
  // Search using cosine similarity
  const results = await sql`
    SELECT 
      content,
      document_id,
      1 - (embedding <=> ${embeddingStr}::vector) as similarity
    FROM document_chunks
    WHERE listing_id = ${listingId}
    ORDER BY embedding <=> ${embeddingStr}::vector
    LIMIT ${limit}
  `;
  
  return results.map((row: any) => ({
    content: row.content,
    similarity: row.similarity,
    documentId: row.document_id,
  }));
}

/**
 * Delete all chunks for a document
 */
export async function deleteDocumentChunks(documentId: string): Promise<void> {
  await sql`
    DELETE FROM document_chunks
    WHERE document_id = ${documentId}
  `;
}

