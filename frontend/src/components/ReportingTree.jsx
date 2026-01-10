import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { User, ChevronUp } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://hrms.gitakshmi.com';

const getProfilePic = (path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${BACKEND_URL}${path.startsWith('/') ? '' : '/'}${path}`;
};

export default function ReportingTree() {
    const [tree, setTree] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTree = async () => {
            try {
                const res = await api.get('/employee/reporting-tree');
                setTree(res.data);
            } catch (err) {
                console.error("Failed to fetch reporting tree", err);
            } finally {
                setLoading(false);
            }
        };
        fetchTree();
    }, []);

    if (loading) return <div className="animate-pulse h-40 bg-slate-100 dark:bg-slate-800 rounded-2xl"></div>;
    if (!tree) return null;

    return (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6">Reporting Hierarchy</h3>

            <div className="flex flex-col items-center gap-4">
                {/* Level 2: Group Manager */}
                {tree.level2 && (
                    <>
                        <div className="flex flex-col items-center">
                            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 w-48 text-center ring-2 ring-slate-100 dark:ring-slate-800">
                                {tree.level2.profilePic ? (
                                    <img src={getProfilePic(tree.level2.profilePic)} alt="" className="w-10 h-10 rounded-full mx-auto mb-2 object-cover border-2 border-white shadow-sm" />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 mx-auto mb-2 flex items-center justify-center text-slate-400">
                                        <User size={20} />
                                    </div>
                                )}
                                <div className="text-xs font-black text-slate-800 dark:text-white truncate">{tree.level2.name}</div>
                                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter truncate">{tree.level2.designation}</div>
                            </div>
                            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700"></div>
                        </div>
                    </>
                )}

                {/* Level 1: Manager */}
                {tree.level1 ? (
                    <>
                        <div className="flex flex-col items-center">
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900/30 w-56 text-center shadow-lg shadow-blue-500/5 ring-2 ring-blue-500/10">
                                {tree.level1.profilePic ? (
                                    <img src={getProfilePic(tree.level1.profilePic)} alt="" className="w-12 h-12 rounded-full mx-auto mb-2 object-cover border-2 border-white shadow-sm" />
                                ) : (
                                    <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/40 mx-auto mb-2 flex items-center justify-center text-blue-500">
                                        <User size={24} />
                                    </div>
                                )}
                                <div className="text-sm font-black text-slate-900 dark:text-white truncate">{tree.level1.name}</div>
                                <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest truncate">{tree.level1.designation}</div>
                                <div className="mt-1 text-[8px] font-bold text-slate-400 uppercase">Direct Manager</div>
                            </div>
                            <div className="h-6 w-px bg-blue-200 dark:bg-blue-800"></div>
                        </div>
                    </>
                ) : (
                    <div className="text-center py-4 text-[10px] font-bold text-slate-400 uppercase italic bg-slate-50 dark:bg-slate-800/50 rounded-xl w-full">
                        No active manager assigned
                    </div>
                )}

                {/* Level 0: Self */}
                <div className="p-4 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl w-64 text-center shadow-xl shadow-slate-900/20 border border-slate-700 ring-4 ring-slate-900/5 transition-transform hover:scale-105">
                    {tree.level0.profilePic ? (
                        <img src={getProfilePic(tree.level0.profilePic)} alt="" className="w-14 h-14 rounded-full mx-auto mb-2 object-cover border-2 border-slate-600 shadow-xl" />
                    ) : (
                        <div className="w-14 h-14 rounded-full bg-slate-700 mx-auto mb-2 flex items-center justify-center text-slate-400 shadow-inner">
                            <User size={28} />
                        </div>
                    )}
                    <div className="text-base font-black text-white">{tree.level0.name}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{tree.level0.designation}</div>
                    <div className="mt-2 inline-block px-2 py-0.5 bg-blue-500/20 text-blue-400 text-[8px] font-black uppercase rounded-full border border-blue-500/30">You</div>
                </div>
            </div>
        </div>
    );
}
