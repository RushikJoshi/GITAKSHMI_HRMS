import React, { useState, useEffect } from 'react';
import api from '../../../utils/api';
import { IndianRupee, Users, TrendingUp, Calendar, ArrowRight, Play, FileText, PieChart } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PayrollDashboard() {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        lastMonthPayout: 0,
        lastMonthHeadcount: 0,
        ytdPayout: 0,
        recentRuns: []
    });

    useEffect(() => {
        loadDashboardData();
    }, []);

    async function loadDashboardData() {
        try {
            setLoading(true);
            const year = new Date().getFullYear();

            // Fetch runs for current year to calculate stats
            // Note: In a real large-scale app, we'd want a dedicated /stats endpoint.
            // Optimizing here by using existing list endpoint and processing client side for MVP.
            const res = await api.get(`/payroll/runs?year=${year}`);
            const runs = res.data?.data || [];

            // Sort runs by date desc
            runs.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

            let lastMonthPayout = 0;
            let lastMonthHeadcount = 0;
            let ytdPayout = 0;

            // Find latest APPROVED or PAID run
            const latestCompleted = runs.find(r => ['APPROVED', 'PAID'].includes(r.status));
            if (latestCompleted) {
                lastMonthPayout = latestCompleted.totalNetPay || 0;
                lastMonthHeadcount = latestCompleted.processedEmployees || 0;
            }

            // Calculate YTD
            ytdPayout = runs
                .filter(r => ['APPROVED', 'PAID'].includes(r.status))
                .reduce((sum, r) => sum + (r.totalNetPay || 0), 0);

            setStats({
                lastMonthPayout,
                lastMonthHeadcount,
                ytdPayout,
                recentRuns: runs.slice(0, 5) // Last 5 runs
            });

        } catch (err) {
            console.error("Failed to load dashboard stats", err);
        } finally {
            setLoading(false);
        }
    }

    const StatCard = ({ title, value, subtitle, icon: Icon, color }) => (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-start justify-between">
            <div>
                <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">{title}</p>
                <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
                {subtitle && <p className="text-slate-400 text-xs mt-2">{subtitle}</p>}
            </div>
            <div className={`p-3 rounded-lg ${color}`}>
                <Icon className="h-6 w-6 text-white" />
            </div>
        </div>
    );

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Payroll Overview</h1>
                    <p className="text-slate-500 mt-1">Real-time snapshots of payroll activities</p>
                </div>
                <Link to="/hr/payroll/run" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm flex items-center gap-2">
                    <Play className="h-4 w-4" /> Run Payroll
                </Link>
            </div>

            {loading ? (
                <div className="p-12 text-center text-slate-400">Loading metrics...</div>
            ) : (
                <>
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <StatCard
                            title="Last Payroll Cost"
                            value={`₹${stats.lastMonthPayout.toLocaleString()}`}
                            subtitle="Net Pay Disbursed"
                            icon={IndianRupee}
                            color="bg-emerald-500"
                        />
                        <StatCard
                            title="Employees Paid"
                            value={stats.lastMonthHeadcount}
                            subtitle="Last processed cycle"
                            icon={Users}
                            color="bg-blue-500"
                        />
                        <StatCard
                            title="YTD Cost"
                            value={`₹${stats.ytdPayout.toLocaleString()}`}
                            subtitle={`Total for ${new Date().getFullYear()}`}
                            icon={TrendingUp}
                            color="bg-purple-500"
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Recent Activity */}
                        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200">
                            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-gray-50">
                                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                                    <Calendar className="h-5 w-5 text-slate-500" /> Recent Runs
                                </h3>
                                <Link to="/hr/payroll/run" className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1">
                                    View All <ArrowRight className="h-3 w-3" />
                                </Link>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-white">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Period</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {stats.recentRuns.length === 0 ? (
                                            <tr><td colSpan="4" className="px-6 py-8 text-center text-slate-500">No payroll runs found yet.</td></tr>
                                        ) : (
                                            stats.recentRuns.map(run => (
                                                <tr key={run._id} className="hover:bg-slate-50">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                                                        {new Date(0, run.month - 1).toLocaleString('default', { month: 'long' })} {run.year}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                                        {new Date(run.updatedAt).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className={`px-2 py-1 text-xs font-medium rounded-full 
                                         ${run.status === 'PAID' ? 'bg-green-100 text-green-800' :
                                                                run.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                                                                    run.status === 'CALCULATED' ? 'bg-purple-100 text-purple-800 text-center' :
                                                                        'bg-blue-100 text-blue-800'}`}>
                                                            {run.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 text-right font-mono">
                                                        ₹{(run.totalNetPay || 0).toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Quick Actions / Configuration */}
                        <div className="space-y-6">
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                    <PieChart className="h-5 w-5 text-slate-500" /> Quick Actions
                                </h3>
                                <div className="space-y-3">
                                    <Link to="/hr/payroll/salary-components" className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:shadow-sm transition group">
                                        <span className="text-sm font-medium text-slate-700 group-hover:text-blue-700">Manage Components</span>
                                        <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-700" />
                                    </Link>
                                    <Link to="/hr/payroll/salary-templates/new" className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:shadow-sm transition group">
                                        <span className="text-sm font-medium text-slate-700 group-hover:text-blue-700">Design Salary Template</span>
                                        <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-700" />
                                    </Link>
                                    <Link to="/hr/payroll/payslips" className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:shadow-sm transition group">
                                        <span className="text-sm font-medium text-slate-700 group-hover:text-blue-700">Download Payslips</span>
                                        <FileText className="h-4 w-4 text-slate-400 group-hover:text-blue-700" />
                                    </Link>
                                </div>
                            </div>

                            <div className="bg-indigo-900 rounded-xl shadow-sm p-6 text-white bg-gradient-to-br from-indigo-900 to-slate-900">
                                <h3 className="font-bold text-lg mb-2">Help & Support</h3>
                                <p className="text-indigo-200 text-sm mb-4">Need help running payroll? Check our documentation or contact support.</p>
                                <button className="text-sm bg-white/10 hover:bg-white/20 px-3 py-2 rounded text-white transition">
                                    View Documentation
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
