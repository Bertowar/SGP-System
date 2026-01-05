const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:\\Users\\berto\\DEV\\SGP-System\\.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectEntries() {
    const today = new Date().toISOString().split('T')[0];
    console.log(`Fetching entries for date: ${today}`);

    const { data, error } = await supabase
        .from('production_entries')
        .select('*')
        .eq('date', today)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error:", error);
        return;
    }

    if (!data || data.length === 0) {
        console.log("No entries found for today.");
        return;
    }

    console.log(`Found ${data.length} entries:`);
    data.forEach(e => {
        const isDowntime = e.downtime_minutes > 0;
        console.log(`[${e.id.substring(0, 5)}...] Machine: ${e.machine_id} | Type: ${isDowntime ? 'PARADA' : 'PRODUÇÃO'} | Times: ${e.start_time} - ${e.end_time} | Downtime: ${e.downtime_minutes} min | OK: ${e.qty_ok} | Defect: ${e.qty_defect}`);
    });
}

inspectEntries();
