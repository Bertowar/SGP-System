
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const runDebug = async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        console.log('--- RLS Status for Products & Materials ---');
        const resRLS = await pool.query(`
            SELECT tablename, rowsecurity 
            FROM pg_tables 
            WHERE tablename IN ('products', 'raw_materials') AND schemaname = 'public';
        `);
        console.table(resRLS.rows);

        console.log('\n--- Count of Rows with NULL organization_id ---');
        const tables = ['products', 'raw_materials', 'inventory_transactions', 'suppliers'];
        for (const t of tables) {
            const resCount = await pool.query(`SELECT count(*) as null_org_count FROM ${t} WHERE organization_id IS NULL`);
            console.log(`${t}: ${resCount.rows[0].null_org_count}`);
        }

        console.log('\n--- Definition of get_current_org_id ---');
        const resFunc = await pool.query(`
            SELECT pg_get_functiondef(oid) 
            FROM pg_proc 
            WHERE proname = 'get_current_org_id';
        `);
        if (resFunc.rows.length > 0) {
            console.log(resFunc.rows[0].pg_get_functiondef);
        } else {
            console.log("Function get_current_org_id NOT FOUND.");
        }

    } catch (e) { console.error(e); }
    finally { await pool.end(); }
};
runDebug();
