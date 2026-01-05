
import { createClient } from '@supabase/supabase-js';

// Hardcoded from .env
const SUPABASE_URL = 'https://ojnrtqejmnssmkgywufa.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qbnJ0cWVqbW5zc21rZ3l3dWZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwNzQ3MDYsImV4cCI6MjA3OTY1MDcwNn0.ZAWjuazCvo3TeW7JYkZY0_JvGm_nhUyvg39ySDsZua0'; // Anon key is fine if RLS allows or we mock user? 
// Actually Anon key might be restricted by RLS if I don't sign in.
// But I don't have a user credentials.
// Use SERVICE_KEY if possible? I don't have it.
// I have 'postgres' connection string. I can use that to bypass RLS with 'pg'! 
// BUT replicating logic in SQL is hard.
// I will try with Anon Key and see if I can fetch products. Public read might be on.
// If not, I will use 'postgres' client to fetch data, but logic is JS.

import pg from 'pg';
const { Client } = pg;
const connectionString = 'postgres://postgres:j4pCwB6WqbcnnFnb@db.ojnrtqejmnssmkgywufa.supabase.co:5432/postgres';

async function run() {
    console.log("REPRODUCE_START");
    const client = new Client({ connectionString });
    await client.connect();

    try {
        // 1. Fetch Product
        const productName = 'P-08 EMB RET C/TP ARTIC NOBRE';
        const resProd = await client.query("SELECT * FROM products WHERE name ILIKE $1", ['%' + productName + '%']);
        if (resProd.rows.length === 0) { console.log("Product not found"); return; }
        const product = resProd.rows[0];
        const orgId = product.organization_id;

        console.log(JSON.stringify({ step: 'init', product: product.name, code: product.code, orgId: orgId }));

        // 2. Mock DTO
        const dto = {
            productCode: product.code,
            quantity: 1000
        };
        console.log(JSON.stringify({ step: 'dto', quantity: dto.quantity }));

        // 3. BOM
        const resBom = await client.query("SELECT * FROM product_bom WHERE product_code = $1", [product.code]);
        const bomData = resBom.rows;
        console.log(JSON.stringify({ step: 'bom_fetched', count: bomData.length }));

        // 4. Explosion Logic
        for (const bomItem of bomData) {
            const qtyReq = Number(bomItem.quantity_required) || 0;
            const totalReq = qtyReq * dto.quantity;

            console.log(JSON.stringify({
                step: 'calc',
                material_id: bomItem.material_id,
                bom_qty: qtyReq,
                order_qty: dto.quantity,
                result: totalReq
            }));

            // Check Recursion (Bobina)
            // Fetch Material Code
            const resMat = await client.query("SELECT code FROM raw_materials WHERE id = $1", [bomItem.material_id]);
            const matCode = resMat.rows[0]?.code;

            // Check if Product exists
            const resChild = await client.query("SELECT * FROM products WHERE code = $1 AND organization_id = $2", [matCode, orgId]);
            if (resChild.rows.length > 0) {
                const child = resChild.rows[0];
                console.log(JSON.stringify({ step: 'recursion_found', child: child.name, code: child.code }));

                // Recursive Calc
                // Simulate Recursive CreateProductionOrder
                const childQty = totalReq; // 1327
                console.log(JSON.stringify({ step: 'child_op_start', child_qty: childQty }));

                // Child BOM
                const resChildBom = await client.query("SELECT * FROM product_bom WHERE product_code = $1", [child.code]);
                for (const childBomItem of resChildBom.rows) {
                    const cQtyReq = Number(childBomItem.quantity_required) || 0;
                    const cTotalReq = cQtyReq * childQty;
                    console.log(JSON.stringify({
                        step: 'child_calc',
                        material_id: childBomItem.material_id,
                        bom_qty: cQtyReq,
                        parent_qty: childQty,
                        result: cTotalReq
                    }));
                }
            }
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
