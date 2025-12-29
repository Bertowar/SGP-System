
import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        const sql = fs.readFileSync('supabase/migrations/20251229_add_purchase_ratings.sql', 'utf8');
        await pool.query(sql);
        console.log("Migration applied successfully.");
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
};
run();
