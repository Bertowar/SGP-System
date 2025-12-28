
import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
    console.log('Starting SQL Migration: 20251227_isolate_complete.sql...');

    if (!process.env.DATABASE_URL) {
        console.error('Error: DATABASE_URL not found in environment variables.');
        process.exit(1);
    }

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '20251227_isolate_complete.sql');
        console.log(`Reading SQL from: ${sqlPath}`);

        if (!fs.existsSync(sqlPath)) {
            throw new Error(`File not found: ${sqlPath}`);
        }

        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log(`Executing SQL (${sql.length} bytes)...`);

        await pool.query(sql);
        console.log('Migration applied successfully!');
    } catch (e) {
        console.error('Error executing SQL migration:', e);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

run();
