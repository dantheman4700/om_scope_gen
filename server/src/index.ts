import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';

import { env } from './config/env';
import { testConnection, closeConnection } from './db';
import { errorHandler } from './middleware/errorHandler';

// Import routes
import authRoutes from './routes/auth';
import listingsRoutes from './routes/listings';
import prospectsRoutes from './routes/prospects';
import tenantsRoutes from './routes/tenants';
import usersRoutes from './routes/users';
import uploadRoutes from './routes/upload';
import servicesRoutes from './routes/services';
import documentsRoutes from './routes/documents';
import templatesRoutes from './routes/templates';

// Import workers
import { startDocumentWorker, startGenerationWorker } from './services/documentWorker';

const app = express();

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    // Allow localhost on any port during development
    if (env.NODE_ENV === 'development' && origin.includes('localhost')) {
      return callback(null, true);
    }
    
    // Check against configured frontend URL
    if (origin === env.FRONTEND_URL) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/listings', listingsRoutes);
app.use('/api/prospects', prospectsRoutes);
app.use('/api/tenants', tenantsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api', servicesRoutes); // scrape-website, search-trademarks, validate-dns, webhooks
app.use('/api', documentsRoutes); // document upload, generation
app.use('/api/templates', templatesRoutes); // template management

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
async function start() {
  // Test database connection
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('Failed to connect to database. Exiting.');
    process.exit(1);
  }

  // Start background workers for document processing
  try {
    const documentWorker = startDocumentWorker();
    const generationWorker = startGenerationWorker();
    console.log('📄 Document processing workers started');
  } catch (error) {
    console.warn('⚠️ Could not start workers (Redis may not be available):', (error as Error).message);
  }

  app.listen(env.PORT, () => {
    console.log(`🚀 Server running on http://localhost:${env.PORT}`);
    console.log(`📁 Uploads directory: ${env.UPLOAD_DIR}`);
  });
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  await closeConnection();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down...');
  await closeConnection();
  process.exit(0);
});

start();

