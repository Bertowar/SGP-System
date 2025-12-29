
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        console.log('--- RAW MATERIALS RLS POLICIES ---');
        const res = await pool.query(`
            SELECT policyname, cmd, qual, with_check 
            FROM pg_policies 
            WHERE tablename = 'raw_materials'
        `);
        res.rows.forEach(r => {
            console.log(`POLICY: ${r.policyname} (${r.cmd})`);
            console.log(`  USING: ${r.qual}`);
            console.log(`  Expected WITH CHECK: ${r.with_check}`);
            console.log('---');
        });

        console.log('--- GET_CURRENT_ORG_ID DEFINITION ---');
        const funcRes = await pool.query(`
            SELECT pg_get_functiondef(oid) 
            FROM pg_proc 
            WHERE proname = 'get_current_org_id'
        `);
        if (funcRes.rows.length > 0) {
            console.log(funcRes.rows[0].pg_get_functiondef);
        }

    } catch (e) {
        console.error("ERROR EXECUTION:", e);
    } finally {
        await pool.end();
    }
};
run();
