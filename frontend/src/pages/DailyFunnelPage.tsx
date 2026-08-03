import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as Icons from 'lucide-react';
import api from '../services/api';
import { useToastStore } from '../store/toastStore';
import { exportLeadReportXLSX } from '../utils/exportLeadReportXLSX';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

const STATUS_COLORS: Record<string, string> = {
  'Hot': '#EF4444',
  'Warm': '#F59E0B',
  'Not Connected': '#0EA5E9',
  'Invalid Number': '#F43F5E',
  'Not Required': '#8B5CF6',
  'New': '#6366F1',
  'Approved': '#10B981',
  'Disbursed': '#059669',
  'Cedil Pending': '#EC4899',
  'Document Pending': '#14B8A6',
  'Approval Pending': '#F97316',
  'Rejected': '#DC2626',
  'Followup': '#3B82F6',
  'Dropped': '#E11D48',
  'Pending': '#EAB308',
};

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const YEARS = ['2024', '2025', '2026', '2027'];

export default function DailyFunnelPage() {
  const [searchParams] = useSearchParams();
  const initialCamp = searchParams.get('campaign') || 'ALL';

  const { showToast } = useToastStore();
  const [loading, setLoading] = useState(false);

  // Filter States
  const [selectedDay, setSelectedDay] = useState<string>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<string>('July');
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [selectedCampaign, setSelectedCampaign] = useState<string>(initialCamp);
  const [selectedAgent, setSelectedAgent] = useState<string>('ALL');

  // Raw Data
  const [leads, setLeads] = useState<any[]>([]);
  const [campaignsList, setCampaignsList] = useState<string[]>([]);
  const [agentsList, setAgentsList] = useState<any[]>([]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [leadsRes, campRes, usersRes] = await Promise.all([
        api.get('/records/leads?limit=2000').catch(() => ({ data: { records: [] } })),
        api.get('/records/campaigns?limit=1000').catch(() => ({ data: { records: [] } })),
        api.get('/auth/users').catch(() => ({ data: [] }))
      ]);

      const fetchedLeads = leadsRes.data?.records || leadsRes.data || [];
      const fetchedCampaigns = (campRes.data?.records || []).map((c: any) => c.data?.campaignName || c.name).filter(Boolean);
      const fetchedUsers = Array.isArray(usersRes.data) ? usersRes.data : usersRes.data?.users || [];

      setLeads(fetchedLeads);
      setCampaignsList(Array.from(new Set(fetchedCampaigns)));
      setAgentsList(fetchedUsers);
    } catch (err) {
      console.error(err);
      showToast('Failed to load daily funnel data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Filter leads by Day of Week, Month, Year, Campaign, Agent
  const filteredLeads = leads.filter(item => {
    const data = item.data || {};

    const rawDate = item.createdAt || data.createdAt || data.date;
    if (rawDate) {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        const itemYear = String(d.getFullYear());
        const itemMonth = MONTHS[d.getMonth()];

        // 0=Sun, 1=Mon, ..., 6=Sat
        const dayIdx = d.getDay();
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const itemDayName = dayNames[dayIdx];

        if (selectedYear && selectedYear !== 'ALL' && itemYear !== selectedYear) return false;
        if (selectedMonth && selectedMonth !== 'ALL' && itemMonth !== selectedMonth) return false;
        if (selectedDay && selectedDay !== 'ALL' && itemDayName.toLowerCase() !== selectedDay.toLowerCase()) return false;
      }
    }

    if (selectedCampaign !== 'ALL') {
      const itemCamp = data.campaign || data.campaignName || item.campaignName || '';
      if (itemCamp.toLowerCase() !== selectedCampaign.toLowerCase()) return false;
    }

    if (selectedAgent !== 'ALL') {
      const agentId = item.assignedTo?._id || item.assignedTo;
      const agentName = item.assignedTo?.name || data.telecaller || data.assignedAgent || '';
      if (agentId !== selectedAgent && agentName !== selectedAgent) return false;
    }

    return true;
  });

  // Calculate day of week progression data (Mon-Sun)
  const dayOfWeekCounts: Record<string, { total: number; hot: number; warm: number; converted: number }> = {
    'Monday': { total: 0, hot: 0, warm: 0, converted: 0 },
    'Tuesday': { total: 0, hot: 0, warm: 0, converted: 0 },
    'Wednesday': { total: 0, hot: 0, warm: 0, converted: 0 },
    'Thursday': { total: 0, hot: 0, warm: 0, converted: 0 },
    'Friday': { total: 0, hot: 0, warm: 0, converted: 0 },
    'Saturday': { total: 0, hot: 0, warm: 0, converted: 0 },
    'Sunday': { total: 0, hot: 0, warm: 0, converted: 0 },
  };

  const statusCounts: Record<string, number> = {};

  filteredLeads.forEach(item => {
    const data = item.data || {};
    const status = data.status || 'New';
    statusCounts[status] = (statusCounts[status] || 0) + 1;

    const rawDate = item.createdAt || data.createdAt || data.date;
    if (rawDate) {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayName = dayNames[d.getDay()];
        if (dayOfWeekCounts[dayName]) {
          dayOfWeekCounts[dayName].total += 1;

          const stLower = status.toLowerCase();
          if (stLower === 'hot') dayOfWeekCounts[dayName].hot += 1;
          if (stLower === 'warm') dayOfWeekCounts[dayName].warm += 1;
          if (stLower === 'approved' || stLower === 'disbursed') dayOfWeekCounts[dayName].converted += 1;
        }
      }
    }
  });

  const dailyBarChartData = DAYS_OF_WEEK.map(day => ({
    day,
    Total: dayOfWeekCounts[day].total,
    Hot: dayOfWeekCounts[day].hot,
    Warm: dayOfWeekCounts[day].warm,
    Converted: dayOfWeekCounts[day].converted,
  }));

  const pieChartData = Object.keys(statusCounts).map(st => ({
    name: st,
    value: statusCounts[st]
  }));

  const totalLeadsCount = filteredLeads.length;
  const convertedCount = (statusCounts['Approved'] || 0) + (statusCounts['Disbursed'] || 0);
  const conversionRate = totalLeadsCount > 0 ? Math.round((convertedCount / totalLeadsCount) * 100) : 0;

  // Find Peak Day
  let peakDay = 'Monday';
  let maxCount = -1;
  DAYS_OF_WEEK.forEach(day => {
    if (dayOfWeekCounts[day].total > maxCount) {
      maxCount = dayOfWeekCounts[day].total;
      peakDay = day;
    }
  });

  const handleExportCSV = () => {
    if (filteredLeads.length === 0) {
      showToast('No data to export', 'info');
      return;
    }
    exportLeadReportXLSX(filteredLeads, `Daily_Funnel_${selectedDay}_${selectedMonth}_${selectedYear}`);
    showToast('Exported Daily Funnel report to Excel', 'success');
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6 bg-[#F8F5F1] min-h-screen border border-[#EAE4DA] rounded-3xl">
      {/* Header Banner */}
      <div className="bg-white border border-[#EAE4DA] p-6 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Icons.CalendarRange className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-[#0F172A] dark:text-white tracking-tight">
              Daily Lead Funnel Analytics
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            Analyze daily lead flow, day-of-week trends (Monday - Sunday), and conversion metrics.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="btn-secondary-premium h-11 px-5 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border border-[#EAE4DA] bg-[#F8F5F1] hover:bg-[#EAE4DA] transition-all cursor-pointer active:scale-95"
        >
          <Icons.Download className="w-4 h-4 text-[#17223B]" />
          Export 18-Col Excel Report
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-[#EAE4DA] p-5 rounded-2xl shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Day of Week */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Select Day
          </label>
          <select
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
            className="w-full h-10 px-3 bg-[#F8F5F1] border border-[#EAE4DA] rounded-xl text-xs font-bold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Days (Mon - Sun)</option>
            {DAYS_OF_WEEK.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* Month */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Select Month
          </label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full h-10 px-3 bg-[#F8F5F1] border border-[#EAE4DA] rounded-xl text-xs font-bold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Months</option>
            {MONTHS.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {/* Year */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Select Year
          </label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="w-full h-10 px-3 bg-[#F8F5F1] border border-[#EAE4DA] rounded-xl text-xs font-bold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Years</option>
            {YEARS.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* Campaign */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Filter Campaign
          </label>
          <select
            value={selectedCampaign}
            onChange={(e) => setSelectedCampaign(e.target.value)}
            className="w-full h-10 px-3 bg-[#F8F5F1] border border-[#EAE4DA] rounded-xl text-xs font-bold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Campaigns</option>
            {campaignsList.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Telecaller / Agent */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Filter Agent
          </label>
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="w-full h-10 px-3 bg-[#F8F5F1] border border-[#EAE4DA] rounded-xl text-xs font-bold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Telecallers</option>
            {agentsList.map(a => (
              <option key={a._id} value={a.name || a.email}>{a.name || a.email}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#EAE4DA] p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
            <Icons.CalendarRange className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Filtered Total Leads</p>
            <h3 className="text-2xl font-black text-[#0F172A] mt-0.5">{totalLeadsCount.toLocaleString()}</h3>
          </div>
        </div>

        <div className="bg-white border border-[#EAE4DA] p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
            <Icons.Award className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Peak Performance Day</p>
            <h3 className="text-xl font-black text-[#0F172A] mt-0.5">{peakDay} ({maxCount.toLocaleString()})</h3>
          </div>
        </div>

        <div className="bg-white border border-[#EAE4DA] p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
            <Icons.CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Converted (Approved)</p>
            <h3 className="text-2xl font-black text-[#0F172A] mt-0.5">{convertedCount.toLocaleString()}</h3>
          </div>
        </div>

        <div className="bg-white border border-[#EAE4DA] p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
            <Icons.TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Win Conversion Rate</p>
            <h3 className="text-2xl font-black text-[#0F172A] mt-0.5">{conversionRate}%</h3>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Day of Week Bar Chart */}
        <div className="lg:col-span-2 bg-white border border-[#EAE4DA] p-6 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#0F172A]">Day of Week Lead Distribution (Mon - Sun)</h3>
            <span className="text-xs font-semibold text-slate-400">Total vs Hot vs Converted</span>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyBarChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F172A', color: '#fff', borderRadius: '12px', border: 'none' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
                <Bar dataKey="Total" fill="#6366F1" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Hot" fill="#EF4444" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Converted" fill="#10B981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution Pie Chart */}
        <div className="bg-white border border-[#EAE4DA] p-6 rounded-2xl shadow-sm space-y-4">
          <h3 className="text-base font-bold text-[#0F172A]">Lead Status Breakdown</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F172A', color: '#fff', borderRadius: '12px', border: 'none' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 600 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Daily Lead List Table */}
      <div className="bg-white border border-[#EAE4DA] rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-[#EAE4DA] flex items-center justify-between">
          <h3 className="text-base font-bold text-[#0F172A]">Daily Lead Detailed Records ({filteredLeads.length})</h3>
          <span className="text-xs font-semibold text-slate-400">Filtered View</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 font-semibold">Loading daily lead records...</div>
        ) : filteredLeads.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-semibold">No lead records found for the selected day/filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8F5F1] text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-[#EAE4DA]">
                <tr>
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Customer Name</th>
                  <th className="py-3 px-4">Mobile</th>
                  <th className="py-3 px-4">Campaign</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Loan Product</th>
                  <th className="py-3 px-4">Assigned Telecaller</th>
                  <th className="py-3 px-4">Date / Day</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE4DA] font-semibold text-slate-700">
                {filteredLeads.slice(0, 100).map((lead: any, idx: number) => {
                  const data = lead.data || {};
                  const custName = `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.customerName || data.fullName || 'N/A';
                  const mobile = data.phone || data.mobile || 'N/A';
                  const camp = data.campaign || data.campaignName || lead.campaignName || 'N/A';
                  const status = data.status || 'New';
                  const loan = data.loanProduct || data.loanType || 'Salaried Personal Loan';
                  const agent = lead.assignedToUser ? `${lead.assignedToUser.firstName} ${lead.assignedToUser.lastName}` : (data.assignedTo?.name || data.telecaller || 'Unassigned');

                  const rawDate = lead.createdAt || data.createdAt;
                  const dateStr = rawDate ? new Date(rawDate).toLocaleString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  }) : 'N/A';

                  return (
                    <tr key={lead._id || idx} className="hover:bg-[#F8F5F1]/60 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-[#0F172A]">{custName}</td>
                      <td className="py-3 px-4">{mobile}</td>
                      <td className="py-3 px-4">{camp}</td>
                      <td className="py-3 px-4">
                        <span
                          className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase text-white tracking-wider"
                          style={{ backgroundColor: STATUS_COLORS[status] || '#64748b' }}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="py-3 px-4">{loan}</td>
                      <td className="py-3 px-4 font-bold">{agent}</td>
                      <td className="py-3 px-4 text-slate-500">{dateStr}</td>
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
