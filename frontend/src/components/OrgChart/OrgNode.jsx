import React from 'react';
import { User, Plus, ChevronDown, ChevronUp, MapPin, Briefcase } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://hrms.gitakshmi.com';

const getProfilePic = (path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${BACKEND_URL}${path.startsWith('/') ? '' : '/'}${path}`;
};

export default function OrgNode({ node, onExpand, onCollapse, isExpanded, onAddReportee, isHR }) {
    if (!node) return null;

    const hasChildren = node.children && node.children.length > 0;

    return (
        <div className="group flex flex-col items-center">
            {/* CARD */}
            <div className="relative bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-lg transition-all duration-300 w-64 text-center z-10 hover:border-blue-400 dark:hover:border-blue-500 hover:-translate-y-1">

                {/* Connector Dot Top (if not root) */}
                {/* <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-300 rounded-full"></div> */}

                {/* Profile Pic */}
                <div className="relative mx-auto mb-3 w-16 h-16">
                    {node.profilePic ? (
                        <img
                            src={getProfilePic(node.profilePic)}
                            alt={node.name}
                            className="w-16 h-16 rounded-full object-cover border-2 border-white dark:border-slate-600 shadow-md"
                        />
                    ) : (
                        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 shadow-inner border-2 border-white dark:border-slate-600">
                            <User size={32} />
                        </div>
                    )}
                    <div className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 border-2 border-white dark:border-slate-800 rounded-full" title="Active"></div>
                </div>

                {/* Info */}
                <h3 className="text-sm font-black text-slate-800 dark:text-white mb-1 truncate">{node.name}</h3>
                <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1 truncate">{node.designation}</p>

                <div className="flex items-center justify-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 mb-3">
                    <Briefcase size={10} />
                    <span className="truncate max-w-[120px]">{node.department}</span>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-center gap-2 mt-2 pt-3 border-t border-slate-100 dark:border-slate-700/50">
                    <button className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-blue-500 transition-colors" title="View Profile">
                        <User size={14} />
                    </button>
                    {isHR && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onAddReportee && onAddReportee(node); }}
                            className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-slate-400 hover:text-emerald-500 transition-colors"
                            title="Add Reportee"
                        >
                            <Plus size={14} />
                        </button>
                    )}

                    {/* Expand/Collapse Toggle */}
                    {/* Note: logic handled by parent mostly, but button can trigger it if manual control needed */}
                    {hasChildren && (
                        <button
                            onClick={(e) => { e.stopPropagation(); isExpanded ? onCollapse() : onExpand(); }}
                            className={`p-1.5 rounded-lg transition-colors ${isExpanded ? 'bg-blue-50 text-blue-500' : 'hover:bg-slate-100 text-slate-400'}`}
                            title={isExpanded ? "Collapse" : "Expand"}
                        >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                    )}
                </div>
            </div>

            {/* Connector Dot Bottom (if expanded) */}
            {/* isExpanded && hasChildren && <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-300 rounded-full"></div> */}
        </div>
    );
}
