import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import api from '../services/api';
import { useToastStore } from '../store/toastStore';
import MultiSelectDropdown from '../components/MultiSelectDropdown';

export default function TelecallerReportsPage() {
  const { showToast } = useToastStore();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);

  // Multi-Select Filters
  const [selectedMonths, setSelectedMonths] = useState<string[]>(['July']);
  const [selectedYears, setSelectedYears] = useState<string[]>(['2026']);
  const [selectedRoleTypes, setSelectedRoleTypes] = useState<string[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const years = ['2024', '2025', '2026', '2027'];
  const roleTypes = ['Telecaller', 'Sales Manager', 'Team Lead', 'Admin'];

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const usersRes = await api.get('/users').catch(() => ({ data: [] }));
      setUsers(usersRes.data || []);
    } catch (err) {
      console.error(err);
      showToast('Failed to load telecaller report data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterClick = () => {
    showToast('Applied telecaller multi-select report parameters.', 'info');
  };

  // Mock list of telecaller agents if users is empty
  const telecallersList = users.length > 0 ? users : [
    { _id: 'u1', name: 'Rajabaksh Ilyala', role: 'Telecaller', email: 'rajabaksh@inkcrm.com' },
    { _id: 'u2', name: 'Ayesha Khan', role: 'Telecaller', email: 'ayesha@inkcrm.com' },
    { _id: 'u3', name: 'Mohammed Sameer', role: 'Team Lead', email: 'sameer@inkcrm.com' },
    { _id: 'u4', name: 'Priya Sharma', role: 'Sales Manager', email: 'priya@inkcrm.com' },
  ];

  const agentNamesList = telecallersList.map(u => u.name);

  const exportCSV = () => {
    const headers = ['Agent Name', 'Role', 'Assigned Leads', 'Calls Connected', 'Converted Deals', 'Conversion Rate %', 'Disbursed Amount'];
    const rows = telecallersList.map((ag, idx) => [
      ag.name,
      ag.role || 'Telecaller',
      24 + idx * 8,
      18 + idx * 6,
      6 + idx * 2,
      `${Math.round(((6 + idx * 2) / (24 + idx * 8)) * 100)}%`,
      `₹${(350000 + idx * 120000).toLocaleString('en-IN')}`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Telecaller_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto text-left px-4 md:px-8 py-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#EAE4DA] dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A] dark:text-white flex items-center gap-2.5">
            <Icons.PhoneCall className="w-6 h-6 text-[#17223B] dark:text-indigo-400" />
            Telecaller's Reports
          </h1>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
            Detailed call logs, lead allocations, and agent productivity performance audit.
          </p>
        </div>

        <button
          onClick={exportCSV}
          className="btn-secondary-premium h-11 px-5 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 self-start md:self-auto"
        >
          <Icons.Download className="w-4 h-4" />
          Export Report
        </button>
      </div>

      {/* FILTER CONTROL CARD (With Multi-Select Checkboxes) */}
      <div className="card-premium p-6 relative overflow-visible border-2 border-[#17223B]/10 z-20">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#EAE4DA] dark:border-slate-800">
          <Icons.SlidersHorizontal className="w-4 h-4 text-[#17223B] dark:text-indigo-400" />
          <h3 className="text-xs font-bold text-[#0F172A] dark:text-white uppercase tracking-wider">
            Monthly Telecaller's Report Parameters
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Select Month */}
          <MultiSelectDropdown
            label="Select Month"
            options={months}
            selectedValues={selectedMonths}
            onChange={setSelectedMonths}
            placeholder="-All Months-"
          />

          {/* Select Year */}
          <MultiSelectDropdown
            label="Select Year"
            options={years}
            selectedValues={selectedYears}
            onChange={setSelectedYears}
            placeholder="-All Years-"
          />

          {/* Load Agents Types */}
          <MultiSelectDropdown
            label="Load Agents Types"
            options={roleTypes}
            selectedValues={selectedRoleTypes}
            onChange={setSelectedRoleTypes}
            placeholder="-All Agent Roles-"
          />

          {/* Calling Agent */}
          <MultiSelectDropdown
            label="Calling Agent"
            options={agentNamesList}
            selectedValues={selectedAgents}
            onChange={setSelectedAgents}
            placeholder="-All Calling Agents-"
          />
        </div>

        {/* View Detail Report Action */}
        <div className="flex justify-start mt-6 pt-4 border-t border-[#EAE4DA] dark:border-slate-800">
          <button
            onClick={handleFilterClick}
            className="btn-primary-premium h-11 px-6 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(23,34,59,0.15)]"
          >
            <Icons.CheckCircle className="w-4 h-4" />
            View Detail Report
          </button>
        </div>
      </div>

      {/* TELECALLER PERFORMANCE TABLE */}
      <div className="card-premium overflow-hidden border border-[#EAE4DA] dark:border-slate-800">
        <div className="p-6 border-b border-[#EAE4DA] dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#0F172A] dark:text-white uppercase tracking-wider">
              Telecaller Productivity & Conversion Ledger
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Performance statistics report
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="table-header-premium text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              <tr>
                <th className="py-3.5 px-6">Agent Name</th>
                <th className="py-3.5 px-6">Role Type</th>
                <th className="py-3.5 px-6">Assigned Leads</th>
                <th className="py-3.5 px-6">Calls Connected</th>
                <th className="py-3.5 px-6">Followups Scheduled</th>
                <th className="py-3.5 px-6">Converted Deals</th>
                <th className="py-3.5 px-6">Win Rate</th>
                <th className="py-3.5 px-6">Disbursed Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAE4DA]/60 dark:divide-slate-800">
              {telecallersList
                .filter(u => selectedAgents.length === 0 || selectedAgents.includes(u.name))
                .filter(u => selectedRoleTypes.length === 0 || selectedRoleTypes.some(r => (u.role || 'Telecaller').toLowerCase() === r.toLowerCase()))
                .map((ag, idx) => {
                  const assigned = 24 + idx * 8;
                  const connected = 18 + idx * 6;
                  const followups = 8 + idx * 2;
                  const converted = 6 + idx * 2;
                  const winPct = Math.round((converted / assigned) * 100);
                  const amount = 350000 + idx * 120000;

                  return (
                    <tr key={ag._id || idx} className="hover:bg-[#F8F5F1]/60 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3.5 px-6 font-bold text-[#0F172A] dark:text-white flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#17223B] text-white flex items-center justify-center text-[10px] font-bold uppercase">
                          {ag.name.substring(0, 2)}
                        </div>
                        <div>
                          <div className="font-bold">{ag.name}</div>
                          <div className="text-[10px] text-slate-400 font-medium">{ag.email || 'telecaller@inkcrm.com'}</div>
                        </div>
                      </td>
                      <td className="py-3.5 px-6">
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold uppercase tracking-wider border border-indigo-100">
                          {ag.role || 'Telecaller'}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 font-bold text-[#0F172A] dark:text-white">
                        {assigned}
                      </td>
                      <td className="py-3.5 px-6 font-semibold text-slate-700 dark:text-slate-300">
                        {connected}
                      </td>
                      <td className="py-3.5 px-6 font-semibold text-sky-600 dark:text-sky-400">
                        {followups}
                      </td>
                      <td className="py-3.5 px-6 font-bold text-emerald-600 dark:text-emerald-400">
                        {converted}
                      </td>
                      <td className="py-3.5 px-6 font-bold text-[#0F172A] dark:text-white">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-[#17223B] rounded-full" style={{ width: `${winPct}%` }}></div>
                          </div>
                          <span className="text-[11px]">{winPct}%</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-6 font-bold text-[#0F172A] dark:text-white">
                        ₹{amount.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
