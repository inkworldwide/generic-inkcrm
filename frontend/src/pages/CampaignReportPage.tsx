import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import api from '../services/api';
import { useToastStore } from '../store/toastStore';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

interface CampaignStat {
  campaignName: string;
  totalAssigned: number;
  dialed: number;
  yetToDial: number;
  createdAt: string;
  hotCount: number;
  convertedCount: number;
  progressPct: number;
}

const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#0EA5E9', '#EC4899'];

export default function CampaignReportPage() {
  const { showToast } = useToastStore();
  const [loading, setLoading] = useState(true);
  const [campaignStats, setCampaignStats] = useState<CampaignStat[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('ALL');
  const [allLeads, setAllLeads] = useState<any[]>([]);

  useEffect(() => {
    fetchCampaignReportData();
  }, []);

  const fetchCampaignReportData = async () => {
    setLoading(true);
    try {
      const [leadsRes, campRes] = await Promise.all([
        api.get('/records/leads?limit=1000').catch(() => ({ data: { records: [] } })),
        api.get('/records/campaigns?limit=1000').catch(() => ({ data: { records: [] } }))
      ]);

      const leadsList = leadsRes.data?.records || leadsRes.data || [];
      const campaignsList = campRes.data?.records || [];
      setAllLeads(leadsList);

      // Group leads by campaign name
      const campaignMap: Record<string, { total: number; dialed: number; yetToDial: number; createdAt: string; hot: number; converted: number }> = {};

      // Seed from campaigns master if available
      campaignsList.forEach((c: any) => {
        const name = c.data?.campaignName || c.name || 'Default Campaign';
        campaignMap[name] = {
          total: 0,
          dialed: 0,
          yetToDial: 0,
          createdAt: c.createdAt || new Date().toISOString(),
          hot: 0,
          converted: 0
        };
      });

      // Aggregate lead records
      leadsList.forEach((lead: any) => {
        const cName = lead.data?.campaign || lead.data?.campaignName || lead.campaignName || 'General Drive';
        if (!campaignMap[cName]) {
          campaignMap[cName] = {
            total: 0,
            dialed: 0,
            yetToDial: 0,
            createdAt: lead.createdAt || new Date().toISOString(),
            hot: 0,
            converted: 0
          };
        }

        campaignMap[cName].total += 1;
        const status = (lead.data?.status || lead.status || '').toLowerCase();
        
        if (status && !['new', 'yet to call', 'unassigned', ''].includes(status)) {
          campaignMap[cName].dialed += 1;
        } else {
          campaignMap[cName].yetToDial += 1;
        }

        if (status.includes('hot') || status.includes('warm')) {
          campaignMap[cName].hot += 1;
        }

        if (status.includes('approved') || status.includes('disbursed')) {
          campaignMap[cName].converted += 1;
        }
      });

      const statsArray: CampaignStat[] = Object.entries(campaignMap).map(([name, data]) => {
        const progressPct = data.total > 0 ? Math.round((data.dialed / data.total) * 100) : 0;
        return {
          campaignName: name,
          totalAssigned: data.total,
          dialed: data.dialed,
          yetToDial: data.yetToDial,
          createdAt: data.createdAt,
          hotCount: data.hot,
          convertedCount: data.converted,
          progressPct
        };
      });

      setCampaignStats(statsArray);
    } catch (err) {
      console.error(err);
      showToast('Failed to load campaign report data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredStats = selectedCampaign === 'ALL'
    ? campaignStats
    : campaignStats.filter(c => c.campaignName.toLowerCase() === selectedCampaign.toLowerCase());

  const totalAssignedLeads = filteredStats.reduce((sum, c) => sum + c.totalAssigned, 0);
  const totalDialedLeads = filteredStats.reduce((sum, c) => sum + c.dialed, 0);
  const totalYetToDialLeads = filteredStats.reduce((sum, c) => sum + c.yetToDial, 0);
  const totalConvertedLeads = filteredStats.reduce((sum, c) => sum + c.convertedCount, 0);
  const overallProgressPct = totalAssignedLeads > 0 ? Math.round((totalDialedLeads / totalAssignedLeads) * 100) : 0;

  // Bar chart data for campaign progress comparison
  const barChartData = filteredStats.map(c => ({
    name: c.campaignName.length > 15 ? c.campaignName.substring(0, 15) + '...' : c.campaignName,
    Dialed: c.dialed,
    'Yet to Dial': c.yetToDial,
    Converted: c.convertedCount
  }));

  // Export CSV
  const handleExportCSV = () => {
    if (filteredStats.length === 0) return;
    const headers = ['Campaign Name', 'Total Leads', 'Dialed', 'Yet to Dial', 'Progress %', 'Hot/Warm Leads', 'Converted'];
    const rows = filteredStats.map(c => [
      c.campaignName,
      c.totalAssigned,
      c.dialed,
      c.yetToDial,
      `${c.progressPct}%`,
      c.hotCount,
      c.convertedCount
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.map(cell => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Campaign_Analytics_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported campaign analytics report to CSV', 'success');
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-orange-50 border border-orange-100 text-orange-600 rounded-2xl flex-shrink-0">
            <Icons.Megaphone className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold text-orange-600 bg-orange-50 border border-orange-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Reports & Analytics
              </span>
              <span className="text-xs font-semibold text-slate-400">
                Campaign Performance Dashboard
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
              My Campaign Report
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Real-time report mapping for all calling campaigns, telecaller dialing throughput, and conversion progress.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={fetchCampaignReportData}
            className="btn-secondary-premium flex items-center gap-2"
          >
            <Icons.RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button 
            onClick={handleExportCSV}
            className="btn-primary-premium flex items-center gap-2"
          >
            <Icons.Download className="w-3.5 h-3.5" /> Export Report CSV
          </button>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full max-w-md">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex-shrink-0">Select Campaign:</label>
          <select
            value={selectedCampaign}
            onChange={(e) => setSelectedCampaign(e.target.value)}
            className="input-premium w-full"
          >
            <option value="ALL">All Campaigns ({campaignStats.length})</option>
            {campaignStats.map(c => (
              <option key={c.campaignName} value={c.campaignName}>{c.campaignName}</option>
            ))}
          </select>
        </div>

        <div className="text-xs font-bold text-slate-400">
          Showing <span className="text-slate-900">{filteredStats.length}</span> of {campaignStats.length} Campaigns
        </div>
      </div>

      {/* Analytics KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Campaign Leads</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{totalAssignedLeads}</h3>
            <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded mt-1 inline-block">
              {filteredStats.length} Active Campaigns
            </span>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Icons.Target className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Dialed Calls</p>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">{totalDialedLeads}</h3>
            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded mt-1 inline-block">
              {overallProgressPct}% Completion
            </span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Icons.PhoneCall className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Yet To Dial</p>
            <h3 className="text-2xl font-black text-amber-600 mt-1">{totalYetToDialLeads}</h3>
            <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded mt-1 inline-block">
              Pending Telecalling
            </span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Icons.Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Campaign Conversions</p>
            <h3 className="text-2xl font-black text-indigo-600 mt-1">{totalConvertedLeads}</h3>
            <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded mt-1 inline-block">
              Approved / Disbursed
            </span>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Icons.Award className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Visual Chart */}
      <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 uppercase tracking-tight">
              Campaign Calling & Conversion Throughput Chart
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Dialed vs Yet-To-Dial leads across campaigns
            </p>
          </div>
          <span className="px-2.5 py-1 text-xs font-extrabold text-orange-700 bg-orange-50 border border-orange-100 rounded-full">
            {barChartData.length} Campaigns
          </span>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barChartData} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700, fill: '#475569' }} />
              <YAxis tick={{ fontSize: 10, fontWeight: 700, fill: '#64748B' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1E293B', color: '#FFF', borderRadius: '12px', fontSize: '12px', border: 'none' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
              <Bar dataKey="Dialed" fill="#10B981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Yet to Dial" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Converted" fill="#6366F1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Campaign Performance Summary Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
        <h2 className="text-base font-extrabold text-slate-900 uppercase tracking-tight mb-4">
          Campaign Performance Report Table
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="table-header-premium">
                <th className="py-3 px-4">Campaign Name</th>
                <th className="py-3 px-4 text-center">Total Assigned Leads</th>
                <th className="py-3 px-4 text-center">Dialed Leads</th>
                <th className="py-3 px-4 text-center">Yet to Dial</th>
                <th className="py-3 px-4 text-center">Progress %</th>
                <th className="py-3 px-4 text-center">Hot / Warm Leads</th>
                <th className="py-3 px-4 text-center">Converted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150">
              {filteredStats.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-semibold">
                    No active campaign records found.
                  </td>
                </tr>
              ) : (
                filteredStats.map((row) => (
                  <tr key={row.campaignName} className="hover:bg-slate-50/60 transition-colors h-11">
                    <td className="px-4 py-2 font-bold text-slate-900 uppercase">
                      {row.campaignName}
                    </td>
                    <td className="px-4 py-2 text-center font-extrabold text-slate-850">
                      {row.totalAssigned}
                    </td>
                    <td className="px-4 py-2 text-center font-bold text-emerald-600">
                      {row.dialed}
                    </td>
                    <td className="px-4 py-2 text-center font-bold text-amber-600">
                      {row.yetToDial}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className="font-bold text-slate-800">{row.progressPct}%</span>
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${row.progressPct}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center font-bold text-rose-600">
                      {row.hotCount}
                    </td>
                    <td className="px-4 py-2 text-center font-bold text-indigo-600">
                      {row.convertedCount}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
