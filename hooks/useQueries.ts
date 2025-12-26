
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    fetchProducts, fetchMachines, fetchOperators, fetchDowntimeTypes, fetchScrapReasons,
    fetchFieldDefinitions, fetchMachineStatuses, fetchSettings, fetchSectors, fetchWorkShifts,
    registerProductionEntry, fetchDashboardStats, fetchProductionOrders, fetchEntriesByDate
} from '../services/storage';
import { ProductionEntry } from '../types';
import { useAuth } from '../contexts/AuthContext';

// --- KEYS ---
export const KEYS = {
    PRODUCTS: ['products'],
    MACHINES: ['machines'],
    OPERATORS: ['operators'],
    DOWNTIME_TYPES: ['downtimeTypes'],
    SCRAP_REASONS: ['scrapReasons'],
    CUSTOM_FIELDS: ['customFields'],
    MACHINE_STATUS: ['machineStatus'],
    SETTINGS: ['settings'],
    SECTORS: ['sectors'],
    SHIFTS: ['shifts'],
    DASHBOARD: 'dashboard',
    ENTRIES: 'entries',
    PRODUCTION_ORDERS: ['productionOrders']
};

// --- MASTER DATA HOOKS (Read-Heavy, Long Cache) ---

export const useProducts = () => {
    const { user } = useAuth();
    return useQuery({
        queryKey: [...KEYS.PRODUCTS, user?.organizationId],
        queryFn: fetchProducts,
        staleTime: 1000 * 60 * 10 // 10 mins
    });
};

export const useMachines = () => {
    const { user } = useAuth();
    return useQuery({
        queryKey: [...KEYS.MACHINES, user?.organizationId],
        queryFn: fetchMachines
    });
};

export const useOperators = () => {
    const { user } = useAuth();
    return useQuery({
        queryKey: [...KEYS.OPERATORS, user?.organizationId],
        queryFn: fetchOperators
    });
};

export const useDowntimeTypes = () => {
    const { user } = useAuth();
    return useQuery({
        queryKey: [...KEYS.DOWNTIME_TYPES, user?.organizationId],
        queryFn: fetchDowntimeTypes
    });
};

export const useScrapReasons = () => {
    const { user } = useAuth();
    return useQuery({
        queryKey: [...KEYS.SCRAP_REASONS, user?.organizationId],
        queryFn: fetchScrapReasons
    });
};

export const useSectors = () => {
    const { user } = useAuth();
    return useQuery({
        queryKey: [...KEYS.SECTORS, user?.organizationId],
        queryFn: fetchSectors
    });
};

export const useWorkShifts = () => {
    const { user } = useAuth();
    return useQuery({
        queryKey: [...KEYS.SHIFTS, user?.organizationId],
        queryFn: fetchWorkShifts
    });
};

export const useSettings = () => {
    const { user } = useAuth();
    return useQuery({
        queryKey: [...KEYS.SETTINGS, user?.organizationId],
        queryFn: fetchSettings
    });
};

export const useCustomFields = () => {
    const { user } = useAuth();
    return useQuery({
        queryKey: [...KEYS.CUSTOM_FIELDS, user?.organizationId],
        queryFn: fetchFieldDefinitions
    });
};

export const useProductionOrders = () => {
    const { user } = useAuth();
    return useQuery({
        queryKey: [...KEYS.PRODUCTION_ORDERS, user?.organizationId],
        queryFn: fetchProductionOrders
    });
};

// --- OPERATIONAL DATA HOOKS (Frequent Updates) ---

export const useMachineStatuses = () => {
    const { user } = useAuth();
    return useQuery({
        queryKey: [...KEYS.MACHINE_STATUS, user?.organizationId],
        queryFn: fetchMachineStatuses,
        refetchInterval: 30000 // Auto-refresh status every 30s
    });
};

export const useDashboardStats = (startDate: string, endDate: string) => {
    const { user } = useAuth();
    return useQuery({
        queryKey: [KEYS.DASHBOARD, startDate, endDate, user?.organizationId],
        queryFn: () => fetchDashboardStats(startDate, endDate),
        staleTime: 1000 * 60, // 1 min cache for dashboards
    });
};

export const useProductionEntriesByDate = (date: string) => {
    const { user } = useAuth();
    return useQuery({
        queryKey: [KEYS.ENTRIES, date, user?.organizationId],
        queryFn: () => date ? fetchEntriesByDate(date) : Promise.resolve([]),
        enabled: !!date && date.length === 10, // Only fetch if valid date string
        staleTime: 1000 * 30
    });
};

// --- MUTATIONS (Write Operations) ---

export const useRegisterEntry = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ entry, isEdit }: { entry: ProductionEntry, isEdit: boolean }) => {
            return await registerProductionEntry(entry, isEdit);
        },
        onSuccess: () => {
            // Invalidate relevant queries to force refresh
            queryClient.invalidateQueries({ queryKey: KEYS.MACHINE_STATUS });
            queryClient.invalidateQueries({ queryKey: [KEYS.DASHBOARD] }); // Invalidate all dashboards
            queryClient.invalidateQueries({ queryKey: KEYS.PRODUCTION_ORDERS }); // Refresh OPs progress
            // We could also invalidate specific entry lists if needed
        }
    });
};
