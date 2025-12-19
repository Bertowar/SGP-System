import React, { useState, useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, ComposedChart
} from 'recharts';
import { Package, AlertTriangle, TrendingUp, Clock, Loader2, Cpu, Users, Sun, Calendar, BarChart3, Timer, LayoutGrid, Disc, RefreshCcw } from 'lucide-react';
import { useDashboardStats, useDowntimeTypes, useMachines, useProductionEntriesByDate } from '../hooks/useQueries';

const COLORS = ['#0ea5e9', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6'];

const timeToMinutes = (time: string) => {
    if (!time) return 0;
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
};

const Dashboard: React.FC = () => {
    // View State
    const [activeTab, setActiveTab] = useState<'products' | 'machines' | 'operators' | 'shifts'>('machines');
    const [selectedDate, setSelectedDate] = useState('');
    const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day');

    // Calculate Date Range based on ViewMode
    const { startDate, endDate } = useMemo(() => {
        if (!selectedDate) {
            // Cumulative Mode (All Time)
            return {
                startDate: '2000-01-01',
                endDate: new Date().toISOString().split('T')[0]
            };
        }

        const end = new Date(selectedDate);
        const start = new Date(selectedDate);

        if (viewMode === 'day') {
            start.setDate(end.getDate() - 2); // Last 3 days context
        } else if (viewMode === 'week') {
            end.setDate(start.getDate() + 7);
        } else {
            end.setDate(start.getDate() + 30);
        }
        return {
            startDate: start.toISOString().split('T')[0],
            endDate: end.toISOString().split('T')[0]
        };
    }, [selectedDate, viewMode]);

    // Fetch Logic (React Query)
    const { data, isLoading: loading, error } = useDashboardStats(startDate, endDate);
    const { data: machines = [] } = useMachines();
    const { data: rawEntries = [] } = useProductionEntriesByDate(
        selectedDate && viewMode === 'day' ? selectedDate : ''
    );

    // --- KPI CALCULATIONS ---
    const sectorStats = useMemo(() => {
        const stats = {
            extrusion: { production: 0, return: 0, loss: 0, entries: 0 },
            thermoforming: { production: 0, return: 0, loss: 0, entries: 0 }
        };

        // Helper to find sector
        const getSector = (machineIdOrName: string) => {
            const mac = machines.find(m => m.code === machineIdOrName || m.name === machineIdOrName);
            if (mac?.sector) return mac.sector;
            const normalized = String(machineIdOrName).toUpperCase();
            if (normalized.startsWith('EXT')) return 'Extrusão';
            if (normalized.startsWith('TF') || normalized.includes('TERMO')) return 'Termoformagem';
            return 'Outro';
        };

        // 1. CLIENT-SIDE CALCULATION (Override for Day View)
        if (selectedDate && viewMode === 'day' && rawEntries.length > 0) {
            console.log("Using Client-Side Aggregation for Day View", rawEntries);
            rawEntries.forEach((entry: any) => {
                const sector = getSector(entry.machineId);
                const isExtrusion = sector === 'Extrusão';

                if (isExtrusion) {
                    // Production: Weight
                    const weight = Number(entry.measuredWeight || entry.metaData?.measuredWeight || 0);
                    // Return: Metadata Refile
                    const metaRefile = Number(entry.metaData?.extrusion?.refile || 0);
                    // Loss: Metadata Borra
                    const metaBorra = Number(entry.metaData?.extrusion?.borra || 0);
                    // Legacy: Qty Defect
                    const legacyDefect = Number(entry.qtyDefect || 0);

                    stats.extrusion.production += weight;
                    stats.extrusion.return += metaRefile;

                    // Logic: If borra exists, use it. Else if no refile, maybe defect is loss?
                    if (metaBorra > 0) {
                        stats.extrusion.loss += metaBorra;
                    } else if (metaRefile === 0 && legacyDefect > 0) {
                        stats.extrusion.loss += legacyDefect;
                    }
                    stats.extrusion.entries += 1;
                } else if (sector === 'Termoformagem') {
                    // Thermoforming: OK = Production, Defect = Loss (mostly)
                    stats.thermoforming.production += Number(entry.qtyOK || 0);
                    stats.thermoforming.loss += Number(entry.qtyDefect || 0);
                    stats.thermoforming.entries += 1;
                }
            });
            return stats;
        }

        // 2. SERVER-SIDE FALLBACK
        if (!data || !machines.length) return stats;

        console.log("Dashboard Raw Data (RPC):", data);

        const records = Array.isArray(data.machines) ? data.machines : [];
        records.forEach((r: any) => {
            const id = r.machine_id || r.name;
            const sector = getSector(id);

            const ok = Number(r.qty_ok || r.total_qty || 0);
            const weight = Number(r.measured_weight || r.total_weight || 0);
            const ret = Number(r.qty_return || r.total_return || 0);
            const loss = Number(r.qty_loss || r.total_loss || 0);

            const legacyDefect = Number(r.qty_defect || r.total_defect || 0);
            const finalRet = ret;
            const finalLoss = loss > 0 || ret > 0 ? loss : legacyDefect;

            if (sector === 'Extrusão') {
                stats.extrusion.production += weight > 0 ? weight : ok;
                stats.extrusion.return += finalRet;
                stats.extrusion.loss += finalLoss;
                if (r.entries_count) stats.extrusion.entries += Number(r.entries_count);
                else if (data.isShortPeriod) stats.extrusion.entries += 1;
            } else if (sector === 'Termoformagem') {
                stats.thermoforming.production += ok;
                stats.thermoforming.return += finalRet;
                stats.thermoforming.loss += finalLoss;
                if (r.entries_count) stats.thermoforming.entries += Number(r.entries_count);
                else if (data.isShortPeriod) stats.thermoforming.entries += 1;
            }
        });

        return stats;
    }, [data, machines, rawEntries, selectedDate, viewMode]);



    // Transform Server-Side simplified Gantt data into Visual Structure
    const ganttData = useMemo(() => {
        if (!data || !data.isShortPeriod) return [];

        const rowMap: Record<string, any> = {};

        (data.machines || []).forEach((e: any) => {
            const key = `${e.machine_id}|${e.date}`;
            if (!rowMap[key]) {
                const dateObj = new Date(e.date);
                const dateStr = `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}`;

                rowMap[key] = {
                    machineId: e.machine_id,
                    date: e.date,
                    displayCode: `${e.machine_id} (${dateStr})`,
                    events: [],
                    efficiency: 0,
                    totalTime: 0,
                    prodTime: 0
                };
            }

            if (!e.start_time || !e.end_time) return;
            const startMin = timeToMinutes(e.start_time);
            const endMin = timeToMinutes(e.end_time);
            let duration = endMin - startMin;
            if (duration < 0) duration += 1440;

            const isDowntime = e.downtime_minutes > 0;
            if (isDowntime) rowMap[key].totalTime += duration;
            else {
                rowMap[key].totalTime += duration;
                rowMap[key].prodTime += duration;
            }

            rowMap[key].events.push({
                start: startMin,
                duration: duration,
                widthPct: (duration / 1440) * 100,
                startPct: (startMin / 1440) * 100,
                type: isDowntime ? 'downtime' : 'production',
                details: isDowntime
                    ? `Parada: ${e.downtime_desc || 'S/M'} (${duration} min)`
                    : `Prod: ${e.qty_ok} pçs`
            });
        });

        return Object.values(rowMap).map((row: any) => ({
            ...row,
            efficiency: row.totalTime > 0 ? (row.prodTime / row.totalTime) * 100 : 0
        })).sort((a: any, b: any) => b.date.localeCompare(a.date) || a.machineId.localeCompare(b.machineId));

    }, [data]);

    const kpis = useMemo(() => {
        if (!data) return { produced: 0, defects: 0, rate: 0 };
        const total = data.kpis.produced + data.kpis.defects;
        const rate = total > 0 ? (data.kpis.defects / total) * 100 : 0;
        return { ...data.kpis, rate };
    }, [data]);

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center text-slate-500">
                <Loader2 className="animate-spin mr-2" />
                Carregando indicadores...
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 text-center text-red-500 bg-red-50 rounded-xl border border-red-200 m-4">
                <p className="font-bold text-lg mb-2">Erro ao carregar dados:</p>
                <div className="text-xs text-left bg-white p-4 border border-red-100 rounded overflow-auto max-w-2xl mx-auto shadow-sm font-mono max-h-64">
                    {JSON.stringify(error, null, 2)}
                </div>
            </div>
        );
    }

    if (!data) return <div className="p-8 text-center text-slate-500">Falha ao carregar dados.</div>;

    const renderMachinesTab = () => (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-in fade-in overflow-hidden">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h3 className="text-lg font-bold text-slate-800">
                    {data.isShortPeriod
                        ? 'Linha do Tempo (Gantt - Detalhado)'
                        : 'Capacidade Produtiva (Consolidado)'}
                </h3>

                <div className="flex items-center gap-4">
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        {[
                            { id: 'day', label: 'Dia' },
                            { id: 'week', label: 'Semana' },
                            { id: 'month', label: 'Mês' }
                        ].map(mode => (
                            <button
                                key={mode.id}
                                onClick={() => setViewMode(mode.id as any)}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${viewMode === mode.id
                                    ? 'bg-white text-brand-600 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                {mode.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {data.isShortPeriod ? (
                <div className="relative">
                    <div className="flex justify-between text-xs text-slate-400 border-b border-slate-200 pb-2 mb-2 pl-28 pr-16">
                        {[0, 4, 8, 12, 16, 20, 24].map(h => <span key={h}>{h}h</span>)}
                    </div>
                    <div className="space-y-4 max-h-[500px] overflow-y-auto">
                        {ganttData.length === 0 && <div className="text-center py-8 text-slate-400">Sem registros no período.</div>}
                        {ganttData.map((m: any) => (
                            <div key={`${m.machineId}-${m.date}`} className="flex items-center group">
                                <div className="w-28 flex-shrink-0 pr-2 text-right">
                                    <p className="font-bold text-xs text-slate-800 font-mono">{m.displayCode}</p>
                                </div>
                                <div className="flex-1 h-8 bg-slate-100 rounded relative overflow-hidden">
                                    <div className="absolute inset-0 flex justify-between px-0 opacity-10 pointer-events-none">
                                        {[0, 4, 8, 12, 16, 20, 24].map(h => <div key={h} className="w-px h-full bg-slate-900"></div>)}
                                    </div>
                                    {m.events?.map((ev: any, idx: number) => (
                                        <div
                                            key={idx}
                                            className={`absolute h-full top-0 border-r border-white/20 transition-all hover:brightness-110 cursor-help ${ev.type === 'production' ? 'bg-green-500' : 'bg-orange-500'
                                                }`}
                                            style={{ left: `${ev.startPct}%`, width: `${ev.widthPct}%` }}
                                            title={`${ev.details}`}
                                        ></div>
                                    ))}
                                </div>
                                <div className="w-16 flex-shrink-0 pl-4 text-right">
                                    <div className="text-sm font-bold text-slate-600">{m.efficiency.toFixed(0)}%</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.machines} layout="vertical" margin={{ left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                            <XAxis type="number" />
                            <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12, fontWeight: 'bold' }} />
                            <Tooltip
                                cursor={{ fill: 'transparent' }}
                                formatter={(value: number) => new Intl.NumberFormat('pt-BR').format(value)}
                            />
                            <Legend />
                            <Bar dataKey="total_qty" name="Produção Total (pçs)" fill="#0ea5e9" barSize={20} radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Painel Geral</h2>
                    <p className="text-slate-500">{selectedDate ? 'Indicadores do Período Selecionado' : 'Indicadores Cumulativos (Histórico Completo)'}</p>
                </div>
                <div className="flex items-center space-x-2 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                    <div className="p-1 bg-slate-100 rounded text-slate-500"><Calendar size={18} /></div>
                    <div className="flex flex-col px-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-0.5">FILTRO DE DATA</span>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-transparent text-slate-800 font-bold outline-none text-sm p-0 w-32"
                        />
                    </div>
                </div>
            </div>

            {/* SECTOR: EXTRUSÃO */}
            <div>
                <div className="flex items-center mb-4">
                    <div className="bg-blue-100 p-1.5 rounded-md mr-2 text-blue-600"><Cpu size={16} /></div>
                    <h3 className="text-sm font-bold text-blue-900 uppercase tracking-wide">Setor Extrusão</h3>
                </div>
                {/* Extrusão Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Produção (Extrusão)</h3>
                            <div className="p-1 bg-blue-50 rounded text-blue-600"><Disc size={16} /></div>
                        </div>
                        <p className="text-3xl font-bold text-slate-800">{sectorStats.extrusion.production.toLocaleString()} kg</p>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Retorno (Refile)</h3>
                            <div className="p-1 bg-orange-50 rounded text-orange-600"><RefreshCcw size={16} /></div>
                        </div>
                        <p className="text-3xl font-bold text-slate-800">{sectorStats.extrusion.return.toLocaleString()} kg</p>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Perda (Borra)</h3>
                            <div className="p-1 bg-red-50 rounded text-red-600"><AlertTriangle size={16} /></div>
                        </div>
                        <p className="text-3xl font-bold text-slate-800">{sectorStats.extrusion.loss.toLocaleString()} kg</p>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Qualidade (Peso)</h3>
                            <div className="p-1 bg-green-50 rounded text-green-600"><TrendingUp size={16} /></div>
                        </div>
                        <p className="text-3xl font-bold text-green-600">
                            {sectorStats.extrusion.production > 0
                                ? (((sectorStats.extrusion.production) / (sectorStats.extrusion.production + sectorStats.extrusion.loss)) * 100).toFixed(1) // Quality considers only LOSS as defect, return is recycled
                                : '100.0'}%
                        </p>
                    </div>
                </div>
            </div>

            {/* SECTOR: TERMOFORMAGEM */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <div className="bg-indigo-100 p-2 rounded-lg text-indigo-700">
                        <LayoutGrid size={20} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-700">Setor Termoformagem</h3>
                </div>

                {/* Termoformagem Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Produção (Termo)</h3>
                            <div className="p-1 bg-blue-50 rounded text-blue-600"><Package size={16} /></div>
                        </div>
                        <p className="text-3xl font-bold text-slate-800">{sectorStats.thermoforming.production.toLocaleString()}</p>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Retorno (Aparas)</h3>
                            <div className="p-1 bg-orange-50 rounded text-orange-600"><RefreshCcw size={16} /></div>
                        </div>
                        {/* TODO: Aparas is usually weight (kg), but production is units. Check data unit. Assuming defects for TF are also units unless specific scrap reason says otherwise. But usually scraps in TF are counted or weighed. Existing logic was units. */}
                        <p className="text-3xl font-bold text-slate-800">{sectorStats.thermoforming.return.toLocaleString()}</p>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Refugo (Perda)</h3>
                            <div className="p-1 bg-red-50 rounded text-red-600"><AlertTriangle size={16} /></div>
                        </div>
                        <p className="text-3xl font-bold text-slate-800">{sectorStats.thermoforming.loss.toLocaleString()}</p>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Qualidade (Qtd)</h3>
                            <div className="p-1 bg-green-50 rounded text-green-600"><TrendingUp size={16} /></div>
                        </div>
                        <p className="text-3xl font-bold text-green-600">
                            {sectorStats.thermoforming.production > 0
                                ? (((sectorStats.thermoforming.production) / (sectorStats.thermoforming.production + sectorStats.thermoforming.loss)) * 100).toFixed(1)
                                : '100.0'}%
                        </p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex space-x-1 border-b border-slate-200 overflow-x-auto pb-1 mt-4">
                {[
                    { id: 'machines', icon: Cpu, label: 'Máquinas' },
                    { id: 'products', icon: Package, label: 'Produtos' },
                    { id: 'operators', icon: Users, label: 'Operadores' },
                    { id: 'shifts', icon: Sun, label: 'Turnos' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`px-4 py-3 text-sm font-medium flex items-center space-x-2 transition-all rounded-t-lg whitespace-nowrap ${activeTab === tab.id ? 'border border-b-0 border-slate-200 bg-white text-brand-600 shadow-sm translate-y-px' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                            }`}
                    >
                        <tab.icon size={16} />
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            <div className="bg-slate-50 min-h-[300px]">
                {activeTab === 'machines' && renderMachinesTab()}

                {activeTab === 'products' && (
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-in fade-in h-[400px]">
                        <h3 className="text-lg font-bold text-slate-800 mb-6">Top 10 Produtos</h3>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.products} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-45} textAnchor="end" height={80} />
                                <YAxis />
                                <Tooltip />
                                <Legend verticalAlign="top" height={36} />
                                <Bar dataKey="ok" name="Aprovados" fill="#22c55e" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="defect" name="Refugos" fill="#ef4444" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {activeTab === 'operators' && (
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-in fade-in h-[400px]">
                        <h3 className="text-lg font-bold text-slate-800 mb-6">Ranking de Operadores</h3>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.operators} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" />
                                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                                <Tooltip />
                                <Legend verticalAlign="top" height={36} />
                                <Bar dataKey="ok" name="Aprovados" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                                <Bar dataKey="defect" name="Refugos" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {activeTab === 'shifts' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-[400px]">
                            <h3 className="text-lg font-bold text-slate-800 mb-6">Produção por Turno</h3>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={data.shifts}
                                        dataKey="ok"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={100}
                                        fill="#8884d8"
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    >
                                        {data.shifts.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-[400px] overflow-auto">
                            <h3 className="text-lg font-bold text-slate-800 mb-4">Detalhamento</h3>
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-700">
                                    <tr>
                                        <th className="px-4 py-2">Turno</th>
                                        <th className="px-4 py-2 text-right">Prod.</th>
                                        <th className="px-4 py-2 text-right">Ref.</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {data.shifts.map((s, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50">
                                            <td className="px-4 py-2 font-medium">{s.name}</td>
                                            <td className="px-4 py-2 text-right text-green-600 font-bold">{s.ok}</td>
                                            <td className="px-4 py-2 text-right text-red-600 font-bold">{s.defect}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
