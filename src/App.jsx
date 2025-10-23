import React, { useState, useMemo, useEffect } from 'react';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Users, Clock, History, Shield, X, MessageSquare, Upload, Filter, TrendingUp, Home, Eye } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('accueil');
  const [selectedCD, setSelectedCD] = useState(null);
  const [feedbackOperator, setFeedbackOperator] = useState('');
  const [feedbackRole, setFeedbackRole] = useState('all');
  const [feedbackQuality, setFeedbackQuality] = useState('all');
  const [hiddenNiv3Ids, setHiddenNiv3Ids] = useState(new Set());
  const [showDefectRate, setShowDefectRate] = useState(false);
  const [binomeOperator, setBinomeOperator] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [filterTypeMachine, setFilterTypeMachine] = useState('all');
  const [filterTypeProd, setFilterTypeProd] = useState('all');
  const [filterMachine, setFilterMachine] = useState('all');
  const [thresholds, setThresholds] = useState({ excellent: 8, good: 12, poor: 15, maxNiv3Percent: 10 });
  const [dateRange, setDateRange] = useState(null);
  const [rawData, setRawData] = useState(null);
  const [nameFusions, setNameFusions] = useState({});
  const [sortByNet, setSortByNet] = useState(false);
  const [searchOperator, setSearchOperator] = useState('');
  const [searchMachine, setSearchMachine] = useState('');

  const [sortHistoryByDate, setSortHistoryByDate] = useState('recent'); // 'recent' ou 'oldest'
  async function handleFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    setUploadError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { cellDates: true });
        const sheetBD = workbook.Sheets['BD'];
        if (!sheetBD) { setUploadError("La feuille 'BD' n'a pas été trouvée"); setIsLoading(false); return; }
        const dataArray = XLSX.utils.sheet_to_json(sheetBD, { defval: null, raw: false, header: 1 });
        const dataRows = dataArray.slice(3);
        const dates = dataRows.map((row) => row?.[4]).map((d) => (d instanceof Date ? d : new Date(d))).filter((d) => d && !isNaN(d?.getTime?.()));
        const sortedDates = dates.sort((a, b) => a - b);
        const maxDate = sortedDates[sortedDates.length - 1];
        const sixMonthsBefore = new Date(maxDate);
        sixMonthsBefore.setMonth(maxDate.getMonth() - 6);
        setDateRange({ start: sixMonthsBefore.toISOString().split('T')[0], end: maxDate.toISOString().split('T')[0] });
        setRawData(dataRows);
      } catch (err) { setUploadError('Erreur lors du traitement du fichier'); }
      finally { setIsLoading(false); }
    };
    reader.onerror = () => { setUploadError('Erreur lors de la lecture du fichier'); setIsLoading(false); };
    reader.readAsArrayBuffer(file);
  }

  useEffect(() => {
    async function tryAutoLoad() {
      try {
        if (!window?.fs?.readFile) return;
        const response = await window.fs.readFile('Copie News 2024 BDCD 2014 3.xlsx');
        const workbook = XLSX.read(response, { cellDates: true });
        const sheetBD = workbook.Sheets['BD'];
        if (!sheetBD) return;
        const dataArray = XLSX.utils.sheet_to_json(sheetBD, { defval: null, raw: false, header: 1 });
        const dataRows = dataArray.slice(3);
        const dates = dataRows.map((row) => row?.[4]).map((d) => (d instanceof Date ? d : new Date(d))).filter((d) => d && !isNaN(d?.getTime?.()));
        if (dates.length) {
          const sortedDates = dates.sort((a, b) => a - b);
          const maxDate = sortedDates[sortedDates.length - 1];
          const sixMonthsBefore = new Date(maxDate);
          sixMonthsBefore.setMonth(maxDate.getMonth() - 6);
          const formatDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          setDateRange({ start: formatDate(sixMonthsBefore), end: formatDate(maxDate) });
        }
        setRawData(dataRows);
      } catch (e) {
        // Auto-load silencieux
      }
    }
    tryAutoLoad();
  }, []);

  const allUniqueNames = useMemo(() => {
    if (!rawData) return [];
    const namesSet = new Set();
    rawData.forEach((row) => {
      [row[16], row[17], row[18]].forEach((name) => {
        if (name && typeof name === 'string' && name.trim().length > 1) namesSet.add(name.trim());
      });
    });
    return Array.from(namesSet).sort();
  }, [rawData]);

  const getNormalizedName = (rawName) => {
    if (!rawName) return null;
    if (nameFusions[rawName]) return nameFusions[rawName];
    return rawName;
  };

  const cdData = useMemo(() => {
    if (!rawData) return [];
    let cdId = 1;
    const data = [];
    for (const row of rawData) {
      if (!row) continue;
      let date = null;
      const d = row[4];
      if (d) date = d instanceof Date ? d : new Date(d);
      if (!date || isNaN(date.getTime())) continue;
      const dateStr = date.toISOString().split('T')[0];
      const conf1 = getNormalizedName(row[16]);
      const conf2 = getNormalizedName(row[17]);
      if (!conf1 && !conf2) continue;
      const tempsD1 = parseFloat(row[85]) || 0;
      if (tempsD1 <= 0) continue;
      
      // Filtrer les proto ici directement
      const typeProd = row[7] || 'N/A';
      if (typeProd.toLowerCase() === 'proto') continue;
      
      let qualite = 'Niv1';
      let qualiteInfo = null;
      if (row[67]) { qualite = 'Niv3'; qualiteInfo = typeof row[67] === 'string' ? row[67] : "Pas d'informations"; }
      else if (row[68]) { qualite = 'Niv2'; qualiteInfo = typeof row[68] === 'string' ? row[68] : "Pas d'informations"; }
      const pannes = parseFloat(row[110]) || 0;
      data.push({ 
        id: cdId++, 
        date: dateStr, 
        week: row[3] || null, 
        month: row[2] || null, 
        year: row[1] || null, 
        conf1, 
        conf2, 
        tempsD1, 
        tempsD1Net: parseFloat(row[111]) || 0, 
        qualite, 
        qualiteInfo, 
        isPanne: pannes > 0, 
        dimension: row[14] || 'N/A', 
        machine: row[6] || 'N/A', 
        commentaire: row[64] || '', 
        cqCW: row[100] || '', 
        cqCX: row[101] || '', 
        cqCY: row[102] || '', 
        notesGarant: row[131] || '', 
        typeMachine: row[5] || 'N/A', 
        typeProd: typeProd, 
        typeCD: row[8] || 'Normal' 
      });
    }
    return data;
  }, [rawData, nameFusions]);

  const filteredCdData = useMemo(() => {
    let filtered = cdData;
    if (dateRange) {
      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);
      filtered = filtered.filter((cd) => { const cdDate = new Date(cd.date); return cdDate >= startDate && cdDate <= endDate; });
    }
    if (filterTypeMachine !== 'all') filtered = filtered.filter(cd => cd.typeMachine === filterTypeMachine);
    if (filterTypeProd !== 'all') filtered = filtered.filter(cd => cd.typeProd === filterTypeProd);
    if (filterMachine !== 'all') filtered = filtered.filter(cd => cd.machine === filterMachine);
    return filtered;
  }, [cdData, dateRange, filterTypeMachine, filterTypeProd, filterMachine]);

  const sortedHistoryCdData = useMemo(() => {
    const sorted = [...filteredCdData];
    if (sortHistoryByDate === 'recent') {
      return sorted.sort((a, b) => new Date(b.date) - new Date(a.date));
    } else {
      return sorted.sort((a, b) => new Date(a.date) - new Date(b.date));
    }
  }, [filteredCdData, sortHistoryByDate]);

  const uniqueTypeMachines = useMemo(() => { const types = new Set(); cdData.forEach(cd => types.add(cd.typeMachine)); return Array.from(types).sort(); }, [cdData]);
  const uniqueTypeProds = useMemo(() => { const types = new Set(); cdData.forEach(cd => types.add(cd.typeProd)); return Array.from(types).sort(); }, [cdData]);
  const uniqueMachines = useMemo(() => { const machines = new Set(); cdData.forEach(cd => machines.add(cd.machine)); return Array.from(machines).sort(); }, [cdData]);

  const machineStats = useMemo(() => {
    const byMachine = {};
    for (const machine of uniqueMachines) {
      const cdsForMachine = filteredCdData.filter(cd => cd.machine === machine);
      if (!cdsForMachine.length) continue;
      const avgTime = cdsForMachine.reduce((s, cd) => s + cd.tempsD1, 0) / cdsForMachine.length;
      byMachine[machine] = {
        machine,
        totalCD: cdsForMachine.length,
        avgTime,
        niv1: cdsForMachine.filter(cd => cd.qualite === 'Niv1').length,
        niv2: cdsForMachine.filter(cd => cd.qualite === 'Niv2').length,
        niv3: cdsForMachine.filter(cd => cd.qualite === 'Niv3').length,
        incidents: cdsForMachine.filter(cd => cd.isPanne).length
      };
    }
    return Object.values(byMachine);
  }, [filteredCdData, uniqueMachines]);

  const operators = useMemo(() => {
    const ops = new Set();
    filteredCdData.forEach((cd) => { if (cd.conf1) ops.add(cd.conf1); if (cd.conf2) ops.add(cd.conf2); });
    return Array.from(ops).sort();
  }, [filteredCdData]);

  const operatorStats = useMemo(() => {
    const byOp = {};
    for (const op of operators) {
      const cdAsConf1 = filteredCdData.filter((cd) => cd.conf1 === op);
      const cdAsConf2 = filteredCdData.filter((cd) => cd.conf2 === op);
      const allCD = [...cdAsConf1, ...cdAsConf2];
      if (!allCD.length) continue;
      const avgTime = allCD.reduce((s, cd) => s + cd.tempsD1, 0) / allCD.length;
      const avgTimeNet = allCD.reduce((s, cd) => s + cd.tempsD1Net, 0) / allCD.length;
      byOp[op] = { 
        name: op, 
        totalCD: allCD.length, 
        asConf1: cdAsConf1.length, 
        asConf2: cdAsConf2.length, 
        avgTime,
        avgTimeNet,
        niv1: allCD.filter((cd) => cd.qualite === 'Niv1').length, 
        niv2: allCD.filter((cd) => cd.qualite === 'Niv2').length, 
        niv3: allCD.filter((cd) => cd.qualite === 'Niv3').length, 
        cdListConf1: cdAsConf1, 
        cdListConf2: cdAsConf2 
      };
    }
    return Object.values(byOp);
  }, [filteredCdData, operators]);

  const globalStats = useMemo(() => {
    const total = filteredCdData.length;
    if (!total) return { total: 0, avgTime: '0', incidents: 0, niv1: 0, niv2: 0, niv3: 0 };
    const avgTime = filteredCdData.reduce((s, cd) => s + cd.tempsD1, 0) / total;
    const niv1 = filteredCdData.filter((cd) => cd.qualite === 'Niv1').length;
    const niv2 = filteredCdData.filter((cd) => cd.qualite === 'Niv2').length;
    const niv3 = filteredCdData.filter((cd) => cd.qualite === 'Niv3').length;
    return { total, avgTime: avgTime.toFixed(1), incidents: filteredCdData.filter((cd) => cd.isPanne).length, niv1, niv2, niv3 };
  }, [filteredCdData]);

  const historyData = useMemo(() => {
    const grouped = {};
    for (const cd of filteredCdData) {
      const key = cd.date.substring(0, 7);
      if (!grouped[key]) grouped[key] = { month: key, total: 0, niv1: 0, niv2: 0, niv3: 0, sumTime: 0 };
      grouped[key].total++; grouped[key].sumTime += cd.tempsD1;
      if (cd.qualite === 'Niv1') grouped[key].niv1++;
      if (cd.qualite === 'Niv2') grouped[key].niv2++;
      if (cd.qualite === 'Niv3') grouped[key].niv3++;
    }
    return Object.values(grouped).map((g) => ({ ...g, avgTime: +(g.sumTime / g.total).toFixed(1) })).sort((a, b) => a.month.localeCompare(b.month));
  }, [filteredCdData]);

  const binomeStats = useMemo(() => {
    if (!binomeOperator) return [];
    const map = {};
    for (const cd of filteredCdData) {
      let partner = null;
      if (cd.conf1 === binomeOperator) partner = cd.conf2;
      else if (cd.conf2 === binomeOperator) partner = cd.conf1;
      if (!partner) continue;
      if (!map[partner]) map[partner] = { name: partner, totalCD: 0, sumTime: 0, niv1: 0, niv2: 0, niv3: 0 };
      map[partner].totalCD++; map[partner].sumTime += cd.tempsD1;
      if (cd.qualite === 'Niv1') map[partner].niv1++;
      if (cd.qualite === 'Niv2') map[partner].niv2++;
      if (cd.qualite === 'Niv3') map[partner].niv3++;
    }
    return Object.values(map).map((b) => ({ ...b, avgTime: b.sumTime / b.totalCD })).sort((a, b) => a.avgTime - b.avgTime);
  }, [binomeOperator, filteredCdData]);

  const selectedStat = feedbackOperator ? operatorStats.find((s) => s.name === feedbackOperator) : null;

  const feedbackFilteredCDs = useMemo(() => {
    if (!selectedStat) return [];
    let cds = [];
    if (feedbackRole === 'all') cds = [...selectedStat.cdListConf1, ...selectedStat.cdListConf2];
    else if (feedbackRole === 'conf1') cds = selectedStat.cdListConf1;
    else if (feedbackRole === 'conf2') cds = selectedStat.cdListConf2;
    if (feedbackQuality !== 'all') {
      const qualityMap = { niv1: 'Niv1', niv2: 'Niv2', niv3: 'Niv3' };
      cds = cds.filter(cd => cd.qualite === qualityMap[feedbackQuality]);
    }
    return cds.sort((a, b) => b.date.localeCompare(a.date));
  }, [selectedStat, feedbackRole, feedbackQuality]);

  const feedbackStats = useMemo(() => {
    if (!feedbackFilteredCDs.length) return null;
    const visibleCDs = feedbackFilteredCDs.filter(cd => !(cd.qualite === 'Niv3' && hiddenNiv3Ids.has(cd.id)));
    if (!visibleCDs.length) return { total: 0, avgTime: 0, avgTimeNet: 0, niv1: 0, niv2: 0, niv3: 0, withCQ: 0, hidden: feedbackFilteredCDs.length };
    const avgTime = visibleCDs.reduce((s, cd) => s + cd.tempsD1, 0) / visibleCDs.length;
    const avgTimeNet = visibleCDs.reduce((s, cd) => s + cd.tempsD1Net, 0) / visibleCDs.length;
    const niv1 = visibleCDs.filter(cd => cd.qualite === 'Niv1').length;
    const niv2 = visibleCDs.filter(cd => cd.qualite === 'Niv2').length;
    const niv3 = visibleCDs.filter(cd => cd.qualite === 'Niv3').length;
    const withCQ = visibleCDs.filter(cd => cd.cqCW || cd.cqCX || cd.cqCY).length;
    const hidden = feedbackFilteredCDs.length - visibleCDs.length;
    return { total: visibleCDs.length, avgTime, avgTimeNet, niv1, niv2, niv3, withCQ, hidden };
  }, [feedbackFilteredCDs, hiddenNiv3Ids]);

  function getTimeColor(time) {
    if (time <= thresholds.excellent) return '#4CAF50';
    if (time <= thresholds.good) return '#2196F3';
    if (time <= thresholds.poor) return '#FF9800';
    return '#F44336';
  }

  function evaluateOperatorPerformance(op) {
    const timePerf = op.avgTime <= thresholds.excellent ? 'excellent' : op.avgTime <= thresholds.good ? 'good' : op.avgTime <= thresholds.poor ? 'warning' : 'critical';
    const niv3Pct = (op.niv3 / op.totalCD * 100);
    const issues = [];
    if (niv3Pct > thresholds.maxNiv3Percent) issues.push(`Niv3: ${niv3Pct.toFixed(0)}% (max: ${thresholds.maxNiv3Percent}%)`);
    let status = timePerf;
    if (issues.length > 0) {
      if (timePerf === 'excellent' || timePerf === 'good') status = 'warning';
      else if (timePerf === 'warning') status = 'critical';
    }
    return { status, alerts: issues, niv3Percent: niv3Pct.toFixed(0) };
  }

  function setQuickDateRange(preset) {
    if (!dateRange) return;
    const end = new Date(dateRange.end);
    const start = new Date(dateRange.end);
    if (preset === '7d') start.setDate(end.getDate() - 7);
    else if (preset === '30d') start.setDate(end.getDate() - 30);
    else if (preset === '3m') start.setMonth(end.getMonth() - 3);
    else if (preset === '6m') start.setMonth(end.getMonth() - 6);
    setDateRange({ start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] });
  }

  function toggleHideNiv3(cdId) {
    setHiddenNiv3Ids(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cdId)) newSet.delete(cdId);
      else newSet.add(cdId);
      return newSet;
    });
  }

  function exportOperatorsToExcel() {
    const sortedOps = [...operatorStats].sort((a, b) => sortByNet ? a.avgTimeNet - b.avgTimeNet : a.avgTime - b.avgTime);
    const dataToExport = sortedOps.map((op, idx) => ({
      'Rang': idx + 1,
      'Opérateur': op.name,
      'Total CD': op.totalCD,
      'Temps Moyen D1': op.avgTime.toFixed(1),
      'Temps Moyen D1 NET': op.avgTimeNet.toFixed(1),
      'Niv1': op.niv1,
      'Niv2': op.niv2,
      'Niv3': op.niv3,
      '% Niv3': ((op.niv3 / op.totalCD) * 100).toFixed(1),
      'CD Conf1 (PNC)': op.asConf1,
      'CD Conf2 (PNS)': op.asConf2
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Opérateurs');
    XLSX.writeFile(wb, `Statistiques_Operateurs_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  function exportMachinesToExcel() {
    const sortedMachines = [...machineStats].sort((a, b) => a.avgTime - b.avgTime);
    const dataToExport = sortedMachines.map((machine, idx) => ({
      'Rang': idx + 1,
      'N° Machine': machine.machine,
      'Total CD': machine.totalCD,
      'Temps Moyen': machine.avgTime.toFixed(1),
      'Niv1': machine.niv1,
      'Niv2': machine.niv2,
      'Niv3': machine.niv3,
      '% Niv3': ((machine.niv3 / machine.totalCD) * 100).toFixed(1),
      'Incidents': machine.incidents
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Machines');
    XLSX.writeFile(wb, `Statistiques_Machines_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  const tabs = [
    { id: 'accueil', name: 'Accueil', icon: Home },
    { id: 'historique', name: 'Historique', icon: History },
    { id: 'statistiques', name: 'Statistiques', icon: TrendingUp },
    { id: 'feedback', name: 'Feedback', icon: MessageSquare },
    { id: 'binomes', name: 'Binômes', icon: Users },
    { id: 'manager', name: 'Vue Manager', icon: Eye },
    { id: 'machines', name: 'Machines', icon: Shield },
    { id: 'admin', name: 'Admin', icon: Shield }
  ];

  function NameFusionManager({ allNames, nameFusions, setNameFusions }) {
    const [selectedNames, setSelectedNames] = useState([]);
    const [targetName, setTargetName] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const uniqueNames = [...new Set(allNames)].sort();
    const filteredNames = uniqueNames.filter(name => name.toLowerCase().includes(searchTerm.toLowerCase()));
    const toggleName = (name) => setSelectedNames(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
    const createFusion = () => {
      if (selectedNames.length < 2 || !targetName.trim()) { alert('Sélectionnez au moins 2 noms et définissez le nom cible'); return; }
      const newFusions = { ...nameFusions };
      selectedNames.forEach(name => { if (name !== targetName) newFusions[name] = targetName; });
      setNameFusions(newFusions);
      setSelectedNames([]);
      setTargetName('');
    };
    const deleteFusion = (sourceName) => {
      const newFusions = { ...nameFusions };
      delete newFusions[sourceName];
      setNameFusions(newFusions);
    };
    const existingFusions = Object.entries(nameFusions);
    return (
      <div className="space-y-4">
        {existingFusions.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-3">Fusions actives ({existingFusions.length})</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {existingFusions.map(([source, target]) => (
                <div key={source} className="flex items-center justify-between bg-white p-2 rounded border">
                  <span className="text-sm"><span className="text-slate-600">{source}</span><span className="mx-2 text-blue-600">→</span><span className="font-semibold text-blue-900">{target}</span></span>
                  <button onClick={() => deleteFusion(source)} className="text-red-600 hover:text-red-800 px-2 py-1"><X size={16} /></button>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="border-2 border-dashed border-slate-300 rounded-lg p-4">
          <h4 className="font-semibold mb-3">Créer une nouvelle fusion</h4>
          <div className="mb-4">
            <input type="text" placeholder="Rechercher un nom..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4 max-h-64 overflow-y-auto p-2 bg-slate-50 rounded">
            {filteredNames.map(name => (
              <label key={name} className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${selectedNames.includes(name) ? 'bg-blue-100 border-2 border-blue-500' : 'bg-white border border-slate-200 hover:bg-slate-100'}`}>
                <input type="checkbox" checked={selectedNames.includes(name)} onChange={() => toggleName(name)} className="w-4 h-4" />
                <span className="text-sm">{name}</span>
              </label>
            ))}
          </div>
          {selectedNames.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-green-800 font-medium mb-2">{selectedNames.length} nom(s) sélectionné(s) :</p>
              <div className="flex flex-wrap gap-1">
                {selectedNames.map(name => <span key={name} className="bg-green-200 text-green-900 px-2 py-1 rounded text-xs font-medium">{name}</span>)}
              </div>
            </div>
          )}
          <div className="flex gap-3">
            <input type="text" placeholder="Nom cible (ex: DUPONT Jean)" value={targetName} onChange={(e) => setTargetName(e.target.value)} className="flex-1 px-4 py-2 border-2 border-blue-300 rounded-lg font-semibold" />
            <button onClick={createFusion} disabled={selectedNames.length < 2 || !targetName.trim()} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed">Fusionner</button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-800 flex items-center justify-center">
        <div className="text-center">
          <div className="relative mb-8">
            <div className="w-32 h-32 mx-auto relative">
              <div className="absolute inset-0 border-8 border-blue-300 border-t-yellow-400 rounded-full animate-spin"></div>
              <div className="absolute inset-4 bg-white rounded-full flex items-center justify-center"><div className="text-4xl font-bold text-blue-900">M</div></div>
            </div>
          </div>
          <h2 className="text-3xl font-bold text-white mb-3">MICHELIN</h2>
          <p className="text-xl text-blue-200 mb-6">Chargement des données...</p>
          <div className="flex justify-center gap-2 mb-4">
            <div className="w-3 h-3 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-3 h-3 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-3 h-3 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          <p className="text-sm text-blue-300">Analyse en cours...</p>
        </div>
      </div>
    );
  }

  if (!rawData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-xl shadow-lg max-w-md">
          <Upload className="mx-auto mb-4 text-blue-600" size={64} />
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Charger les données</h2>
          <p className="text-slate-600 mb-6">Veuillez sélectionner votre fichier Excel</p>
          <label className="inline-block">
            <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
            <span className="cursor-pointer inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"><Upload size={20} />Sélectionner fichier</span>
          </label>
          {uploadError && <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg"><p className="text-sm text-red-700">{uploadError}</p></div>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="bg-gradient-to-r from-blue-900 to-blue-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-yellow-400">Dashboard Michelin Gravanches</h1>
              <p className="text-blue-200 mt-1">Analyse Changements Dimension</p>
            </div>
            <label className="cursor-pointer">
              <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600 rounded-lg font-medium"><Upload size={18} />Charger fichier</span>
            </label>
          </div>
          {dateRange && (
            <div className="space-y-4">
              <div className="bg-blue-800/50 rounded-lg p-4">
                <div className="flex flex-wrap items-end gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-sm font-medium text-blue-200 mb-2">Date début</label>
                    <input type="date" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-white text-slate-900" />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-sm font-medium text-blue-200 mb-2">Date fin</label>
                    <input type="date" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-white text-slate-900" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setQuickDateRange('7d')} className="px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm">7j</button>
                    <button onClick={() => setQuickDateRange('30d')} className="px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm">30j</button>
                    <button onClick={() => setQuickDateRange('3m')} className="px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm">3m</button>
                    <button onClick={() => setQuickDateRange('6m')} className="px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm">6m</button>
                  </div>
                </div>
                <p className="text-blue-200 text-sm mt-3">{new Date(dateRange.start).toLocaleDateString('fr-FR')} - {new Date(dateRange.end).toLocaleDateString('fr-FR')}<span className="ml-3 font-semibold text-yellow-300">({filteredCdData.length} CD)</span></p>
              </div>
              <div className="bg-blue-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3"><Filter size={18} className="text-blue-200" /><h3 className="text-sm font-semibold text-blue-200">Filtres avancés</h3></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-blue-200 mb-2">Type Machine</label>
                    <select value={filterTypeMachine} onChange={(e) => setFilterTypeMachine(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-white text-slate-900 text-sm">
                      <option value="all">Tous</option>
                      {uniqueTypeMachines.map(type => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-blue-200 mb-2">Type Production</label>
                    <select value={filterTypeProd} onChange={(e) => setFilterTypeProd(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-white text-slate-900 text-sm">
                      <option value="all">Tous</option>
                      {uniqueTypeProds.map(type => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-blue-200 mb-2">N° Machine</label>
                    <select value={filterMachine} onChange={(e) => setFilterMachine(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-white text-slate-900 text-sm">
                      <option value="all">Toutes</option>
                      {uniqueMachines.map(machine => <option key={machine} value={machine}>{machine}</option>)}
                    </select>
                  </div>
                </div>
                {(filterTypeMachine !== 'all' || filterTypeProd !== 'all' || filterMachine !== 'all') && (
                  <button onClick={() => { setFilterTypeMachine('all'); setFilterTypeProd('all'); setFilterMachine('all'); }} className="mt-3 text-xs px-3 py-1 bg-yellow-500 text-slate-900 rounded-lg hover:bg-yellow-400">Réinitialiser filtres</button>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex space-x-1 overflow-x-auto justify-center">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center space-x-2 px-6 py-4 border-b-2 transition-colors ${activeTab === tab.id ? 'border-blue-600 text-blue-600 font-semibold bg-blue-50' : 'border-transparent text-slate-600 hover:bg-slate-50'}`}>
                  <Icon size={18} /><span>{tab.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === 'accueil' && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl shadow-sm p-6 text-center">
                <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"><Users className="text-blue-600" size={32} /></div>
                <p className="text-4xl font-bold text-slate-900 mb-2">{globalStats.total}</p>
                <p className="text-sm text-slate-600">Total CD</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6 text-center">
                <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"><Clock className="text-purple-600" size={32} /></div>
                <p className="text-4xl font-bold text-slate-900 mb-2">{globalStats.avgTime}h</p>
                <p className="text-sm text-slate-600">Temps Moyen</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6 text-center">
                <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"><TrendingUp className="text-green-600" size={32} /></div>
                <p className="text-4xl font-bold text-green-600 mb-2">{globalStats.niv1}</p>
                <p className="text-sm text-slate-600">CD Niv1</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6 text-center">
                <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"><X className="text-red-600" size={32} /></div>
                <p className="text-4xl font-bold text-red-600 mb-2">{globalStats.incidents}</p>
                <p className="text-sm text-slate-600">Incidents</p>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-xl font-semibold mb-6 text-center">Répartition Qualité</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={[{ name: 'Niv1', value: globalStats.niv1 }, { name: 'Niv2', value: globalStats.niv2 }, { name: 'Niv3', value: globalStats.niv3 }]} cx="50%" cy="50%" label={(entry) => `${entry.name} ${((entry.value / globalStats.total) * 100).toFixed(0)}%`} outerRadius={100} dataKey="value">
                      <Cell fill="#4CAF50" /><Cell fill="#FF9800" /><Cell fill="#F44336" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-xl font-semibold mb-4 text-center">Distribution Temps</h3>
                <div className="space-y-4">
                  <div className="bg-green-50 p-4 rounded-lg border-2 border-green-200"><div className="flex justify-between items-center"><span className="text-sm text-green-700 font-medium">≤ {thresholds.excellent}h</span><span className="text-3xl font-bold text-green-900">{filteredCdData.filter(cd => cd.tempsD1 <= thresholds.excellent).length}</span></div></div>
                  <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200"><div className="flex justify-between items-center"><span className="text-sm text-blue-700 font-medium">≤ {thresholds.good}h</span><span className="text-3xl font-bold text-blue-900">{filteredCdData.filter(cd => cd.tempsD1 > thresholds.excellent && cd.tempsD1 <= thresholds.good).length}</span></div></div>
                  <div className="bg-orange-50 p-4 rounded-lg border-2 border-orange-200"><div className="flex justify-between items-center"><span className="text-sm text-orange-700 font-medium">≤ {thresholds.poor}h</span><span className="text-3xl font-bold text-orange-900">{filteredCdData.filter(cd => cd.tempsD1 > thresholds.good && cd.tempsD1 <= thresholds.poor).length}</span></div></div>
                  <div className="bg-red-50 p-4 rounded-lg border-2 border-red-200"><div className="flex justify-between items-center"><span className="text-sm text-red-700 font-medium">&gt; {thresholds.poor}h</span><span className="text-3xl font-bold text-red-900">{filteredCdData.filter(cd => cd.tempsD1 > thresholds.poor).length}</span></div></div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-xl font-semibold mb-6 text-center">Par Type Machine</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={uniqueTypeMachines.map(type => ({ name: type, count: filteredCdData.filter(cd => cd.typeMachine === type).length }))}>
                    <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="count" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-xl font-semibold mb-6 text-center">Par Type Production</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={uniqueTypeProds.map(type => ({ name: type, count: filteredCdData.filter(cd => cd.typeProd === type).length }))}>
                    <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="count" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'historique' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-2xl font-bold mb-6">Liste des CD</h2>
            <div className="mb-4 flex items-center gap-3">
              <label className="text-sm font-medium text-slate-700">Trier par date :</label>
              <select 
                value={sortHistoryByDate} 
                onChange={(e) => setSortHistoryByDate(e.target.value)}
                className="px-4 py-2 border-2 border-slate-300 rounded-lg text-sm font-medium hover:border-blue-500 focus:border-blue-500 focus:outline-none transition-colors"
              >
                <option value="recent">Plus récents d'abord</option>
                <option value="oldest">Plus anciens d'abord</option>
              </select>
            </div>
            <div className="overflow-auto max-h-[600px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white border-b-2">
                  <tr><th className="text-left py-3 px-3">Date</th><th className="text-left py-3 px-3">Conf1</th><th className="text-left py-3 px-3">Conf2</th><th className="text-center py-3 px-3">Temps</th><th className="text-center py-3 px-3">Qualité</th><th className="text-center py-3 px-3">CQ</th><th className="text-center py-3 px-3">N° Machine</th><th className="text-center py-3 px-3">Type Machine</th><th className="text-center py-3 px-3">Prod</th></tr>
                </thead>
                <tbody>
                  {sortedHistoryCdData.map((cd) => {
                    const hasCQ = cd.cqCW || cd.cqCX || cd.cqCY;
                    return (
                    <tr key={cd.id} onClick={() => setSelectedCD(cd)} className="border-b hover:bg-slate-50 cursor-pointer">
                      <td className="py-2 px-3">{cd.date}</td>
                      <td className="py-2 px-3 font-medium">{cd.conf1 || '-'}</td>
                      <td className="py-2 px-3 font-medium">{cd.conf2 || '-'}</td>
                      <td className="py-2 px-3 text-center"><span className="font-bold" style={{ color: getTimeColor(cd.tempsD1) }}>{cd.tempsD1}h</span></td>
                      <td className="py-2 px-3 text-center">
                        <span 
                          className={`px-2 py-1 rounded text-xs font-medium ${cd.qualite === 'Niv1' ? 'bg-green-100 text-green-700' : cd.qualite === 'Niv2' ? 'bg-orange-100 text-orange-700 cursor-help' : 'bg-red-100 text-red-700 cursor-help'}`}
                          title={cd.qualite !== 'Niv1' && cd.qualiteInfo ? cd.qualiteInfo : ''}
                        >
                          {cd.qualite}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        {hasCQ ? (
                          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded font-medium cursor-help" title={`${cd.cqCW ? 'NC: ' + cd.cqCW : ''}${cd.cqCX ? ' PNS: ' + cd.cqCX : ''}${cd.cqCY ? ' 82.1: ' + cd.cqCY : ''}`}>CQ</span>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center text-xs font-semibold text-blue-600">{cd.machine}</td>
                      <td className="py-2 px-3 text-center text-xs">{cd.typeMachine}</td>
                      <td className="py-2 px-3 text-center text-xs">{cd.typeProd}</td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-slate-600 mt-4 text-center">{sortedHistoryCdData.length} CD affichés</p>
          </div>
        )}

        {activeTab === 'statistiques' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-2xl font-bold mb-6">Évolution Temporelle</h2>
              {historyData.length ? (
                <div className="space-y-8">
                  <div><h3 className="text-lg font-semibold mb-4">Temps Moyen par Mois</h3><ResponsiveContainer width="100%" height={300}><LineChart data={historyData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Legend /><Line type="monotone" dataKey="avgTime" stroke="#8884d8" strokeWidth={3} name="Temps (h)" /></LineChart></ResponsiveContainer></div>
                  <div><h3 className="text-lg font-semibold mb-4">Évolution Qualité</h3><ResponsiveContainer width="100%" height={300}><LineChart data={historyData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Legend /><Line type="monotone" dataKey="niv1" stroke="#4CAF50" strokeWidth={2} name="Niv1" /><Line type="monotone" dataKey="niv2" stroke="#FF9800" strokeWidth={2} name="Niv2" /><Line type="monotone" dataKey="niv3" stroke="#F44336" strokeWidth={2} name="Niv3" /></LineChart></ResponsiveContainer></div>
                  <div><h3 className="text-lg font-semibold mb-4">Volume CD</h3><ResponsiveContainer width="100%" height={300}><LineChart data={historyData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Legend /><Line type="monotone" dataKey="total" stroke="#9c27b0" strokeWidth={3} name="Nombre CD" /></LineChart></ResponsiveContainer></div>
                </div>
              ) : <p className="text-center py-12 text-slate-500">Aucune donnée</p>}
            </div>
          </div>
        )}

        {activeTab === 'binomes' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-8">
              <h3 className="text-2xl font-semibold mb-6 text-center">Analyse Binômes</h3>
              <div className="max-w-md mx-auto">
                <label className="block text-sm font-medium mb-3">Opérateur</label>
                <select value={binomeOperator} onChange={(e) => setBinomeOperator(e.target.value)} className="w-full px-4 py-3 border-2 rounded-lg text-lg">
                  <option value="">Choisir</option>
                  {operators.map(op => <option key={op} value={op}>{op}</option>)}
                </select>
              </div>
            </div>
            {binomeOperator && binomeStats.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-8">
                <h3 className="text-2xl font-bold mb-6 text-center">Binômes de {binomeOperator}</h3>
                <div className="overflow-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b-2">
                      <tr><th className="text-left py-3 px-4">Rang</th><th className="text-left py-3 px-4">Partenaire</th><th className="text-center py-3 px-4">CD</th><th className="text-center py-3 px-4">Temps</th><th className="text-center py-3 px-4">Qualité</th></tr>
                    </thead>
                    <tbody>
                      {binomeStats.map((binome, idx) => (
                        <tr key={idx} className="border-b hover:bg-slate-50">
                          <td className="py-3 px-4"><span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${idx === 0 ? 'bg-yellow-500 text-white' : idx === 1 ? 'bg-gray-400 text-white' : idx === 2 ? 'bg-orange-600 text-white' : 'bg-slate-200'}`}>{idx + 1}</span></td>
                          <td className="py-3 px-4 font-bold">{binome.name}</td>
                          <td className="py-3 px-4 text-center text-lg font-semibold text-blue-600">{binome.totalCD}</td>
                          <td className="py-3 px-4 text-center font-bold" style={{ color: getTimeColor(binome.avgTime) }}>{binome.avgTime.toFixed(1)}h</td>
                          <td className="py-3 px-4"><div className="flex justify-center gap-2"><span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">{binome.niv1}</span><span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs">{binome.niv2}</span><span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">{binome.niv3}</span></div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'feedback' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-2xl font-semibold mb-4 text-center">Consultation Individuelle</h3>
              <div className="max-w-md mx-auto">
                <label className="block text-sm font-medium mb-2 text-center">Opérateur</label>
                <select value={feedbackOperator} onChange={(e) => { setFeedbackOperator(e.target.value); setFeedbackRole('all'); setFeedbackQuality('all'); }} className="w-full px-4 py-3 border-2 rounded-lg text-lg">
                  <option value="">Sélectionner un opérateur</option>
                  {operators.map(op => <option key={op} value={op}>{op}</option>)}
                </select>
              </div>
            </div>
            {selectedStat && (
              <>
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg p-6 text-white">
                  <h3 className="text-3xl font-bold mb-6 text-center">{selectedStat.name}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg text-center"><p className="text-sm opacity-90 mb-1">Total CD</p><p className="text-3xl font-bold">{selectedStat.totalCD}</p></div>
                    <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg text-center"><p className="text-sm opacity-90 mb-1">Temps Moyen</p><p className="text-3xl font-bold">{selectedStat.avgTime.toFixed(1)}h</p></div>
                    <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg text-center"><p className="text-sm opacity-90 mb-1">PNC (Conf1)</p><p className="text-3xl font-bold">{selectedStat.asConf1}</p></div>
                    <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg text-center"><p className="text-sm opacity-90 mb-1">PNS (Conf2)</p><p className="text-3xl font-bold">{selectedStat.asConf2}</p></div>
                    <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg text-center"><p className="text-sm opacity-90 mb-1">Qualité</p><div className="flex justify-center gap-2 mt-1"><span className="bg-green-500 px-2 py-1 rounded text-sm font-bold">{selectedStat.niv1}</span><span className="bg-orange-500 px-2 py-1 rounded text-sm font-bold">{selectedStat.niv2}</span><span className="bg-red-500 px-2 py-1 rounded text-sm font-bold">{selectedStat.niv3}</span></div></div>
                  </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <div className="flex items-center gap-2 mb-4"><Filter size={20} className="text-slate-600" /><h4 className="text-lg font-semibold">Filtres</h4></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium mb-3">Rôle de l'opérateur</label>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => setFeedbackRole('all')} className={`px-4 py-2 rounded-lg font-medium transition-all ${feedbackRole === 'all' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>Tous ({selectedStat.totalCD})</button>
                        <button onClick={() => setFeedbackRole('conf1')} className={`px-4 py-2 rounded-lg font-medium transition-all ${feedbackRole === 'conf1' ? 'bg-green-600 text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>PNC ({selectedStat.asConf1})</button>
                        <button onClick={() => setFeedbackRole('conf2')} className={`px-4 py-2 rounded-lg font-medium transition-all ${feedbackRole === 'conf2' ? 'bg-orange-600 text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>PNS ({selectedStat.asConf2})</button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-3">Niveau de qualité</label>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => setFeedbackQuality('all')} className={`px-4 py-2 rounded-lg font-medium transition-all ${feedbackQuality === 'all' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>Tous</button>
                        <button onClick={() => setFeedbackQuality('niv1')} className={`px-4 py-2 rounded-lg font-medium transition-all ${feedbackQuality === 'niv1' ? 'bg-green-600 text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>Niv1</button>
                        <button onClick={() => setFeedbackQuality('niv2')} className={`px-4 py-2 rounded-lg font-medium transition-all ${feedbackQuality === 'niv2' ? 'bg-orange-600 text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>Niv2</button>
                        <button onClick={() => setFeedbackQuality('niv3')} className={`px-4 py-2 rounded-lg font-medium transition-all ${feedbackQuality === 'niv3' ? 'bg-red-600 text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>Niv3</button>
                      </div>
                    </div>
                  </div>
                </div>
                {feedbackStats && (
                  <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-semibold">Résultats filtrés ({feedbackStats.total} CD comptabilisés)</h4>
                      {feedbackStats.hidden > 0 && <span className="text-sm bg-slate-200 text-slate-700 px-3 py-1 rounded-full font-medium">{feedbackStats.hidden} Niv3 masqué{feedbackStats.hidden > 1 ? 's' : ''}</span>}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                      <div className="bg-blue-50 p-4 rounded-lg text-center"><p className="text-xs text-blue-600 font-medium mb-1">CD comptés</p><p className="text-2xl font-bold text-blue-900">{feedbackStats.total}</p></div>
                      <div className="bg-purple-50 p-4 rounded-lg text-center"><p className="text-xs text-purple-600 font-medium mb-1">Temps Moyen D1</p><p className="text-2xl font-bold text-purple-900">{feedbackStats.avgTime.toFixed(1)}h</p></div>
                      <div className="bg-indigo-50 p-4 rounded-lg text-center"><p className="text-xs text-indigo-600 font-medium mb-1">D1 NET Moyen</p><p className="text-2xl font-bold text-indigo-900">{feedbackStats.avgTimeNet.toFixed(1)}h</p></div>
                      <div className="bg-green-50 p-4 rounded-lg text-center"><p className="text-xs text-green-600 font-medium mb-1">Niv1</p><p className="text-2xl font-bold text-green-900">{feedbackStats.niv1}</p></div>
                      <div className="bg-orange-50 p-4 rounded-lg text-center"><p className="text-xs text-orange-600 font-medium mb-1">Niv2</p><p className="text-2xl font-bold text-orange-900">{feedbackStats.niv2}</p></div>
                      <div className="bg-red-50 p-4 rounded-lg text-center"><p className="text-xs text-red-600 font-medium mb-1">Niv3</p><p className="text-2xl font-bold text-red-900">{feedbackStats.niv3}</p></div>
                    </div>
                    {feedbackFilteredCDs.length > 1 && (
                      <div className="mt-6 pt-6 border-t">
                        <h5 className="text-sm font-semibold mb-3 text-slate-700">Évolution du temps (20 derniers CD)</h5>
                        <ResponsiveContainer width="100%" height={120}>
                          <LineChart data={feedbackFilteredCDs.slice(0, 20).reverse()}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" /><XAxis dataKey="date" hide /><YAxis domain={['auto', 'auto']} width={40} />
                            <Tooltip content={({ active, payload }) => { if (active && payload && payload.length) { return <div className="bg-white p-2 border rounded shadow-sm"><p className="text-xs">{payload[0].payload.date}</p><p className="text-sm font-bold">{payload[0].value}h</p></div>; } return null; }} />
                            <Line type="monotone" dataKey="tempsD1" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                )}
                {feedbackFilteredCDs.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm p-6">
                    <h4 className="text-lg font-semibold mb-4">Détail des CD</h4>
                    <div className="overflow-auto max-h-[500px]">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-slate-50 border-b-2">
                          <tr><th className="text-left py-3 px-3">Date</th><th className="text-center py-3 px-3">Rôle</th><th className="text-center py-3 px-3">D1</th><th className="text-center py-3 px-3">D1 NET</th><th className="text-center py-3 px-3">Qualité</th><th className="text-center py-3 px-3">CQ</th><th className="text-left py-3 px-3">Info Qualité</th></tr>
                        </thead>
                        <tbody>
                          {feedbackFilteredCDs.map((cd) => {
                            const isConf1 = cd.conf1 === feedbackOperator;
                            const isNiv3Hidden = hiddenNiv3Ids.has(cd.id);
                            const hasCQ = cd.cqCW || cd.cqCX || cd.cqCY;
                            return (
                              <tr 
                                key={cd.id} 
                                className={`border-b cursor-pointer ${isNiv3Hidden ? 'opacity-40 bg-slate-100' : 'hover:bg-blue-50'}`}
                                onClick={() => setSelectedCD(cd)}
                              >
                                <td className="py-3 px-3 font-medium">{new Date(cd.date).toLocaleDateString('fr-FR')}</td>
                                <td className="py-3 px-3 text-center"><span className={`px-2 py-1 rounded text-xs font-bold ${isConf1 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{isConf1 ? 'PNC' : 'PNS'}</span></td>
                                <td className="py-3 px-3 text-center"><span className="font-bold text-base" style={{ color: getTimeColor(cd.tempsD1) }}>{cd.tempsD1}h</span></td>
                                <td className="py-3 px-3 text-center"><span className="font-semibold text-sm text-blue-700">{cd.tempsD1Net}h</span></td>
                                <td className="py-3 px-3 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${cd.qualite === 'Niv1' ? 'bg-green-100 text-green-700' : cd.qualite === 'Niv2' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>{cd.qualite}</span>
                                    {cd.qualite === 'Niv3' && (
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); toggleHideNiv3(cd.id); }} 
                                        className={`p-1 rounded hover:bg-slate-200 ${isNiv3Hidden ? 'text-green-600' : 'text-red-600'}`} 
                                        title={isNiv3Hidden ? 'Réintégrer dans les stats' : 'Exclure des stats'}
                                      >
                                        {isNiv3Hidden ? '👁️' : '🚫'}
                                      </button>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-3 text-center">
                                  {hasCQ ? (
                                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded font-medium cursor-help" title={`${cd.cqCW ? 'NC: ' + cd.cqCW : ''}${cd.cqCX ? ' PNS: ' + cd.cqCX : ''}${cd.cqCY ? ' 82.1: ' + cd.cqCY : ''}`}>CQ</span>
                                  ) : (
                                    <span className="text-xs text-slate-400">-</span>
                                  )}
                                </td>
                                <td className="py-3 px-3 text-xs max-w-xs truncate">
                                  {cd.qualiteInfo ? (
                                    <span className={`${cd.qualite === 'Niv2' ? 'text-orange-700' : 'text-red-700'} font-medium`}>{cd.qualiteInfo}</span>
                                  ) : (
                                    <span className="text-green-600 font-medium">✓ Aucun défaut</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'manager' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl shadow-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Vue Manager - Tous les Opérateurs</h2>
                  <p className="opacity-90">Identification rapide des performances</p>
                </div>
                <button
                  onClick={exportOperatorsToExcel}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-indigo-600 rounded-lg font-semibold hover:bg-indigo-50 transition-colors"
                >
                  <Upload size={18} />
                  Exporter Excel
                </button>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="🔍 Rechercher un opérateur..."
                    value={searchOperator}
                    onChange={(e) => setSearchOperator(e.target.value)}
                    className="w-full px-4 py-2 pl-10 border-2 border-slate-300 rounded-lg focus:border-indigo-500 focus:outline-none"
                  />
                  {searchOperator && (
                    <button
                      onClick={() => setSearchOperator('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
              </div>
              {searchOperator && (
                <p className="text-sm text-slate-600 mt-2">
                  {operatorStats.filter(op => op.name.toLowerCase().includes(searchOperator.toLowerCase())).length} résultat(s) trouvé(s)
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl shadow-sm p-4 text-center"><p className="text-sm text-slate-600 mb-1">Opérateurs actifs</p><p className="text-3xl font-bold text-slate-900">{operators.length}</p></div>
              <div className="bg-green-50 rounded-xl shadow-sm p-4 text-center"><p className="text-sm text-green-600 mb-1">Excellent</p><p className="text-3xl font-bold text-green-700">{operatorStats.filter(op => evaluateOperatorPerformance(op).status === 'excellent').length}</p></div>
              <div className="bg-orange-50 rounded-xl shadow-sm p-4 text-center"><p className="text-sm text-orange-600 mb-1">À surveiller</p><p className="text-3xl font-bold text-orange-700">{operatorStats.filter(op => evaluateOperatorPerformance(op).status === 'warning').length}</p></div>
              <div className="bg-red-50 rounded-xl shadow-sm p-4 text-center"><p className="text-sm text-red-600 mb-1">Priorité</p><p className="text-3xl font-bold text-red-700">{operatorStats.filter(op => evaluateOperatorPerformance(op).status === 'critical').length}</p></div>
            </div>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 bg-slate-50 border-b flex items-center justify-between">
                <h3 className="text-lg font-semibold">Classement des Opérateurs</h3>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border">
                    <span className="text-sm font-medium text-slate-700">Trier par:</span>
                    <button
                      onClick={() => setSortByNet(false)}
                      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${!sortByNet ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      D1
                    </button>
                    <button
                      onClick={() => setSortByNet(true)}
                      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${sortByNet ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      D1 NET
                    </button>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={showDefectRate} onChange={(e) => setShowDefectRate(e.target.checked)} className="w-4 h-4" />
                    <span className="text-slate-700 font-medium">Afficher % Niv3</span>
                  </label>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-100 border-b-2">
                    <tr><th className="text-left py-3 px-4">Rang</th><th className="text-left py-3 px-4">Opérateur</th><th className="text-center py-3 px-4">Total CD</th><th className="text-center py-3 px-4">{sortByNet ? 'Temps Moyen NET' : 'Temps Moyen'}</th><th className="text-center py-3 px-4">Qualité</th><th className="text-center py-3 px-4">Action</th></tr>
                  </thead>
                  <tbody>
                    {[...operatorStats]
                      .filter(op => op.name.toLowerCase().includes(searchOperator.toLowerCase()))
                      .sort((a, b) => sortByNet ? a.avgTimeNet - b.avgTimeNet : a.avgTime - b.avgTime)
                      .map((op, idx) => {
                      const evaluation = evaluateOperatorPerformance(op);
                      const displayTime = sortByNet ? op.avgTimeNet : op.avgTime;
                      return (
                        <tr key={op.name} className={`border-b hover:bg-slate-50 transition-colors ${evaluation.status === 'critical' ? 'bg-red-50/50' : evaluation.status === 'warning' ? 'bg-orange-50/50' : ''}`}>
                          <td className="py-3 px-4"><span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${idx === 0 ? 'bg-yellow-400 text-white' : idx === 1 ? 'bg-slate-400 text-white' : idx === 2 ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-700'}`}>{idx + 1}</span></td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-base">{op.name}</span>
                          </td>
                          <td className="py-3 px-4 text-center"><span className="text-lg font-semibold text-blue-600">{op.totalCD}</span></td>
                          <td className="py-3 px-4 text-center"><span className="text-2xl font-bold" style={{ color: getTimeColor(displayTime) }}>{displayTime.toFixed(1)}h</span></td>
                          <td className="py-3 px-4">
                            <div className="flex flex-col items-center gap-1">
                              <div className="flex gap-1">
                                <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">{op.niv1}</span>
                                <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-bold">{op.niv2}</span>
                                <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">{op.niv3}</span>
                              </div>
                              {showDefectRate && (
                                <div className="flex flex-col items-center gap-1 mt-1">
                                  <span className={`text-xs font-medium ${evaluation.niv3Percent <= thresholds.maxNiv3Percent ? 'text-green-600' : 'text-red-600'}`}>
                                    Niv3: {evaluation.niv3Percent}% {evaluation.niv3Percent > thresholds.maxNiv3Percent ? '⚠️' : '✓'}
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button onClick={() => { setFeedbackOperator(op.name); setActiveTab('feedback'); }} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-medium">Voir détail</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'machines' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl shadow-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Analyse par Machine</h2>
                  <p className="opacity-90">Identification des récurrences de problèmes par machine</p>
                </div>
                <button
                  onClick={exportMachinesToExcel}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-purple-600 rounded-lg font-semibold hover:bg-purple-50 transition-colors"
                >
                  <Upload size={18} />
                  Exporter Excel
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="🔍 Rechercher une machine (ex: 305, 521)..."
                    value={searchMachine}
                    onChange={(e) => setSearchMachine(e.target.value)}
                    className="w-full px-4 py-2 pl-10 border-2 border-slate-300 rounded-lg focus:border-purple-500 focus:outline-none"
                  />
                  {searchMachine && (
                    <button
                      onClick={() => setSearchMachine('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
              </div>
              {searchMachine && (
                <p className="text-sm text-slate-600 mt-2">
                  {machineStats.filter(m => m.machine.toLowerCase().includes(searchMachine.toLowerCase())).length} résultat(s) trouvé(s)
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl shadow-sm p-4 text-center">
                <p className="text-sm text-slate-600 mb-1">Machines actives</p>
                <p className="text-3xl font-bold text-slate-900">{uniqueMachines.length}</p>
              </div>
              <div className="bg-green-50 rounded-xl shadow-sm p-4 text-center">
                <p className="text-sm text-green-600 mb-1">Performantes</p>
                <p className="text-3xl font-bold text-green-700">{machineStats.filter(m => m.avgTime <= thresholds.good).length}</p>
              </div>
              <div className="bg-orange-50 rounded-xl shadow-sm p-4 text-center">
                <p className="text-sm text-orange-600 mb-1">À surveiller</p>
                <p className="text-3xl font-bold text-orange-700">{machineStats.filter(m => m.avgTime > thresholds.good && m.avgTime <= thresholds.poor).length}</p>
              </div>
              <div className="bg-red-50 rounded-xl shadow-sm p-4 text-center">
                <p className="text-sm text-red-600 mb-1">Problématiques</p>
                <p className="text-3xl font-bold text-red-700">{machineStats.filter(m => m.avgTime > thresholds.poor || (m.niv3 / m.totalCD * 100) > thresholds.maxNiv3Percent).length}</p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 bg-slate-50 border-b">
                <h3 className="text-lg font-semibold">Classement des Machines</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-100 border-b-2">
                    <tr>
                      <th className="text-left py-3 px-4">Rang</th>
                      <th className="text-left py-3 px-4">N° Machine</th>
                      <th className="text-center py-3 px-4">Total CD</th>
                      <th className="text-center py-3 px-4">Temps Moyen</th>
                      <th className="text-center py-3 px-4">Qualité</th>
                      <th className="text-center py-3 px-4">Incidents</th>
                      <th className="text-center py-3 px-4">% Niv3</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...machineStats]
                      .filter(machine => machine.machine.toLowerCase().includes(searchMachine.toLowerCase()))
                      .sort((a, b) => a.avgTime - b.avgTime)
                      .map((machine, idx) => {
                      const niv3Percent = (machine.niv3 / machine.totalCD * 100).toFixed(0);
                      const hasQualityIssue = niv3Percent > thresholds.maxNiv3Percent;
                      return (
                        <tr key={machine.machine} className={`border-b hover:bg-slate-50 transition-colors ${hasQualityIssue ? 'bg-red-50/30' : ''}`}>
                          <td className="py-3 px-4">
                            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                              idx === 0 ? 'bg-yellow-400 text-white' :
                              idx === 1 ? 'bg-slate-400 text-white' :
                              idx === 2 ? 'bg-orange-500 text-white' :
                              'bg-slate-200 text-slate-700'
                            }`}>
                              {idx + 1}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-lg text-blue-600">{machine.machine}</td>
                          <td className="py-3 px-4 text-center text-lg font-semibold">{machine.totalCD}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="text-2xl font-bold" style={{ color: getTimeColor(machine.avgTime) }}>
                              {machine.avgTime.toFixed(1)}h
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex justify-center gap-1">
                              <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">{machine.niv1}</span>
                              <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-bold">{machine.niv2}</span>
                              <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">{machine.niv3}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                              machine.incidents > 5 ? 'bg-red-100 text-red-700' : 
                              machine.incidents > 2 ? 'bg-orange-100 text-orange-700' : 
                              'bg-green-100 text-green-700'
                            }`}>
                              {machine.incidents}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`text-xl font-bold ${hasQualityIssue ? 'text-red-600' : 'text-green-600'}`}>
                              {niv3Percent}%
                              {hasQualityIssue && ' ⚠️'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">💡 Comment interpréter ces données</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• <strong>Temps moyen élevé</strong> : La machine peut nécessiter une maintenance ou formation spécifique</li>
                <li>• <strong>% Niv3 élevé</strong> : Récurrence de défauts qualité sur cette machine - à investiguer</li>
                <li>• <strong>Incidents fréquents</strong> : Problèmes techniques récurrents sur la machine</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-2xl font-bold mb-2 flex items-center gap-2"><span>🔗</span> Fusion de Noms</h2>
              <p className="text-sm text-slate-600 mb-4">Regroupez plusieurs variantes d'un même nom en un seul nom normalisé.</p>
              <NameFusionManager allNames={allUniqueNames} nameFusions={nameFusions} setNameFusions={setNameFusions} />
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-2xl font-bold mb-2 flex items-center gap-2"><span>⚙️</span> Seuils de Performance</h2>
              <p className="text-sm text-slate-600 mb-6">Définissez les critères pour évaluer les performances (temps + qualité)</p>
              <div className="space-y-6">
                <div className="border-b pb-6">
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2"><Clock size={18} className="text-blue-600" /> Seuils Temps D1</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-green-700">Excellent (h)</label>
                      <input type="number" value={thresholds.excellent} onChange={(e) => setThresholds({ ...thresholds, excellent: parseFloat(e.target.value) })} className="w-full px-4 py-3 border-2 border-green-300 rounded-lg focus:border-green-500 focus:outline-none" step="0.5" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-blue-700">Bon (h)</label>
                      <input type="number" value={thresholds.good} onChange={(e) => setThresholds({ ...thresholds, good: parseFloat(e.target.value) })} className="w-full px-4 py-3 border-2 border-blue-300 rounded-lg focus:border-blue-500 focus:outline-none" step="0.5" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-orange-700">Limite acceptable (h)</label>
                      <input type="number" value={thresholds.poor} onChange={(e) => setThresholds({ ...thresholds, poor: parseFloat(e.target.value) })} className="w-full px-4 py-3 border-2 border-orange-300 rounded-lg focus:border-orange-500 focus:outline-none" step="0.5" />
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2"><Shield size={18} className="text-purple-600" /> Seuils Qualité</h3>
                  <div className="max-w-md">
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-red-700">% Niv3 maximum toléré</label>
                      <div className="flex items-center gap-3">
                        <input type="number" value={thresholds.maxNiv3Percent} onChange={(e) => setThresholds({ ...thresholds, maxNiv3Percent: parseFloat(e.target.value) })} className="flex-1 px-4 py-3 border-2 border-red-300 rounded-lg" min="0" max="100" step="5" />
                        <span className="text-2xl font-bold text-red-700">{thresholds.maxNiv3Percent}%</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">Alerte si % Niv3 &gt; ce seuil (calculé sur total CD réalisés)</p>
                    </div>
                  </div>
                  <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-900"><span className="font-semibold">💡 Info:</span> Un opérateur passera en statut "À surveiller" ou "Priorité" s'il dépasse les seuils de temps <strong>OU</strong> s'il a trop de CD Niv3 par rapport à son nombre total de CD réalisés.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {selectedCD && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedCD(null)}>
          <div className="bg-white rounded-xl max-w-2xl w-full" style={{ height: '80vh', maxHeight: '600px' }} onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-blue-900 to-blue-800 text-white px-4 py-3 rounded-t-xl flex justify-between items-center">
              <h2 className="text-base font-bold">CD #{selectedCD.id} - Détails complets</h2>
              <button onClick={() => setSelectedCD(null)} className="hover:bg-blue-700 rounded p-1 transition-colors"><X size={18} /></button>
            </div>
            <div className="p-4" style={{ height: 'calc(100% - 52px)', overflowY: 'scroll' }}>
              <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 p-2 rounded-lg"><p className="text-xs text-blue-600 font-medium mb-1">Date</p><p className="text-base font-bold">{new Date(selectedCD.date).toLocaleDateString('fr-FR')}</p></div>
                <div className="bg-purple-50 p-2 rounded-lg"><p className="text-xs text-purple-600 font-medium mb-1">Semaine</p><p className="text-base font-bold">S{selectedCD.week || 'N/A'}</p></div>
              </div>
              <div className="border-t pt-3">
                <h3 className="font-bold text-sm mb-2">Binôme</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-50 p-2 rounded-lg"><p className="text-xs text-green-600 font-medium mb-1">Conf1 (PNC)</p><p className="text-base font-bold">{selectedCD.conf1 || '-'}</p></div>
                  <div className="bg-orange-50 p-2 rounded-lg"><p className="text-xs text-orange-600 font-medium mb-1">Conf2 (PNS)</p><p className="text-base font-bold">{selectedCD.conf2 || '-'}</p></div>
                </div>
              </div>
              <div className="border-t pt-3">
                <h3 className="font-bold text-sm mb-2">Performance</h3>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-slate-50 p-2 rounded-lg text-center"><p className="text-xs font-medium mb-1">Temps D1</p><p className="text-xl font-bold" style={{ color: getTimeColor(selectedCD.tempsD1) }}>{selectedCD.tempsD1}h</p></div>
                  <div className="bg-blue-50 p-2 rounded-lg text-center"><p className="text-xs font-medium mb-1">D1 NET</p><p className="text-xl font-bold text-blue-700">{selectedCD.tempsD1Net}h</p></div>
                  <div className="bg-slate-50 p-2 rounded-lg text-center"><p className="text-xs font-medium mb-1">Qualité</p><span className={`px-2 py-1 rounded text-sm font-bold inline-block ${selectedCD.qualite === 'Niv1' ? 'bg-green-100 text-green-700' : selectedCD.qualite === 'Niv2' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>{selectedCD.qualite}</span></div>
                </div>
              </div>
              <div className="border-t pt-3">
                <h3 className="font-bold text-sm mb-2">Info Qualité</h3>
                <div className={`p-2 rounded-lg ${selectedCD.qualite === 'Niv1' ? 'bg-green-50' : selectedCD.qualite === 'Niv2' ? 'bg-orange-50' : 'bg-red-50'}`}>
                  {selectedCD.qualiteInfo ? <p className={`text-xs font-medium ${selectedCD.qualite === 'Niv1' ? 'text-green-800' : selectedCD.qualite === 'Niv2' ? 'text-orange-800' : 'text-red-800'}`}>{selectedCD.qualiteInfo}</p> : <p className="text-xs text-green-700 font-medium">✓ Aucun défaut</p>}
                </div>
              </div>
              <div className="border-t pt-3">
                <h3 className="font-bold text-sm mb-2">Détails Techniques</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-50 p-2 rounded">
                    <p className="text-xs text-slate-600 mb-0.5">Machine</p>
                    <p className="text-sm font-bold text-blue-600">{selectedCD.machine}</p>
                  </div>
                  <div className="bg-slate-50 p-2 rounded">
                    <p className="text-xs text-slate-600 mb-0.5">Type Machine</p>
                    <p className="text-sm font-bold">{selectedCD.typeMachine}</p>
                  </div>
                  <div className="bg-slate-50 p-2 rounded">
                    <p className="text-xs text-slate-600 mb-0.5">Type Production</p>
                    <p className="text-sm font-bold">{selectedCD.typeProd}</p>
                  </div>
                  <div className="bg-slate-50 p-2 rounded">
                    <p className="text-xs text-slate-600 mb-0.5">Type CD</p>
                    <p className="text-sm font-bold">{selectedCD.typeCD}</p>
                  </div>
                  <div className="bg-slate-50 p-2 rounded">
                    <p className="text-xs text-slate-600 mb-0.5">Dimension</p>
                    <p className="text-sm font-bold">{selectedCD.dimension}</p>
                  </div>
                  <div className={`p-2 rounded ${selectedCD.isPanne ? 'bg-red-100' : 'bg-green-100'}`}>
                    <p className="text-xs font-medium mb-0.5">Incident</p>
                    <p className="text-sm font-bold">{selectedCD.isPanne ? '⚠️ Oui' : '✓ Non'}</p>
                  </div>
                </div>
              </div>
              {(selectedCD.cqCW || selectedCD.cqCX || selectedCD.cqCY) && (
                <div className="border-t pt-3">
                  <h3 className="font-bold text-sm mb-2">Contrôle Qualité (CQ)</h3>
                  <div className="space-y-2">
                    {selectedCD.cqCW && (
                      <div className="bg-yellow-50 border border-yellow-200 p-2 rounded">
                        <p className="text-xs text-yellow-700 font-semibold mb-0.5">CQ NC</p>
                        <p className="text-xs text-yellow-900">{selectedCD.cqCW}</p>
                      </div>
                    )}
                    {selectedCD.cqCX && (
                      <div className="bg-yellow-50 border border-yellow-200 p-2 rounded">
                        <p className="text-xs text-yellow-700 font-semibold mb-0.5">CQ PNS</p>
                        <p className="text-xs text-yellow-900">{selectedCD.cqCX}</p>
                      </div>
                    )}
                    {selectedCD.cqCY && (
                      <div className="bg-yellow-50 border border-yellow-200 p-2 rounded">
                        <p className="text-xs text-yellow-700 font-semibold mb-0.5">CQ 82.1</p>
                        <p className="text-xs text-yellow-900">{selectedCD.cqCY}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {(selectedCD.commentaire || selectedCD.notesGarant) && (
                <div className="border-t pt-3">
                  <h3 className="font-bold text-sm mb-2">Commentaires & Notes</h3>
                  <div className="space-y-2">
                    {selectedCD.commentaire && (
                      <div className="bg-blue-50 border border-blue-200 p-2 rounded">
                        <p className="text-xs text-blue-700 font-semibold mb-0.5">Commentaire</p>
                        <p className="text-xs text-blue-900 whitespace-pre-wrap">{selectedCD.commentaire}</p>
                      </div>
                    )}
                    {selectedCD.notesGarant && (
                      <div className="bg-purple-50 border border-purple-200 p-2 rounded">
                        <p className="text-xs text-purple-700 font-semibold mb-0.5">Notes Garant</p>
                        <p className="text-xs text-purple-900 whitespace-pre-wrap">{selectedCD.notesGarant}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
