import { supabase } from './supabaseClient';
import { formatError } from './utils';

export interface SalesImportItem {
    reference: string;
    nobreId: string | null;
    qtyTotal: number;
    valTotal: number;
    // New Fields for Split Storage
    qtyMatriz: number;
    valMatriz: number;
    qtyFilial: number;
    valFilial: number;
}

export interface SalesImportResult {
    success: boolean;
    error?: string;
}

export interface SalesSummaryData {
    product_code: string;
    consolidated_id: string | null;
    qty_matriz: number;
    val_matriz: number;
    qty_filial: number;
    val_filial: number;
    qty_total: number;
    val_total: number;
    last_import_date: string;
}

export interface SalesMetrics {
    ipiMatriz: number;
    ipiFilial: number;
}

/**
 * Sends the Consolidated Data to the Database via RPC.
 * @param items List of consolidated items
 * @param fileDate Date of the imported file
 * @param forceOverride Check
 * @param metrics Optional metrics (IPI)
 */
export const processSalesImport = async (
    items: SalesImportItem[],
    fileDate: string,
    forceOverride: boolean = false,
    metrics?: SalesMetrics
): Promise<SalesImportResult> => {
    try {
        const { data, error } = await supabase.rpc('process_sales_import', {
            items: items,
            file_date: fileDate,
            force_override: forceOverride,
            metrics: metrics || {}
        });

        if (error) throw error;

        // The RPC returns a JSON object with { success: boolean, error?: string }
        return data as SalesImportResult;

    } catch (error: any) {
        console.error("Error processing sales import:", error);
        return {
            success: false,
            error: formatError(error)
        };
    }
};

/**
 * Fetches monthly metrics (IPI, etc)
 */
export const fetchSalesMetrics = async (year: number, month: number) => {
    try {
        const { data, error } = await supabase
            .from('sales_monthly_metrics')
            .select('*')
            .eq('year', year)
            .eq('month', month)
            .maybeSingle();

        if (error) return null;
        return data as { ipi_val_matriz: number, ipi_val_filial: number } | null;
    } catch (error) {
        return null;
    }
};

/**
 * Fetches the Monthly Accumulated Sales Summary.
 */
export const fetchSalesSummary = async (year: number, month: number): Promise<SalesSummaryData[]> => {
    try {
        const { data, error } = await supabase
            .from('sales_monthly_accumulated')
            .select(`
                product_code,
                consolidated_id,
                last_accumulated_qty_matriz,
                last_accumulated_val_matriz,
                last_accumulated_qty_filial,
                last_accumulated_val_filial,
                last_accumulated_qty,
                last_accumulated_value,
                last_import_date
            `)
            .eq('year', year)
            .eq('month', month);

        if (error) throw error;

        return data.map((d: any) => ({
            product_code: d.product_code,
            consolidated_id: d.consolidated_id,
            qty_matriz: d.last_accumulated_qty_matriz,
            val_matriz: d.last_accumulated_val_matriz,
            qty_filial: d.last_accumulated_qty_filial,
            val_filial: d.last_accumulated_val_filial,
            qty_total: d.last_accumulated_qty,
            val_total: d.last_accumulated_value,
            last_import_date: d.last_import_date
        }));
    } catch (error) {
        console.error("Error fetching sales summary:", error);
        return [];
    }
};

export interface DailySalesData {
    date: string;
    total_qty: number;
    total_val: number;
    matriz_val: number;
    filial_val: number;
}

/**
 * Fetches daily movements for the chart.
 */
export const fetchDailyMovements = async (year: number, month: number): Promise<DailySalesData[]> => {
    try {
        // Construct date range
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // Last day of month

        const { data, error } = await supabase
            .from('sales_daily_movements')
            .select('date, daily_qty, daily_value, daily_val_matriz, daily_val_filial')
            .gte('date', startDate)
            .lte('date', endDate)
            .order('date', { ascending: true });

        if (error) throw error;

        // Group by date (in case of multiple entries per day - though usually one per product)
        // We want a summation per day across all products.
        const dailyMap = new Map<string, DailySalesData>();

        data.forEach((item: any) => {
            const date = item.date;
            if (!dailyMap.has(date)) {
                dailyMap.set(date, { date, total_qty: 0, total_val: 0, matriz_val: 0, filial_val: 0 });
            }
            const current = dailyMap.get(date)!;
            current.total_qty += item.daily_qty || 0;
            current.total_val += item.daily_value || 0;
            current.matriz_val += item.daily_val_matriz || 0;
            current.filial_val += item.daily_val_filial || 0;
        });

        return Array.from(dailyMap.values());

    } catch (error) {
        console.error("Error fetching daily movements:", error);
        return [];
    }
};


export interface AnnualSalesData {
    month: number;
    total_products: number;
    total_ipi: number;
    total_revenue: number; // Products + IPI
}

/**
 * Fetches aggregated sales data for an entire year (Monthly granulation).
 * Used for annual comparison charts.
 */
export const fetchAnnualSales = async (year: number): Promise<AnnualSalesData[]> => {
    try {
        // 1. Fetch Product Totals per Month
        // We need to sum last_accumulated_value for all products where year = X, grouped by month.
        // Supabase standard client doesn't support "group by" cleanly without RPC or view, 
        // but for now we can fetch distinct product/month sums or use a simple loop if dataset isn't huge.
        // BETTER: Create a DB View or RPC? 
        // For speed/simplicity without migration: Fetch all monthly_accumulated for the year and aggregate in JS.
        // Assuming ~1000 products * 12 months = 12000 rows. It's handleable but not ideal.
        // Let's check sales_monthly_metrics first, maybe we can rely on that if we had product totals there? 
        // We don't. We only have IPI there.

        // Let's try to do it efficiently.
        // Since we are in Execution mode and want to be fast but correct: 
        // I will fetch only the necessary columns: month, last_accumulated_value.

        const { data: productData, error: productError } = await supabase
            .from('sales_monthly_accumulated')
            .select('month, last_accumulated_value')
            .eq('year', year);

        if (productError) throw productError;

        // 2. Fetch IPI Metrics per Month
        const { data: metricsData, error: metricsError } = await supabase
            .from('sales_monthly_metrics')
            .select('month, ipi_val_matriz, ipi_val_filial')
            .eq('year', year);

        if (metricsError) throw metricsError;

        // 3. Aggregate
        const monthlyStats = new Map<number, AnnualSalesData>();

        // Initialize all 12 months
        for (let m = 1; m <= 12; m++) {
            monthlyStats.set(m, { month: m, total_products: 0, total_ipi: 0, total_revenue: 0 });
        }

        // Validate and Sum Products
        if (productData) {
            productData.forEach((item: any) => {
                const m = item.month;
                if (monthlyStats.has(m)) {
                    monthlyStats.get(m)!.total_products += (item.last_accumulated_value || 0);
                }
            });
        }

        // Validate and Sum IPI
        if (metricsData) {
            metricsData.forEach((item: any) => {
                const m = item.month;
                if (monthlyStats.has(m)) {
                    const ipi = (item.ipi_val_matriz || 0) + (item.ipi_val_filial || 0);
                    monthlyStats.get(m)!.total_ipi += ipi;
                }
            });
        }

        // Calculate Final Revenue
        monthlyStats.forEach(stat => {
            stat.total_revenue = stat.total_products + stat.total_ipi;
        });

        return Array.from(monthlyStats.values()).sort((a, b) => a.month - b.month);

    } catch (error) {
        console.error(`Error fetching annual sales for ${year}:`, error);
        return [];
    }
};

/**
 * Fetches the last import date...
 */
export const getLastImportInfo = async (year: number, month: number) => {
    try {
        const { data, error } = await supabase
            .from('sales_monthly_accumulated')
            .select('last_import_date, last_accumulated_value')
            .eq('year', year)
            .eq('month', month)
            .limit(1)
            .order('last_import_date', { ascending: false });

        if (error) return null;
        return data?.[0] || null;
    } catch (e) {
        return null;
    }
};
