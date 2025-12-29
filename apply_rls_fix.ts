
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const run = async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        const sql = fs.readFileSync('./supabase/migrations/20251228_fix_raw_materials_rls.sql', 'utf8');
        console.log("Applying Migration: 20251228_fix_raw_materials_rls.sql");
        await pool.query(sql);
        console.log("Migration applied successfully.");
    } catch (e) {
        console.error("ERROR APPLYING MIGRATION:", e);
    } finally {
        await pool.end();
    }
};
run();
