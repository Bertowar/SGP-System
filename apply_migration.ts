import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const runMigration = async () => {
    let connectionString = process.argv[2] || process.env.DATABASE_URL;

    // Helper to construct Supabase URL if just a password is provided (assuming default project from context)
    // Project ID from run_fix_inline.ts: ojnrtqejmnssmkgywufa
    if (connectionString && !connectionString.startsWith('postgres')) {
        console.log('Argument detected as password. Constructing connection string...');
        connectionString = `postgresql://postgres:${connectionString}@db.ojnrtqejmnssmkgywufa.supabase.co:5432/postgres`;
    }

    if (!connectionString) {
        console.error('Error: DATABASE_URL missing in .env and no password provided as argument.');
        console.log('Usage: npx tsx apply_migration.ts "YOUR_DB_PASSWORD"');
        process.exit(1);
    }

    const pool = new Pool({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const sqlPath = path.resolve('./migration_stock_trigger.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Connecting to database...');
        await pool.query('SELECT NOW()'); // Test connection

        console.log('Applying migration from:', sqlPath);
        await pool.query(sql);
        console.log('SUCCESS: Stock Update Trigger created successfully!');

    } catch (e: any) {
        console.error('Error executing migration:', e.message);
    } finally {
        await pool.end();
    }
};

runMigration();
