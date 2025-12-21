
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
    console.log('Starting SQL fix application...');

    // Allow user to pass connection string as arg or env
    const connectionString = process.argv[2] || process.env.DATABASE_URL;

    if (!connectionString) {
        console.error('Error: DATABASE_URL not found in environment variables and not provided as argument.');
        console.log('Usage: npx tsx run_fix.ts "postgres://user:pass@host:port/db"');
        process.exit(1);
    }

    const pool = new Pool({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const sqlPath = path.join(process.cwd(), 'fix_thermo_scrap.sql');
        console.log(`Reading SQL file from: ${sqlPath}`);

        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log(`SQL file size: ${sql.length} bytes`);

        await pool.query(sql);
        console.log('SUCCESS: SQL fix applied successfully!');
    } catch (e: any) {
        console.error('Error executing SQL:', e.message);
        if (e.position) {
            console.error(`Error position: ${e.position}`);
        }
        process.exit(1);
    } finally {
        await pool.end();
    }
}

run();
