import React, { useEffect, useState, useRef } from 'react';
import * as Icons from 'lucide-react';
import api, { FILE_BASE_URL } from '../services/api';
import { useThemeStore } from '../store/themeStore';
import { Link } from 'react-router-dom';
import { DynamicIcon } from '../components/Layout';
import { useQuery } from '@tanstack/react-query';
import { formatDate } from '../utils/dateFormatter';
import { useToastStore } from '../store/toastStore';

const FUNNEL_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#f97316', '#8b5cf6'];
const STAGE_COLORS = ['#818cf8', '#34d399', '#fbbf24', '#fb923c', '#c084fc'];

export default function Dashboard() {
  const { showToast } = useToastStore();
  const { branding, fetchBranding } = useThemeStore();
  const [animate, setAnimate] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  // File upload and History timeline states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingRecordId, setUploadingRecordId] = useState<string | null>(null);
  const [activeHistoryRecord, setActiveHistoryRecord] = useState<any | null>(null);
  const [historyActivities, setHistoryActivities] = useState<any[]>([]);
  const [historyDocuments, setHistoryDocuments] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const handleUploadClick = (recordId: string) => {
    setUploadingRecordId(recordId);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingRecordId) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('recordId', uploadingRecordId);

    try {
      await api.post('/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      showToast('File uploaded successfully!', 'success');
    } catch (err) {
      showToast('Failed to upload file.', 'error');
    } finally {
      setUploadingRecordId(null);
    }
  };

  const openHistory = async (rec: any) => {
    setActiveHistoryRecord(rec);
    setLoadingHistory(true);
    try {
      const [activitiesRes, docsRes] = await Promise.all([
        api.get(`/records/leads/${rec._id}/activities`),
        api.get(`/documents`, { params: { recordId: rec._id } })
      ]);
      setHistoryActivities(activitiesRes.data);
      setHistoryDocuments(docsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Fetch live dashboard metrics from database with 5s polling intervals
  const { data: metricsData, isLoading, refetch } = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: async () => {
      const res = await api.get('/dashboard/metrics');
      return res.data;
    },
    refetchInterval: (query) => (query.state.error ? false : 5000)
  });

  useEffect(() => {
    // Trigger progress bar animations on load
    const timer = setTimeout(() => setAnimate(true), 150);
    return () => clearTimeout(timer);
  }, [metricsData]);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await api.get('/audit?limit=5');
        setNotifications(res.data);
      } catch (e) {
      }
    };
    fetchNotifications();
  }, []);

  const handleGlobalSearch = async (val: string) => {
    setSearchQuery(val);
    if (val.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await api.get(`/search?q=${val}`);
      const results = res.data;
      setSearchResults(results.filter((r: any) => r.records.length > 0));
    } catch (e) {
      console.error(e);
    }
  };

  const getStatusCount = (lbl: string) => {
    if (!metricsData?.statusCounts) return 0;
    let key = lbl.toUpperCase();
    if (key.endsWith(' LEADS')) {
      key = key.replace(' LEADS', '');
    }
    if (key === 'CEBIL PENDING') key = 'CEDIL PENDING';
    if (key === 'APPROVED BUT NOT DISBUSE') key = 'APPROVED';
    if (key === 'DISBUSED') key = 'DISBURSED';
    
    // Count today's followups separately
    if (key === "TODAY'S FOLLOWUPS") {
      return metricsData.todayFollowupsCount || 0;
    }
    return metricsData.statusCounts[key] || 0;
  };

  // Convert pipeline stage data to array
  const pipelineStages = [
    { name: 'Prospecting', val: metricsData?.pipelineData?.['Prospecting'] || 0, color: 'from-indigo-650 to-indigo-400', pct: '100%' },
    { name: 'Qualification', val: metricsData?.pipelineData?.['Qualification'] || 0, color: 'from-emerald-50 to-teal-400', pct: '71%' },
    { name: 'Proposal', val: metricsData?.pipelineData?.['Proposal'] || 0, color: 'from-amber-50 to-yellow-400', pct: '60%' },
    { name: 'Negotiation', val: metricsData?.pipelineData?.['Negotiation'] || 0, color: 'from-orange-50 to-rose-400', pct: '42%' },
    { name: 'Closed Won', val: metricsData?.pipelineData?.['Closed Won'] || 0, color: 'from-violet-60 to-fuchsia-500', pct: '27%' }
  ];

  const funnelData = [
    { stage: 'Prospecting', value: metricsData?.pipelineData?.['Prospecting'] || 0 },
    { stage: 'Qualification', value: metricsData?.pipelineData?.['Qualification'] || 0 },
    { stage: 'Proposal', value: metricsData?.pipelineData?.['Proposal'] || 0 },
    { stage: 'Negotiation', value: metricsData?.pipelineData?.['Negotiation'] || 0 },
    { stage: 'Closed Won', value: metricsData?.pipelineData?.['Closed Won'] || 0 }
  ].sort((a, b) => b.value - a.value);

  // Find max value in funnel to scale percentages
  const maxFunnelVal = Math.max(...funnelData.map(d => d.value), 1);

  const stagesOrder = ['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won'];
  
  const stageAccents: Record<string, string> = {
    'Negotiation': '#6366F1',
    'Proposal': '#10B981',
    'Closed Won': '#F59E0B',
    'Qualification': '#F97316',
    'Prospecting': '#8B5CF6'
  };

  const totalPipeline = Object.values(metricsData?.pipelineData || {}).reduce((a: any, b: any) => Number(a) + Number(b), 0) as number;
  const activeDeals = metricsData?.dealStatus?.open || 0;
  const avgDealSize = activeDeals > 0 ? Math.round(totalPipeline / activeDeals) : 0;

  const wonCount = metricsData?.dealStatus?.won || 0;
  const lostCount = metricsData?.dealStatus?.lost || 0;
  const totalClosed = wonCount + lostCount;
  const winRate = totalClosed > 0 ? Math.round((wonCount / totalClosed) * 100) : 24;

  const stageMeta: Record<string, { icon: React.ComponentType<any>; color: string; bg: string; text: string; dot: string; pillBg: string; pillText: string }> = {
    'Prospecting': { 
      icon: Icons.Send, 
      color: '#8B5CF6', 
      bg: 'rgba(139, 92, 246, 0.08)', 
      text: 'text-violet-650', 
      dot: 'bg-[#8B5CF6]',
      pillBg: 'bg-violet-50/80',
      pillText: 'text-violet-700'
    },
    'Qualification': { 
      icon: Icons.ClipboardList, 
      color: '#F97316', 
      bg: 'rgba(249, 115, 22, 0.08)', 
      text: 'text-orange-600', 
      dot: 'bg-[#F97316]',
      pillBg: 'bg-orange-50/80',
      pillText: 'text-orange-700'
    },
    'Proposal': { 
      icon: Icons.TrendingUp, 
      color: '#10B981', 
      bg: 'rgba(16, 185, 129, 0.08)', 
      text: 'text-emerald-600', 
      dot: 'bg-[#10B981]',
      pillBg: 'bg-emerald-50/80',
      pillText: 'text-emerald-700'
    },
    'Negotiation': { 
      icon: Icons.Handshake, 
      color: '#6366F1', 
      bg: 'rgba(99, 102, 241, 0.08)', 
      text: 'text-indigo-650', 
      dot: 'bg-[#6366F1]',
      pillBg: 'bg-indigo-50/80',
      pillText: 'text-indigo-700'
    },
    'Closed Won': { 
      icon: Icons.Trophy, 
      color: '#F59E0B', 
      bg: 'rgba(245, 158, 11, 0.08)', 
      text: 'text-amber-600', 
      dot: 'bg-[#F59E0B]',
      pillBg: 'bg-amber-50/80',
      pillText: 'text-amber-700'
    }
  };

  const getStageDealsCount = (stageName: string, val: number): number => {
    if (val === 0) return 0;
    if (stageName === 'Prospecting') return Math.max(1, Math.round(val / 50000));
    if (stageName === 'Qualification') return Math.max(1, Math.round(val / 30000));
    if (stageName === 'Proposal') return Math.max(1, Math.round(val / 30000));
    if (stageName === 'Negotiation') return Math.max(1, Math.round(val / 42857));
    if (stageName === 'Closed Won') return Math.max(1, Math.round(val / 30000));
    return Math.max(1, Math.round(val / 30000));
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 rounded animate-shimmer"></div>
        <div className="h-64 rounded-lg animate-shimmer"></div>
      </div>
    );
  }

  return (
    <div className="space-y-10 max-w-[1400px] mx-auto text-left px-4 md:px-8 py-6">
      
      {/* 1. TOP BAR SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between md:justify-end gap-5 pb-4 border-b border-slate-200/40">
        <div className="flex items-center justify-between md:justify-end gap-5 w-full md:w-auto relative">
          
          {/* Search Input bar */}
          <div className="relative flex-1 md:w-72">
            <Icons.Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleGlobalSearch(e.target.value)}
              placeholder="Search leads, deals, contacts..."
              className="w-full pl-10 pr-4 py-2 text-xs md:text-sm bg-white border border-slate-200 rounded-[16px] focus:outline-none focus:ring-4 focus:ring-slate-900/5 focus:border-slate-800 transition-all text-slate-700 shadow-[0_2px_8px_rgba(15,23,42,0.02)]"
            />
            {/* Search Results Dropdown */}
            {searchQuery && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 shadow-xl rounded-xl overflow-hidden max-h-80 overflow-y-auto z-50">
                {searchResults.length === 0 ? (
                  <div className="p-4 text-center text-sm text-slate-500">No records found.</div>
                ) : (
                  searchResults.map(({ module, records }) => (
                    <div key={module._id} className="border-b border-slate-100 last:border-0">
                      <div className="px-4 py-1.5 bg-slate-50 text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <DynamicIcon name={module.icon} className="w-3.5 h-3.5" />
                        {module.pluralLabel}
                      </div>
                      {records.map((rec: any) => (
                        <Link
                          key={rec._id}
                          to={`/modules/${module.apiPath}/${rec._id}`}
                          onClick={() => setSearchQuery('')}
                          className="block px-6 py-2 hover:bg-slate-50 text-sm transition-colors text-slate-700"
                        >
                          <span className="font-medium text-indigo-650">
                            {rec.data.fullName || rec.data.companyName || rec.data.dealName || rec.data.title || rec.data.firstName || rec._id}
                          </span>
                          {rec.data.email && <span className="text-slate-400 text-xs ml-3">({rec.data.email})</span>}
                        </Link>
                      ))}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Notification bell */}
          <div className="relative flex-shrink-0">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2.5 bg-white border border-slate-200/80 hover:bg-slate-50 text-slate-500 hover:text-slate-900 rounded-[14px] transition-all shadow-sm hover:shadow-md"
            >
              <Icons.Bell className="w-5 h-5 md:w-4 md:h-4" />
            </button>
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 border-2 border-white rounded-full animate-pulse"></span>
            
            {showNotifications && (
              <div className="absolute right-0 mt-3 w-80 bg-white border border-slate-200 shadow-xl rounded-xl overflow-hidden z-50">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">System Activity</span>
                  <button onClick={() => setNotifications([])} className="text-[10px] text-rose-500 hover:underline">Clear</button>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">No activity logs.</div>
                  ) : (
                    notifications.map((n) => (
                      <div key={n._id} className="p-3 hover:bg-slate-50 transition-colors text-xs text-left">
                        <p className="text-slate-700">
                          <span className="font-semibold">{n.userId?.firstName || 'System'}</span> triggered a {n.type || n.action} event.
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">{new Date(n.createdAt).toLocaleTimeString()}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="w-10 h-10 md:w-9 md:h-9 rounded-full bg-slate-900 text-white font-bold text-sm flex items-center justify-center shadow-md flex-shrink-0">
            AK
          </div>
        </div>
      </div>

      {/* 2. DASHBOARD HEADER & PREMIUM METRIC CARDS */}
      <div className="text-left space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-[850] tracking-tight text-slate-800 font-sans">Dashboard Overview</h1>
            <p className="text-xs font-semibold text-slate-400 mt-1">Welcome back. Here is today's business summary.</p>
          </div>
          <Link 
            to="/modules/leads/new" 
            className="flex items-center gap-2 px-5 h-[44px] text-xs font-bold uppercase tracking-wider bg-slate-900 hover:bg-slate-800 text-white rounded-[14px] transition-all shadow-[0_4px_12px_rgba(15,23,42,0.1)] hover:shadow-[0_8px_20px_rgba(15,23,42,0.2)] hover:-translate-y-0.5 active:scale-95 duration-200 w-full sm:w-auto justify-center"
          >
            <Icons.Plus className="w-4 h-4" />
            Add Lead
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[
            { label: 'NEW LEADS', accentColor: '#3B82F6', icon: Icons.Sparkles, sub: '▲ +8% This Month', bg: '#EFF6FF', border: 'border-blue-100/50' },
            { label: 'HOT LEADS', accentColor: '#EA580C', icon: Icons.Flame, sub: '🔥 Updated Today', bg: '#FFF7ED', border: 'border-orange-100/50' },
            { label: 'WARM LEADS', accentColor: '#D97706', icon: Icons.Sun, sub: '☀ Active Follow-ups', bg: '#FEF3C7', border: 'border-amber-100/50' },
            { label: 'CEBIL PENDING', accentColor: '#64748B', icon: Icons.FileWarning, sub: '⏳ Awaiting verification', bg: '#F8FAFC', border: 'border-slate-100/50' },
            { label: 'DOCUMENT PENDING', accentColor: '#64748B', icon: Icons.FileText, sub: '📄 Files required', bg: '#F8FAFC', border: 'border-slate-100/50' },
            { label: 'APPROVAL PENDING', accentColor: '#EA580C', icon: Icons.Clock, sub: '⏳ Under review', bg: '#FFF7ED', border: 'border-orange-100/50' },
            { label: 'APPROVED BUT NOT DISBUSE', accentColor: '#16A34A', icon: Icons.CheckCircle, sub: '✔ Ready for disbursement', bg: '#F0FDF4', border: 'border-green-100/50' },
            { label: 'DISBUSED', accentColor: '#15803D', icon: Icons.Banknote, sub: '💰 Funds released', bg: '#F0FDF4', border: 'border-green-100/50' },
            { label: 'REJECTED', accentColor: '#DC2626', icon: Icons.XOctagon, sub: '✕ Closed', bg: '#FEF2F2', border: 'border-red-100/50' },
            { label: 'FOLLOWUP', accentColor: '#0284C7', icon: Icons.PhoneCall, sub: '📞 Call scheduled', bg: '#F0F9FF', border: 'border-sky-100/50' },
            { label: 'DROPPED', accentColor: '#64748B', icon: Icons.ArrowDownCircle, sub: '✕ Inactive', bg: '#F8FAFC', border: 'border-slate-100/50' },
            { label: 'PENDING', accentColor: '#D97706', icon: Icons.Hourglass, sub: '⏳ Pending action', bg: '#FEF3C7', border: 'border-yellow-100/50' },
            { label: "TODAY'S FOLLOWUPS", accentColor: '#0891B2', icon: Icons.CalendarClock, sub: '📅 Action required today', bg: '#ECFEFF', border: 'border-cyan-100/50' },
          ].map((metric, idx) => {
            const Icon = metric.icon;
            const count = getStatusCount(metric.label);
            const statusMap: Record<string, string> = {
              'NEW LEADS': 'New',
              'HOT LEADS': 'Hot',
              'WARM LEADS': 'Warm',
              'CEBIL PENDING': 'Cedil Pending',
              'DOCUMENT PENDING': 'Document Pending',
              'APPROVAL PENDING': 'Approval Pending',
              'APPROVED BUT NOT DISBUSE': 'Approved',
              'DISBUSED': 'Disbursed',
              'REJECTED': 'Rejected',
              'FOLLOWUP': 'Followup',
              'DROPPED': 'Dropped',
              'PENDING': 'Pending',
              "TODAY'S FOLLOWUPS": 'Followup',
            };
            const filterStatus = statusMap[metric.label] || metric.label;
            return (
              <Link
                to={`/modules/leads?status=${encodeURIComponent(filterStatus)}`}
                key={idx} 
                className="group flex flex-col justify-between py-4 px-5 bg-white border border-[#EBE8E0]/60 rounded-2xl shadow-[0_2px_6px_rgba(0,0,0,0.01)] hover:shadow-[0_12px_24px_rgba(0,0,0,0.03)] hover:-translate-y-0.5 transition-all duration-250 ease-out cursor-pointer relative overflow-hidden"
              >
                {/* Top Label & Icon */}
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">
                    {metric.label.toLowerCase().replace("but not disbuse", "")}
                  </span>
                  <div 
                    className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 group-hover:text-indigo-600 group-hover:bg-indigo-50/50 group-hover:border-indigo-150/50 transition-all duration-250"
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                </div>

                {/* Counter */}
                <div className="my-2">
                  <h3 className="text-3xl font-[850] text-[#18181b] tracking-tight leading-none">
                    {count}
                  </h3>
                </div>

                {/* Subtext */}
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-semibold text-slate-400">
                    {metric.sub}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* 3. MIDDLE ROW: Pipeline by Stage + Deal Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Pipeline by Stage */}
        <div className="bg-white border border-[#EBE8E0]/60 rounded-2xl p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.015),0_1px_3px_rgb(0,0,0,0.01)] flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#FAF8F3] border border-[#E5E2D9] rounded-xl">
                  <Icons.BarChart3 className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-sm font-[800] text-slate-800 tracking-tight">Pipeline by Stage</h3>
                  <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Monthly revenue progression</p>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              {pipelineStages.map((stage, idx) => (
                <div key={idx} className="group">
                  <div className="flex justify-between text-xs font-semibold text-slate-650 mb-2 group-hover:text-[#0f172a] transition-colors">
                    <span>{stage.name}</span>
                    <span className="font-bold text-slate-800">${Number(stage.val).toLocaleString()}</span>
                  </div>
                  <div className="w-full h-3 bg-slate-50 border border-slate-100 rounded-full overflow-hidden shadow-inner">
                    <div 
                      style={{ 
                        width: animate ? stage.pct : '0%', 
                        backgroundColor: STAGE_COLORS[idx % STAGE_COLORS.length],
                        transition: `width 1.2s cubic-bezier(0.4, 0, 0.2, 1) ${idx * 0.1}s` 
                      }}
                      className="h-full rounded-full"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Deal Status Grid */}
        <div className="bg-white border border-[#EBE8E0]/60 rounded-2xl p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.015),0_1px_3px_rgb(0,0,0,0.01)] flex flex-col">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#FAF8F3] border border-[#E5E2D9] rounded-xl">
                <Icons.Target className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-sm font-[800] text-slate-800 tracking-tight">Deal Status</h3>
                <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Deals closing performance</p>
              </div>
            </div>
            <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 shadow-sm uppercase tracking-wider">This Month</span>
          </div>
          <div className="grid grid-cols-2 gap-5 flex-1">
            {[
              { label: 'Open Deals', value: metricsData?.dealStatus?.open || 0, sub: 'Active negotiations', icon: Icons.FolderOpen, color: 'text-indigo-650', bg: 'bg-indigo-50/40', border: 'border-indigo-100/40' },
              { label: 'Won Deals', value: metricsData?.dealStatus?.won || 0, sub: 'Successfully closed', icon: Icons.Trophy, color: 'text-emerald-600', bg: 'bg-emerald-50/40', border: 'border-emerald-100/40' },
              { label: 'Lost Deals', value: metricsData?.dealStatus?.lost || 0, sub: 'Unsuccessful', icon: Icons.XOctagon, color: 'text-rose-600', bg: 'bg-rose-50/40', border: 'border-rose-100/40' },
              { label: 'Pending Deals', value: metricsData?.dealStatus?.pending || 0, sub: 'Awaiting signature', icon: Icons.Clock, color: 'text-amber-500', bg: 'bg-amber-50/40', border: 'border-amber-100/40' }
            ].map((box, index) => {
              const BoxIcon = box.icon;
              return (
                <div key={index} className="p-5 bg-white border border-[#EBE8E0]/60 rounded-2xl text-left flex flex-col justify-between hover:shadow-[0_8px_20px_rgba(0,0,0,0.02)] hover:-translate-y-0.5 transition-all duration-200 cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
                  <div className="flex justify-between items-start">
                    <div className={`p-2 bg-slate-50 border border-slate-100 rounded-xl ${box.color}`}>
                      <BoxIcon className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-[800] text-slate-400 uppercase tracking-wider">{box.label}</span>
                  </div>
                  <div>
                    <h4 className="text-2xl font-[850] text-slate-800 tracking-tight mt-3">
                      {box.value}
                    </h4>
                    <p className="text-[9px] font-semibold text-slate-400 mt-1">{box.sub}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* 4. TODAY'S FOLLOWUP LEADS DETAILS */}
      <div className="bg-white border border-[#EBE8E0]/60 rounded-2xl p-0 overflow-hidden text-left shadow-[0_8px_30px_rgb(0,0,0,0.015),0_1px_3px_rgb(0,0,0,0.01)]">
        <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/40">
          <h2 className="text-xs font-[800] text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Icons.CalendarClock className="w-4 h-4 text-slate-800" />
            {metricsData?.isUpcoming ? "Upcoming Followup Leads" : "Today's Followup Leads"}
          </h2>
        </div>
        
        <div className="p-8 space-y-6">
          {!metricsData?.todayFollowupsList || metricsData.todayFollowupsList.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-4 shadow-inner">
                <Icons.CheckCircle2 className="w-8 h-8 text-slate-350" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700">
                {metricsData?.isUpcoming ? "No upcoming follow-ups scheduled." : "No follow-ups scheduled today."}
              </h3>
              <p className="text-xs text-slate-400 mt-1">Enjoy your day.</p>
            </div>
          ) : (
            metricsData.todayFollowupsList.map((rec: any, idx: number) => {
              const leadNo = rec._id.slice(-6).toUpperCase();
              return (
                <div key={rec._id} className="border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 bg-white dark:bg-slate-800 relative mb-6 last:mb-0 text-left shadow-sm">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-green-500 rounded-t-2xl" />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-y-6 gap-x-8 text-sm mt-2">
                    {/* Column 1 */}
                    <div className="space-y-4">
                      <div><span className="font-bold text-slate-700 dark:text-slate-350">Sl No.:</span> <span className="text-slate-600 dark:text-slate-400">{idx + 1}</span></div>
                      <div><span className="font-bold text-slate-700 dark:text-slate-350">Lead No.:</span> <span className="text-slate-600 dark:text-slate-400">LND-{leadNo}</span></div>
                      <div><span className="font-bold text-slate-700 dark:text-slate-350">Product:</span> <span className="text-slate-600 dark:text-slate-400">{rec.data?.loanType || 'N/A'}</span></div>
                      <div><span className="font-bold text-slate-700 dark:text-slate-350">Status:</span> <span className="text-slate-600 dark:text-slate-400 uppercase">{rec.data?.status || 'New'}</span></div>
                      <div><span className="font-bold text-slate-700 dark:text-slate-350">Bank Partner:</span> <span className="text-slate-600 dark:text-slate-400">{rec.data?.businessPartner || 'N/A'}</span></div>
                    </div>

                    {/* Column 2 */}
                    <div className="space-y-4">
                      <div><span className="font-bold text-slate-700 dark:text-slate-350">Lead Name:</span> <span className="text-slate-600 dark:text-slate-400">{rec.data?.firstName} {rec.data?.lastName}</span></div>
                      <div><span className="font-bold text-slate-700 dark:text-slate-350">Location:</span> <span className="text-slate-600 dark:text-slate-400">{rec.data?.location || 'N/A'}</span></div>
                      <div><span className="font-bold text-slate-700 dark:text-slate-350">Mobile No.:</span> <span className="text-slate-600 dark:text-slate-400">{rec.data?.phone || 'N/A'}</span></div>
                      <div><span className="font-bold text-slate-700 dark:text-slate-350">Amount:</span> <span className="text-slate-600 dark:text-slate-400">{rec.data?.budget ? '$' + Number(rec.data.budget).toLocaleString() : 'N/A'}</span></div>
                      <div><span className="font-bold text-slate-700 dark:text-slate-350">Case Details:</span> <span className="text-slate-600 dark:text-slate-400">{rec.data?.caseDetails || 'N/A'}</span></div>
                    </div>

                    {/* Column 3 */}
                    <div className="space-y-4">
                      <div><span className="font-bold text-slate-700 dark:text-slate-350">Created On:</span> <span className="text-slate-600 dark:text-slate-400">{formatDate(rec.createdAt)}</span></div>
                      <div><span className="font-bold text-slate-700 dark:text-slate-350">Followup Date:</span> <span className="text-indigo-650 font-bold bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100/50 px-2 py-0.5 rounded-lg text-xs">{rec.data?.followUpDate ? formatDate(rec.data.followUpDate) : 'N/A'}</span></div>
                      <div><span className="font-bold text-slate-700 dark:text-slate-350">Pending at:</span> <span className="text-slate-600 dark:text-slate-400">{rec.data?.assignToTeam || 'Sales Review'}</span></div>
                      <div><span className="font-bold text-slate-700 dark:text-slate-350">PSM:</span> <span className="text-slate-600 dark:text-slate-400">{rec.data?.assignedTo || 'Unassigned'}</span></div>
                      <div><span className="font-bold text-slate-700 dark:text-slate-350">Data Code:</span> <span className="text-slate-600 dark:text-slate-400">{rec.data?.dataCode || 'N/A'}</span></div>
                    </div>

                    {/* Column 4 */}
                    <div className="space-y-4">
                      <div><span className="font-bold text-slate-700 dark:text-slate-350">Firm/Company:</span> <span className="text-slate-600 dark:text-slate-400">{rec.data?.company || 'N/A'}</span></div>
                      <div><span className="font-bold text-slate-700 dark:text-slate-350">Modified On:</span> <span className="text-slate-600 dark:text-slate-400">{formatDate(rec.updatedAt)}</span></div>
                      <div><span className="font-bold text-slate-700 dark:text-slate-350">Assigned By:</span> <span className="text-slate-600 dark:text-slate-400">System Router</span></div>
                      <div>
                        <span className="font-bold text-slate-700 dark:text-slate-350">Remarks:</span> 
                        <span className="text-slate-500 italic ml-1 text-xs">{rec.data?.notes ? rec.data.notes.replace(/<[^>]*>/g, '') : 'Transferred to agent'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700">
                    <div className="mb-3 flex items-center gap-2">
                      <span className={`${
                        rec.data?.status?.toUpperCase() === 'HOT' 
                          ? 'bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30' 
                          : 'bg-indigo-50 border border-indigo-200 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30'
                      } text-[10px] font-[800] uppercase tracking-wider px-3 py-1.5 rounded-lg`}>
                        {rec.data?.status ? `${rec.data.status} Lead` : 'Lead Info'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button 
                        onClick={() => {
                          const phone = rec.data?.phone || rec.data?.mobile || rec.data?.contactNumber || '';
                          const cleanPhone = phone.replace(/\D/g, '');
                          if (cleanPhone) {
                            window.open(`https://wa.me/${cleanPhone}`, '_blank');
                          } else {
                            showToast('No phone number available for this lead.', 'warning');
                          }
                        }}
                        className="bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-150 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30 dark:hover:bg-emerald-900/40 text-[10px] font-bold uppercase tracking-wider px-4 py-2 rounded-lg transition-all duration-200"
                      >
                        WA Chat
                      </button>
                      
                      <button 
                        onClick={() => {
                          const phone = rec.data?.phone || rec.data?.mobile || rec.data?.contactNumber || '';
                          const cleanPhone = phone.replace(/\D/g, '');
                          if (cleanPhone) {
                            window.location.href = `tel:${cleanPhone}`;
                          } else {
                            showToast('No phone number available for this lead.', 'warning');
                          }
                        }}
                        className="bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-150 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30 dark:hover:bg-indigo-900/40 text-[10px] font-bold uppercase tracking-wider px-4 py-2 rounded-lg transition-all duration-200"
                      >
                        Call
                      </button>
                      
                      <button 
                        onClick={() => handleUploadClick(rec._id)}
                        className="bg-amber-50 hover:bg-amber-100 active:bg-amber-150 text-amber-700 border border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30 dark:hover:bg-amber-900/40 text-[10px] font-bold uppercase tracking-wider px-4 py-2 rounded-lg transition-all duration-200"
                      >
                        Upload File
                      </button>
                      
                      <Link to={`/modules/leads/${rec._id}`} className="bg-cyan-50 hover:bg-cyan-100 active:bg-cyan-150 text-cyan-700 border border-cyan-200 dark:bg-cyan-950/20 dark:text-cyan-400 dark:border-cyan-900/30 dark:hover:bg-cyan-900/40 text-[10px] font-bold uppercase tracking-wider px-4 py-2 rounded-lg transition-all duration-200">
                        Edit
                      </Link>

                      <button 
                        onClick={() => openHistory(rec)}
                        className="bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-600 border border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700/60 dark:hover:bg-slate-700/80 text-[10px] font-bold uppercase tracking-wider px-4 py-2 rounded-lg transition-all duration-200"
                      >
                        History
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 5. SALES PIPELINE FUNNEL */}
      <div className="bg-white border border-[#EBE8E0]/60 rounded-2xl p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.015),0_1px_3px_rgb(0,0,0,0.01)] text-left">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[12px] bg-indigo-50/80 border border-indigo-100/50 flex items-center justify-center flex-shrink-0">
              <Icons.PieChart className="w-5 h-5 text-indigo-650" />
            </div>
            <div>
              <h3 className="text-sm font-[800] text-slate-800 tracking-tight">Sales Pipeline Funnel</h3>
              <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Stage-by-stage conversion breakdown</p>
            </div>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-[12px] shadow-sm hover:bg-slate-50 transition-colors text-xs font-semibold text-slate-700">
            <Icons.Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>This Quarter</span>
            <Icons.ChevronDown className="w-3 h-3 text-slate-400 ml-1" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch bg-slate-50/50 p-6 md:p-8 rounded-2xl border border-[#EBE8E0]/60">
          {/* Left Column (65% width) */}
          <div className="md:col-span-8 flex flex-col justify-between gap-6 w-full">
            <div className="flex flex-col gap-2 w-full items-start">
              {stagesOrder.map((stageName, index) => {
                const val = metricsData?.pipelineData?.[stageName] || 0;
                const pct = Math.round((val / maxFunnelVal) * 100);
                const meta = stageMeta[stageName] || { 
                  icon: Icons.HelpCircle, 
                  color: '#64748B', 
                  bg: 'rgba(100, 116, 139, 0.08)', 
                  text: 'text-slate-600', 
                  dot: 'bg-slate-400',
                  pillBg: 'bg-slate-50',
                  pillText: 'text-slate-600'
                };
                const StageIcon = meta.icon;
                
                // Left-aligned widths: widest (top) to narrowest (bottom)
                const widthClass = [
                  'w-full',
                  'w-[94%]',
                  'w-[88%]',
                  'w-[82%]',
                  'w-[76%]'
                ][index] || 'w-full';

                const dealsCount = getStageDealsCount(stageName, val);

                return (
                  <div 
                    key={stageName}
                    className={`${widthClass} flex items-center justify-between py-2.5 px-4 bg-white/90 border border-slate-150 rounded-[20px] shadow-[0_4px_12px_rgba(15,23,42,0.015)] hover:shadow-[0_12px_24px_rgba(15,23,42,0.04)] hover:-translate-y-0.5 transition-all duration-300 ease-out relative overflow-hidden group`}
                  >
                    {/* Left accent line */}
                    <div 
                      className="absolute left-0 top-0 bottom-0 w-[4px]" 
                      style={{ backgroundColor: meta.color }}
                    />
                    
                    <div className="flex items-center gap-4 pl-2">
                      {/* Circular icon container */}
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-105"
                        style={{ backgroundColor: meta.bg }}
                      >
                        <StageIcon className="w-4 h-4" style={{ color: meta.color }} />
                      </div>
                      
                      {/* Info & Value */}
                      <div className="text-left">
                        <span className={`text-[10px] font-bold uppercase tracking-wider block ${meta.text}`}>{stageName}</span>
                        <div className="flex items-center gap-2.5 mt-0.5">
                          <span className="text-base font-bold text-slate-800 tracking-tight">${Number(val).toLocaleString()}</span>
                          <span className={`px-2.5 py-0.5 rounded-[10px] text-[9px] font-bold ${meta.pillBg} ${meta.pillText}`}>
                            {dealsCount} Deals
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Conversion Stats */}
                    <div className="text-right pr-3">
                      <span className="text-xs font-bold text-slate-800 block">{pct}%</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5">Conversion</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom mini KPI row */}
            <div className="w-full grid grid-cols-3 bg-white/90 border border-slate-150 rounded-[20px] p-4 shadow-[0_2px_8px_rgba(15,23,42,0.01)] items-center">
              <div className="flex items-center gap-3 pl-3">
                <div className="w-8 h-8 rounded-full bg-indigo-50/85 flex items-center justify-center">
                  <Icons.Percent className="w-3.5 h-3.5 text-indigo-655" />
                </div>
                <div className="text-left">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Win Rate</p>
                  <p className="text-sm font-bold text-slate-800 tracking-tight mt-0.5">{winRate}%</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 pl-3 border-l border-slate-100">
                <div className="w-8 h-8 rounded-full bg-emerald-50/85 flex items-center justify-center">
                  <Icons.Calendar className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div className="text-left">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Avg. Sales Cycle</p>
                  <p className="text-sm font-bold text-slate-800 tracking-tight mt-0.5">28 Days</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 pl-3 border-l border-slate-100">
                <div className="w-8 h-8 rounded-full bg-orange-50/85 flex items-center justify-center">
                  <Icons.Target className="w-3.5 h-3.5 text-orange-600" />
                </div>
                <div className="text-left">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Active Deals</p>
                  <p className="text-sm font-bold text-slate-800 tracking-tight mt-0.5">{activeDeals}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (35% width) */}
          <div className="md:col-span-4 flex flex-col gap-6">
            
            {/* Conversion Overview */}
            <div className="bg-white/90 border border-slate-150 p-6 rounded-[22px] shadow-[0_4px_12px_rgba(15,23,42,0.015)] text-left">
              <h4 className="text-[10px] font-[800] text-slate-400 uppercase tracking-wider mb-5">Conversion Overview</h4>
              <div className="space-y-4">
                {stagesOrder.map((stageName, idx) => {
                  const val = metricsData?.pipelineData?.[stageName] || 0;
                  const pct = Math.round((val / maxFunnelVal) * 100);
                  const meta = stageMeta[stageName] || { color: '#64748B' };
                  return (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: meta.color }} />
                          <span className="font-semibold text-slate-700">{stageName}</span>
                        </div>
                        <span className="font-bold text-slate-800">${Number(val).toLocaleString()}</span>
                      </div>
                      
                      {/* Progress bar line */}
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-slate-50 border border-slate-100 rounded-full overflow-hidden shadow-inner">
                          <div
                            style={{ 
                              width: animate ? `${pct}%` : '0%', 
                              backgroundColor: meta.color, 
                              transition: `width 1.2s cubic-bezier(0.4,0,0.2,1) ${idx * 0.08}s` 
                            }}
                            className="h-full rounded-full"
                          />
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 w-8 text-right">{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pipeline Summary */}
            <div className="bg-white border border-[#EBE8E0]/60 p-6 rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.01)] text-left">
              <h4 className="text-[10px] font-[800] text-slate-400 uppercase tracking-wider mb-5">Pipeline Summary</h4>
              <div className="grid grid-cols-2 gap-4">
                
                {/* Total Pipeline */}
                <div className="p-4 bg-[#FCFAF6] border border-[#EBE8E0]/60 rounded-xl flex items-center gap-3 shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
                  <div className="w-8 h-8 rounded-full bg-indigo-50/80 flex items-center justify-center flex-shrink-0">
                    <Icons.Briefcase className="w-3.5 h-3.5 text-indigo-650" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">${totalPipeline.toLocaleString()}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Total Pipeline</p>
                  </div>
                </div>

                {/* Total Stages */}
                <div className="p-4 bg-[#FCFAF6] border border-[#EBE8E0]/60 rounded-xl flex items-center gap-3 shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
                  <div className="w-8 h-8 rounded-full bg-emerald-50/80 flex items-center justify-center flex-shrink-0">
                    <Icons.Layers className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">5</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Total Stages</p>
                  </div>
                </div>

                {/* Active Deals */}
                <div className="p-4 bg-[#FCFAF6] border border-[#EBE8E0]/60 rounded-xl flex items-center gap-3 shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
                  <div className="w-8 h-8 rounded-full bg-orange-50/80 flex items-center justify-center flex-shrink-0">
                    <Icons.Users className="w-3.5 h-3.5 text-orange-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{activeDeals}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Active Deals</p>
                  </div>
                </div>

                {/* Avg. Deal Size */}
                <div className="p-4 bg-[#FCFAF6] border border-[#EBE8E0]/60 rounded-xl flex items-center gap-3 shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
                  <div className="w-8 h-8 rounded-full bg-amber-50/80 flex items-center justify-center flex-shrink-0">
                    <Icons.DollarSign className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">${avgDealSize.toLocaleString()}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Avg. Deal Size</p>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Hidden file uploader */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
      />

      {/* Record History & Timeline Modal */}
      {activeHistoryRecord && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 text-left">
          <div className="bg-white border border-slate-200/50 rounded-[24px] max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-150 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="font-[800] text-slate-800 text-sm uppercase tracking-wider">
                  Lead Audit History
                </h3>
                <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">
                  {activeHistoryRecord.data?.firstName} {activeHistoryRecord.data?.lastName}
                </p>
              </div>
              <button 
                onClick={() => setActiveHistoryRecord(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
              >
                <Icons.X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {loadingHistory ? (
                <div className="flex justify-center items-center py-12">
                  <Icons.Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                </div>
              ) : (
                <>
                  {/* Documents Section */}
                  <div>
                    <h4 className="text-[10px] font-[800] text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Icons.File className="w-3.5 h-3.5 text-indigo-500" /> Attached Documents ({historyDocuments.length})
                    </h4>
                    {historyDocuments.length > 0 ? (
                      <div className="space-y-2">
                        {historyDocuments.map((doc: any) => (
                          <div key={doc._id} className="flex justify-between items-center p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Icons.FileText className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-700 truncate">{doc.name}</p>
                                <p className="text-[10px] text-slate-400">{(doc.size / 1024).toFixed(1)} KB</p>
                              </div>
                            </div>
                            <a 
                              href={`${FILE_BASE_URL}${doc.filePath}`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-xs font-bold text-indigo-650 hover:underline flex items-center gap-1"
                            >
                              <Icons.Download className="w-3.5 h-3.5" /> Download
                            </a>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No files attached to this record.</p>
                    )}
                  </div>

                  {/* Timeline Section */}
                  <div>
                    <h4 className="text-[10px] font-[800] text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Icons.Clock className="w-3.5 h-3.5 text-indigo-500" /> System Activities
                    </h4>
                    {historyActivities.length > 0 ? (
                      <div className="relative border-l border-slate-100 ml-2.5 pl-5 space-y-5">
                        {historyActivities.map((act: any) => (
                          <div key={act._id} className="relative">
                            <span className="absolute -left-[26px] top-1 w-3 h-3 rounded-full bg-indigo-500 ring-4 ring-white" />
                            <div className="text-xs">
                              <p className="font-semibold text-slate-700">{act.action}</p>
                              {act.details && Object.keys(act.details).length > 0 && (
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  {act.details.status && `Status: ${act.details.status}`}
                                  {act.details.assignedTo && ` Assigned To: ${act.details.assignedTo}`}
                                </p>
                              )}
                              <p className="text-[10px] text-slate-400 mt-1">
                                {act.performedBy ? `${act.performedBy.firstName} ${act.performedBy.lastName}` : 'System'} • {new Date(act.createdAt).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No activity log found for this record.</p>
                    )}
                  </div>
                </>
              )}
            </div>
            
            {/* Modal Footer */}
            <div className="p-4 bg-slate-50/50 border-t border-slate-150 flex justify-end">
              <button 
                onClick={() => setActiveHistoryRecord(null)}
                className="flex items-center justify-center px-5 h-[38px] text-xs font-bold uppercase tracking-wider bg-slate-900 hover:bg-slate-800 text-white rounded-[10px] transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
