import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
const { Client } = pg;

const connectionString = 'postgres://postgres:j4pCwB6WqbcnnFnb@db.ojnrtqejmnssmkgywufa.supabase.co:5432/postgres';

async function run() {
    console.log("DEBUG_SCRIPT_START");
    const client = new Client({ connectionString });
    try {
        await client.connect();

        const productName = 'P-08 EMB RET C/TP ARTIC NOBRE';

        // 1. Find Product
        const resProd = await client.query("SELECT * FROM products WHERE name ILIKE $1", ['%' + productName + '%']);
        if (resProd.rows.length === 0) { console.log(JSON.stringify({ found: false })); return; }
        const product = resProd.rows[0];

        // 2. Find Latest OP
        console.log("SEARCHING_OP_START");
        const resOp = await client.query(`
            SELECT * FROM production_orders 
            WHERE product_code = $1 
            ORDER BY created_at DESC LIMIT 1
        `, [product.code]);

        if (resOp.rows.length > 0) {
            const op = resOp.rows[0];
            console.log(JSON.stringify({ op: op }));

            const resRes = await client.query(`
                SELECT r.id, r.quantity, m.name, m.unit
                FROM material_reservations r
                JOIN raw_materials m ON r.material_id = m.id
                WHERE r.production_order_id = $1
             `, [op.id]);
            console.log("OP_RESERVATIONS");
            console.log(JSON.stringify(resRes.rows));

            // Check Steps
            const resSteps = await client.query(`
                SELECT * FROM production_order_steps WHERE production_order_id = $1
             `, [op.id]);
            console.log("OP_STEPS");
            console.log(JSON.stringify(resSteps.rows));

            // 3. Find Child OP (Extrusion)
            // Look for OPs with parent_order_id = op.id
            const resChildOp = await client.query(`
                SELECT * FROM production_orders WHERE parent_order_id = $1
             `, [op.id]);

            if (resChildOp.rows.length > 0) {
                const childOp = resChildOp.rows[0];
                console.log(JSON.stringify({ child_op: childOp }));

                const resChildRes = await client.query(`
                    SELECT r.id, r.quantity, m.name, m.unit
                    FROM material_reservations r
                    JOIN raw_materials m ON r.material_id = m.id
                    WHERE r.production_order_id = $1
                 `, [childOp.id]);
                console.log("CHILD_OP_RESERVATIONS");
                console.log(JSON.stringify(resChildRes.rows));
            } else {
                console.log("No child OP found.");
            }

        } else {
            console.log("OP not found for this product.");
        }

    } catch (e) {
        console.error("ERROR_JSON:", JSON.stringify(e));
    } finally {
        await client.end();
    }
}

run();
