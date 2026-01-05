
import { useQuery } from '@tanstack/react-query';
import { fetchEntriesByDate } from '../services/productionService';
import { useAuth } from '../contexts/AuthContext';
import { startOfDay, format } from 'date-fns';

export function useDashboardMetrics(date: Date) {
    const { currentOrg } = useAuth();
    const dateStr = format(date, 'yyyy-MM-dd');

    return useQuery({
        queryKey: ['dashboardMetrics', currentOrg?.id, dateStr],
        queryFn: async () => {
            const entries = await fetchEntriesByDate(dateStr);

            // Client-side Aggregation
            let totalProduction = 0;
            let totalScrap = 0;
            let totalEntries = entries.length;
            let machinesActive = new Set();

            // Hourly production for chart
            const hourlyData: Record<string, number> = {};

            entries.forEach(entry => {
                const qtyOK = Number(entry.qtyOK) || 0;
                const qtyDefect = Number(entry.qtyDefect) || 0;

                totalProduction += qtyOK;
                totalScrap += qtyDefect;
                if (entry.machineId) machinesActive.add(entry.machineId);

                // Hourly aggregation (simple approximation based on start time)
                if (entry.startTime) {
                    const hour = entry.startTime.split(':')[0]; // "08:30" -> "08"
                    hourlyData[hour] = (hourlyData[hour] || 0) + qtyOK;
                }
            });

            // Calculate Efficiency (Mock formula: OK / (OK + Scrap)) - Real formula needs Standard Cycle
            const totalMaterial = totalProduction + totalScrap;
            const efficiency = totalMaterial > 0 ? (totalProduction / totalMaterial) * 100 : 0; // Yield actually

            const chartData = Object.entries(hourlyData)
                .map(([hour, value]) => ({ hour: `${hour}:00`, production: value }))
                .sort((a, b) => a.hour.localeCompare(b.hour));

            return {
                summary: {
                    totalProduction,
                    totalScrap,
                    efficiency,
                    activeMachines: machinesActive.size
                },
                chartData,
                entries
            };
        },
        enabled: !!currentOrg?.id,
        staleTime: 1000 * 60 * 5 // 5 minutes
    });
}
