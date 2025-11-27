import { Router, Request, Response, NextFunction } from 'express';
import { sql } from '../db';
import { HttpError } from '../utils/httpError';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

/**
 * GET /api/templates
 * List all active templates
 */
router.get(
  '/',
  authenticate,
  requireRole('admin', 'editor'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const templates = await sql`
        SELECT 
          id, name, description, output_formats, is_active, created_at,
          (SELECT COUNT(*) FROM template_variables WHERE template_id = document_templates.id) as variable_count
        FROM document_templates
        WHERE is_active = true
        ORDER BY name ASC
      `;

      res.json({ templates });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/templates/:id
 * Get template with its variables
 */
router.get(
  '/:id',
  authenticate,
  requireRole('admin', 'editor'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const [template] = await sql`
        SELECT * FROM document_templates WHERE id = ${id}
      `;

      if (!template) {
        throw HttpError.notFound('Template not found');
      }

      const variables = await sql`
        SELECT * FROM template_variables 
        WHERE template_id = ${id}
        ORDER BY sort_order ASC, variable_name ASC
      `;

      res.json({ 
        template: {
          ...template,
          variables,
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/templates
 * Create a new template (admin only)
 */
router.post(
  '/',
  authenticate,
  requireRole('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, description, templateContent, outputFormats } = req.body;

      if (!name || !templateContent) {
        throw HttpError.badRequest('Name and template content are required');
      }

      const [template] = await sql`
        INSERT INTO document_templates (
          name,
          description,
          template_content,
          output_formats
        ) VALUES (
          ${name},
          ${description || null},
          ${templateContent},
          ${outputFormats || ['pdf', 'docx']}
        )
        RETURNING *
      `;

      res.status(201).json({ template });
    } catch (error: any) {
      if (error.code === '23505') { // Unique violation
        next(HttpError.badRequest('A template with this name already exists'));
        return;
      }
      next(error);
    }
  }
);

/**
 * PUT /api/templates/:id
 * Update a template (admin only)
 */
router.put(
  '/:id',
  authenticate,
  requireRole('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { name, description, templateContent, outputFormats, isActive } = req.body;

      const [existing] = await sql`SELECT id FROM document_templates WHERE id = ${id}`;
      if (!existing) {
        throw HttpError.notFound('Template not found');
      }

      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (templateContent !== undefined) updates.template_content = templateContent;
      if (outputFormats !== undefined) updates.output_formats = outputFormats;
      if (isActive !== undefined) updates.is_active = isActive;

      const [template] = await sql`
        UPDATE document_templates
        SET ${sql(updates)}
        WHERE id = ${id}
        RETURNING *
      `;

      res.json({ template });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/templates/:id/variables
 * Add a variable to a template
 */
router.post(
  '/:id/variables',
  authenticate,
  requireRole('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: templateId } = req.params;
      const { 
        variableName, 
        displayName, 
        description, 
        ragQuestion, 
        fallbackValue,
        variableType,
        required,
        sortOrder 
      } = req.body;

      if (!variableName) {
        throw HttpError.badRequest('Variable name is required');
      }

      // Verify template exists
      const [template] = await sql`SELECT id FROM document_templates WHERE id = ${templateId}`;
      if (!template) {
        throw HttpError.notFound('Template not found');
      }

      const [variable] = await sql`
        INSERT INTO template_variables (
          template_id,
          variable_name,
          display_name,
          description,
          rag_question,
          fallback_value,
          variable_type,
          required,
          sort_order
        ) VALUES (
          ${templateId},
          ${variableName},
          ${displayName || variableName},
          ${description || null},
          ${ragQuestion || null},
          ${fallbackValue || null},
          ${variableType || 'text'},
          ${required || false},
          ${sortOrder || 0}
        )
        RETURNING *
      `;

      res.status(201).json({ variable });
    } catch (error: any) {
      if (error.code === '23505') { // Unique violation
        next(HttpError.badRequest('A variable with this name already exists in this template'));
        return;
      }
      next(error);
    }
  }
);

/**
 * DELETE /api/templates/:templateId/variables/:variableId
 * Delete a variable from a template
 */
router.delete(
  '/:templateId/variables/:variableId',
  authenticate,
  requireRole('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { templateId, variableId } = req.params;

      const result = await sql`
        DELETE FROM template_variables 
        WHERE id = ${variableId} AND template_id = ${templateId}
      `;

      if (result.count === 0) {
        throw HttpError.notFound('Variable not found');
      }

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

