import React, { useEffect, useState } from "react";
import { Pagination } from 'antd';
import { useNavigate } from 'react-router-dom';
import api from "../../utils/api";
import CompanyForm from "./CompanyForm";
import ModuleConfig from "./ModuleConfig";
import CompanyView from "./CompanyView";

export default function Companies() {
  const [companies, setCompanies] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [openForm, setOpenForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [openModules, setOpenModules] = useState(false);
  const [openView, setOpenView] = useState(false);
  const [revealMap, setRevealMap] = useState({});
  const _navigate = useNavigate();
  const API_BASE = import.meta.env.VITE_API_BASE || 'https://hrms.gitakshmi.com/api';
  const API_ORIGIN = API_BASE.replace(/\/api\/?$/, '');

  async function load() {
    try {
      const res = await api.get("/tenants");
      // setCompanies(res.data || []);
      setCompanies(Array.isArray(res.data) ? res.data : (res.data?.tenants || res.data?.data || []));

    } catch (err) {
      console.log(err);
      alert("Failed to load companies");
    }
  }

  useEffect(() => {
    (async () => {
      await load();
      setCurrentPage(1);
    })();
  }, []);

  // compute current page slice for rendering
  const start = (currentPage - 1) * pageSize;
  const paged = companies.slice(start, start + pageSize);

  async function toggleActive(company) {
    try {
      // Backend tenant status enum uses 'active' | 'suspended' | 'deleted'
      // use 'suspended' for the inactive state to avoid mismatches/typos
      const newStatus = company.status === 'active' ? 'suspended' : 'active';
      await api.put(`/tenants/${company._id}`, { status: newStatus });
      load();
    } catch (err) {
      console.error(err);
      alert('Failed to update status');
    }
  }

  function toggleReveal(id) {
    setRevealMap(prev => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Companies</h1>
        <button
          onClick={() => {
            setSelected(null);
            setOpenForm(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700"
        >
          + Add Company
        </button>
      </div>
      <div className="bg-white rounded-lg shadow-sm border">
        {/* Desktop / Tablet Table */}
        <div className="hidden md:block overflow-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="p-3 text-left">ID</th>
                <th className="p-3 text-left">Logo</th>
                <th className="p-3 text-left">Company</th>
                <th className="p-3 text-left">Email</th>
                <th className="p-3 text-left">Password</th>
                <th className="p-3 text-left">Modules</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Actions</th>
              </tr>
            </thead>

            <tbody>
              {paged.map((c) => (
                <tr key={c._id} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-mono text-sm">{c.code || c._id}</td>
                  <td className="p-3">
                    {c.meta?.logo ? (
                      <img src={(c.meta.logo || '').startsWith('http') ? c.meta.logo : `${API_ORIGIN}${c.meta.logo || ''}`} alt="logo" className="h-10 w-10 object-contain rounded" />
                    ) : (
                      <div className="h-10 w-10 bg-slate-100 rounded flex items-center justify-center text-sm text-slate-400">No</div>
                    )}
                  </td>
                  <td className="p-3 font-medium">{c.name}</td>
                  <td className="p-3">{c.meta?.primaryEmail || c.meta?.email || '-'}</td>
                  <td className="p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-mono">{revealMap[c._id] ? (c.meta?.adminPassword || '-') : (c.meta?.adminPassword ? '••••••' : '-')}</span>
                      {c.meta?.adminPassword && (
                        <button type="button" onClick={() => toggleReveal(c._id)} className="p-1 rounded hover:bg-slate-100" aria-label={revealMap[c._id] ? 'Hide password' : 'Reveal password'}>
                          {/* Eye icon */}
                          {revealMap[c._id] ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-5.523 0-10-4.477-10-10a9.97 9.97 0 012.175-5.675M3 3l18 18" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      {(c.modules || []).length === 0 ? <span className="text-sm text-slate-500">-</span> : (c.modules || []).map(m => (
                        <span key={m} className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded border border-blue-100 capitalize">{m}</span>
                      ))}
                    </div>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-sm ${c.status === 'active' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                      {c.status === 'active' ? 'Active' : 'Deactive'}
                    </span>
                  </td>

                  <td className="p-3 flex gap-3 items-center">
                    <button onClick={() => { setSelected(c); setOpenView(true); }} className="p-1 rounded hover:bg-slate-100" title="View" aria-label="View company">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    <button onClick={() => { setSelected(c); setOpenForm(true); }} className="p-1 rounded hover:bg-slate-100" title="Edit" aria-label="Edit company">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button onClick={() => toggleActive(c)} className={`px-2 py-1 text-sm rounded ${c.status === 'active' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'}`}>{c.status === 'active' ? 'Deactive' : 'Activate'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile / Small: stacked cards */}
        <div className="md:hidden p-3 space-y-3">
          {paged.map((c) => (
            <div key={c._id} className="bg-white border rounded-lg p-3 shadow-sm">
              <div className="flex items-start gap-3">
                <div>
                  {c.meta?.logo ? (
                    <img src={(c.meta.logo || '').startsWith('http') ? c.meta.logo : `${API_ORIGIN}${c.meta.logo || ''}`} alt="logo" className="h-12 w-12 object-contain rounded" />
                  ) : (
                    <div className="h-12 w-12 bg-slate-100 rounded flex items-center justify-center text-sm text-slate-400">No</div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-slate-800">{c.name}</div>
                      <div className="text-sm text-slate-500">ID: <span className="font-mono">{c.code || c._id}</span></div>
                      <div className="text-sm text-slate-500">Email: <span className="font-medium">{c.meta?.primaryEmail || c.meta?.email || '-'}</span></div>
                      <div className="text-sm text-slate-500">Password: <span className="font-medium font-mono">{revealMap[c._id] ? (c.meta?.adminPassword || '-') : (c.meta?.adminPassword ? '••••••' : '-')}</span> {c.meta?.adminPassword && (<button type="button" onClick={() => toggleReveal(c._id)} className="ml-2 text-xs text-slate-500 hover:text-slate-700">{revealMap[c._id] ? 'Hide' : 'Reveal'}</button>)}</div>
                    </div>
                    <div>
                      <span className={`px-2 py-1 rounded text-sm ${c.status === 'active' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>{c.status === 'active' ? 'Active' : 'Deactive'}</span>
                    </div>
                  </div>

                  <div className="mt-2">
                    <div className="text-sm text-slate-600">Modules:</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {(c.modules || []).length === 0 ? (
                        <span className="text-sm text-slate-500">-</span>
                      ) : (
                        (c.modules || []).map(m => (
                          <span key={m} className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded border border-blue-100 capitalize">{m}</span>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex gap-2 items-center">
                    <button onClick={() => { setSelected(c); setOpenView(true); }} className="p-1 rounded hover:bg-slate-100" aria-label="View company">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    <button onClick={() => { setSelected(c); setOpenForm(true); }} className="p-1 rounded hover:bg-slate-100" aria-label="Edit company">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button onClick={() => toggleActive(c)} className={`text-sm px-2 py-1 rounded ${c.status === 'active' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'}`}>{c.status === 'active' ? 'Deactive' : 'Activate'}</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {companies.length === 0 && (
          <div className="p-4 text-center text-gray-500">No companies found</div>
        )}

        {companies.length > pageSize && (
          <div className="flex justify-end p-4 border-t">
            <Pagination
              current={currentPage}
              pageSize={pageSize}
              total={companies.length}
              onChange={(page) => setCurrentPage(page)}
              showSizeChanger={false}
            />
          </div>
        )}
      </div>

      {openForm && (
        <CompanyForm
          company={selected}
          onClose={() => {
            setOpenForm(false);
            load();
          }}
        />
      )}

      {openView && (
        <CompanyView
          company={selected}
          onClose={() => {
            setOpenView(false);
            setSelected(null);
          }}
        />
      )}

      {openModules && (
        <ModuleConfig
          company={selected}
          onClose={() => {
            setOpenModules(false);
            load();
          }}
        />
      )}
    </div>
  );
}
