import pg from 'pg';
const { Client } = pg;

const connectionString = 'postgres://postgres:j4pCwB6WqbcnnFnb@db.ojnrtqejmnssmkgywufa.supabase.co:5432/postgres';

async function run() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        console.log("Connected to DB.");

        // Find Product using broader search
        const resProd = await client.query("SELECT code, name, id FROM products WHERE name ILIKE $1 LIMIT 5", ['%P-08%']);
        if (resProd.rows.length === 0) {
            console.log("Product NOT found.");
            return;
        }

        console.log("Found Products:", resProd.rows);
        const product = resProd.rows[0]; // Take the first one

        // Find BOM
        console.log(`Checking BOM for code: ${product.code}`);
        const resBom = await client.query("SELECT id, quantity_required, material_id FROM product_bom WHERE product_code = $1", [product.code]);
        console.log("Parent BOM:", JSON.stringify(resBom.rows, null, 2));

        // Find explicit material '87cd59ea-48a2-46c8-b0f0-a444b9955bb9' (Bobina)
        const targetMatId = '87cd59ea-48a2-46c8-b0f0-a444b9955bb9';
        // Or loop all
        for (const item of resBom.rows) {
            const matRes = await client.query("SELECT code, name FROM raw_materials WHERE id = $1", [item.material_id]);
            if (matRes.rows.length === 0) continue;
            const mat = matRes.rows[0];
            console.log(`BOM Item: ${mat.name} (Qty: ${item.quantity_required})`);

            // Check if it is a product
            const childProdRes = await client.query("SELECT code, name FROM products WHERE code = $1", [mat.code]);
            if (childProdRes.rows.length > 0) {
                const child = childProdRes.rows[0];
                console.log(` -> Found Child Product: ${child.name}`);

                // Fetch Name of the 100 qty material
                const problemMatId = '3eef0b2c-53f1-486b-8744-7481501a70a5';
                const resProb = await client.query("SELECT name FROM raw_materials WHERE id = $1", [problemMatId]);
                if (resProb.rows.length > 0) {
                    console.log(` !!! PROBLEM MATERIAL (Qty 100): ${resProb.rows[0].name}`);
                }

                // Fetch Child BOM
                const childBom = await client.query("SELECT id, quantity_required, material_id FROM product_bom WHERE product_code = $1", [child.code]);
                console.log(` -> Child BOM for ${child.name}:`, JSON.stringify(childBom.rows, null, 2));
            }
        }

    } catch (e) {
        console.error("Script Error:", e);
    } finally {
        await client.end();
    }
}

run();
