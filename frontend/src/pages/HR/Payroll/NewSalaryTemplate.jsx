import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Info,
    Save,
    Loader2,
    Plus,
    Trash2,
    Calculator,
    ChevronRight,
    Check,
    Wand2,
    Search,
    IndianRupee,
    AlertCircle
} from 'lucide-react';
import api from '../../../utils/api';

export default function NewSalaryTemplate() {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Master Data
    const [masterEarnings, setMasterEarnings] = useState([]);
    const [masterDeductions, setMasterDeductions] = useState([]);
    const [masterBenefits, setMasterBenefits] = useState([]);

    // Step 1: Basic Details
    const [basicInfo, setBasicInfo] = useState({
        name: '',
        description: '',
        annualCTC: ''
    });

    // Step 2: Component Configuration
    const [selectedEarnings, setSelectedEarnings] = useState([]);
    const [selectedDeductions, setSelectedDeductions] = useState([]);
    const [selectedBenefits, setSelectedBenefits] = useState([]);

    // Search
    const [searchQuery, setSearchQuery] = useState('');
    const [showComponentPicker, setShowComponentPicker] = useState(false);
    const [pickerCategory, setPickerCategory] = useState('earnings');

    useEffect(() => {
        fetchMasterData();
    }, []);

    const fetchMasterData = async () => {
        try {
            const [eRes, dRes, bRes] = await Promise.all([
                api.get('/payroll/earnings'),
                api.get('/deductions'),
                api.get('/payroll/benefits')
            ]);
            setMasterEarnings(eRes.data.data || []);
            setMasterDeductions(dRes.data.data || []);
            setMasterBenefits(bRes.data.data || []);
        } catch (err) {
            console.error('Failed to fetch components', err);
        }
    };

    const handleBasicChange = (e) => {
        const { name, value } = e.target;
        setBasicInfo(prev => ({ ...prev, [name]: value }));
        setError(null);
    };

    const nextStep = () => {
        if (!basicInfo.name.trim()) return setError('Template name is required');
        if (!basicInfo.annualCTC || Number(basicInfo.annualCTC) <= 0) return setError('Valid Annual CTC is required');

        // Auto-add "Basic" if not already there
        if (selectedEarnings.length === 0) {
            const basicMaster = masterEarnings.find(e => e.name.toLowerCase().includes('basic'));
            if (basicMaster) {
                addEarning(basicMaster);
            }
        }

        setStep(2);
        window.scrollTo(0, 0);
    };

    const addEarning = (master) => {
        if (selectedEarnings.find(e => e.id === master._id)) return;
        const newEarning = {
            id: master._id,
            name: master.name,
            code: master.code || master.name.toUpperCase().replace(/\s+/g, '_'),
            calculationType: 'PERCENT_CTC',
            percentage: master.name.toLowerCase().includes('basic') ? 50 : 0,
            formula: master.name.toLowerCase().includes('basic') ? 'CTC * 0.5' : '',
            monthlyAmount: 0,
            annualAmount: 0,
            isRemovable: !master.name.toLowerCase().includes('basic')
        };
        setSelectedEarnings([...selectedEarnings, newEarning]);
        setShowComponentPicker(false);
    };

    const addDeduction = (master) => {
        if (selectedDeductions.find(d => d.id === master._id)) return;
        const newDeduction = {
            id: master._id,
            name: master.name,
            code: master.code || master.name.toUpperCase().replace(/\s+/g, '_'),
            category: master.category || 'POST_TAX',
            amountType: 'FIXED',
            formula: '',
            amountValue: 0,
            monthlyAmount: 0
        };
        setSelectedDeductions([...selectedDeductions, newDeduction]);
        setShowComponentPicker(false);
    };

    const addBenefit = (master) => {
        if (selectedBenefits.find(b => b.id === master._id)) return;
        const newBenefit = {
            id: master._id,
            name: master.name,
            code: master.code || master.name.toUpperCase().replace(/\s+/g, '_'),
            calculationType: 'FIXED',
            formula: '',
            monthlyAmount: 0,
            annualAmount: 0
        };
        setSelectedBenefits([...selectedBenefits, newBenefit]);
        setShowComponentPicker(false);
    };

    const removeEarning = (id) => setSelectedEarnings(selectedEarnings.filter(e => e.id !== id));
    const removeDeduction = (id) => setSelectedDeductions(selectedDeductions.filter(d => d.id !== id));
    const removeBenefit = (id) => setSelectedBenefits(selectedBenefits.filter(b => b.id !== id));

    const updateEarning = (id, field, value) => {
        setSelectedEarnings(selectedEarnings.map(e => e.id === id ? { ...e, [field]: value } : e));
    };

    const updateDeduction = (id, field, value) => {
        setSelectedDeductions(selectedDeductions.map(d => d.id === id ? { ...d, [field]: value } : d));
    };

    const updateBenefit = (id, field, value) => {
        setSelectedBenefits(selectedBenefits.map(b => b.id === id ? { ...b, [field]: value } : b));
    };

    // Auto-calculate suggested breakdown
    const handleMagicSuggest = () => {
        const matches = [];
        const annualCTC = Number(basicInfo.annualCTC);
        const monthlyCTC = annualCTC / 12;

        // Reset
        let newEarnings = [];
        let newDeductions = [];
        let newBenefits = [];

        // 1. Basic (50%)
        const basic = masterEarnings.find(e => e.name.toLowerCase().includes('basic'));
        if (basic) {
            newEarnings.push({
                id: basic._id,
                name: basic.name,
                code: 'BASIC',
                calculationType: 'PERCENT_CTC',
                percentage: 50,
                formula: 'CTC * 0.5',
                monthlyAmount: Math.round(monthlyCTC * 0.5),
                annualAmount: Math.round(annualCTC * 0.5),
                isRemovable: false
            });
        }

        // 2. HRA (40% of Basic)
        const hra = masterEarnings.find(e => e.name.toLowerCase().includes('hra'));
        if (hra) {
            newEarnings.push({
                id: hra._id,
                name: hra.name,
                code: 'HRA',
                calculationType: 'PERCENT_BASIC',
                percentage: 40,
                formula: 'BASIC * 0.4',
                monthlyAmount: Math.round(monthlyCTC * 0.5 * 0.4),
                annualAmount: Math.round(annualCTC * 0.5 * 0.4),
                isRemovable: true
            });
        }

        // 3. PF (Employer)
        const epf = masterBenefits.find(b => b.name.toLowerCase().includes('pf') || b.name.toLowerCase().includes('provident'));
        if (epf) {
            const basicMonthly = monthlyCTC * 0.5;
            const pfWage = Math.min(basicMonthly, 15000);
            const pfAmount = Math.round(pfWage * 0.12);
            newBenefits.push({
                id: epf._id,
                name: epf.name,
                code: 'EPF_EMPLOYER',
                calculationType: 'FORMULA',
                formula: 'Math.min(BASIC, 15000) * 0.12',
                monthlyAmount: pfAmount,
                annualAmount: pfAmount * 12
            });
        }

        // 4. PF (Employee)
        const pfEmp = masterDeductions.find(d => d.name.toLowerCase().includes('pf') || d.name.toLowerCase().includes('provident'));
        if (pfEmp) {
            newDeductions.push({
                id: pfEmp._id,
                name: pfEmp.name,
                code: 'EPF_EMPLOYEE',
                category: 'PRE_TAX',
                amountType: 'FORMULA',
                formula: 'Math.min(BASIC, 15000) * 0.12',
                amountValue: 0,
                monthlyAmount: Math.min(monthlyCTC * 0.5, 15000) * 0.12
            });
        }

        // 5. Special Allowance (Remnant)
        // Calculate consumed
        const earningsTotal = newEarnings.reduce((s, e) => s + e.monthlyAmount, 0);
        const benefitsTotal = newBenefits.reduce((s, b) => s + b.monthlyAmount, 0);
        const specialAmt = Math.max(0, Math.round(monthlyCTC - (earningsTotal + benefitsTotal)));

        const special = masterEarnings.find(e => e.name.toLowerCase().includes('special'));
        if (special) {
            newEarnings.push({
                id: special._id,
                name: special.name,
                code: 'SPECIAL_ALLOWANCE',
                calculationType: 'FIXED',
                percentage: 0,
                formula: '',
                monthlyAmount: specialAmt,
                annualAmount: specialAmt * 12,
                isRemovable: true
            });
        }

        setSelectedEarnings(newEarnings);
        setSelectedDeductions(newDeductions);
        setSelectedBenefits(newBenefits);
    };

    const handleSave = async () => {
        try {
            setLoading(true);
            setError(null);

            const payload = {
                templateName: basicInfo.name,
                description: basicInfo.description,
                annualCTC: Number(basicInfo.annualCTC),
                earnings: selectedEarnings.map(e => ({
                    name: e.name,
                    componentCode: e.code,
                    calculationType: e.calculationType,
                    formula: e.formula,
                    percentage: e.percentage,
                    monthlyAmount: e.monthlyAmount || 0,
                    annualAmount: e.annualAmount || 0
                })),
                employerDeductions: selectedBenefits.map(b => ({
                    name: b.name,
                    componentCode: b.code,
                    formula: b.formula,
                    monthlyAmount: b.monthlyAmount || 0,
                    annualAmount: b.annualAmount || 0
                })),
                employeeDeductions: selectedDeductions.map(d => ({
                    name: d.name,
                    componentCode: d.code,
                    category: d.category,
                    amountType: d.amountType === 'FORMULA' ? 'FORMULA' : (d.amountType === 'PERCENTAGE' ? 'PERCENTAGE' : 'FIXED'),
                    formula: d.formula,
                    amountValue: d.amountValue,
                    monthlyAmount: d.monthlyAmount || 0
                })),
                settings: {
                    pfWageRestriction: true,
                    pfWageLimit: 15000,
                    includeESI: true
                }
            };

            const res = await api.post('/payroll/salary-templates', payload);
            if (res.data.success) {
                navigate('/hr/payroll/salary-components'); // Use redirection to list or dashboard
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to save template');
        } finally {
            setLoading(false);
        }
    };

    // Calculate totals for sidebar preview
    const totals = useMemo(() => {
        const annualCTC = Number(basicInfo.annualCTC) || 0;
        const monthlyCTC = annualCTC / 12;

        const earningsTotal = selectedEarnings.reduce((s, e) => s + (Number(e.monthlyAmount) || 0), 0);
        const benefitsTotal = selectedBenefits.reduce((s, b) => s + (Number(b.monthlyAmount) || 0), 0);
        const deductionsTotal = selectedDeductions.reduce((s, d) => s + (Number(d.monthlyAmount) || 0), 0);

        const currentCTC = (earningsTotal + benefitsTotal) * 12;
        const diff = Math.abs(currentCTC - annualCTC);
        const isBalanced = diff < 12; // allow 1 rupee rounding drift

        return {
            gross: earningsTotal,
            net: earningsTotal - deductionsTotal,
            benefits: benefitsTotal,
            deductions: deductionsTotal,
            currentAnnualCTC: currentCTC,
            isBalanced,
            diff
        };
    }, [selectedEarnings, selectedDeductions, selectedBenefits, basicInfo.annualCTC]);

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* HEADER */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-20">
                <div className="max-w-7xl mx-auto px-4 md:px-8">
                    <div className="flex justify-between items-center h-20">
                        <div className="flex items-center gap-6">
                            <button
                                onClick={() => step === 1 ? navigate(-1) : setStep(1)}
                                className="p-2.5 hover:bg-slate-100 rounded-xl transition text-slate-500"
                            >
                                <ArrowLeft size={22} />
                            </button>
                            <div>
                                <h1 className="text-xl font-bold text-slate-900 leading-tight">
                                    {basicInfo.name || "New Salary Template"}
                                </h1>
                                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                                    Step {step} of 2 • {step === 1 ? 'Basic Details' : 'Component Configuration'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            {step === 1 ? (
                                <button
                                    onClick={nextStep}
                                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-200 transition-all active:scale-95"
                                >
                                    Next: Build Structure <ChevronRight size={18} />
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={handleMagicSuggest}
                                        className="hidden md:flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 hover:border-blue-500 hover:text-blue-600 rounded-xl font-bold text-sm transition-all shadow-sm"
                                    >
                                        <Wand2 size={16} /> Auto-Suggest
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={loading || !totals.isBalanced}
                                        className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                                        Create Template
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
                {error && (
                    <div className="mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="bg-rose-50 border border-rose-100 text-rose-600 px-4 py-3 rounded-xl flex items-center gap-3 text-sm font-medium">
                            <AlertCircle size={18} /> {error}
                        </div>
                    </div>
                )}

                {step === 1 ? (
                    /* STEP 1: BASIC INFO */
                    <div className="max-w-2xl mx-auto">
                        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 space-y-8">
                            <div className="space-y-2">
                                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Template Identity</h2>
                                <p className="text-slate-500 text-sm">Define the core attributes for this salary structure.</p>
                            </div>

                            <div className="grid grid-cols-1 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Template Name *</label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={basicInfo.name}
                                        onChange={handleBasicChange}
                                        placeholder="e.g. Standard Product Team (Grade 3)"
                                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-semibold"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Description</label>
                                    <textarea
                                        name="description"
                                        value={basicInfo.description}
                                        onChange={handleBasicChange}
                                        placeholder="Briefly explain who this template is for..."
                                        rows={3}
                                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-medium"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                                            <IndianRupee size={10} /> Target Annual CTC *
                                        </label>
                                        <div className="relative">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</div>
                                            <input
                                                type="number"
                                                name="annualCTC"
                                                value={basicInfo.annualCTC}
                                                onChange={handleBasicChange}
                                                placeholder="0.00"
                                                className="w-full pl-8 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all text-lg font-black"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2 opacity-50 select-none">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1 text-blue-500">
                                            Monthly CTC (Equivalent)
                                        </label>
                                        <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl font-black text-blue-700 text-lg">
                                            ₹{basicInfo.annualCTC ? (Number(basicInfo.annualCTC) / 12).toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '0'}
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-blue-50/30 p-5 rounded-2xl border border-blue-50 flex items-start gap-4">
                                    <div className="p-2 bg-blue-100 rounded-full text-blue-600 flex-shrink-0">
                                        <Info size={16} />
                                    </div>
                                    <p className="text-xs text-blue-700 leading-relaxed font-medium">
                                        Entering the CTC helps us suggest a balanced structure in the next step.
                                        Don't worry, you can always adjust individual components exactly how you want.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* STEP 2: STRUCTURE DESIGN */
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* LEFT: COMPONENT EDITOR */}
                        <div className="lg:col-span-2 space-y-8">

                            {/* EARNINGS */}
                            <section className="space-y-4">
                                <div className="flex justify-between items-center px-2">
                                    <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight">
                                        <IndianRupee size={20} className="text-emerald-500" /> 1. Monthly Earnings
                                    </h3>
                                    <button
                                        onClick={() => { setPickerCategory('earnings'); setShowComponentPicker(true); }}
                                        className="text-blue-600 hover:text-blue-700 font-bold text-xs flex items-center gap-1 uppercase tracking-widest p-1 hover:bg-blue-50 rounded"
                                    >
                                        <Plus size={14} /> Add Component
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {selectedEarnings.map(comp => (
                                        <div key={comp.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:border-blue-200 transition-all group">
                                            <div className="flex flex-col md:flex-row md:items-center gap-6">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-slate-900">{comp.name}</span>
                                                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter">{comp.code}</span>
                                                    </div>
                                                    <div className="mt-4 flex flex-wrap gap-4 items-end">
                                                        <div className="space-y-1.5 min-w-[140px]">
                                                            <label className="text-[9px] uppercase font-black text-slate-400 tracking-widest block ml-0.5">Calculation</label>
                                                            <select
                                                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none"
                                                                value={comp.calculationType}
                                                                onChange={(e) => updateEarning(comp.id, 'calculationType', e.target.value)}
                                                            >
                                                                <option value="PERCENT_CTC">% of CTC</option>
                                                                <option value="PERCENT_BASIC">% of Basic</option>
                                                                <option value="FIXED">Flat (Monthly)</option>
                                                                <option value="FORMULA">Custom Formula</option>
                                                            </select>
                                                        </div>

                                                        {comp.calculationType === 'FORMULA' ? (
                                                            <div className="space-y-1.5 flex-1 min-w-[200px]">
                                                                <label className="text-[9px] uppercase font-black text-slate-400 tracking-widest block ml-0.5">Formula (e.g. CTC * 0.4)</label>
                                                                <input
                                                                    type="text"
                                                                    className="w-full p-2 bg-amber-50/50 border border-amber-200 rounded-lg text-xs font-mono font-bold text-amber-900 outline-none"
                                                                    value={comp.formula}
                                                                    onChange={(e) => updateEarning(comp.id, 'formula', e.target.value)}
                                                                />
                                                            </div>
                                                        ) : comp.calculationType === 'FIXED' ? null : (
                                                            <div className="space-y-1.5 w-16">
                                                                <label className="text-[9px] uppercase font-black text-slate-400 tracking-widest block ml-0.5">Value</label>
                                                                <div className="relative">
                                                                    <input
                                                                        type="number"
                                                                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none pr-4 text-right"
                                                                        value={comp.percentage}
                                                                        onChange={(e) => updateEarning(comp.id, 'percentage', e.target.value)}
                                                                    />
                                                                    <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400">%</span>
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div className="space-y-1.5 w-32 ml-auto">
                                                            <label className="text-[9px] uppercase font-black text-slate-400 tracking-widest block text-right mr-1">Amount (Monthly)</label>
                                                            <input
                                                                type="number"
                                                                className="w-full p-2 bg-blue-50/50 border border-blue-200 rounded-lg text-xs font-black text-blue-700 outline-none text-right"
                                                                value={comp.monthlyAmount}
                                                                onChange={(e) => updateEarning(comp.id, 'monthlyAmount', e.target.value)}
                                                            />
                                                        </div>

                                                        {comp.isRemovable && (
                                                            <button
                                                                onClick={() => removeEarning(comp.id)}
                                                                className="p-2 text-slate-300 hover:text-rose-500 rounded-lg transition-colors group-hover:opacity-100 opacity-0"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* BENEFITS */}
                            <section className="space-y-4">
                                <div className="flex justify-between items-center px-2">
                                    <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight">
                                        <Calculator size={20} className="text-blue-500" /> 2. Employer Contributions (Retirals)
                                    </h3>
                                    <button
                                        onClick={() => { setPickerCategory('benefits'); setShowComponentPicker(true); }}
                                        className="text-blue-600 hover:text-blue-700 font-bold text-xs flex items-center gap-1 uppercase tracking-widest p-1 hover:bg-blue-50 rounded"
                                    >
                                        <Plus size={14} /> Add Component
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {selectedBenefits.length === 0 && (
                                        <div className="bg-slate-100/50 border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                                            No employer benefits selected
                                        </div>
                                    )}
                                    {selectedBenefits.map(comp => (
                                        <div key={comp.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:border-blue-200 transition-all group">
                                            <div className="flex flex-col md:flex-row md:items-center gap-6">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-slate-900">{comp.name}</span>
                                                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter">{comp.code}</span>
                                                    </div>
                                                    <div className="mt-4 flex flex-wrap gap-4 items-end">
                                                        <div className="space-y-1.5 min-w-[240px] flex-1">
                                                            <label className="text-[9px] uppercase font-black text-slate-400 tracking-widest block ml-0.5 font-mono">Formula (e.g. BASIC * 0.12)</label>
                                                            <input
                                                                type="text"
                                                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none font-mono"
                                                                value={comp.formula}
                                                                onChange={(e) => updateBenefit(comp.id, 'formula', e.target.value)}
                                                                placeholder="Calculation rule..."
                                                            />
                                                        </div>

                                                        <div className="space-y-1.5 w-32 ml-auto text-right">
                                                            <label className="text-[9px] uppercase font-black text-slate-400 tracking-widest block mr-1 text-right">Monthly Cost</label>
                                                            <input
                                                                type="number"
                                                                className="w-full p-2 bg-indigo-50/50 border border-indigo-200 rounded-lg text-xs font-black text-indigo-700 outline-none text-right"
                                                                value={comp.monthlyAmount}
                                                                onChange={(e) => updateBenefit(comp.id, 'monthlyAmount', e.target.value)}
                                                            />
                                                        </div>

                                                        <button
                                                            onClick={() => removeBenefit(comp.id)}
                                                            className="p-2 text-slate-300 hover:text-rose-500 rounded-lg transition-colors group-hover:opacity-100 opacity-0"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* DEDUCTIONS */}
                            <section className="space-y-4">
                                <div className="flex justify-between items-center px-2">
                                    <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight">
                                        <Trash2 size={20} className="text-rose-500" /> 3. Employee Deductions (Statutory)
                                    </h3>
                                    <button
                                        onClick={() => { setPickerCategory('deductions'); setShowComponentPicker(true); }}
                                        className="text-blue-600 hover:text-blue-700 font-bold text-xs flex items-center gap-1 uppercase tracking-widest p-1 hover:bg-blue-50 rounded"
                                    >
                                        <Plus size={14} /> Add Component
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {selectedDeductions.length === 0 && (
                                        <div className="bg-slate-100/50 border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                                            No employee deductions added
                                        </div>
                                    )}
                                    {selectedDeductions.map(comp => (
                                        <div key={comp.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:border-blue-200 transition-all group">
                                            <div className="flex flex-col md:flex-row md:items-center gap-6">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-slate-900">{comp.name}</span>
                                                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter ${comp.category === 'PRE_TAX' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                                                            {comp.category}
                                                        </span>
                                                    </div>
                                                    <div className="mt-4 flex flex-wrap gap-4 items-end">
                                                        <div className="space-y-1.5 w-32">
                                                            <label className="text-[9px] uppercase font-black text-slate-400 tracking-widest block ml-0.5">Type</label>
                                                            <select
                                                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none"
                                                                value={comp.amountType}
                                                                onChange={(e) => updateDeduction(comp.id, 'amountType', e.target.value)}
                                                            >
                                                                <option value="FIXED">Flat (Monthly)</option>
                                                                <option value="PERCENTAGE">% of Basic</option>
                                                                <option value="FORMULA">Formula</option>
                                                            </select>
                                                        </div>

                                                        {comp.amountType === 'FORMULA' ? (
                                                            <div className="space-y-1.5 flex-1 min-w-[200px]">
                                                                <label className="text-[9px] uppercase font-black text-slate-400 tracking-widest block ml-0.5">Rule</label>
                                                                <input
                                                                    type="text"
                                                                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none font-mono"
                                                                    value={comp.formula}
                                                                    onChange={(e) => updateDeduction(comp.id, 'formula', e.target.value)}
                                                                />
                                                            </div>
                                                        ) : comp.amountType === 'FIXED' ? null : (
                                                            <div className="space-y-1.5 w-16">
                                                                <label className="text-[9px] uppercase font-black text-slate-400 tracking-widest block ml-0.5">Value</label>
                                                                <input
                                                                    type="number"
                                                                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none pr-4 text-right"
                                                                    value={comp.amountValue}
                                                                    onChange={(e) => updateDeduction(comp.id, 'amountValue', e.target.value)}
                                                                />
                                                            </div>
                                                        )}

                                                        <div className="space-y-1.5 w-32 ml-auto text-right">
                                                            <label className="text-[9px] uppercase font-black text-slate-400 tracking-widest block mr-1 text-right">Monthly Ded.</label>
                                                            <input
                                                                type="number"
                                                                className="w-full p-2 bg-rose-50/50 border border-rose-200 rounded-lg text-xs font-black text-rose-700 outline-none text-right"
                                                                value={comp.monthlyAmount}
                                                                onChange={(e) => updateDeduction(comp.id, 'monthlyAmount', e.target.value)}
                                                            />
                                                        </div>

                                                        <button
                                                            onClick={() => removeDeduction(comp.id)}
                                                            className="p-2 text-slate-300 hover:text-rose-500 rounded-lg transition-colors group-hover:opacity-100 opacity-0"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>

                        {/* RIGHT: LIVE PREVIEW SIDEBAR */}
                        <div className="space-y-6">
                            <div className="bg-[#1e293b] text-white p-6 rounded-[2rem] shadow-2xl space-y-8 sticky top-28">
                                <div className="flex justify-between items-center border-b border-white/10 pb-4">
                                    <h3 className="font-bold uppercase tracking-widest text-[10px] text-blue-400">Live Structure Summary</h3>
                                    {totals.isBalanced ?
                                        <span className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-400 uppercase bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20">
                                            <Check size={10} /> Balanced
                                        </span> :
                                        <span className="flex items-center gap-1.5 text-[9px] font-bold text-rose-400 uppercase bg-rose-400/10 px-2 py-0.5 rounded-full border border-rose-400/20">
                                            Mismatch: ₹{Math.round(totals.diff)}
                                        </span>
                                    }
                                </div>

                                <div className="space-y-6">
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-1">Monthly Take Home (Approx)</p>
                                        <p className="text-4xl font-black text-white flex items-baseline gap-1">
                                            <span className="text-xl font-bold opacity-40">₹</span>{totals.net.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                            <p className="text-[9px] uppercase font-bold text-slate-500 mb-1">Gross Earnings</p>
                                            <p className="font-black text-lg">₹{totals.gross.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                                        </div>
                                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                            <p className="text-[9px] uppercase font-bold text-slate-500 mb-1">Emp. Deductions</p>
                                            <p className="font-black text-lg text-rose-400">₹{totals.deductions.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                                        </div>
                                    </div>

                                    <div className="p-6 bg-gradient-to-br from-blue-600 to-blue-800 rounded-3xl shadow-xl border border-white/10">
                                        <div className="flex justify-between items-center mb-1">
                                            <p className="text-[10px] uppercase font-bold text-blue-100 tracking-widest opacity-80">Calculated Annual CTC</p>
                                        </div>
                                        <p className="text-3xl font-black">₹{totals.currentAnnualCTC.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                                        <div className="mt-3 py-1 border-t border-white/10 flex justify-between items-center">
                                            <span className="text-[9px] uppercase font-bold text-blue-300">Target CTC</span>
                                            <span className="text-[11px] font-black opacity-80">₹{Number(basicInfo.annualCTC).toLocaleString('en-IN')}</span>
                                        </div>
                                    </div>
                                </div>

                                {!totals.isBalanced && (
                                    <div className="flex items-start gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
                                        <AlertCircle size={16} className="text-rose-400 flex-shrink-0 mt-0.5" />
                                        <p className="text-[10px] font-medium text-rose-300 leading-normal">
                                            The sum of <b>Earnings + Employer Benefits</b> must equal the <b>Target CTC</b>. Adjust the monthly amounts to balance the structure.
                                        </p>
                                    </div>
                                )}

                                <button
                                    onClick={handleSave}
                                    disabled={loading || !totals.isBalanced}
                                    className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl transition-all disabled:opacity-30 shadow-xl shadow-blue-900/40 font-black text-sm uppercase tracking-widest"
                                >
                                    {loading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                                    Finalize Template
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* COMPONENT PICKER OVERLAY */}
            {showComponentPicker && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setShowComponentPicker(false)}></div>
                    <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-8 border-b border-slate-100">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Add {pickerCategory}</h3>
                                <button onClick={() => setShowComponentPicker(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                                    <Trash2 size={20} />
                                </button>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    placeholder={`Search ${pickerCategory}...`}
                                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 outline-none transition-all font-semibold italic text-sm"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="p-4 max-h-[400px] overflow-y-auto bg-slate-50/50">
                            <div className="grid grid-cols-1 gap-2">
                                {(pickerCategory === 'earnings' ? masterEarnings : pickerCategory === 'deductions' ? masterDeductions : masterBenefits)
                                    .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
                                    .map(comp => (
                                        <button
                                            key={comp._id}
                                            onClick={() => {
                                                if (pickerCategory === 'earnings') addEarning(comp);
                                                else if (pickerCategory === 'deductions') addDeduction(comp);
                                                else addBenefit(comp);
                                            }}
                                            className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl hover:border-blue-500 hover:shadow-md transition-all group text-left"
                                        >
                                            <div>
                                                <div className="font-bold text-slate-800">{comp.name}</div>
                                                <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest">{comp.code || 'NO-CODE'}</div>
                                            </div>
                                            <div className="p-2 bg-slate-50 group-hover:bg-blue-600 group-hover:text-white rounded-xl transition-colors">
                                                <Plus size={16} />
                                            </div>
                                        </button>
                                    ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
