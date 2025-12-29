
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        // 1. Get an existing material to test or create one
        // Let's use the one created in browser test if exists, or create a temp one.
        const orgIdRes = await pool.query("SELECT id FROM organizations LIMIT 1");
        const orgId = orgIdRes.rows[0].id;

        const code = `TEST-TRX-${Date.now()}`;
        const insertRes = await pool.query(`
            INSERT INTO raw_materials (code, name, organization_id, current_stock)
            VALUES ($1, 'Test Item Logic', $2, 10.0)
            RETURNING id, current_stock
        `, [code, orgId]);

        const matId = insertRes.rows[0].id;
        console.log(`[INIT] Created Material ${code} with Stock: ${insertRes.rows[0].current_stock}`);

        // 2. Insert ADJ +5
        await pool.query(`
            INSERT INTO inventory_transactions (material_id, type, quantity, organization_id, notes)
            VALUES ($1, 'ADJ', 5.0, $2, 'Testing ADJ +5')
        `, [matId, orgId]);

        const res1 = await pool.query(`SELECT current_stock FROM raw_materials WHERE id = $1`, [matId]);
        console.log(`[S1] ADJ+5 -> Stock: ${res1.rows[0].current_stock}`);

        // 3. Insert ADJ -3
        await pool.query(`
            INSERT INTO inventory_transactions (material_id, type, quantity, organization_id, notes)
            VALUES ($1, 'ADJ', -3.0, $2, 'Test -3')
        `, [matId, orgId]);

        const res2 = await pool.query(`SELECT current_stock FROM raw_materials WHERE id = $1`, [matId]);
        console.log(`[S2] ADJ-3 -> Stock: ${res2.rows[0].current_stock}`);

        // Clean up
        await pool.query(`DELETE FROM inventory_transactions WHERE material_id = $1`, [matId]);
        await pool.query(`DELETE FROM raw_materials WHERE id = $1`, [matId]);

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
};
run();
