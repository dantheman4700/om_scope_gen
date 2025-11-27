import fs from 'fs';
import path from 'path';
import { sql, closeConnection } from './index';

async function migrate() {
  console.log('Running database migrations...');

  try {
    // Get all migration files sorted by name
    const migrationsDir = path.join(__dirname, '../../migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`Found ${migrationFiles.length} migration files.`);

    for (const file of migrationFiles) {
      const migrationPath = path.join(migrationsDir, file);
      const migrationSql = fs.readFileSync(migrationPath, 'utf-8');

      console.log(`Executing ${file}...`);
      try {
        await sql.unsafe(migrationSql);
        console.log(`  ✅ ${file} completed`);
      } catch (error: any) {
        // Check if it's just a "already exists" type error
        if (error.message?.includes('already exists') || error.code === '42P07' || error.code === '42710') {
          console.log(`  ⊘ ${file} - some objects already exist, skipping`);
        } else {
          throw error;
        }
      }
    }
    
    console.log('✅ All migrations completed successfully!');
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message || error);
    process.exit(1);
  } finally {
    await closeConnection();
  }
}

migrate();
