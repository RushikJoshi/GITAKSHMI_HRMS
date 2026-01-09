import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronDown, Plus, Loader2 } from 'lucide-react';
import SalaryComponentTable from '../../../components/Payroll/SalaryComponentTable';
import api from '../../../utils/api';
import { formatCalculationLabel } from '../../../utils/payrollFormat';

export default function SalaryComponents() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const initialTab = searchParams.get('tab') || 'templates';
    const [activeTab, setActiveTab] = useState(initialTab);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [earnings, setEarnings] = useState([]);
    const [deductions, setDeductions] = useState([]);
    const [benefits, setBenefits] = useState([]);
    const [templates, setTemplates] = useState([]);

    useEffect(() => {
        if (activeTab === 'earnings') {
            fetchEarnings();
        } else if (activeTab === 'deductions') {
            fetchDeductions();
        } else if (activeTab === 'benefits') {
            fetchBenefits();
        } else if (activeTab === 'templates') {
            fetchTemplates();
        }
    }, [activeTab]);

    const fetchTemplates = async () => {
        try {
            setLoading(true);
            const res = await api.get('/payroll/salary-templates');
            if (res.data.success) {
                const formatted = res.data.data.map(item => ({
                    id: item._id,
                    name: item.templateName,
                    type: 'Template',
                    description: item.description,
                    annualCTC: item.annualCTC,
                    monthlyCTC: item.monthlyCTC,
                    status: item.isActive ? 'Active' : 'Inactive',
                    category: 'Template'
                }));
                setTemplates(formatted);
            }
        } catch (err) {
            console.error('Failed to fetch templates', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchBenefits = async () => {
        try {
            setLoading(true);
            const res = await api.get('/payroll/benefits');
            if (res.data.success) {
                const formatted = res.data.data.map(item => ({
                    id: item._id,
                    name: item.name,
                    type: item.payType === 'FIXED' ? 'Fixed' : 'Variable',
                    calculationType: formatCalculationLabel(item),
                    considerForPF: item.epf?.enabled,
                    considerForESI: item.esi?.enabled,
                    status: item.isActive ? 'Active' : 'Inactive',
                    isUsed: false,
                    category: 'Benefit'
                }));
                setBenefits(formatted);
            }
        } catch (err) {
            console.error('Failed to fetch benefits', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchEarnings = async () => {
        try {
            setLoading(true);
            const res = await api.get('/payroll/earnings');
            if (res.data.success) {
                const formatted = res.data.data.map(item => ({
                    id: item._id,
                    name: item.name,
                    type: item.payType === 'FIXED' ? 'Fixed' : 'Variable',
                    calculationType: formatCalculationLabel(item),
                    considerForPF: item.epf?.enabled,
                    considerForESI: item.esi?.enabled,
                    status: item.isActive ? 'Active' : 'Inactive',
                    isUsed: item.isUsedInPayroll,
                    category: 'Earning'
                }));
                setEarnings(formatted);
            }
        } catch (err) {
            console.error('Failed to fetch earnings', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchDeductions = async () => {
        try {
            setLoading(true);
            const res = await api.get('/deductions');
            if (res.data.success) {
                const formatted = res.data.data.map(item => ({
                    id: item._id,
                    name: item.name,
                    type: item.category === 'PRE_TAX' ? 'Pre-Tax' : 'Post-Tax',
                    calculationType: item.amountType === 'FIXED' ? `₹${item.amountValue}` : `${item.amountValue}% of ${item.calculationBase}`,
                    frequency: item.recurring ? 'Monthly' : 'One-time',
                    status: item.isActive ? 'Active' : 'Inactive',
                    category: 'Deduction'
                }));
                setDeductions(formatted);
            }
        } catch (err) {
            console.error('Failed to fetch deductions', err);
        } finally {
            setLoading(false);
        }
    };

    // Data helpers
    const getData = () => {
        switch (activeTab) {
            case 'earnings': return earnings;
            case 'deductions': return deductions;
            case 'corrections': return [];
            case 'benefits': return benefits;
            case 'templates': return templates;
            default: return [];
        }
    };

    const activeData = getData();

    // Handlers
    const handleEdit = (item) => {
        if (item.category === 'Earning') {
            navigate(`/hr/payroll/earnings/edit/${item.id}`);
        } else if (item.category === 'Deduction') {
            navigate(`/hr/payroll/deductions/edit/${item.id}`);
        } else if (item.category === 'Benefit') {
            navigate(`/hr/payroll/benefits/edit/${item.id}`);
        } else if (item.category === 'Template') {
            navigate(`/hr/payroll/salary-templates/edit/${item.id}`);
        }
    };

    const handleToggleStatus = async (item) => {
        try {
            if (item.category === 'Earning') {
                await api.put(`/payroll/earnings/${item.id}`, { isActive: item.status !== 'Active' });
                fetchEarnings();
            } else if (item.category === 'Deduction') {
                await api.patch(`/deductions/${item.id}/status`, { isActive: item.status !== 'Active' });
                fetchDeductions();
            } else if (item.category === 'Benefit') {
                await api.patch(`/payroll/benefits/${item.id}/status`, { isActive: item.status !== 'Active' });
                fetchBenefits();
            } else if (item.category === 'Template') {
                await api.put(`/payroll/salary-templates/${item.id}`, { isActive: item.status !== 'Active' });
                fetchTemplates();
            }
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to update status');
        }
    };

    const handleDelete = async (item) => {
        if (!window.confirm(`Are you sure you want to delete "${item.name}"? This cannot be undone.`)) return;

        try {
            if (item.category === 'Earning') {
                await api.delete(`/payroll/earnings/${item.id}`);
                fetchEarnings();
            } else if (item.category === 'Deduction') {
                // Assuming standard delete route exists, if not need to verify
                await api.delete(`/deductions/${item.id}`);
                fetchDeductions();
            } else if (item.category === 'Benefit') {
                await api.delete(`/payroll/benefits/${item.id}`);
                fetchBenefits();
            }
        } catch (err) {
            // Check for specific error about usage
            alert(err.response?.data?.error || 'Failed to delete component. It might be in use.');
        }
    };

    const handleAdd = (type) => {
        setDropdownOpen(false);
        if (type === 'Earning') {
            navigate('/hr/payroll/earnings/new');
        } else if (type === 'Deduction') {
            navigate('/hr/payroll/deductions/new');
        } else if (type === 'Benefit') {
            navigate('/hr/payroll/benefits/new');
        } else {
            alert(`Coming soon: ${type}`);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50/50 pb-12">
            {/* HEADER */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-6">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Salary Components</h1>
                            <p className="text-sm text-slate-500 mt-1">Manage all salary structure elements, deductions, and benefits.</p>
                        </div>

                        <div className="relative">
                            <button
                                onClick={() => setDropdownOpen(!dropdownOpen)}
                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-all focus:ring-2 focus:ring-blue-500/20 active:scale-95"
                            >
                                <Plus size={18} />
                                <span>Add Component</span>
                                <ChevronDown size={16} className={`transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Dropdown Menu */}
                            {dropdownOpen && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)}></div>
                                    <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-20 py-2 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                                        <button onClick={() => handleAdd('Earning')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600 font-medium transition-colors">
                                            Add Earning
                                        </button>
                                        <button onClick={() => handleAdd('Deduction')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600 font-medium transition-colors">
                                            Add Deduction
                                        </button>
                                        <button onClick={() => handleAdd('Correction')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600 font-medium transition-colors">
                                            Add Correction
                                        </button>
                                        <button onClick={() => handleAdd('Benefit')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600 font-medium transition-colors">
                                            Add Benefit
                                        </button>
                                        <button onClick={() => navigate('/hr/payroll/salary-templates/new')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600 font-medium transition-colors border-t border-slate-100 mt-2 pt-2">
                                            Add Template
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* TABS */}
                    <div className="flex items-center gap-8 overflow-x-auto no-scrollbar">
                        {['Templates', 'Earnings', 'Deductions', 'Corrections', 'Benefits'].map((tab) => {
                            const key = tab.toLowerCase();
                            const isActive = activeTab === key;
                            return (
                                <button
                                    key={key}
                                    onClick={() => {
                                        setActiveTab(key);
                                        setSearchParams({ tab: key });
                                    }}
                                    className={`pb-4 text-sm font-semibold transition-all relative whitespace-nowrap ${isActive ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    {tab}
                                    {isActive && (
                                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full transition-all"></div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* CONTENT */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-200 rounded-lg shadow-sm">
                        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
                        <p className="text-sm text-slate-500 font-medium">Fetching salary components...</p>
                    </div>
                ) : (
                    <SalaryComponentTable
                        data={activeData}
                        onEdit={handleEdit}
                        onToggleStatus={handleToggleStatus}
                        onDelete={handleDelete}
                    />
                )}
            </div>
        </div>
    );
}
