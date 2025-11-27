import fs from 'fs/promises';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
// NOTE: puppeteer is imported dynamically in generatePDF() to avoid loading Chromium on startup
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { sql } from '../db';
import { env } from '../config/env';
import { searchSimilarChunks } from './embeddingService';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

export interface GenerationResult {
  pdfPath: string | null;
  docxPath: string | null;
  variablesUsed: Record<string, string>;
}

/**
 * Generate a document from template using RAG
 */
export async function generateDocument(
  generatedDocId: string,
  listingId: string,
  templateId: string
): Promise<GenerationResult> {
  // Get template and variables
  const [template] = await sql`
    SELECT * FROM document_templates WHERE id = ${templateId}
  `;
  
  if (!template) {
    throw new Error('Template not found');
  }

  const variables = await sql`
    SELECT * FROM template_variables 
    WHERE template_id = ${templateId}
    ORDER BY sort_order ASC
  `;

  // Get listing info for context
  const [listing] = await sql`
    SELECT * FROM listings WHERE id = ${listingId}
  `;

  // Generate values for each variable using RAG
  const variableValues: Record<string, string> = {};
  
  for (const variable of variables) {
    try {
      const value = await generateVariableValue(
        variable,
        listingId,
        listing
      );
      variableValues[variable.variable_name] = value;
    } catch (error) {
      console.error(`Error generating variable ${variable.variable_name}:`, error);
      variableValues[variable.variable_name] = variable.fallback_value || '';
    }
  }

  // Render template with variables
  let renderedContent = template.template_content;
  for (const [key, value] of Object.entries(variableValues)) {
    renderedContent = renderedContent.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }

  // Generate output files
  const outputDir = path.join(env.UPLOAD_DIR, 'generated-documents');
  await fs.mkdir(outputDir, { recursive: true });

  const timestamp = Date.now();
  const baseFilename = `${generatedDocId}-${timestamp}`;

  let pdfPath: string | null = null;
  let docxPath: string | null = null;

  // Generate PDF if supported
  if (template.output_formats.includes('pdf')) {
    pdfPath = await generatePDF(renderedContent, outputDir, baseFilename, listing);
  }

  // Generate DOCX if supported
  if (template.output_formats.includes('docx')) {
    docxPath = await generateDOCX(renderedContent, outputDir, baseFilename, listing);
  }

  return {
    pdfPath,
    docxPath,
    variablesUsed: variableValues,
  };
}

/**
 * Generate a variable value using RAG
 */
async function generateVariableValue(
  variable: any,
  listingId: string,
  listing: any
): Promise<string> {
  if (!variable.rag_question) {
    return variable.fallback_value || '';
  }

  if (!env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is required for document generation');
  }

  // Search for relevant context
  const relevantChunks = await searchSimilarChunks(variable.rag_question, listingId, 5);
  
  if (relevantChunks.length === 0) {
    return variable.fallback_value || '';
  }

  // Build context from chunks
  const context = relevantChunks
    .map((chunk, i) => `[Source ${i + 1}]:\n${chunk.content}`)
    .join('\n\n');

  // Add listing context
  const listingContext = `
Company Information from Database:
- Company Name: ${listing.company_name || 'Not specified'}
- Industry: ${listing.industry || 'Not specified'}
- Location: ${listing.location || 'Not specified'}
- Revenue: ${listing.revenue ? `$${(listing.revenue / 1000000).toFixed(1)}M` : 'Not specified'}
- EBITDA: ${listing.ebitda ? `$${(listing.ebitda / 1000000).toFixed(1)}M` : 'Not specified'}
- Asking Price: ${listing.asking_price ? `$${(listing.asking_price / 1000000).toFixed(1)}M` : 'Not specified'}
`;

  // Generate answer using Gemini 2.5 Pro
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.5-pro',
    generationConfig: {
      temperature: 0.7, // Balanced for creative yet accurate writing
      maxOutputTokens: 4096,
      topP: 0.9,
    },
  });
  
  const systemInstruction = `You are a professional M&A document writer with extensive experience creating Offering Memoranda and Confidential Information Memoranda for mid-market transactions. Your writing is:
- Professional and formal in tone
- Concise yet comprehensive
- Factually accurate - you never fabricate numbers or details
- Well-structured with clear flow`;

  const prompt = `Based on the following context from uploaded documents and company information, answer this question:
"${variable.rag_question}"

${listingContext}

Document Context:
${context}

Instructions:
- Write in a professional, formal tone suitable for an M&A document
- Be concise but comprehensive
- If the information is not available in the context, write "${variable.fallback_value || 'Information not available'}"
- Do not make up specific numbers or facts not present in the context
- Format appropriately for the variable type: ${variable.variable_type}
${variable.description ? `- Additional context: ${variable.description}` : ''}

Answer:`;

  const result = await model.generateContent({
    contents: [{
      role: 'user',
      parts: [{ text: prompt }],
    }],
    systemInstruction: {
      role: 'system',
      parts: [{ text: systemInstruction }],
    },
  });
  const answer = result.response.text().trim();
  
  return answer || variable.fallback_value || '';
}

/**
 * Generate PDF from rendered content
 */
async function generatePDF(
  content: string,
  outputDir: string,
  baseFilename: string,
  listing: any
): Promise<string> {
  // Dynamic import to avoid loading Chromium on server startup
  const puppeteer = await import('puppeteer');
  
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    
    // Convert markdown-style content to HTML
    const htmlContent = markdownToHTML(content);
    
    // Create full HTML document
    const fullHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&family=Open+Sans:wght@400;600&display=swap');
    
    body {
      font-family: 'Open Sans', sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #333;
      max-width: 100%;
      margin: 0;
      padding: 40px 60px;
    }
    
    h1 {
      font-family: 'Merriweather', serif;
      font-size: 24pt;
      color: #1a365d;
      border-bottom: 3px solid #2c5282;
      padding-bottom: 10px;
      margin-top: 30px;
    }
    
    h2 {
      font-family: 'Merriweather', serif;
      font-size: 16pt;
      color: #2c5282;
      margin-top: 25px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 5px;
    }
    
    h3 {
      font-size: 13pt;
      color: #4a5568;
      margin-top: 20px;
    }
    
    p {
      margin: 12px 0;
      text-align: justify;
    }
    
    ul, ol {
      margin: 12px 0;
      padding-left: 30px;
    }
    
    li {
      margin: 6px 0;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    
    th, td {
      border: 1px solid #e2e8f0;
      padding: 10px;
      text-align: left;
    }
    
    th {
      background-color: #f7fafc;
      font-weight: 600;
    }
    
    .cover-page {
      text-align: center;
      padding: 100px 40px;
    }
    
    .cover-page h1 {
      font-size: 32pt;
      border: none;
      margin-bottom: 20px;
    }
    
    .cover-page .subtitle {
      font-size: 18pt;
      color: #4a5568;
      margin-bottom: 40px;
    }
    
    .cover-page .confidential {
      font-size: 10pt;
      color: #e53e3e;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-top: 60px;
    }
    
    .page-break {
      page-break-after: always;
    }
  </style>
</head>
<body>
  <div class="cover-page">
    <h1>Confidential Information Memorandum</h1>
    <div class="subtitle">${listing.company_name || listing.title || 'Investment Opportunity'}</div>
    <p class="confidential">Confidential - Do Not Distribute</p>
  </div>
  <div class="page-break"></div>
  ${htmlContent}
</body>
</html>`;

    await page.setContent(fullHTML, { waitUntil: 'networkidle0' });
    
    const relativePath = `generated-documents/${baseFilename}.pdf`;
    const absolutePath = path.join(outputDir, `${baseFilename}.pdf`);
    
    await page.pdf({
      path: absolutePath,
      format: 'Letter',
      margin: {
        top: '0.75in',
        bottom: '0.75in',
        left: '0.75in',
        right: '0.75in',
      },
      printBackground: true,
    });

    return relativePath;
  } finally {
    await browser.close();
  }
}

/**
 * Generate DOCX from rendered content
 */
async function generateDOCX(
  content: string,
  outputDir: string,
  baseFilename: string,
  listing: any
): Promise<string> {
  const sections = parseContentToSections(content);
  
  const children: any[] = [];
  
  // Cover page
  children.push(
    new Paragraph({
      text: 'Confidential Information Memorandum',
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
    new Paragraph({
      text: listing.company_name || listing.title || 'Investment Opportunity',
      alignment: AlignmentType.CENTER,
      spacing: { after: 800 },
      children: [
        new TextRun({
          text: listing.company_name || listing.title || 'Investment Opportunity',
          size: 36,
          color: '4a5568',
        }),
      ],
    }),
    new Paragraph({
      text: 'CONFIDENTIAL - DO NOT DISTRIBUTE',
      alignment: AlignmentType.CENTER,
      spacing: { before: 1200 },
      children: [
        new TextRun({
          text: 'CONFIDENTIAL - DO NOT DISTRIBUTE',
          size: 20,
          color: 'e53e3e',
          allCaps: true,
        }),
      ],
    }),
    new Paragraph({
      text: '',
      pageBreakBefore: true,
    })
  );

  // Content sections
  for (const section of sections) {
    if (section.type === 'h1') {
      children.push(new Paragraph({
        text: section.content,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      }));
    } else if (section.type === 'h2') {
      children.push(new Paragraph({
        text: section.content,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 150 },
      }));
    } else if (section.type === 'h3') {
      children.push(new Paragraph({
        text: section.content,
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 200, after: 100 },
      }));
    } else if (section.type === 'bullet') {
      children.push(new Paragraph({
        text: section.content,
        bullet: { level: 0 },
        spacing: { after: 100 },
      }));
    } else {
      children.push(new Paragraph({
        text: section.content,
        spacing: { after: 200 },
      }));
    }
  }

  const doc = new Document({
    sections: [{
      properties: {},
      children,
    }],
  });

  const relativePath = `generated-documents/${baseFilename}.docx`;
  const absolutePath = path.join(outputDir, `${baseFilename}.docx`);
  
  const buffer = await Packer.toBuffer(doc);
  await fs.writeFile(absolutePath, buffer);

  return relativePath;
}

/**
 * Convert markdown-style content to HTML
 */
function markdownToHTML(content: string): string {
  return content
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Bullet lists
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    // Numbered lists
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Paragraphs
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hulo])(.+)$/gm, '<p>$1</p>')
    // Clean up
    .replace(/<p><\/p>/g, '')
    .replace(/<p>(<[hulo])/g, '$1')
    .replace(/(<\/[hulo][^>]*>)<\/p>/g, '$1');
}

/**
 * Parse content into sections for DOCX generation
 */
function parseContentToSections(content: string): Array<{ type: string; content: string }> {
  const sections: Array<{ type: string; content: string }> = [];
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    if (trimmed.startsWith('### ')) {
      sections.push({ type: 'h3', content: trimmed.slice(4) });
    } else if (trimmed.startsWith('## ')) {
      sections.push({ type: 'h2', content: trimmed.slice(3) });
    } else if (trimmed.startsWith('# ')) {
      sections.push({ type: 'h1', content: trimmed.slice(2) });
    } else if (trimmed.startsWith('- ')) {
      sections.push({ type: 'bullet', content: trimmed.slice(2) });
    } else if (/^\d+\. /.test(trimmed)) {
      sections.push({ type: 'bullet', content: trimmed.replace(/^\d+\. /, '') });
    } else {
      sections.push({ type: 'paragraph', content: trimmed });
    }
  }
  
  return sections;
}

