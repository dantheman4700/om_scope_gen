import postgres from 'postgres';
import { env } from '../config/env';

// Create postgres connection
export const sql = postgres(env.DATABASE_URL, {
  max: 10, // Max connections in pool
  idle_timeout: 20,
  connect_timeout: 10,
});

// Test connection
export async function testConnection(): Promise<boolean> {
  try {
    await sql`SELECT 1`;
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

// Graceful shutdown
export async function closeConnection(): Promise<void> {
  await sql.end();
  console.log('Database connection closed');
}

