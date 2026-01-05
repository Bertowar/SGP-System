import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Manual .env parsing
const envPath = path.resolve(process.cwd(), '.env');
let envVars: any = {};
if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            envVars[key.trim()] = value.trim().replace(/^["']|["']$/g, ''); // Remove quotes
        }
    });
}
// Try local if .env is missing or variables missing
if (!envVars.VITE_SUPABASE_URL) {
    const localEnvPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(localEnvPath)) {
        const content = fs.readFileSync(localEnvPath, 'utf-8');
        content.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) {
                envVars[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
            }
        });
    }
}

const supabase = createClient(envVars.VITE_SUPABASE_URL!, envVars.VITE_SUPABASE_ANON_KEY!);

// We can't easily import 'inventoryService' because it imports 'supabaseClient' which fails.
// So we will COPY the fetching logic here for debugging.

async function run() {
    console.log("Fetching structure for 9008...");

    // 1. Resolve Product
    let product: any = null;

    // Debug: List all codes
    const { data: allProds } = await supabase.from('products').select('id, code, produto').limit(10);
    console.log("First 10 products:", allProds);

    const { data: prodById } = await supabase.from('products').select('*').eq('code', '9008').maybeSingle();

    if (prodById) product = prodById;

    // Try searching similar if not found
    if (!product) {
        const { data: fuzzy } = await supabase.from('products').select('*').ilike('code', '%9008%').limit(1);
        if (fuzzy && fuzzy.length > 0) product = fuzzy[0];
    }

    if (!product) { console.log('Product 9008 not found even with fuzzy search'); return; }
    console.log('Product Found:', product.id, product.code);

    // 2. Fetch Route (Operations)
    const { data: routeData, error } = await supabase
        .from('product_routes')
        .select('*, steps:route_steps(*)')
        .eq('product_id', product.id)
        .eq('active', true)
    //.single(); // Let's see if there are multiple?

    if (error) console.error("Route Error:", error);
    console.log("Routes Found:", routeData?.length);

    if (routeData) {
        routeData.forEach((r: any, i: number) => {
            console.log(`Route ${i} (ID: ${r.id}, Active: ${r.active}):`, r.steps?.length, "steps");
            r.steps?.forEach((s: any) => console.log(` - Step ${s.step_order}: ${s.description}`));
        });
    }
}

run();
