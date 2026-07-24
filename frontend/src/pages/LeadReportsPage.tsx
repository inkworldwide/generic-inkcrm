import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import api from '../services/api';
import { useToastStore } from '../store/toastStore';
import MultiSelectDropdown from '../components/MultiSelectDropdown';

export default function LeadReportsPage() {
  const { showToast } = useToastStore();
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);

  // Multi-Select Filter States with Checkboxes
  const [selectedMonths, setSelectedMonths] = useState<string[]>(['July']);
  const [selectedYears, setSelectedYears] = useState<string[]>(['2026']);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedLoanTypes, setSelectedLoanTypes] = useState<string[]>([]);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const years = ['2024', '2025', '2026', '2027'];
  
  const statusOptions = [
    'New', 'Hot', 'Warm', 'Cedil Pending', 'Document Pending',
    'Approval Pending', 'Approved', 'Disbursed', 'Rejected', 'Followup', 'Dropped', 'Pending'
  ];

  const loanTypes = [
    'Personal Loan', 'Business Loan', 'Home Loan', 'Education Loan',
    'Auto Loan', 'Gold Loan', 'Loan Against Property'
  ];

  useEffect(() => {
    fetchReportData();
  }, []);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/records/leads');
      const allRecords = res.data?.records || res.data || [];
      setLeads(allRecords);
    } catch (err) {
      console.error(err);
      showToast('Failed to load lead report data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterClick = () => {
    fetchReportData();
    showToast('Applied multi-select filter conditions.', 'info');
  };

  // Filter leads based on selected criteria
  const filteredLeads = leads.filter((item) => {
    const data = item.data || {};
    const statusMatch = selectedStatuses.length === 0 || selectedStatuses.some(s => (data.status || '').toLowerCase() === s.toLowerCase());
    const loanMatch = selectedLoanTypes.length === 0 || selectedLoanTypes.some(l => (data.loanType || data.serviceType || '').toLowerCase() === l.toLowerCase());
    return statusMatch && loanMatch;
  });

  const exportCSV = () => {
    if (filteredLeads.length === 0) return;
    const headers = ['Lead ID', 'Full Name', 'Phone', 'Email', 'Loan Type', 'Status', 'Amount', 'Assigned To'];
    const rows = filteredLeads.map(l => [
      l._id,
      l.data?.fullName || l.data?.name || 'N/A',
      l.data?.phone || 'N/A',
      l.data?.email || 'N/A',
      l.data?.loanType || 'Personal Loan',
      l.data?.status || 'New',
      l.data?.amount || 250000,
      l.assignedTo?.name || 'Unassigned'
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Lead_Report.csv`);
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
            <Icons.ListFilter className="w-6 h-6 text-[#17223B] dark:text-indigo-400" />
            Lead Reports
          </h1>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
            Filter, generate, and analyze lead distribution by month, year, status, and loan type.
          </p>
        </div>

        <button
          onClick={exportCSV}
          className="btn-secondary-premium h-11 px-5 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 self-start md:self-auto"
        >
          <Icons.Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* FILTER CONTROL CARD (With Multi-Select Checkboxes) */}
      <div className="card-premium p-6 relative overflow-visible border-2 border-[#17223B]/10 z-20">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#EAE4DA] dark:border-slate-800">
          <Icons.Filter className="w-4 h-4 text-[#17223B] dark:text-indigo-400" />
          <h3 className="text-xs font-bold text-[#0F172A] dark:text-white uppercase tracking-wider">
            Final Report Parameters
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

          {/* Lead Status */}
          <MultiSelectDropdown
            label="Lead Status"
            options={statusOptions}
            selectedValues={selectedStatuses}
            onChange={setSelectedStatuses}
            placeholder="-All Statuses-"
          />

          {/* Loan Type */}
          <MultiSelectDropdown
            label="Loan Type"
            options={loanTypes}
            selectedValues={selectedLoanTypes}
            onChange={setSelectedLoanTypes}
            placeholder="-All Loan Types-"
          />
        </div>

        {/* View Detail Report Action */}
        <div className="flex justify-end mt-6 pt-4 border-t border-[#EAE4DA] dark:border-slate-800">
          <button
            onClick={handleFilterClick}
            className="btn-primary-premium h-11 px-6 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(23,34,59,0.15)]"
          >
            <Icons.PieChart className="w-4 h-4" />
            View Detail Report
          </button>
        </div>
      </div>

      {/* DETAILED DATA TABLE */}
      <div className="card-premium overflow-hidden border border-[#EAE4DA] dark:border-slate-800">
        <div className="p-6 border-b border-[#EAE4DA] dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#0F172A] dark:text-white uppercase tracking-wider">
              Detailed Lead Audit Matrix
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Showing {filteredLeads.length} record entries
            </p>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading lead report data...</div>
        ) : filteredLeads.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 font-medium">
            No lead records found matching the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="table-header-premium text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="py-3.5 px-6">Lead ID</th>
                  <th className="py-3.5 px-6">Client Name</th>
                  <th className="py-3.5 px-6">Contact Info</th>
                  <th className="py-3.5 px-6">Loan Type</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6">Amount</th>
                  <th className="py-3.5 px-6">Period</th>
                  <th className="py-3.5 px-6">Assigned Agent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE4DA]/60 dark:divide-slate-800">
                {filteredLeads.map((item, idx) => {
                  const data = item.data || {};
                  const name = data.fullName || data.companyName || data.name || `Lead #${idx + 1}`;
                  const phone = data.phone || data.mobile || 'N/A';
                  const email = data.email || 'N/A';
                  const loanType = data.loanType || data.serviceType || 'Personal Loan';
                  const status = data.status || 'New';
                  const amount = data.amount || data.loanAmount || 250000;
                  const agent = item.assignedTo?.name || data.telecaller || 'Rajabaksh Ilyala';

                  return (
                    <tr key={item._id || idx} className="hover:bg-[#F8F5F1]/60 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3.5 px-6 font-mono text-[11px] text-slate-500 font-bold">
                        #{item._id ? item._id.substring(item._id.length - 6).toUpperCase() : `LD-100${idx}`}
                      </td>
                      <td className="py-3.5 px-6 font-bold text-[#0F172A] dark:text-white">
                        {name}
                      </td>
                      <td className="py-3.5 px-6">
                        <div className="font-semibold text-slate-700 dark:text-slate-300">{phone}</div>
                        <div className="text-[10px] text-slate-400">{email}</div>
                      </td>
                      <td className="py-3.5 px-6 font-medium text-slate-600 dark:text-slate-300">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold">
                          {loanType}
                        </span>
                      </td>
                      <td className="py-3.5 px-6">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          status.toLowerCase() === 'disbursed' || status.toLowerCase() === 'approved'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : status.toLowerCase() === 'hot'
                            ? 'bg-orange-50 text-orange-700 border-orange-200'
                            : status.toLowerCase() === 'followup'
                            ? 'bg-sky-50 text-sky-700 border-sky-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {status}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 font-bold text-[#0F172A] dark:text-white">
                        ₹{Number(amount).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-6 font-medium text-slate-500 text-[11px]">
                        July 2026
                      </td>
                      <td className="py-3.5 px-6 font-semibold text-slate-700 dark:text-slate-300">
                        {agent}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
