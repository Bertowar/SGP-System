import { fetchSalesSummary, fetchDailyMovements, fetchSalesMetrics, fetchAnnualSales, SalesSummaryData, DailySalesData, AnnualSalesData } from '../services/salesService';
import { Search, Loader2, Calendar, TrendingUp, TrendingDown, Store, Building2, Sigma, ArrowUpRight, BarChart3, List, PieChart } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ComposedChart, Bar, Line } from 'recharts';

const SalesSummaryPage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<SalesSummaryData[]>([]);
    const [dailyData, setDailyData] = useState<DailySalesData[]>([]);
    const [metrics, setMetrics] = useState<{ ipi_val_matriz: number, ipi_val_filial: number } | null>(null);
    const [viewMode, setViewMode] = useState<'table' | 'chart' | 'annual'>('table');

    // Annual Comp Data
    const [annualDataCurrent, setAnnualDataCurrent] = useState<AnnualSalesData[]>([]);
    const [annualDataPrevious, setAnnualDataPrevious] = useState<AnnualSalesData[]>([]);

    // Filters
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            const [summaryRes, dailyRes, metricsRes, annCurrRes, annPrevRes] = await Promise.all([
                fetchSalesSummary(selectedYear, selectedMonth),
                fetchDailyMovements(selectedYear, selectedMonth),
                fetchSalesMetrics(selectedYear, selectedMonth),
                fetchAnnualSales(selectedYear),
                fetchAnnualSales(selectedYear - 1)
            ]);
            setData(summaryRes);
            setDailyData(dailyRes);
            setMetrics(metricsRes);
            setAnnualDataCurrent(annCurrRes);
            setAnnualDataPrevious(annPrevRes);
            setLoading(false);
        };
        loadData();
    }, [selectedMonth, selectedYear]);

    // ... Derived stats ...
    const totalIpi = (metrics?.ipi_val_matriz || 0) + (metrics?.ipi_val_filial || 0);

    // ...
    // Calculate Trend Line (Linear Regression) for Current Year
    const annualChartData = useMemo(() => {
        // Merge Current and Previous
        const merged = [];
        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

        // Prepare arrays for regression (x = month index 0-11, y = revenue)
        const xValues: number[] = [];
        const yValues: number[] = [];

        for (let i = 0; i < 12; i++) {
            const m = i + 1;
            const curr = annualDataCurrent.find(d => d.month === m)?.total_revenue || 0;
            const prev = annualDataPrevious.find(d => d.month === m)?.total_revenue || 0;

            if (curr > 0) {
                xValues.push(i);
                yValues.push(curr);
            }

            merged.push({
                name: months[i],
                monthIndex: i,
                RevenueCurrent: curr,
                RevenuePrevious: prev,
                Trend: 0 // Placeholder
            });
        }

        // Linear Regression: y = mx + b
        if (xValues.length > 1) {
            const n = xValues.length;
            const sumX = xValues.reduce((a, b) => a + b, 0);
            const sumY = yValues.reduce((a, b) => a + b, 0);
            const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
            const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);

            const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
            const intercept = (sumY - slope * sumX) / n;

            // Apply trend line only up to the last known month + maybe projection?
            // User asked for trend line... typically extends slightly or covers known data.
            merged.forEach((item, i) => {
                // Calculate Trend for all months to show projection
                item.Trend = slope * i + intercept;
                // Don't show negative trend
                if (item.Trend < 0) item.Trend = 0;
            });
        }

        return merged;
    }, [annualDataCurrent, annualDataPrevious]);


    // Derived Statistics
    const statistics = useMemo(() => {
        return data.reduce((acc, item) => ({
            totalQtyMatriz: acc.totalQtyMatriz + item.qty_matriz,
            totalValMatriz: acc.totalValMatriz + item.val_matriz,
            totalQtyFilial: acc.totalQtyFilial + item.qty_filial,
            totalValFilial: acc.totalValFilial + item.val_filial,
            totalQtyGeral: acc.totalQtyGeral + item.qty_total,
            totalValGeral: acc.totalValGeral + item.val_total,
        }), {
            totalQtyMatriz: 0, totalValMatriz: 0,
            totalQtyFilial: 0, totalValFilial: 0,
            totalQtyGeral: 0, totalValGeral: 0
        });
    }, [data]);

    // Filtering
    const filteredData = data.filter(item =>
        item.product_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.consolidated_id && item.consolidated_id.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // Formatter
    const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const formatNumber = (val: number) => val.toLocaleString('pt-BR');

    return (
        <div className="space-y-6 pb-20 animate-in fade-in duration-500">
            {/* HEADER & FILTERS */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Resumo de Vendas</h1>
                    <p className="text-slate-500 text-sm">Acompanhamento mensal e diário.</p>
                </div>

                <div className="flex gap-3 ">
                    {/* View Switcher */}
                    <div className="bg-slate-100 p-1 rounded-lg flex items-center shadow-inner">
                        <button
                            onClick={() => setViewMode('table')}
                            className={`px-3 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'table' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <List size={16} /> Detalhado
                        </button>
                        <button
                            onClick={() => setViewMode('chart')}
                            className={`px-3 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'chart' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <BarChart3 size={16} /> Diário
                        </button>
                        <button
                            onClick={() => setViewMode('annual')}
                            className={`px-3 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'annual' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <PieChart size={16} /> Anual
                        </button>
                    </div>

                    <div className="flex gap-3 bg-white p-2 rounded-lg shadow-sm border border-slate-200">
                        <div className="flex items-center gap-2 px-2 border-r border-slate-100">
                            <Calendar size={16} className="text-slate-400" />
                            <select
                                className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                            >
                                {Array.from({ length: 12 }, (_, i) => (
                                    <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('pt-BR', { month: 'long' })}</option>
                                ))}
                            </select>
                            <select
                                className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(Number(e.target.value))}
                            >
                                <option value={2024}>2024</option>
                                <option value={2025}>2025</option>
                                <option value={2026}>2026</option>
                            </select>
                        </div>
                        {viewMode === 'table' && (
                            <div className="flex items-center px-2">
                                <Search size={16} className="text-slate-400 mr-2" />
                                <input
                                    type="text"
                                    placeholder="Filtrar produto..."
                                    className="text-sm outline-none w-40"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* CARDS TOTALIZADORES */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* MATRIZ */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-1">
                        <Building2 size={14} /> Matriz
                    </p>
                    <div>
                        <div className="text-lg font-bold text-slate-800">{formatCurrency(statistics.totalValMatriz)}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{formatNumber(statistics.totalQtyMatriz)} itens</div>
                    </div>
                </div>

                {/* FILIAL */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-1">
                        <Store size={14} /> Filial
                    </p>
                    <div>
                        <div className="text-lg font-bold text-slate-800">{formatCurrency(statistics.totalValFilial)}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{formatNumber(statistics.totalQtyFilial)} itens</div>
                    </div>
                </div>

                {/* IPI (NEW) */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-1 opacity-5">
                        <Sigma size={60} />
                    </div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-1">
                        Valor IPI (Mês)
                    </p>
                    <div>
                        {/* Calculate Total IPI locally just for display if needed or use from state */}
                        <div className="text-lg font-bold text-slate-600">
                            {formatCurrency((metrics?.ipi_val_matriz || 0) + (metrics?.ipi_val_filial || 0))}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 whitespace-nowrap">
                            M: {formatCurrency(metrics?.ipi_val_matriz || 0)} | F: {formatCurrency(metrics?.ipi_val_filial || 0)}
                        </div>
                    </div>
                </div>

                {/* QTD GLOBAL (NEW) */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-1">
                        Qtd Global (CX)
                    </p>
                    <div>
                        <div className="text-lg font-bold text-slate-800">{formatNumber(statistics.totalQtyGeral)}</div>
                        <div className="text-xs text-slate-500 mt-0.5">Caixas</div>
                    </div>
                </div>

                {/* CONSOLIDADO */}
                <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-4 rounded-xl shadow-lg shadow-indigo-200 flex flex-col justify-between text-white">
                    <p className="text-xs font-bold text-indigo-200 uppercase tracking-wider flex items-center gap-2 mb-1">
                        <Sigma size={14} /> Total Geral
                    </p>
                    <div>
                        <div className="text-xl font-bold">{formatCurrency(statistics.totalValGeral + totalIpi)}</div>
                        <div className="text-xs text-indigo-200 mt-0.5">Líquido + IPI Acumulado</div>
                    </div>
                </div>
            </div>

            {/* CONTENTE - TABLE OR CHART */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px]">
                {loading ? (
                    <div className="p-12 flex justify-center text-slate-400">
                        <Loader2 className="animate-spin" size={32} />
                    </div>
                ) : viewMode === 'table' ? (
                    <>
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                <List size={18} className="text-slate-400" /> Detalhamento por Produto (Acumulado)
                            </h3>
                            <span className="text-xs font-medium text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">
                                Total Produtos: {filteredData.length}
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                                    <tr>
                                        <th className="px-4 py-3 w-24">Cód. Nobre</th>
                                        <th className="px-4 py-3">Produto (Ref)</th>

                                        {/* Grupo Matriz */}
                                        <th className="px-4 py-3 text-right text-slate-600 border-l border-slate-100 bg-slate-50/80">Qtd Matriz</th>
                                        <th className="px-4 py-3 text-right text-slate-600 bg-slate-50/80">Valor Matriz</th>

                                        {/* Grupo Filial */}
                                        <th className="px-4 py-3 text-right text-purple-600 border-l border-slate-100 bg-purple-50/30">Qtd Filial</th>
                                        <th className="px-4 py-3 text-right text-purple-600 bg-purple-50/30">Valor Filial</th>

                                        {/* Grupo Total */}
                                        <th className="px-4 py-3 text-right text-slate-800 border-l border-slate-100 bg-yellow-50/30">Qtd Global (CX)</th>
                                        <th className="px-4 py-3 text-right font-bold text-green-600 bg-yellow-50/30">TOTAL R$</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredData.length > 0 ? filteredData.map((item) => (
                                        <tr key={item.product_code} className="hover:bg-slate-50 transition-colors group">
                                            <td className="px-4 py-3">
                                                {item.consolidated_id ? (
                                                    <span className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded text-xs font-bold font-mono">
                                                        {item.consolidated_id}
                                                    </span>
                                                ) : (
                                                    <span className="bg-slate-100 text-slate-400 px-2 py-0.5 rounded text-[10px] font-bold">N/D</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 font-medium text-slate-700">
                                                {item.product_code}
                                            </td>

                                            {/* Matriz */}
                                            <td className="px-4 py-3 text-right font-mono text-slate-500 border-l border-slate-50">
                                                {item.qty_matriz > 0 ? formatNumber(item.qty_matriz) : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-blue-600">
                                                {item.val_matriz > 0 ? formatCurrency(item.val_matriz) : '-'}
                                            </td>

                                            {/* Filial */}
                                            <td className="px-4 py-3 text-right font-mono text-slate-500 border-l border-slate-50 bg-purple-50/10">
                                                {item.qty_filial > 0 ? formatNumber(item.qty_filial) : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-purple-600 bg-purple-50/10">
                                                {item.val_filial > 0 ? formatCurrency(item.val_filial) : '-'}
                                            </td>

                                            {/* Geral */}
                                            <td className="px-4 py-3 text-right font-bold text-slate-700 border-l border-slate-50 bg-yellow-50/10">
                                                {formatNumber(item.qty_total)}
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-green-600 bg-yellow-50/10">
                                                {formatCurrency(item.val_total)}
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                                                <div className="flex flex-col items-center">
                                                    <Store size={48} className="mb-4 opacity-20" />
                                                    <p>Nenhum dado encontrado para este período.</p>
                                                    <p className="text-xs mt-1">Verifique se você realizou a importação do relatório no módulo de Logística.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                ) : viewMode === 'chart' ? (
                    <div className="p-6 h-[500px]">
                        <div className="mb-6 flex items-center justify-between">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                <BarChart3 size={18} className="text-slate-400" /> Evolução de Vendas (Diária)
                            </h3>
                            <p className="text-xs text-slate-400">Movimentação diária importada para o sistema.</p>
                        </div>

                        {dailyData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={dailyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorMatriz" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorFilial" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#a855f7" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis
                                        dataKey="date"
                                        tickFormatter={(date) => new Date(date).getDate().toString().padStart(2, '0') + '/' + (new Date(date).getMonth() + 1).toString().padStart(2, '0')}
                                        stroke="#cbd5e1"
                                        fontSize={12}
                                    />
                                    <YAxis
                                        stroke="#cbd5e1"
                                        fontSize={12}
                                        tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
                                    />
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <Tooltip
                                        formatter={(value: number) => formatCurrency(value)}
                                        labelFormatter={(label) => new Date(label).toLocaleDateString()}
                                    />
                                    <Legend />
                                    <Area type="monotone" dataKey="total_val" name="Total (R$)" stroke="#4f46e5" fillOpacity={1} fill="url(#colorTotal)" />
                                    <Area type="monotone" dataKey="matriz_val" name="Matriz (R$)" stroke="#94a3b8" fillOpacity={0.5} fill="url(#colorMatriz)" />
                                    <Area type="monotone" dataKey="filial_val" name="Filial (R$)" stroke="#a855f7" fillOpacity={0.5} fill="url(#colorFilial)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-300">
                                <TrendingUp size={48} className="mb-4 opacity-50" />
                                <p>Nenhum dado diário encontrado para este período.</p>
                                <p className="text-xs mt-1">Isso ocorre se você só importou o acumulado final, sem acompanhar dia a dia.</p>
                            </div>
                        )}
                    </div>
                ) : (
                    // ANNUAL COMPARISON CHART
                    <div className="p-6 h-[500px]">
                        <div className="mb-6 flex items-center justify-between">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                <PieChart size={18} className="text-slate-400" /> Faturamento {selectedYear} x {selectedYear - 1}
                            </h3>
                            <p className="text-xs text-slate-400">Comparativo mensal com ano anterior e tendência.</p>
                        </div>

                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={annualChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="name" stroke="#cbd5e1" fontSize={12} />
                                <YAxis
                                    stroke="#cbd5e1"
                                    fontSize={12}
                                    tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
                                />
                                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                <Legend />

                                {/* Previous Year - Light Bar */}
                                <Bar dataKey="RevenuePrevious" name={`Receita ${selectedYear - 1}`} fill="#e2e8f0" radius={[4, 4, 0, 0]} />

                                {/* Current Year - Dark Blue Bar */}
                                <Bar dataKey="RevenueCurrent" name={`Receita ${selectedYear}`} fill="#1e3a8a" radius={[4, 4, 0, 0]} />

                                {/* Trend Line - Dotted */}
                                <Line
                                    type="monotone"
                                    dataKey="Trend"
                                    name={`Tendência (${selectedYear})`}
                                    stroke="#3b82f6"
                                    strokeDasharray="5 5"
                                    dot={false}
                                    strokeWidth={2}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SalesSummaryPage;
