
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        console.log("--- RECENT RAW MATERIALS (All Orgs) ---");
        const res = await pool.query(`
            SELECT id, code, name, "group", organization_id, created_at 
            FROM raw_materials 
            ORDER BY created_at DESC 
            LIMIT 10
        `);
        res.rows.forEach(r => {
            console.log(`[${r.created_at.toISOString()}] Org: ${r.organization_id} | Group: ${r.group} | Code: ${r.code} | Name: ${r.name}`);
        });

        console.log("\n--- USER PROFILES ---");
        const profiles = await pool.query(`SELECT id, organization_id FROM profiles`);
        profiles.rows.forEach(r => {
            console.log(`User: ${r.id} -> Org: ${r.organization_id}`);
        });

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await pool.end();
    }
};
run();
