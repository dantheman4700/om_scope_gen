import fs from 'fs/promises';
import path from 'path';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import officeparser from 'officeparser';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/env';

// Initialize Gemini for image/PDF extraction
const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

export interface ExtractionResult {
  text: string;
  metadata: {
    pageCount?: number;
    wordCount: number;
    extractionMethod: string;
  };
}

/**
 * Extract text content from various document types
 */
export async function extractDocument(filePath: string, mimeType: string): Promise<ExtractionResult> {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(env.UPLOAD_DIR, filePath);
  
  // Check file exists
  await fs.access(absolutePath);

  // Route to appropriate extractor based on mime type
  if (mimeType === 'application/pdf') {
    return extractPDF(absolutePath);
  }
  
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return extractDOCX(absolutePath);
  }
  
  if (mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
    return extractPPTX(absolutePath);
  }
  
  if (mimeType.startsWith('image/')) {
    return extractImage(absolutePath, mimeType);
  }
  
  if (isTextFile(mimeType)) {
    return extractText(absolutePath);
  }
  
  throw new Error(`Unsupported file type: ${mimeType}`);
}

/**
 * Extract text from PDF - falls back to Gemini Vision if no text found
 */
async function extractPDF(filePath: string): Promise<ExtractionResult> {
  const buffer = await fs.readFile(filePath);
  
  try {
    // Skip rendering pages (major memory saver) - we only need text
    const options = {
      // Don't render pages as images - just extract text
      pagerender: () => Promise.resolve(''),
    };
    
    const data = await pdf(buffer, options);
    const text = data.text.trim();
    
    // If PDF has extractable text, use it
    if (text.length > 50) {
      return {
        text,
        metadata: {
          pageCount: data.numpages,
          wordCount: text.split(/\s+/).length,
          extractionMethod: 'pdf-parse',
        },
      };
    }
    
    // Fall back to Gemini Vision for scanned PDFs
    console.log('PDF has little/no text, using Gemini Vision...');
    return extractWithGeminiVision(buffer, 'application/pdf');
  } catch (error) {
    console.error('PDF parsing failed, trying Gemini Vision:', error);
    return extractWithGeminiVision(buffer, 'application/pdf');
  }
}

/**
 * Extract text from DOCX using mammoth
 */
async function extractDOCX(filePath: string): Promise<ExtractionResult> {
  const buffer = await fs.readFile(filePath);
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value.trim();
  
  return {
    text,
    metadata: {
      wordCount: text.split(/\s+/).length,
      extractionMethod: 'mammoth',
    },
  };
}

/**
 * Extract text from PPTX using officeparser
 */
async function extractPPTX(filePath: string): Promise<ExtractionResult> {
  const text = await officeparser.parseOfficeAsync(filePath);
  const trimmedText = text.trim();
  
  return {
    text: trimmedText,
    metadata: {
      wordCount: trimmedText.split(/\s+/).length,
      extractionMethod: 'officeparser',
    },
  };
}

/**
 * Extract text from images using Gemini Vision
 */
async function extractImage(filePath: string, mimeType: string): Promise<ExtractionResult> {
  const buffer = await fs.readFile(filePath);
  return extractWithGeminiVision(buffer, mimeType);
}

/**
 * Use Gemini Vision to extract text from images or scanned PDFs
 */
async function extractWithGeminiVision(buffer: Buffer, mimeType: string): Promise<ExtractionResult> {
  if (!env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is required for image/scanned PDF extraction');
  }

  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.5-pro',
    generationConfig: {
      temperature: 0.1, // Low temperature for accurate extraction
      maxOutputTokens: 8192,
    },
  });
  
  const base64Data = buffer.toString('base64');
  
  const prompt = `Extract all text content from this document or image. 
Include all visible text, tables, charts labels, and any other textual information.
Format the output as clean, readable text.
If there are tables, preserve their structure using markdown table format.
If there are lists, preserve them as bullet points or numbered lists.
Maintain the original document structure and hierarchy where possible.`;

  const result = await model.generateContent({
    contents: [{
      role: 'user',
      parts: [
        { text: prompt },
        {
          inlineData: {
            mimeType: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'application/pdf',
            data: base64Data,
          },
        },
      ],
    }],
  });
  
  const text = result.response.text().trim();
  
  return {
    text,
    metadata: {
      wordCount: text.split(/\s+/).length,
      extractionMethod: 'gemini-vision',
    },
  };
}

/**
 * Extract plain text files (txt, md, csv, etc.)
 */
async function extractText(filePath: string): Promise<ExtractionResult> {
  const text = await fs.readFile(filePath, 'utf-8');
  const trimmedText = text.trim();
  
  return {
    text: trimmedText,
    metadata: {
      wordCount: trimmedText.split(/\s+/).length,
      extractionMethod: 'direct-read',
    },
  };
}

/**
 * Check if mime type is a text file
 */
function isTextFile(mimeType: string): boolean {
  const textTypes = [
    'text/plain',
    'text/csv',
    'text/markdown',
    'text/x-markdown',
    'application/json',
    'text/html',
    'text/xml',
    'application/xml',
  ];
  return textTypes.includes(mimeType) || mimeType.startsWith('text/');
}

/**
 * Get supported mime types
 */
export function getSupportedMimeTypes(): string[] {
  return [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'text/plain',
    'text/csv',
    'text/markdown',
    'text/x-markdown',
    'application/json',
  ];
}

