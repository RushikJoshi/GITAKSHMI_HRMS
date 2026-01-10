import React, { useState, useEffect } from 'react';
import { Tree, TreeNode } from 'react-organizational-chart';
import useOrgStructure from '../../hooks/useOrgStructure';
import { useNavigate } from 'react-router-dom';
import { Spin, Empty, Button, Tooltip, Avatar, Badge, Tag } from 'antd';
import {
    ApartmentOutlined,
    UserOutlined,
    CaretDownOutlined,
    CaretUpOutlined,
    ArrowLeftOutlined,
    InfoCircleOutlined,
    EyeOutlined,
    CheckCircleOutlined
} from '@ant-design/icons';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://hrms.gitakshmi.com';

export default function OrgStructure() {
    const { getTopLevelEmployees, getDirectReports } = useOrgStructure();
    const navigate = useNavigate();
    const [roots, setRoots] = useState([]);
    const [loading, setLoading] = useState(true);

    // Initial load of roots
    useEffect(() => {
        const fetchRoots = async () => {
            setLoading(true);
            const res = await getTopLevelEmployees();
            if (res.success) {
                setRoots(res.data.employees.map(emp => ({
                    ...emp,
                    isExpanded: false,
                    loaded: false,
                    children: []
                })));
            }
            setLoading(false);
        };
        fetchRoots();
    }, []);

    const toggleNode = async (nodeId, currentRoots) => {
        const updateRecursive = async (nodes) => {
            return Promise.all(nodes.map(async (node) => {
                if (node._id === nodeId) {
                    if (node.isExpanded) return { ...node, isExpanded: false };
                    if (!node.loaded) {
                        const res = await getDirectReports(node._id);
                        if (res.success) {
                            return {
                                ...node,
                                isExpanded: true,
                                loaded: true,
                                children: res.data.map(child => ({
                                    ...child,
                                    isExpanded: false,
                                    loaded: false,
                                    children: []
                                }))
                            };
                        }
                    }
                    return { ...node, isExpanded: true };
                }
                if (node.children?.length > 0) {
                    return { ...node, children: await updateRecursive(node.children) };
                }
                return node;
            }));
        };
        const newRoots = await updateRecursive(currentRoots);
        setRoots(newRoots);
    };

    const EmployeeNode = ({ employee, isRoot = false }) => {
        const isExpanded = employee.isExpanded;

        return (
            <div className="inline-block p-4 group select-none animate-in fade-in zoom-in duration-500">
                <div className="relative">
                    {/* The Node Card */}
                    <div
                        className={`
                            w-64 bg-white dark:bg-slate-900 rounded-[3rem] border-2 transition-all duration-700
                            ${isExpanded ? 'border-indigo-500 shadow-2xl scale-105' : 'border-slate-50 dark:border-slate-800 shadow-xl shadow-slate-200/40 hover:border-indigo-200'}
                            flex flex-col items-center pt-8 pb-6 px-4
                        `}
                        style={{ borderTopWidth: '8px' }}
                    >
                        {/* Avatar Section */}
                        <div className="relative mb-4">
                            <div className={`p-1.5 rounded-full bg-slate-50 dark:bg-slate-800 shadow-inner`}>
                                <Avatar
                                    size={80}
                                    src={employee.profilePic ? (employee.profilePic.startsWith('http') ? employee.profilePic : `${BACKEND_URL}${employee.profilePic}`) : null}
                                    icon={<UserOutlined />}
                                    className="border-2 border-white dark:border-slate-700 shadow-lg"
                                />
                            </div>
                            <div className="absolute top-1/2 -right-2 transform -translate-y-1/2">
                                <div className="w-5 h-5 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-md">
                                    <div className={`w-2.5 h-2.5 rounded-full ${employee.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                </div>
                            </div>
                        </div>

                        {/* Identity */}
                        <div className="text-center space-y-1">
                            <h3 className="text-base font-black text-slate-800 dark:text-white tracking-tight">
                                {employee.firstName} {employee.lastName}
                            </h3>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                {employee.role || 'Team Member'}
                            </p>
                        </div>

                        {/* Metadata Pill */}
                        <div className="mt-4">
                            <Tag className="m-0 text-[8px] font-black uppercase tracking-widest border-none bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 px-4 py-1 rounded-full">
                                {employee.department || 'GLOBAL'}
                            </Tag>
                        </div>

                        {/* Action Stack */}
                        <div className="mt-6 flex flex-col items-center gap-4">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/hr/details/Employee/${employee._id}`);
                                }}
                                className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-white transition-all shadow-sm border border-slate-100 dark:border-slate-700"
                            >
                                <EyeOutlined style={{ fontSize: '14px' }} />
                            </button>

                            <button
                                onClick={() => toggleNode(employee._id, roots)}
                                className={`
                                    w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500
                                    ${isExpanded ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border border-slate-100 dark:border-slate-700'}
                                `}
                            >
                                {isExpanded ? <CaretUpOutlined style={{ fontSize: '12px' }} /> : <CaretDownOutlined style={{ fontSize: '12px' }} />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderRecursive = (nodes) => {
        return nodes.map((node) => (
            <TreeNode key={node._id} label={<EmployeeNode employee={node} />}>
                {node.isExpanded && node.children && node.children.length > 0 && renderRecursive(node.children)}
                {node.isExpanded && node.loaded && node.children.length === 0 && (
                    <TreeNode label={<div className="text-[8px] font-black text-slate-300 uppercase tracking-[0.5em] mt-8 py-3 border-2 border-dashed border-slate-100 rounded-[2rem] mx-auto w-40">Leaf Node / No Reports</div>} />
                )}
            </TreeNode>
        ));
    };

    if (loading) return (
        <div className="flex h-screen items-center justify-center bg-white dark:bg-slate-950">
            <div className="flex flex-col items-center gap-6">
                <Spin size="large" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Mapping Corporate DNA</p>
            </div>
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
            {/* Design Header */}
            <div className="px-10 py-10 flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <button
                        onClick={() => navigate(-1)}
                        className="w-12 h-12 rounded-full flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-600 shadow-sm hover:scale-110 transition-transform"
                    >
                        <ArrowLeftOutlined />
                    </button>
                    <div className="flex items-center gap-6">
                        <div className="p-5 bg-slate-900 rounded-3xl text-white shadow-xl shadow-slate-400/20">
                            <ApartmentOutlined size={24} className="text-2xl" />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black text-slate-800 dark:text-white tracking-tighter">Org Tree</h1>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                Strategic Human Capital Map
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="px-6 py-3 bg-white dark:bg-slate-900 rounded-full flex items-center gap-3 border border-slate-100 dark:border-slate-800 shadow-sm">
                        <CheckCircleOutlined className="text-indigo-500" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Lazy Loading Active</span>
                    </div>
                </div>
            </div>

            {/* Tree Canvas */}
            <div className="flex-1 overflow-auto p-12 no-scrollbar scroll-smooth bg-[#fafbfc] dark:bg-slate-950/20">
                {roots.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                        <Empty description="No Root Authority Found" />
                    </div>
                ) : (
                    <div className="flex justify-center min-w-max pb-32">
                        <Tree
                            lineWidth={'2px'}
                            lineColor={'#e2e8f0'}
                            lineHeight={'60px'}
                            lineBorderRadius={'24px'}
                            label={
                                <div className="mb-12">
                                    <div className="inline-block px-10 py-3 bg-slate-900 text-white rounded-full text-[9px] font-black uppercase tracking-[0.5em] shadow-xl">
                                        Corporate Entity Root
                                    </div>
                                </div>
                            }
                        >
                            {renderRecursive(roots)}
                        </Tree>
                    </div>
                )}
            </div>

            {/* Global Overlay Styles */}
            <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                .react-organizational-chart { width: auto !important; margin: 0 auto; }
                .react-organizational-chart .node-content { display: inline-block; }
            `}</style>
        </div>
    );
}
