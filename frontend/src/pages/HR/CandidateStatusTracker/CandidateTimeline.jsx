import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../../utils/api';
import {
    ArrowLeft, Clock, User, MessageSquare, Calendar,
    CheckCircle, PlusCircle, XCircle, PlayCircle,
    MapPin, Phone, Mail, Award
} from 'lucide-react';
import dayjs from 'dayjs';

export default function CandidateTimeline() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [candidate, setCandidate] = useState(null);
    const [timeline, setTimeline] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modal State for Status Update
    const [showUpdateModal, setShowUpdateModal] = useState(false);
    const [formData, setFormData] = useState({
        status: '',
        stage: 'HR',
        remarks: '',
        actionBy: 'HR Manager'
    });

    const loadData = async () => {
        setLoading(true);
        try {
            // Find candidate in list (simplification: we could have a single fetch API)
            const cRes = await api.get('tracker/candidates');
            const found = cRes.data.find(c => c._id === id);
            setCandidate(found);

            // Get timeline
            const tRes = await api.get(`tracker/candidates/${id}/timeline`);
            setTimeline(tRes.data || []);

            if (found) {
                setFormData(prev => ({ ...prev, status: found.currentStatus, stage: found.currentStage }));
            }
        } catch (err) {
            console.error(err);
            alert('Failed to load candidate data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [id]);

    const handleUpdateStatus = async (e) => {
        e.preventDefault();
        try {
            await api.post(`tracker/candidates/${id}/status`, formData);
            setShowUpdateModal(false);
            loadData();
        } catch (err) {
            console.error(err);
            alert('Failed to update status');
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'Applied': return <PlusCircle size={20} className="text-blue-500" />;
            case 'Shortlisted': return <Award size={20} className="text-yellow-500" />;
            case 'Interview Scheduled': return <PlayCircle size={20} className="text-purple-500" />;
            case 'Selected': return <CheckCircle size={20} className="text-emerald-500" />;
            case 'Rejected': return <XCircle size={20} className="text-rose-500" />;
            default: return <Clock size={20} className="text-slate-400" />;
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                <p className="text-slate-500 font-medium animate-pulse">Building Timeline...</p>
            </div>
        </div>
    );

    if (!candidate) return (
        <div className="p-12 text-center">
            <div className="text-slate-400 mb-4 font-bold text-xl uppercase">404 - Not Found</div>
            <button onClick={() => navigate('/hr/candidate-status')} className="text-blue-600 hover:underline">Return to list</button>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50/50 pb-20">
            {/* Top Banner */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-20">
                <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/hr/candidate-status')}
                            className="p-2 hover:bg-slate-100 rounded-full transition text-slate-500"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">{candidate.name}</h2>
                            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{candidate.requirementTitle}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowUpdateModal(true)}
                        className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 font-bold text-sm"
                    >
                        Update Progress
                    </button>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Left: Candidate Info Card */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-8 -mt-8 opacity-50"></div>

                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white text-3xl font-black mb-6 shadow-lg shadow-blue-200">
                            {candidate.name.charAt(0)}
                        </div>

                        <div className="space-y-4 relative">
                            <div className="flex items-center gap-3 text-slate-600">
                                <Mail size={18} className="text-blue-500" />
                                <span className="text-sm font-medium truncate">{candidate.email}</span>
                            </div>
                            <div className="flex items-center gap-3 text-slate-600">
                                <Phone size={18} className="text-emerald-500" />
                                <span className="text-sm font-medium">{candidate.phone}</span>
                            </div>
                            <div className="pt-6 border-t border-slate-100">
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Current Status</div>
                                <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></span>
                                    <span className="font-bold text-slate-800">{candidate.currentStatus}</span>
                                </div>
                            </div>
                            <div>
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Target Role</div>
                                <div className="flex items-center gap-2 font-medium text-slate-700">
                                    <MapPin size={16} className="text-slate-400" />
                                    {candidate.requirementTitle}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Vertical Timeline View */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-900 mb-8 flex items-center gap-2">
                            <Clock size={20} className="text-blue-500" />
                            Execution Timeline
                        </h3>

                        {timeline.length === 0 ? (
                            <div className="py-20 text-center text-slate-400 italic bg-slate-50 rounded-xl border-2 border-dashed border-slate-100">
                                No timeline logs yet.
                            </div>
                        ) : (
                            <div className="relative ml-4">
                                {/* Vertical Line */}
                                <div className="absolute left-0 top-0 w-0.5 h-full bg-slate-100 -ml-[1px]"></div>

                                <div className="space-y-12">
                                    {timeline.map((log, index) => (
                                        <div key={log._id} className="relative pl-10">
                                            {/* Dot/Icon */}
                                            <div className="absolute left-0 top-0 -ml-[21px] p-2 bg-white rounded-full border-2 border-slate-100 shadow-sm z-10 transition-transform hover:scale-110">
                                                {getStatusIcon(log.status)}
                                            </div>

                                            <div className="bg-slate-50/50 hover:bg-slate-50 rounded-2xl p-5 border border-slate-100 transition duration-300">
                                                <div className="flex flex-col md:flex-row md:items-center justify-between mb-3 gap-2">
                                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ring-1 ring-inset ${log.status === 'Selected' ? 'text-emerald-700 bg-emerald-50 ring-emerald-200' :
                                                        log.status === 'Rejected' ? 'text-rose-700 bg-rose-50 ring-rose-200' :
                                                            'text-slate-700 bg-slate-100 ring-slate-200'
                                                        }`}>
                                                        {log.status}
                                                    </span>
                                                    <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                                                        <Calendar size={12} />
                                                        {dayjs(log.actionDate).format('MMM DD, YYYY • hh:mm A')}
                                                    </span>
                                                </div>

                                                <div className="p-3 bg-white rounded-lg border border-slate-100/50 shadow-sm">
                                                    <p className="text-sm text-slate-700 leading-relaxed italic">
                                                        "{log.remarks || 'No remarks provided.'}"
                                                    </p>
                                                </div>

                                                <div className="mt-4 flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                                                            {log.actionBy.charAt(0)}
                                                        </div>
                                                        <span className="text-xs text-slate-500 font-medium">By {log.actionBy}</span>
                                                    </div>
                                                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{log.stage} STAGE</span>
                                                </div>
                                            </div>

                                            {/* Animated connector for the latest one */}
                                            {index === 0 && <div className="absolute -left-[1px] top-0 w-0.5 h-10 bg-gradient-to-b from-blue-500 to-transparent"></div>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Update Status Modal */}
            {showUpdateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in transition-all">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-300">
                        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-6 flex justify-between items-center">
                            <h3 className="text-white font-bold text-lg">Update Candidate Progress</h3>
                            <button
                                onClick={() => setShowUpdateModal(false)}
                                className="text-white/80 hover:text-white transition"
                            >
                                <ArrowLeft className="rotate-90" size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleUpdateStatus} className="p-6 space-y-5">
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Target Status</label>
                                <select
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition font-medium text-slate-700"
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    required
                                >
                                    <option value="Applied">Applied</option>
                                    <option value="Shortlisted">Shortlisted</option>
                                    <option value="Interview Scheduled">Interview Scheduled</option>
                                    <option value="Selected">Selected</option>
                                    <option value="Rejected">Rejected</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Process Stage</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {['HR', 'Technical', 'Final'].map(s => (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, stage: s })}
                                            className={`py-2 text-xs font-bold rounded-lg border transition ${formData.stage === s
                                                ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
                                                : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'
                                                }`}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">HR Remarks</label>
                                <textarea
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition font-medium text-slate-700 min-h-[100px]"
                                    placeholder="Describe the candidate's performance or action notes..."
                                    value={formData.remarks}
                                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                                    required
                                ></textarea>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowUpdateModal(false)}
                                    className="flex-1 px-4 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition border border-transparent"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition shadow-lg shadow-indigo-100"
                                >
                                    Confirm Update
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
