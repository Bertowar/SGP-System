
import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
    console.log('Starting SQL fix application...');
    console.log('CWD:', process.cwd());
    const envPath = path.resolve(process.cwd(), '.env');
    console.log('.env path:', envPath);
    console.log('.env exists:', fs.existsSync(envPath));

    const result = dotenv.config({ path: envPath });
    if (result.error) {
        console.error('Dotenv error:', result.error);
    } else {
        console.log('Dotenv parsed keys:', Object.keys(result.parsed || {}));
    }

    const sqlFileArg = process.argv[2];
    const connectionStringArg = process.argv[3];

    if (!sqlFileArg) {
        console.error('Error: SQL file path not provided.');
        console.log('Usage: npx tsx run_fix.ts <path_to_sql_file> [db_url]');
        process.exit(1);
    }

    // Resolve absolute path
    const sqlPath = path.isAbsolute(sqlFileArg) ? sqlFileArg : path.join(process.cwd(), sqlFileArg);

    // Allow user to pass connection string as arg or env
    const connectionString = connectionStringArg || process.env.DATABASE_URL;

    if (!connectionString) {
        console.error('Error: DATABASE_URL not found in environment variables and not provided as argument.');
        console.log('Usage: npx tsx run_fix.ts <path_to_sql_file> "postgres://user:pass@host:port/db"');
        process.exit(1);
    }

    const pool = new Pool({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log(`Reading SQL file from: ${sqlPath}`);
        if (!fs.existsSync(sqlPath)) {
            throw new Error(`File not found: ${sqlPath}`);
        }

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
