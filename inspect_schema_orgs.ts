
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        console.log('--- TABLE: PROFILES ---');
        const resCols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'profiles'");
        console.table(resCols.rows);

        console.log('--- FUNCTION: get_current_org_id ---');
        const resFunc = await pool.query("SELECT prosrc FROM pg_proc WHERE proname = 'get_current_org_id'");
        console.log(resFunc.rows[0]?.prosrc);

        console.log('--- TABLE: ORGANIZATION_MEMBERS (Check if exists) ---');
        const resMembers = await pool.query("SELECT * FROM information_schema.tables WHERE table_name = 'organization_members'");
        console.log('Exists:', resMembers.rows.length > 0);

    } catch (e) { console.error(e); }
    finally { await pool.end(); }
};
run();
