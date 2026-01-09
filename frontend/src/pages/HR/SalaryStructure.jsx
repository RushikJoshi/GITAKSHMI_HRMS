import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Calculator,
    Save,
    IndianRupee,
    TrendingUp,
    TrendingDown,
    ShieldCheck,
    AlertCircle,
    Check,
    FileText,
    Settings,
    X,
    Wand2
} from 'lucide-react';
import api from '../../utils/api';

/**
 * Salary Structure Configuration (Refactored to Snapshot-based Architecture)
 * - All calculations moved to Backend (SalaryEngine)
 * - Uses Immutable Snapshots for Single Source of Truth
 */
export default function SalaryStructure() {
    const { candidateId } = useParams();
    const navigate = useNavigate();

    // Core State
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [candidate, setCandidate] = useState(null);
    const [templates, setTemplates] = useState([]);
    const [error, setError] = useState(null);

    // Input State
    const [ctcInput, setCtcInput] = useState("");
    const [selectedTemplateId, setSelectedTemplateId] = useState("");

    // Result State (from Backend)
    const [previewData, setPreviewData] = useState(null);

    useEffect(() => {
        fetchData();
    }, [candidateId]);

    const fetchData = async () => {
        try {
            setLoading(true);

            // Fetch templates first - this is essential regardless of candidate load
            const tempRes = await api.get('/payroll/salary-templates');
            setTemplates(tempRes.data.data || []);

            // Now try fetching candidate/applicant data from multiple endpoints
            let candData = null;
            try {
                // 1. Try Applicants route (most likely if coming from Applicants list)
                const res = await api.get(`/requirements/applicants/${candidateId}`);
                candData = res.data.data || res.data;
            } catch (e1) {
                try {
                    // 2. Try Employees route
                    const res = await api.get(`/hr/employees/${candidateId}`);
                    candData = res.data.data || res.data;
                } catch (e2) {
                    try {
                        // 3. Try Candidate/Public route (fallback)
                        const res = await api.get(`/candidate/${candidateId}`);
                        candData = res.data.data || res.data;
                    } catch (e3) {
                        console.error("All candidate fetch attempts failed", { e1, e2, e3 });
                    }
                }
            }

            if (candData) {
                setCandidate(candData);
                // Set initial CTC if candidate already has one
                if (candData.ctc) {
                    setCtcInput(candData.ctc.toString());
                } else if (candData.salarySnapshot?.annualCTC) {
                    setCtcInput(candData.salarySnapshot.annualCTC.toString());
                }

                // If candidate has a template assigned, select it
                if (candData.salaryTemplateId) {
                    const templateId = candData.salaryTemplateId._id || candData.salaryTemplateId;
                    setSelectedTemplateId(templateId.toString());
                }
            } else {
                setError("Could not find applicant or employee with the provided ID. Please check if the candidate exists.");
                console.warn("Could not find applicant/employee for ID:", candidateId);
            }

        } catch (err) {
            console.error("Fetch error:", err);
            setError("Failed to connect to the server. Please try again later.");
        } finally {
            setLoading(false);
        }
    };

    /**
     * Preview Salary Breakdown from Backend
     */
    const handleCalculate = async () => {
        if (!selectedTemplateId || !ctcInput) {
            alert("Please select a template and enter CTC");
            return;
        }

        try {
            setLoading(true);
            const res = await api.get('/payroll-engine/salary/preview', {
                params: {
                    templateId: selectedTemplateId,
                    ctcAnnual: ctcInput
                }
            });
            setPreviewData(res.data.data);
        } catch (err) {
            console.error("Calculation failed:", err);
            alert("Calculation failed: " + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    /**
     * Assign Salary and Create Immutable Snapshot
     */
    const handleAssign = async () => {
        if (!previewData) {
            alert("Please calculate the breakdown first");
            return;
        }

        try {
            setSaving(true);
            const payload = {
                applicantId: candidateId,
                templateId: selectedTemplateId,
                ctcAnnual: parseFloat(ctcInput),
                effectiveDate: new Date()
            };

            await api.post('/payroll-engine/salary/assign', payload);
            alert("✅ Salary assigned and snapshot created successfully. You can now generate the joining letter.");
            navigate('/hr/applicants');
        } catch (err) {
            console.error("Assignment failed:", err);
            alert("Error: " + (err.response?.data?.message || err.message));
        } finally {
            setSaving(false);
        }
    };

    const formatCurrency = (amount) => {
        return Math.round(amount || 0).toLocaleString('en-IN');
    };

    if (loading && !candidate) return <div className="p-20 text-center font-bold text-gray-500">Loading Salary Configuration...</div>;

    if (error && !candidate) return (
        <div className="p-20 text-center space-y-4">
            <div className="inline-flex p-4 bg-red-50 rounded-full text-red-600 mb-4">
                <AlertCircle size={40} />
            </div>
            <h2 className="text-2xl font-black text-gray-900">Error Loading Candidate</h2>
            <p className="text-gray-500 max-w-md mx-auto">{error}</p>
            <button
                onClick={() => navigate('/hr/applicants')}
                className="px-6 py-2 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition"
            >
                Back to Applicants
            </button>
        </div>
    );

    const totals = previewData?.totals || null;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 bg-gray-50 min-h-screen">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/hr/applicants')} className="p-2 hover:bg-white rounded-full transition shadow-sm border">
                        <ArrowLeft size={20} className="text-gray-600" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900">Salary Configuration</h1>
                        <p className="text-gray-500 font-medium">{candidate?.name} • {candidate?.requirementId?.jobTitle}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="bg-white border rounded-xl p-1 shadow-sm flex items-center">
                        <div className="px-3 py-1 bg-gray-50 rounded-lg text-[10px] font-bold text-gray-400 uppercase mr-2 flex items-center gap-1">
                            <IndianRupee size={12} /> Annual CTC
                        </div>
                        <input
                            type="number"
                            placeholder="e.g. 600000"
                            className="w-40 outline-none p-2 font-bold text-gray-800"
                            value={ctcInput}
                            onChange={(e) => setCtcInput(e.target.value)}
                        />
                    </div>

                    <select
                        className="p-3 bg-white border border-gray-200 rounded-xl font-bold text-sm shadow-sm outline-none"
                        value={selectedTemplateId}
                        onChange={(e) => setSelectedTemplateId(e.target.value)}
                    >
                        <option value="">Select Salary Template</option>
                        {templates.map(t => (
                            <option key={t._id} value={t._id}>{t.templateName}</option>
                        ))}
                    </select>

                    <button
                        onClick={handleCalculate}
                        disabled={loading}
                        className="px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-bold text-sm flex items-center gap-2 shadow-sm"
                    >
                        <Calculator size={18} /> {loading ? "Calculating..." : "Calculate"}
                    </button>

                    <button
                        onClick={handleAssign}
                        disabled={saving || !previewData}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 shadow-lg font-bold"
                    >
                        {saving ? "Saving..." : <><Save size={20} /> Finalize & Assign</>}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {previewData ? (
                        <>
                            {/* EARNINGS */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                <div className="px-6 py-4 bg-gradient-to-r from-green-50 to-white border-b border-green-100 flex justify-between items-center">
                                    <h3 className="font-bold text-green-800 flex items-center gap-2"><TrendingUp size={18} /> Monthly Earnings (Resolved)</h3>
                                </div>
                                <div className="p-6 space-y-4">
                                    {previewData.earnings.map(comp => (
                                        <div key={comp.code} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-transparent">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-800">{comp.name}</span>
                                                <span className="text-[10px] text-gray-400 uppercase font-semibold">Formula: {comp.formula}</span>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-black text-gray-900">₹{formatCurrency(comp.amount / 12)}</p>
                                                <p className="text-[9px] text-gray-400">₹{formatCurrency(comp.amount)} / yr</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* DEDUCTIONS */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                <div className="px-6 py-4 bg-gradient-to-r from-red-50 to-white border-b border-red-100 flex justify-between items-center">
                                    <h3 className="font-bold text-red-800 flex items-center gap-2"><TrendingDown size={18} /> Employee Deductions</h3>
                                </div>
                                <div className="p-6 space-y-4">
                                    {previewData.deductions.map(comp => (
                                        <div key={comp.code} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-800">{comp.name}</span>
                                                <span className="text-[10px] text-gray-400 uppercase font-semibold">Formula: {comp.formula}</span>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-black text-red-600">₹{formatCurrency(comp.amount / 12)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* BENEFITS */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-white border-b border-blue-100">
                                    <h3 className="font-bold text-blue-800 flex items-center gap-2"><ShieldCheck size={18} /> Employer Benefits</h3>
                                </div>
                                <div className="p-6 space-y-4">
                                    {previewData.benefits.map(comp => (
                                        <div key={comp.code} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-800">{comp.name}</span>
                                                <span className="text-[10px] text-gray-400 uppercase font-semibold">Formula: {comp.formula}</span>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-black text-blue-600">₹{formatCurrency(comp.amount / 12)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="bg-white p-20 rounded-3xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                <Calculator size={32} className="text-gray-300" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-400">Ready to Calculate</h3>
                            <p className="max-w-xs text-sm text-gray-400 mt-2">Enter the Annual CTC and select a template to see the breakdown.</p>
                        </div>
                    )}
                </div>

                {/* SIDEBAR */}
                <div className="space-y-6">
                    {previewData && (
                        <div className="bg-[#0f172a] text-white p-8 rounded-3xl shadow-xl space-y-8 sticky top-6">
                            <div className="flex justify-between items-center border-b border-white/10 pb-4">
                                <h3 className="font-bold uppercase tracking-widest text-xs text-blue-400">Salary Snapshot</h3>
                                <Check size={20} className="text-blue-400" />
                            </div>

                            <div className="space-y-6">
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Net Take-Home</p>
                                        <p className="text-4xl font-black text-white">₹{formatCurrency(totals.netMonthly)}</p>
                                    </div>
                                    <span className="bg-blue-500/20 text-blue-300 text-[10px] font-bold px-2 py-1 rounded uppercase">Monthly</span>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                        <p className="text-[9px] uppercase font-bold text-gray-500 mb-1">Gross Earnings</p>
                                        <p className="font-bold text-lg">₹{formatCurrency(totals.grossMonthly)}</p>
                                    </div>
                                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                        <p className="text-[9px] uppercase font-bold text-gray-500 mb-1">Deductions</p>
                                        <p className="font-bold text-lg text-red-400">₹{formatCurrency(totals.deductionsMonthly)}</p>
                                    </div>
                                </div>

                                <div className="p-6 bg-gradient-to-br from-blue-600 to-blue-800 rounded-3xl shadow-lg border border-white/20">
                                    <div className="flex justify-between items-center mb-2">
                                        <p className="text-[10px] uppercase font-bold text-blue-100 tracking-widest">Defined CTC</p>
                                    </div>
                                    <p className="text-3xl font-black">₹{formatCurrency(totals.ctcYearly)}</p>
                                    <div className="mt-2 text-[10px] font-bold text-blue-200 opacity-80 uppercase">
                                        Deterministic Evaluation: OK
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleAssign}
                                disabled={saving}
                                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl transition-all disabled:opacity-50 shadow-xl shadow-blue-900/20 font-black text-sm uppercase tracking-widest"
                            >
                                {saving ? "Saving..." : <><Save size={20} /> Finalize Assignment</>}
                            </button>

                            <p className="text-[10px] text-gray-500 text-center uppercase tracking-tighter">
                                Click Finalize to create an <strong>Immutable Snapshot</strong>
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
