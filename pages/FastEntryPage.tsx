
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Calendar, Clock, Monitor, Save, ArrowRight, Plus, Trash2, Edit,
  Zap, AlertTriangle, CheckCircle2, X, ChevronDown, Package, PauseCircle,
  LayoutTemplate, Table2, TrendingUp, Scale, Boxes, Loader2
} from 'lucide-react';
import { useMachines, useOperators, useProducts, useWorkShifts, useDowntimeTypes, useRegisterEntry } from '../hooks/useQueries';
import { fetchEntriesByDate, deleteEntry, formatError } from '../services/storage';
import { Input } from '../components/Input';
import { ProductSelect } from '../components/ProductSelect';
import { ProductionEntry } from '../types';

const generateUID = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

const parseSafeNumber = (val: any): number => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  let clean = val.toString().trim().replace(/\./g, '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

interface LocalProductionEntry {
  id: string;
  operatorId: number;
  operatorName: string;
  cycleRate: number;
  productCode: number;
  productName: string;
  weight: number;
  boxes: number;
  timestamp: number;
}

interface LocalDowntimeEntry {
  id: string;
  startTime: string;
  endTime: string;
  reasonId: string;
  reasonName: string;
  duration: number;
  timestamp: number;
}

const FastEntryPage: React.FC = () => {
  const { data: machines = [] } = useMachines();
  const { data: operators = [] } = useOperators();
  const { data: products = [] } = useProducts();
  const { data: shifts = [] } = useWorkShifts();
  const { data: downtimeTypes = [] } = useDowntimeTypes();

  const { mutateAsync: saveEntryMutation } = useRegisterEntry();

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMachine, setSelectedMachine] = useState('');
  const [selectedShift, setSelectedShift] = useState('');

  const [prodEntries, setProdEntries] = useState<LocalProductionEntry[]>([]);
  const [stopEntries, setStopEntries] = useState<LocalDowntimeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingLocal, setIsSavingLocal] = useState(false);

  const [isProdModalOpen, setIsProdModalOpen] = useState(false);
  const [isStopModalOpen, setIsStopModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [prodForm, setProdForm] = useState({ operatorId: '', cycleRate: '', productCode: '', weight: '', boxes: '' });
  const [stopForm, setStopForm] = useState({ startTime: '', endTime: '', reasonId: '' });

  const prodWeightRef = useRef<HTMLInputElement>(null);
  const stopStartRef = useRef<HTMLInputElement>(null);

  const currentMachine = machines.find(m => m.code === selectedMachine);
  const isExtrusion = currentMachine?.sector === 'Extrusão';

  // Filtra turnos baseados no setor da máquina selecionada
  // Se o turno não tiver setor (null/undefined), ele é considerado Global e aparece para todos.
  const filteredShifts = useMemo(() => {
    if (!currentMachine?.sector) return shifts;
    return shifts.filter(s => !s.sector || s.sector === currentMachine.sector);
  }, [shifts, currentMachine]);

  // Reset shift if it becomes invalid for the new machine
  useEffect(() => {
    if (selectedShift && filteredShifts.length > 0) {
      const isValid = filteredShifts.some(s => s.name === selectedShift);
      if (!isValid) setSelectedShift('');
    }
  }, [selectedMachine, filteredShifts]);

  // CARREGAMENTO DE DADOS DO BANCO
  const loadData = async () => {
    if (!date || !selectedMachine) return;
    setIsLoading(true);
    try {
      const allDayEntries = await fetchEntriesByDate(date);
      const filtered = allDayEntries.filter(e => e.machineId === selectedMachine && e.shift === selectedShift);

      setProdEntries(filtered.filter(e => e.downtimeMinutes === 0).map(e => ({
        id: e.id,
        operatorId: e.operatorId,
        operatorName: operators.find(op => op.id === e.operatorId)?.name || 'Op ' + e.operatorId,
        productCode: e.productCode || 0,
        productName: products.find(p => p.codigo === e.productCode)?.produto || 'Prod ' + e.productCode,
        cycleRate: e.cycleRate || 0,
        weight: e.measuredWeight || (isExtrusion ? e.qtyOK : 0),
        boxes: e.metaData?.boxes || 0,
        timestamp: e.createdAt
      })));

      setStopEntries(filtered.filter(e => e.downtimeMinutes > 0).map(e => {
        const dt = downtimeTypes.find(dt => dt.id === e.downtimeTypeId);
        return {
          id: e.id,
          startTime: e.startTime || '',
          endTime: e.endTime || '',
          reasonId: e.downtimeTypeId || '',
          reasonName: dt ? `${dt.id} - ${dt.description}` : 'Parada',
          duration: e.downtimeMinutes || 0,
          timestamp: e.createdAt
        };
      }).sort((a, b) => a.startTime.localeCompare(b.startTime)));
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [date, selectedMachine, selectedShift, operators, products]);

  const handleSaveProd = async (closeModal: boolean) => {
    const weightValue = parseSafeNumber(prodForm.weight);
    const boxesValue = parseSafeNumber(prodForm.boxes);
    const prodCode = Number(prodForm.productCode);

    if (!prodForm.operatorId || !prodCode) {
      alert("Operador e Produto são obrigatórios");
      return;
    }

    setIsSavingLocal(true);
    try {
      const shiftTimes = shifts.find(s => s.name === selectedShift);
      const prodRef = products.find(p => p.codigo === prodCode);
      const theoreticalUnitWeight = prodRef?.pesoLiquido || 0;

      let qtyOK = 0;
      if (isExtrusion) {
        qtyOK = weightValue;
      } else {
        qtyOK = weightValue > 0 ? Math.round(weightValue / (theoreticalUnitWeight / 1000)) : boxesValue;
      }

      const dbEntry: ProductionEntry = {
        id: editingId || generateUID(),
        date: date,
        shift: selectedShift,
        operatorId: Number(prodForm.operatorId),
        productCode: prodCode,
        machineId: selectedMachine,
        startTime: shiftTimes?.startTime || '00:00',
        endTime: shiftTimes?.endTime || '00:00',
        qtyOK: qtyOK,
        qtyDefect: 0,
        observations: `Digitação Rápida. Ciclo: ${prodForm.cycleRate}`,
        createdAt: Date.now(),
        cycleRate: parseSafeNumber(prodForm.cycleRate),
        measuredWeight: weightValue,
        calculatedScrap: 0,
        downtimeMinutes: 0,
        metaData: { boxes: boxesValue, is_fast_entry: true }
      };

      await saveEntryMutation({ entry: dbEntry, isEdit: !!editingId });
      await loadData(); // Recarrega do banco para garantir sincronia

      if (closeModal) {
        setIsProdModalOpen(false);
      } else {
        setProdForm(prev => ({ ...prev, weight: '', boxes: '' }));
        setTimeout(() => prodWeightRef.current?.focus(), 100);
      }
    } catch (err) {
      alert("Erro ao salvar: " + formatError(err));
    } finally {
      setIsSavingLocal(false);
    }
  };

  const handleSaveStop = async (closeModal: boolean) => {
    if (!stopForm.startTime || !stopForm.endTime || !stopForm.reasonId) {
      alert("Preencha todos os campos");
      return;
    }

    setIsSavingLocal(true);
    try {
      const [h1, m1] = stopForm.startTime.split(':').map(Number);
      const [h2, m2] = stopForm.endTime.split(':').map(Number);
      let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
      if (diff < 0) diff += 1440;

      const dbEntry: ProductionEntry = {
        id: editingId || generateUID(),
        date: date,
        shift: selectedShift,
        operatorId: prodEntries[0]?.operatorId || 99999,
        machineId: selectedMachine,
        startTime: stopForm.startTime,
        endTime: stopForm.endTime,
        qtyOK: 0,
        qtyDefect: 0,
        observations: 'Parada via Digitação Rápida',
        createdAt: Date.now(),
        downtimeMinutes: diff,
        downtimeTypeId: stopForm.reasonId,
        metaData: { is_fast_entry: true }
      };

      await saveEntryMutation({ entry: dbEntry, isEdit: !!editingId });
      await loadData();

      if (closeModal) setIsStopModalOpen(false);
      else setStopForm({ startTime: '', endTime: '', reasonId: '' });
    } catch (err) {
      alert("Erro ao salvar parada: " + formatError(err));
    } finally {
      setIsSavingLocal(false);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (!confirm("Excluir este registro permanentemente?")) return;
    try {
      await deleteEntry(id);
      await loadData();
    } catch (err) {
      alert("Erro ao excluir: " + formatError(err));
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-24 animate-in fade-in">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h1 className="text-2xl font-bold mb-4 flex items-center text-brand-600">
          <Zap className="mr-2" size={28} fill="currentColor" /> Digitação Rápida
        </h1>
        <div className="flex flex-wrap gap-4 items-center">
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-40" label="Data" />
          <div className="flex flex-col space-y-1">
            <label className="text-sm font-bold text-slate-700">Máquina</label>
            <select value={selectedMachine} onChange={e => setSelectedMachine(e.target.value)} className="p-2 border rounded-lg bg-white font-bold">
              <option value="">Selecione...</option>
              {machines.map(m => <option key={m.code} value={m.code}>{m.code} - {m.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col space-y-1">
            <label className="text-sm font-bold text-slate-700">Turno</label>
            <select value={selectedShift} onChange={e => setSelectedShift(e.target.value)} className="p-2 border rounded-lg bg-white font-bold">
              <option value="">Selecione...</option>
              {filteredShifts.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>
          {isLoading && <Loader2 className="animate-spin text-brand-600 mt-6" size={24} />}
        </div>
      </div>

      {selectedMachine && selectedShift ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold flex items-center"><Package className="mr-2 text-green-600" /> Produção</h3>
              <button onClick={() => { setEditingId(null); setProdForm({ operatorId: '', cycleRate: '', productCode: '', weight: '', boxes: '' }); setIsProdModalOpen(true); }} className="bg-blue-600 text-white px-3 py-1 rounded text-sm font-bold shadow hover:bg-blue-700 flex items-center">
                <Plus size={16} className="mr-1" /> Adicionar
              </button>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b">
                  <tr><th className="px-4 py-2">Op.</th><th className="px-4 py-2">Produto</th><th className="px-4 py-2 text-right">Peso</th><th className="px-4 py-2 text-right">CXs</th><th className="px-4 py-2 text-center">Ações</th></tr>
                </thead>
                <tbody className="divide-y">
                  {prodEntries.map(e => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium">{e.operatorName.split(' ')[0]}</td>
                      <td className="px-4 py-2 text-xs" title={e.productName}>{e.productName.substring(0, 9)}</td>
                      <td className="px-4 py-2 text-right font-bold">{e.weight.toLocaleString('pt-BR')}kg</td>
                      <td className="px-4 py-2 text-right font-bold text-blue-600">{e.boxes}</td>
                      <td className="px-4 py-2 text-center">
                        <button onClick={() => { setEditingId(e.id); setProdForm({ operatorId: e.operatorId.toString(), productCode: e.productCode.toString(), cycleRate: e.cycleRate.toString(), weight: e.weight.toString(), boxes: e.boxes.toString() }); setIsProdModalOpen(true); }} className="p-1 text-slate-400 hover:text-blue-600"><Edit size={16} /></button>
                        <button onClick={() => handleDeleteEntry(e.id)} className="p-1 text-slate-400 hover:text-red-600"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold flex items-center"><PauseCircle className="mr-2 text-orange-600" /> Paradas</h3>
              <button onClick={() => { setEditingId(null); setStopForm({ startTime: '', endTime: '', reasonId: '' }); setIsStopModalOpen(true); }} className="bg-white text-slate-700 border px-3 py-1 rounded text-sm font-bold shadow-sm hover:bg-slate-50 flex items-center">
                <Plus size={16} className="mr-1" /> Adicionar
              </button>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b">
                  <tr><th className="px-4 py-2 w-32">Horário</th><th className="px-4 py-2">Motivo</th><th className="px-4 py-2 text-center w-24">Ações</th></tr>
                </thead>
                <tbody className="divide-y">
                  {stopEntries.map(e => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 align-middle">
                        <div className="flex gap-1 items-center whitespace-nowrap">
                          <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-mono border border-slate-200">{e.startTime}</span>
                          <span className="text-slate-300 text-[10px]">&rarr;</span>
                          <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-mono border border-slate-200">{e.endTime}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 align-middle">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-800">{e.reasonName}</span>
                          <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full border border-red-100 flex items-center whitespace-nowrap">
                            <Clock size={10} className="mr-1" /> {e.duration} min
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-center align-top">
                        <button onClick={() => { setEditingId(e.id); setStopForm({ startTime: e.startTime, endTime: e.endTime, reasonId: e.reasonId }); setIsStopModalOpen(true); }} className="p-1 text-slate-400 hover:text-blue-600"><Edit size={16} /></button>
                        <button onClick={() => handleDeleteEntry(e.id)} className="p-1 text-slate-400 hover:text-red-600"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="h-64 flex flex-col items-center justify-center bg-slate-100 rounded-xl border-2 border-dashed text-slate-400">
          <Monitor size={48} className="mb-2 opacity-20" /><p className="font-bold">Selecione Máquina e Turno para operar.</p>
        </div>
      )}

      {isProdModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in zoom-in-95">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="p-4 border-b bg-slate-50 flex justify-between items-center"><h3 className="font-bold">{editingId ? 'Editar Produção' : 'Nova Produção'}</h3><button onClick={() => setIsProdModalOpen(false)}><X size={24} /></button></div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><label className="text-xs font-bold uppercase text-slate-500">Operador</label><select value={prodForm.operatorId} onChange={e => setProdForm({ ...prodForm, operatorId: e.target.value })} className="w-full p-2 border rounded-lg font-bold"><option value="">Selecione...</option>{operators.filter(op => !op.sector || op.sector === currentMachine?.sector || op.id === Number(prodForm.operatorId)).map(op => <option key={op.id} value={op.id}>{op.name}</option>)}</select></div>
                <div><Input label="Ciclagem" value={prodForm.cycleRate} onChange={e => setProdForm({ ...prodForm, cycleRate: e.target.value })} placeholder="0,0" /></div>
                <div><ProductSelect products={products.filter(p => !p.compatibleMachines || p.compatibleMachines.includes(selectedMachine))} fullList={products} value={prodForm.productCode ? Number(prodForm.productCode) : null} onChange={v => setProdForm({ ...prodForm, productCode: v?.toString() || '' })} /></div>
                <div><Input ref={prodWeightRef} label="Peso (kg)" value={prodForm.weight} onChange={e => setProdForm({ ...prodForm, weight: e.target.value })} placeholder="0,00" /></div>
                <div><Input label="Caixas (Qtd)" value={prodForm.boxes} onChange={e => setProdForm({ ...prodForm, boxes: e.target.value })} placeholder="0" /></div>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t flex justify-end gap-3"><button onClick={() => setIsProdModalOpen(false)} className="px-4 py-2 text-slate-500 font-bold">Cancelar</button><button onClick={() => handleSaveProd(true)} disabled={isSavingLocal} className="px-6 py-2 bg-brand-600 text-white font-bold rounded shadow hover:bg-brand-700 flex items-center">{isSavingLocal ? <Loader2 className="animate-spin mr-2" size={18} /> : <Save className="mr-2" size={18} />} Salvar</button></div>
          </div>
        </div>
      )}

      {isStopModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in zoom-in-95">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-4 border-b bg-red-50 flex justify-between items-center"><h3 className="font-bold text-red-800">Registrar Parada</h3><button onClick={() => setIsStopModalOpen(false)}><X size={24} /></button></div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4"><Input ref={stopStartRef} label="Início" type="time" value={stopForm.startTime} onChange={e => setStopForm({ ...stopForm, startTime: e.target.value })} /><Input label="Fim" type="time" value={stopForm.endTime} onChange={e => setStopForm({ ...stopForm, endTime: e.target.value })} /></div>
              <div><label className="text-xs font-bold uppercase text-slate-500">Motivo</label><select value={stopForm.reasonId} onChange={e => setStopForm({ ...stopForm, reasonId: e.target.value })} className="w-full p-2 border rounded-lg font-bold"><option value="">Selecione...</option>{downtimeTypes.map(d => <option key={d.id} value={d.id}>{d.id} - {d.description}</option>)}</select></div>
            </div>
            <div className="p-4 bg-slate-50 border-t flex justify-end gap-3"><button onClick={() => setIsStopModalOpen(false)} className="px-4 py-2 text-slate-500 font-bold">Cancelar</button><button onClick={() => handleSaveStop(true)} disabled={isSavingLocal} className="px-6 py-2 bg-brand-600 text-white font-bold rounded shadow hover:bg-brand-700 flex items-center">{isSavingLocal ? <Loader2 className="animate-spin mr-2" size={18} /> : <Save className="mr-2" size={18} />} Salvar</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FastEntryPage;
