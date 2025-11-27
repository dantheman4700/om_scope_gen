import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { env } from '../config/env';
import { HttpError } from '../utils/httpError';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// Configure storage
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const type = req.params.type || 'general';
    let dir: string;
    
    switch (type) {
      case 'pitch-deck':
        dir = path.join(env.UPLOAD_DIR, 'pitch-decks');
        break;
      case 'patent-file':
        dir = path.join(env.UPLOAD_DIR, 'patent-files');
        break;
      default:
        dir = path.join(env.UPLOAD_DIR, 'general');
    }

    // Ensure directory exists
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

// File filter
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Allowed MIME types
  const allowedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
    'application/vnd.ms-excel', // xls
    'text/csv',
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Allowed: PDF, PPTX, DOCX, XLSX, XLS, CSV'));
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
 * POST /api/upload/:type
 * Upload a file (admin/editor only)
 */
router.post(
  '/:type',
  authenticate,
  requireRole('admin', 'editor'),
  upload.single('file'),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw HttpError.badRequest('No file uploaded');
      }

      const { type } = req.params;
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      
      // Build public URL
      let publicPath: string;
      switch (type) {
        case 'pitch-deck':
          publicPath = `/uploads/pitch-decks/${req.file.filename}`;
          break;
        case 'patent-file':
          publicPath = `/uploads/patent-files/${req.file.filename}`;
          break;
        default:
          publicPath = `/uploads/general/${req.file.filename}`;
      }

      res.status(201).json({
        success: true,
        file: {
          filename: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size,
          mimeType: req.file.mimetype,
          url: `${baseUrl}${publicPath}`,
          path: publicPath,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/upload/:type/:filename
 * Delete a file (admin/editor only)
 */
router.delete(
  '/:type/:filename',
  authenticate,
  requireRole('admin', 'editor'),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type, filename } = req.params;
      
      let dir: string;
      switch (type) {
        case 'pitch-deck':
          dir = path.join(env.UPLOAD_DIR, 'pitch-decks');
          break;
        case 'patent-file':
          dir = path.join(env.UPLOAD_DIR, 'patent-files');
          break;
        default:
          dir = path.join(env.UPLOAD_DIR, 'general');
      }

      const filePath = path.join(dir, filename);

      // Security: ensure we're not escaping the upload directory
      if (!filePath.startsWith(env.UPLOAD_DIR)) {
        throw HttpError.forbidden('Invalid file path');
      }

      if (!fs.existsSync(filePath)) {
        throw HttpError.notFound('File not found');
      }

      fs.unlinkSync(filePath);

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

// Error handler for multer errors
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

