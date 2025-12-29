
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        console.log("--- PROFILES ---");
        const prodRes = await pool.query(`select id, organization_id, is_super_admin from profiles`);
        prodRes.rows.forEach(r => console.log(`${r.id} | ${r.organization_id} | SA: ${r.is_super_admin}`));

        if (prodRes.rows.length > 0) {
            const orgId = prodRes.rows[0].organization_id;
            console.log(`\n--- MATERIALS FOR ORG ${orgId} ---`);
            const matRes = await pool.query(`select id, name, code, organization_id from raw_materials where organization_id = $1`, [orgId]);
            matRes.rows.forEach(r => console.log(`${r.code} - ${r.name}`));
        } else {
            console.log("No profiles found.");
        }

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await pool.end();
    }
};
run();
