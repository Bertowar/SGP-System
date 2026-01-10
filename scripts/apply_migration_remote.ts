
import { Client } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load env vars
dotenv.config();

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
    console.error("DATABASE_URL not found in .env");
    process.exit(1);
}

const client = new Client({
    connectionString: dbUrl,
    ssl: { discardDisconnect: false, rejectUnauthorized: false } // Supabase requires SSL
});

async function run() {
    try {
        await client.connect();
        console.log("Connected to database...");

        // Define the SQL directly or read from file
        // To be safe and idempotent, we use IF NOT EXISTS logic
        const sql = `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_boms' AND column_name = 'production_rate_per_hour') THEN
                    ALTER TABLE product_boms ADD COLUMN production_rate_per_hour NUMERIC DEFAULT NULL;
                    RAISE NOTICE 'Column production_rate_per_hour added.';
                ELSE
                    RAISE NOTICE 'Column production_rate_per_hour already exists.';
                END IF;
            END
            $$;

            -- Refresh PostgREST schema cache
            NOTIFY pgrst, 'reload config';
        `;

        console.log("Executing migration...");
        await client.query(sql);
        console.log("Migration executed successfully.");

    } catch (err) {
        console.error("Error executing migration:", err);
    } finally {
        await client.end();
    }
}

run();
