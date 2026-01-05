
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const code = '9655';
    console.log(`Searching for Product Code ${code}...`);

    // 1. Fetch Product by Code (Try string and number)
    const { data: products, error } = await supabase
        .from('products')
        .select('*')
        .eq('code', code);

    if (error) { console.error("Error fetching product:", error); return; }

    if (products.length === 0) {
        console.log("Product NOT FOUND.");
        return;
    }

    const product = products[0];
    console.log(`Product Found: ID=${product.id} | Code=${product.codigo} | Name=${product.produto}`);

    // 2. Fetch Route for this Product ID
    const { data: routes, error: errRoute } = await supabase
        .from('product_routes')
        .select('*, steps:route_steps(*)')
        .eq('product_id', product.id)
        .eq('active', true);

    if (errRoute) console.error("Error fetching route:", errRoute);

    if (routes && routes.length > 0) {
        console.log(`Active Route Found: ID=${routes[0].id} | Version=${routes[0].version}`);
        console.log(`Steps: ${routes[0].steps.length}`);
    } else {
        console.log("NO ACTIVE ROUTE FOUND linked to this Product ID.");

        // Debug: Check ANY routes for this product?
        const { data: allRoutes } = await supabase.from('product_routes').select('*').eq('product_id', product.id);
        console.log(`Total Routes for Product: ${allRoutes?.length || 0}`);
    }
}
run();
