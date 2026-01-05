
import React, { useState } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import { Calendar, Filter, Download, Activity, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { useDashboardMetrics } from '../hooks/useDashboardQueries';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Dashboard() {
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const { data, isLoading, error } = useDashboardMetrics(selectedDate);

    const metrics = data?.summary || { totalProduction: 0, totalScrap: 0, efficiency: 0, activeMachines: 0 };
    const chartData = data?.chartData || [];

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center p-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 text-center text-red-500">
                <AlertTriangle size={48} className="mx-auto mb-4" />
                <h2 className="text-xl font-bold">Erro ao carregar dados</h2>
                <p>Verifique sua conexão ou tente recarregar.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header / Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Painel de Controle</h1>
                    <p className="text-slate-500">Visão geral da produção para {format(selectedDate, "d 'de' MMMM, yyyy", { locale: ptBR })}</p>
                </div>

                <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                    <button className="p-2 hover:bg-slate-50 rounded-md text-slate-600">
                        <Filter size={20} />
                    </button>
                    <div className="h-6 w-px bg-slate-200"></div>
                    <input
                        type="date"
                        value={format(selectedDate, 'yyyy-MM-dd')}
                        onChange={(e) => setSelectedDate(new Date(e.target.value + 'T12:00:00'))}
                        className="border-none focus:ring-0 text-sm font-medium text-slate-600 cursor-pointer"
                    />
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                    title="Produção Total"
                    value={`${metrics.totalProduction.toLocaleString()} kg`}
                    icon={<CheckCircle className="text-emerald-500" size={24} />}
                    trend="+5.2%"
                    trendUp={true}
                    color="emerald"
                />
                <KPICard
                    title="Eficiência (Yield)"
                    value={`${metrics.efficiency.toFixed(1)}%`}
                    icon={<Activity className="text-blue-500" size={24} />}
                    trend="-1.2%"
                    trendUp={false}
                    color="blue"
                />
                <KPICard
                    title="Refugo Total"
                    value={`${metrics.totalScrap.toLocaleString()} kg`}
                    icon={<AlertTriangle className="text-amber-500" size={24} />}
                    trend="Estável"
                    color="amber"
                />
                <KPICard
                    title="Máquinas Ativas"
                    value={metrics.activeMachines.toString()}
                    icon={<Clock className="text-purple-500" size={24} />}
                    subtext="Em operação agora"
                    color="purple"
                />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Scale Chart */}
                <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <Activity size={20} className="text-slate-400" />
                        Produção por Hora (kg)
                    </h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                <XAxis
                                    dataKey="hour"
                                    tick={{ fontSize: 12, fill: '#64748B' }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    tick={{ fontSize: 12, fill: '#64748B' }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <RechartsTooltip
                                    cursor={{ fill: '#F1F5F9' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar
                                    dataKey="production"
                                    fill="#3B82F6"
                                    radius={[4, 4, 0, 0]}
                                    barSize={32}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Secondary Chart / Info */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-slate-800 mb-4">Status por Setor</h3>
                    <div className="flex flex-col gap-4">
                        {/* Mock Sector Data until we calculate it */}
                        <SectorProgress name="Extrusão" value={75} color="bg-blue-500" />
                        <SectorProgress name="Termoformagem" value={60} color="bg-purple-500" />
                        <SectorProgress name="Impressão" value={45} color="bg-amber-500" />
                        <SectorProgress name="Acabamento" value={90} color="bg-emerald-500" />
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-100">
                        <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Alertas Recentes</h4>
                        <div className="space-y-3">
                            <AlertItem message="Extrusora 01 parada a mais de 2h" time="10:30" type="danger" />
                            <AlertItem message="Produção termoformagem atingiu meta" time="11:15" type="success" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Sub-components for cleaner file
const KPICard = ({ title, value, icon, trend, trendUp, color, subtext }: any) => (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start mb-4">
            <div className={`p-2 rounded-lg bg-${color}-50`}>
                {icon}
            </div>
            {trend && (
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${trendUp ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {trend}
                </span>
            )}
        </div>
        <div>
            <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
            <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
            {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
        </div>
    </div>
);

const SectorProgress = ({ name, value, color }: any) => (
    <div>
        <div className="flex justify-between text-sm mb-1">
            <span className="font-medium text-slate-700">{name}</span>
            <span className="font-bold text-slate-800">{value}%</span>
        </div>
        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full ${color}`} style={{ width: `${value}%` }}></div>
        </div>
    </div>
);

const AlertItem = ({ message, time, type }: any) => (
    <div className="flex gap-3 items-start p-2 rounded hover:bg-slate-50 transition-colors">
        <div className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${type === 'danger' ? 'bg-red-500' : 'bg-green-500'}`}></div>
        <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-600 leading-tight">{message}</p>
            <span className="text-[10px] text-slate-400">{time}</span>
        </div>
    </div>
);
