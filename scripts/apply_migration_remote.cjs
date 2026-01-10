
const { Client } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load env vars
dotenv.config();

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
    console.error("DATABASE_URL not found in .env");
    process.exit(1);
}

const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log("Connecting to database...");
        await client.connect();
        console.log("Connected.");

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
