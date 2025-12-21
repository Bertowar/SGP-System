```
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

async function run() {
    console.log('Starting SQL fix application...');
    
    if (!process.env.DATABASE_URL) {
        console.error('Error: DATABASE_URL not found in environment variables.');
        process.exit(1);
    }

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false } // Often needed for hosted DBs
    });

    try {
        const sqlPath = path.join(process.cwd(), 'database_dashboard_v2.sql');
        console.log(`Reading SQL file from: ${ sqlPath } `);
        
        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log(`SQL file size: ${ sql.length } bytes`);

        // Check for suspicious non-ASCII characters or translated keywords just in case
        if (sql.includes('ENTÃO') || sql.includes('SENÃO')) {
             console.error('CRITICAL: Portuguese keywords found in SQL file! Aborting.');
             process.exit(1);
        }

        await pool.query(sql);
        console.log('SQL fix applied successfully!');
    } catch (e) {
        console.error('Error executing SQL:', e);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

run();
```
