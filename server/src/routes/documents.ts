import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { sql } from '../db';
import { env } from '../config/env';
import { HttpError } from '../utils/httpError';
import { authenticate, requireRole } from '../middleware/auth';
import { queueDocumentExtraction, queueDocumentGeneration } from '../services/queue';
import { getSupportedMimeTypes } from '../services/documentExtractor';
import { deleteDocumentChunks } from '../services/embeddingService';

const router = Router();

// Configure storage for listing documents
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(env.UPLOAD_DIR, 'listing-documents');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

// File filter for supported types
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const supportedTypes = getSupportedMimeTypes();
  if (supportedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}. Supported: PDF, DOCX, PPTX, images, text files.`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.MAX_FILE_SIZE,
  },
});

/**
 * POST /api/listings/:id/documents
 * Upload document(s) for a listing, queue extraction
 */
router.post(
  '/listings/:id/documents',
  authenticate,
  requireRole('admin', 'editor'),
  upload.array('files', 10),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: listingId } = req.params;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        throw HttpError.badRequest('No files uploaded');
      }

      // Verify listing exists
      const [listing] = await sql`SELECT id FROM listings WHERE id = ${listingId}`;
      if (!listing) {
        throw HttpError.notFound('Listing not found');
      }

      const uploadedDocs = [];

      for (const file of files) {
        // Create document record
        const [doc] = await sql`
          INSERT INTO listing_documents (
            listing_id,
            filename,
            original_name,
            mime_type,
            size_bytes,
            storage_path,
            extraction_status
          ) VALUES (
            ${listingId},
            ${file.filename},
            ${file.originalname},
            ${file.mimetype},
            ${file.size},
            ${`listing-documents/${file.filename}`},
            'pending'
          )
          RETURNING *
        `;

        // Queue extraction job
        await queueDocumentExtraction({
          documentId: doc.id,
          listingId,
          filePath: doc.storage_path,
          mimeType: doc.mime_type,
        });

        uploadedDocs.push(doc);
      }

      res.status(201).json({
        success: true,
        documents: uploadedDocs,
        message: `${uploadedDocs.length} document(s) uploaded and queued for processing`,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/listings/:id/documents
 * List all documents for a listing with status
 */
router.get(
  '/listings/:id/documents',
  authenticate,
  requireRole('admin', 'editor'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: listingId } = req.params;

      const documents = await sql`
        SELECT 
          ld.*,
          (SELECT COUNT(*) FROM document_chunks WHERE document_id = ld.id) as chunk_count
        FROM listing_documents ld
        WHERE ld.listing_id = ${listingId}
        ORDER BY ld.created_at DESC
      `;

      res.json({ documents });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/documents/:id
 * Delete a document and its chunks
 */
router.delete(
  '/documents/:id',
  authenticate,
  requireRole('admin', 'editor'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // Get document
      const [doc] = await sql`
        SELECT * FROM listing_documents WHERE id = ${id}
      `;

      if (!doc) {
        throw HttpError.notFound('Document not found');
      }

      // Delete file from disk
      const filePath = path.join(env.UPLOAD_DIR, doc.storage_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Delete chunks (cascade will handle this, but be explicit)
      await deleteDocumentChunks(id);

      // Delete document record
      await sql`DELETE FROM listing_documents WHERE id = ${id}`;

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/listings/:id/generate/:templateId
 * Generate a document from template
 */
router.post(
  '/listings/:id/generate/:templateId',
  authenticate,
  requireRole('admin', 'editor'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: listingId, templateId } = req.params;

      // Verify listing exists
      const [listing] = await sql`SELECT id FROM listings WHERE id = ${listingId}`;
      if (!listing) {
        throw HttpError.notFound('Listing not found');
      }

      // Verify template exists
      const [template] = await sql`SELECT id, name FROM document_templates WHERE id = ${templateId} AND is_active = true`;
      if (!template) {
        throw HttpError.notFound('Template not found');
      }

      // Check if listing has any processed documents
      const [docCount] = await sql`
        SELECT COUNT(*) as count FROM listing_documents 
        WHERE listing_id = ${listingId} AND extraction_status = 'completed'
      `;
      
      if (parseInt(docCount.count) === 0) {
        throw HttpError.badRequest('No processed documents found for this listing. Please upload and wait for documents to process first.');
      }

      // Create generated document record
      const [generatedDoc] = await sql`
        INSERT INTO generated_documents (
          listing_id,
          template_id,
          generation_status
        ) VALUES (
          ${listingId},
          ${templateId},
          'pending'
        )
        RETURNING *
      `;

      // Queue generation job
      await queueDocumentGeneration({
        generatedDocId: generatedDoc.id,
        listingId,
        templateId,
      });

      res.status(202).json({
        success: true,
        generatedDocument: generatedDoc,
        message: 'Document generation queued',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/listings/:id/generated
 * List generated documents for a listing
 */
router.get(
  '/listings/:id/generated',
  authenticate,
  requireRole('admin', 'editor'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: listingId } = req.params;

      const generatedDocs = await sql`
        SELECT 
          gd.*,
          dt.name as template_name
        FROM generated_documents gd
        JOIN document_templates dt ON dt.id = gd.template_id
        WHERE gd.listing_id = ${listingId}
        ORDER BY gd.created_at DESC
      `;

      res.json({ generatedDocuments: generatedDocs });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/generated/:id/download/:format
 * Download generated document (pdf or docx)
 */
router.get(
  '/generated/:id/download/:format',
  authenticate,
  requireRole('admin', 'editor'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, format } = req.params;

      if (!['pdf', 'docx'].includes(format)) {
        throw HttpError.badRequest('Invalid format. Use pdf or docx.');
      }

      const [doc] = await sql`
        SELECT * FROM generated_documents WHERE id = ${id}
      `;

      if (!doc) {
        throw HttpError.notFound('Generated document not found');
      }

      if (doc.generation_status !== 'completed') {
        throw HttpError.badRequest(`Document is not ready. Status: ${doc.generation_status}`);
      }

      const filePath = format === 'pdf' ? doc.pdf_path : doc.docx_path;
      
      if (!filePath) {
        throw HttpError.notFound(`${format.toUpperCase()} file not available`);
      }

      const absolutePath = path.join(env.UPLOAD_DIR, filePath);
      
      if (!fs.existsSync(absolutePath)) {
        throw HttpError.notFound('File not found on server');
      }

      const contentType = format === 'pdf' 
        ? 'application/pdf' 
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="generated-document.${format}"`);
      
      const stream = fs.createReadStream(absolutePath);
      stream.pipe(res);
    } catch (error) {
      next(error);
    }
  }
);

// Multer error handler
router.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: 'File too large. Maximum size is 20MB.' });
      return;
    }
    res.status(400).json({ error: err.message });
    return;
  }
  next(err);
});

export default router;

