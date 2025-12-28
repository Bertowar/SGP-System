
import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

// Helper for pure console table
const printTable = (rows: any[]) => {
    if (!rows || rows.length === 0) {
        console.log('No results.');
        return;
    }
    console.table(rows);
};

const runCheck = async () => {
    let connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.error('Error: DATABASE_URL missing.');
        process.exit(1);
    }
    const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

    try {
        console.log('--- Checking Tables RLS Status ---');
        const resTables = await pool.query(`
            SELECT tablename, rowsecurity 
            FROM pg_tables 
            WHERE schemaname = 'public' 
            ORDER BY tablename;
        `);
        printTable(resTables.rows);

        console.log('\n--- Checking RLS Policies ---');
        const resPolicies = await pool.query(`
            SELECT tablename, policyname, cmd, qual, with_check 
            FROM pg_policies 
            WHERE schemaname = 'public' 
            ORDER BY tablename, policyname;
        `);
        printTable(resPolicies.rows);

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
};

runCheck();
