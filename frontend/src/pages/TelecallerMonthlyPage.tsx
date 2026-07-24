import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import { useToastStore } from '../store/toastStore';
import MultiSelectDropdown from '../components/MultiSelectDropdown';

export default function TelecallerMonthlyPage() {
  const { showToast } = useToastStore();
  const [selectedMonths, setSelectedMonths] = useState<string[]>(['July']);
  const [selectedYears, setSelectedYears] = useState<string[]>(['2026']);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const years = ['2024', '2025', '2026', '2027'];

  const handleFilterClick = () => {
    showToast('Applied monthly multi-select parameters.', 'info');
  };

  const monthlyAgents = [
    { rank: 1, name: 'Rajabaksh Ilyala', assigned: 45, calls: 38, converted: 12, target: 15, revenue: 1450000, status: 'Top Performer' },
    { rank: 2, name: 'Ayesha Khan', assigned: 38, calls: 31, converted: 9, target: 12, revenue: 980000, status: 'Target Met' },
    { rank: 3, name: 'Mohammed Sameer', assigned: 40, calls: 33, converted: 8, target: 12, revenue: 850000, status: 'On Track' },
    { rank: 4, name: 'Priya Sharma', assigned: 35, calls: 28, converted: 7, target: 10, revenue: 720000, status: 'On Track' },
    { rank: 5, name: 'Vikram Mehta', assigned: 30, calls: 22, converted: 5, target: 10, revenue: 510000, status: 'In Progress' }
  ];

  const exportCSV = () => {
    const headers = ['Rank', 'Telecaller Name', 'Assigned Leads', 'Calls Made', 'Disbursed Deals', 'Target', 'Revenue Achieved', 'Target Status'];
    const rows = monthlyAgents.map(a => [
      a.rank,
      a.name,
      a.assigned,
      a.calls,
      a.converted,
      a.target,
      `₹${a.revenue.toLocaleString('en-IN')}`,
      a.status
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Monthly_Telecaller_Summary.csv`);
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
            <Icons.Calendar className="w-6 h-6 text-[#17223B] dark:text-indigo-400" />
            Monthly Telecaller's Report
          </h1>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
            Monthly target tracking, telecaller performance matrix, and historical revenue trends.
          </p>
        </div>

        <button
          onClick={exportCSV}
          className="btn-secondary-premium h-11 px-5 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 self-start md:self-auto"
        >
          <Icons.Download className="w-4 h-4" />
          Export Summary
        </button>
      </div>

      {/* FILTER CONTROL CARD (With Multi-Select Checkboxes) */}
      <div className="card-premium p-6 relative overflow-visible border-2 border-[#17223B]/10 z-20">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#EAE4DA] dark:border-slate-800">
          <Icons.CalendarDays className="w-4 h-4 text-[#17223B] dark:text-indigo-400" />
          <h3 className="text-xs font-bold text-[#0F172A] dark:text-white uppercase tracking-wider">
            Monthly Performance Filters
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-xl">
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
        </div>

        {/* View Detail Report Action */}
        <div className="flex justify-start mt-6 pt-4 border-t border-[#EAE4DA] dark:border-slate-800">
          <button
            onClick={handleFilterClick}
            className="btn-primary-premium h-11 px-6 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(23,34,59,0.15)]"
          >
            <Icons.TrendingUp className="w-4 h-4" />
            View Detail Report
          </button>
        </div>
      </div>

      {/* MONTHLY AGENT RANKINGS TABLE */}
      <div className="card-premium overflow-hidden border border-[#EAE4DA] dark:border-slate-800">
        <div className="p-6 border-b border-[#EAE4DA] dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#0F172A] dark:text-white uppercase tracking-wider">
              Telecaller Monthly Ranking & Target Matrix
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Aggregated monthly statistics
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="table-header-premium text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              <tr>
                <th className="py-3.5 px-6">Rank</th>
                <th className="py-3.5 px-6">Telecaller Agent</th>
                <th className="py-3.5 px-6">Assigned Leads</th>
                <th className="py-3.5 px-6">Calls Made</th>
                <th className="py-3.5 px-6">Disbursed Deals</th>
                <th className="py-3.5 px-6">Target Progress</th>
                <th className="py-3.5 px-6">Total Disbursed Value</th>
                <th className="py-3.5 px-6">Status Badge</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAE4DA]/60 dark:divide-slate-800">
              {monthlyAgents.map((ag) => {
                const targetPct = Math.min(Math.round((ag.converted / ag.target) * 100), 100);

                return (
                  <tr key={ag.rank} className="hover:bg-[#F8F5F1]/60 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3.5 px-6 font-bold">
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-bold ${
                        ag.rank === 1
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : ag.rank === 2
                          ? 'bg-slate-200 text-slate-700'
                          : ag.rank === 3
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        #{ag.rank}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 font-bold text-[#0F172A] dark:text-white">
                      {ag.name}
                    </td>
                    <td className="py-3.5 px-6 font-bold text-slate-700 dark:text-slate-300">
                      {ag.assigned}
                    </td>
                    <td className="py-3.5 px-6 font-semibold text-slate-600 dark:text-slate-400">
                      {ag.calls}
                    </td>
                    <td className="py-3.5 px-6 font-bold text-emerald-600 dark:text-emerald-400">
                      {ag.converted} / {ag.target}
                    </td>
                    <td className="py-3.5 px-6">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${targetPct >= 80 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                            style={{ width: `${targetPct}%` }}
                          ></div>
                        </div>
                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">{targetPct}%</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-6 font-bold text-[#0F172A] dark:text-white">
                      ₹{ag.revenue.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-6">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        ag.status === 'Top Performer'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : ag.status === 'Target Met'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      }`}>
                        {ag.status}
                      </span>
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
