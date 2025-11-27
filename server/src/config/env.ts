import dotenv from 'dotenv';
import path from 'path';

// Load .env from server directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  // Server
  PORT: parseInt(process.env.PORT || '3001', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Database
  DATABASE_URL: process.env.DATABASE_URL || 'postgres://localhost:5432/ma_platform',
  
  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  
  // File uploads
  UPLOAD_DIR: process.env.UPLOAD_DIR || path.resolve(__dirname, '../../uploads'),
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '20971520', 10), // 20MB default
  
  // Frontend URL (for CORS)
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  
  // AI Services
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
};

// Validate required env vars in production
if (env.NODE_ENV === 'production') {
  const required = ['DATABASE_URL', 'JWT_SECRET'];
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
}

