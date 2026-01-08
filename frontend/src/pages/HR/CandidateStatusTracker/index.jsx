import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../utils/api';
import { Eye, Clock, User, Briefcase, Calendar, CheckCircle, XCircle, ChevronRight, RefreshCw, Database } from 'lucide-react';
import dayjs from 'dayjs';

export default function CandidateStatusTracker() {
    const navigate = useNavigate();
    const [candidates, setCandidates] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const loadCandidates = async () => {
        setLoading(true);
        try {
            const res = await api.get('hr/candidate-status');
            setCandidates(res.data || []);
        } catch (err) {
            console.error('[CANDIDATE_LOAD_ERR]', err);
            // alert('Failed to load candidates');
        } finally {
            setLoading(false);
        }
    };

    const seedSampleData = async () => {
        if (!confirm('This will seed sample candidates. Continue?')) return;
        setLoading(true);
        try {
            await api.post('tracker/seed');
            await loadCandidates();
        } catch (err) {
            console.error('[SEED_ERR]', err);
            alert('Failed to seed sample data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCandidates();
    }, []);

    const getStatusBadge = (status) => {
        const styles = {
            'Applied': 'bg-blue-100 text-blue-700 border-blue-200',
            'Shortlisted': 'bg-yellow-100 text-yellow-700 border-yellow-200',
            'Interview Scheduled': 'bg-purple-100 text-purple-700 border-purple-200',
            'Selected': 'bg-emerald-100 text-emerald-700 border-emerald-200',
            'Rejected': 'bg-rose-100 text-rose-700 border-rose-200'
        };
        return (
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${styles[status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                {status}
            </span>
        );
    };

    const getStageBadge = (stage) => {
        const styles = {
            'HR': 'text-orange-600 bg-orange-50',
            'Technical': 'text-cyan-600 bg-cyan-50',
            'Final': 'text-indigo-600 bg-indigo-50'
        };
        return (
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${styles[stage] || 'bg-gray-50 text-gray-600'}`}>
                {stage} Stage
            </span>
        );
    };

    const filteredCandidates = candidates.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.requirementTitle.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Candidate Status Tracker</h1>
                    <p className="text-slate-500 mt-1 flex items-center gap-2">
                        <Clock size={16} className="text-blue-500" />
                        Real-time monitoring of all applicant progressions
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={seedSampleData}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition shadow-sm text-sm font-medium"
                    >
                        <Database size={18} className="text-orange-500" />
                        Seed Sample Data
                    </button>
                    <button
                        onClick={loadCandidates}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-md shadow-blue-200 text-sm font-medium"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Stats Cards (Mini) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Tracked', count: candidates.length, color: 'blue' },
                    { label: 'Interviews', count: candidates.filter(c => c.currentStatus === 'Interview Scheduled').length, color: 'purple' },
                    { label: 'Selected', count: candidates.filter(c => c.currentStatus === 'Selected').length, color: 'emerald' },
                    { label: 'Rejected', count: candidates.filter(c => c.currentStatus === 'Rejected').length, color: 'rose' },
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">{stat.label}</div>
                        <div className={`text-2xl font-black text-${stat.color}-600 mt-1`}>{stat.count}</div>
                    </div>
                ))}
            </div>

            {/* Main Table Section */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row gap-4 justify-between items-center">
                    <div className="relative w-full md:w-96">
                        <input
                            type="text"
                            placeholder="Search candidate or role..."
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition text-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <User size={18} className="absolute left-3 top-2.5 text-slate-400" />
                    </div>
                    <div className="text-xs text-slate-400 font-medium italic">
                        Showing {filteredCandidates.length} of {candidates.length} candidates
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-slate-600 text-xs font-bold uppercase tracking-wider">
                                <th className="px-6 py-4">Candidate Information</th>
                                <th className="px-6 py-4">Requirement / Role</th>
                                <th className="px-6 py-4">Current Status</th>
                                <th className="px-6 py-4">Progress Stage</th>
                                <th className="px-6 py-4">Last Action</th>
                                <th className="px-6 py-4 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading && candidates.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-slate-400 italic">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                                            Fetching records...
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredCandidates.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-slate-400 italic">
                                        No matching records found.
                                    </td>
                                </tr>
                            ) : (
                                filteredCandidates.map((candidate) => (
                                    <tr key={candidate._id} className="hover:bg-slate-50/80 transition group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-100">
                                                    {candidate.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-900 group-hover:text-blue-600 transition truncate max-w-[180px]">
                                                        {candidate.name}
                                                    </div>
                                                    <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                                        {candidate.email}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-slate-700 font-medium">
                                                <Briefcase size={14} className="text-slate-400" />
                                                {candidate.requirementTitle}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {getStatusBadge(candidate.currentStatus)}
                                        </td>
                                        <td className="px-6 py-4">
                                            {getStageBadge(candidate.currentStage)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-xs text-slate-500 flex items-center gap-1.5">
                                                <Calendar size={14} className="text-slate-400" />
                                                {dayjs(candidate.createdAt).format('MMM DD, YYYY')}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={() => navigate(`/hr/candidate-status/${candidate._id}`)}
                                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all group/btn"
                                                title="View Full Timeline"
                                            >
                                                <Eye size={20} className="group-hover/btn:scale-110 transition-transform" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
