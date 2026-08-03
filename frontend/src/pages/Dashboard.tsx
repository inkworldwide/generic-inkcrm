import React, { useEffect, useState, useRef } from 'react';
import * as Icons from 'lucide-react';
import api, { FILE_BASE_URL } from '../services/api';
import { useThemeStore } from '../store/themeStore';
import { Link, useNavigate } from 'react-router-dom';
import { DynamicIcon } from '../components/Layout';
import { useQuery } from '@tanstack/react-query';
import { formatDate } from '../utils/dateFormatter';
import { useToastStore } from '../store/toastStore';

const FUNNEL_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#f97316', '#8b5cf6'];
const STAGE_COLORS = ['#818cf8', '#34d399', '#fbbf24', '#fb923c', '#c084fc'];

export default function Dashboard() {
  const navigate = useNavigate();
  const { showToast } = useToastStore();
  const { branding, fetchBranding } = useThemeStore();
  const [animate, setAnimate] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'pipeline' | 'followups'>('overview');
  const [followupTab, setFollowupTab] = useState<'today' | 'upcoming'>('today');
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  // File upload, Search input ref and History timeline states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [uploadingRecordId, setUploadingRecordId] = useState<string | null>(null);
  const [activeHistoryRecord, setActiveHistoryRecord] = useState<any | null>(null);
  const [historyActivities, setHistoryActivities] = useState<any[]>([]);
  const [historyDocuments, setHistoryDocuments] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Fetch dynamic configured statuses from database (Settings -> Status Settings)
  const { data: configuredStatuses = [] } = useQuery({
    queryKey: ['dashboard-configured-statuses'],
    queryFn: async () => {
      const res = await api.get('/statuses').catch(() => ({ data: [] }));
      return Array.isArray(res.data) ? res.data : [];
    }
  });

  // Fetch campaigns for Campaign Status section
  const { data: campaignRecords } = useQuery({
    queryKey: ['dashboard-campaigns-list'],
    queryFn: async () => {
      const res = await api.get('/records/campaigns?limit=1000').catch(() => ({ data: { records: [] } }));
      return res.data?.records || res.data || [];
    }
  });

  // Cmd+K / Ctrl+K Keyboard Shortcut Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
    if (metricsData) {
      if (metricsData.todayFollowupsCount > 0) {
        setFollowupTab('today');
      } else if (metricsData.upcomingFollowupsCount > 0 || metricsData.isUpcoming) {
        setFollowupTab('upcoming');
      }
    }
  }, [metricsData]);

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
    const raw = (lbl || '').trim();
    if (!raw) return 0;
    const upper = raw.toUpperCase();

    if (upper === "TODAY'S FOLLOWUPS") {
      return metricsData.todayFollowupsCount || 0;
    }

    // Direct lookup in statusCounts object
    if (metricsData.statusCounts[raw] !== undefined) return metricsData.statusCounts[raw];
    if (metricsData.statusCounts[upper] !== undefined) return metricsData.statusCounts[upper];

    // Alias mapping
    if (upper === 'CEBIL PENDING') return metricsData.statusCounts['CEDIL PENDING'] || metricsData.statusCounts['CEBIL PENDING'] || 0;
    if (upper === 'CEDIL PENDING') return metricsData.statusCounts['CEBIL PENDING'] || metricsData.statusCounts['CEDIL PENDING'] || 0;
    if (upper === 'APPROVED BUT NOT DISBUSE') return metricsData.statusCounts['APPROVED'] || 0;
    if (upper === 'DISBUSED') return metricsData.statusCounts['DISBURSED'] || 0;

    // Check with " LEADS" stripped
    const noLeadsKey = upper.replace(/ LEADS$/, '');
    if (metricsData.statusCounts[noLeadsKey] !== undefined) return metricsData.statusCounts[noLeadsKey];

    return 0;
  };

  // Construct dynamic metric cards list from configured statuses in Settings
  const getDynamicMetricCards = () => {
    if (configuredStatuses && configuredStatuses.length > 0) {
      const visible = configuredStatuses
        .filter((s: any) => s.dashboardVisibility !== false)
        .sort((a: any, b: any) => (a.order || 0) - (b.order || 0));

      if (visible.length > 0) {
        return visible.map((st: any) => {
          const IconComp = (Icons as any)[st.icon] || Icons.Circle;
          const upperName = (st.name || '').toUpperCase();

          let category = 'overview';
          if (st.pipelinePosition > 0) category = 'pipeline';
          if (upperName.includes('FOLLOW') || upperName.includes('WARM') || upperName.includes('PENDING') || upperName.includes('REACHABLE')) {
            category = 'followups';
          }

          let iconBg = 'bg-indigo-50';
          let iconText = 'text-indigo-600';
          let iconBorder = 'border-indigo-100';

          if (st.color) {
            if (st.color.toLowerCase() === '#ea580c' || upperName.includes('HOT')) {
              iconBg = 'bg-orange-50'; iconText = 'text-orange-600'; iconBorder = 'border-orange-100';
            } else if (st.color.toLowerCase() === '#d97706' || upperName.includes('WARM')) {
              iconBg = 'bg-amber-50'; iconText = 'text-amber-600'; iconBorder = 'border-amber-100';
            } else if (st.color.toLowerCase() === '#16a34a' || st.color.toLowerCase() === '#15803d' || upperName.includes('APPROV') || upperName.includes('DISBURS')) {
              iconBg = 'bg-emerald-50'; iconText = 'text-emerald-600'; iconBorder = 'border-emerald-100';
            } else if (st.color.toLowerCase() === '#dc2626' || upperName.includes('REJECT')) {
              iconBg = 'bg-red-50'; iconText = 'text-red-600'; iconBorder = 'border-red-100';
            } else if (upperName.includes('FOLLOW')) {
              iconBg = 'bg-sky-50'; iconText = 'text-sky-600'; iconBorder = 'border-sky-100';
            } else if (st.color.toLowerCase() === '#64748b' || upperName.includes('PENDING') || upperName.includes('DROP')) {
              iconBg = 'bg-slate-100'; iconText = 'text-slate-600'; iconBorder = 'border-slate-200';
            }
          }

          return {
            label: st.name.toUpperCase(),
            rawName: st.name,
            category,
            accentColor: st.color || '#4F46E5',
            icon: IconComp,
            sub: st.isFinal 
              ? (st.isSuccess ? '✔ Closed Won' : '✕ Closed Final') 
              : (st.pipelinePosition > 0 ? `Stage #${st.pipelinePosition}` : '📌 Configured Status'),
            bg: iconBg,
            text: iconText,
            border: iconBorder
          };
        });
      }
    }

    // Default fallback list
    return [
      { label: 'NEW LEADS', rawName: 'New', category: 'overview', accentColor: '#3B82F6', icon: Icons.Sparkles, sub: '▲ +8% This Month', bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100' },
      { label: 'HOT LEADS', rawName: 'Hot', category: 'pipeline', accentColor: '#EA580C', icon: Icons.Flame, sub: '🔥 Updated Today', bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-100' },
      { label: 'WARM LEADS', rawName: 'Warm', category: 'pipeline', accentColor: '#D97706', icon: Icons.Sun, sub: '☀ Active Follow-ups', bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100' },
      { label: 'CEBIL PENDING', rawName: 'Cedil Pending', category: 'pipeline', accentColor: '#64748B', icon: Icons.FileWarning, sub: '⏳ Awaiting verification', bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
      { label: 'DOCUMENT PENDING', rawName: 'Document Pending', category: 'pipeline', accentColor: '#64748B', icon: Icons.FileText, sub: '📄 Files required', bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
      { label: 'APPROVAL PENDING', rawName: 'Approval Pending', category: 'pipeline', accentColor: '#EA580C', icon: Icons.Clock, sub: '⏳ Under review', bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-100' },
      { label: 'APPROVED', rawName: 'Approved', category: 'pipeline', accentColor: '#16A34A', icon: Icons.CheckCircle, sub: '✔ Ready for disbursement', bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100' },
      { label: 'DISBURSED', rawName: 'Disbursed', category: 'pipeline', accentColor: '#15803D', icon: Icons.Banknote, sub: '💰 Funds released', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
      { label: 'FOLLOWUP', rawName: 'Followup', category: 'followups', accentColor: '#0284C7', icon: Icons.PhoneCall, sub: '📞 Call scheduled', bg: 'bg-sky-50', text: 'text-sky-600', border: 'border-sky-100' },
      { label: 'PENDING', rawName: 'Pending', category: 'followups', accentColor: '#D97706', icon: Icons.Hourglass, sub: '⏳ Pending action', bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100' },
      { label: 'REJECTED', rawName: 'Rejected', category: 'overview', accentColor: '#DC2626', icon: Icons.XOctagon, sub: '✕ Closed', bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-100' },
      { label: 'DROPPED', rawName: 'Dropped', category: 'overview', accentColor: '#64748B', icon: Icons.ArrowDownCircle, sub: '✕ Inactive', bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
    ];
  };

  // Convert pipeline stage data to array with dynamic percentage scaling
  const rawPipeline = [
    { 
      name: 'Lead Ingestion / New', 
      val: metricsData?.pipelineData?.['Prospecting'] || getStatusCount('NEW') * 50000 || 50000, 
      count: getStatusCount('NEW') || 10,
      icon: Icons.UserPlus,
      color: 'bg-indigo-600',
      gradient: 'from-indigo-500 to-indigo-600',
      bgLight: 'bg-indigo-50',
      textLight: 'text-indigo-600',
      borderLight: 'border-indigo-100'
    },
    { 
      name: 'Qualification & Hot Leads', 
      val: metricsData?.pipelineData?.['Qualification'] || 90000, 
      count: getStatusCount('HOT') + getStatusCount('WARM') || 14,
      icon: Icons.Flame,
      color: 'bg-emerald-500',
      gradient: 'from-emerald-400 to-teal-500',
      bgLight: 'bg-emerald-50',
      textLight: 'text-emerald-600',
      borderLight: 'border-emerald-100'
    },
    { 
      name: 'Proposal & Documentation', 
      val: metricsData?.pipelineData?.['Proposal'] || 150000, 
      count: getStatusCount('DOCUMENT PENDING') + getStatusCount('CEDIL PENDING') || 8,
      icon: Icons.FileText,
      color: 'bg-amber-500',
      gradient: 'from-amber-400 to-yellow-500',
      bgLight: 'bg-amber-50',
      textLight: 'text-amber-600',
      borderLight: 'border-amber-100'
    },
    { 
      name: 'Negotiation & Approval', 
      val: metricsData?.pipelineData?.['Negotiation'] || 300000, 
      count: getStatusCount('APPROVAL PENDING') || 6,
      icon: Icons.TrendingUp,
      color: 'bg-orange-500',
      gradient: 'from-orange-400 to-rose-500',
      bgLight: 'bg-orange-50',
      textLight: 'text-orange-600',
      borderLight: 'border-orange-100'
    },
    { 
      name: 'Disbursed / Closed Won', 
      val: metricsData?.pipelineData?.['Closed Won'] || 120000, 
      count: getStatusCount('APPROVED') + getStatusCount('DISBURSED') || 12,
      icon: Icons.CheckCircle2,
      color: 'bg-purple-600',
      gradient: 'from-violet-500 to-purple-600',
      bgLight: 'bg-purple-50',
      textLight: 'text-purple-600',
      borderLight: 'border-purple-100'
    }
  ];

  const maxPipelineVal = Math.max(...rawPipeline.map(s => s.val), 1);

  const pipelineStages = rawPipeline.map(s => ({
    ...s,
    pctNum: Math.max(6, Math.round((s.val / maxPipelineVal) * 100)),
    pct: `${Math.max(6, Math.round((s.val / maxPipelineVal) * 100))}%`
  }));

  const funnelData = rawPipeline.map(s => ({
    stage: s.name,
    value: s.val,
    count: s.count
  })).sort((a, b) => b.value - a.value);

  // Find max value in funnel to scale percentages
  const maxFunnelVal = Math.max(...funnelData.map(d => d.value), 1);

  const stagesOrder = rawPipeline.map(s => s.name);
  
  const stageAccents: Record<string, string> = {
    'Lead Ingestion / New': '#6366F1',
    'Qualification & Hot Leads': '#10B981',
    'Proposal & Documentation': '#F59E0B',
    'Negotiation & Approval': '#F97316',
    'Disbursed / Closed Won': '#8B5CF6'
  };

  const totalPipeline = rawPipeline.reduce((a, b) => a + Number(b.val), 0);
  const activeDeals = metricsData?.dealStatus?.open || 12;
  const avgDealSize = activeDeals > 0 ? Math.round(totalPipeline / activeDeals) : 25000;

  const wonCount = metricsData?.dealStatus?.won || 4;
  const lostCount = metricsData?.dealStatus?.lost || 1;
  const totalClosed = wonCount + lostCount;
  const winRate = totalClosed > 0 ? Math.round((wonCount / totalClosed) * 100) : 80;

  const stageMeta: Record<string, { icon: React.ComponentType<any>; color: string; bg: string; text: string; dot: string; pillBg: string; pillText: string }> = {
    'Lead Ingestion / New': { 
      icon: Icons.UserPlus, 
      color: '#6366F1', 
      bg: 'rgba(99, 102, 241, 0.08)', 
      text: 'text-indigo-600', 
      dot: 'bg-indigo-600',
      pillBg: 'bg-indigo-50/80',
      pillText: 'text-indigo-700'
    },
    'Qualification & Hot Leads': { 
      icon: Icons.Flame, 
      color: '#10B981', 
      bg: 'rgba(16, 185, 129, 0.08)', 
      text: 'text-emerald-600', 
      dot: 'bg-emerald-500',
      pillBg: 'bg-emerald-50/80',
      pillText: 'text-emerald-700'
    },
    'Proposal & Documentation': { 
      icon: Icons.FileText, 
      color: '#F59E0B', 
      bg: 'rgba(245, 158, 11, 0.08)', 
      text: 'text-amber-600', 
      dot: 'bg-amber-500',
      pillBg: 'bg-amber-50/80',
      pillText: 'text-amber-700'
    },
    'Negotiation & Approval': { 
      icon: Icons.TrendingUp, 
      color: '#F97316', 
      bg: 'rgba(249, 115, 22, 0.08)', 
      text: 'text-orange-600', 
      dot: 'bg-orange-500',
      pillBg: 'bg-orange-50/80',
      pillText: 'text-orange-700'
    },
    'Disbursed / Closed Won': { 
      icon: Icons.CheckCircle2, 
      color: '#8B5CF6', 
      bg: 'rgba(139, 92, 246, 0.08)', 
      text: 'text-purple-600', 
      dot: 'bg-purple-600',
      pillBg: 'bg-purple-50/80',
      pillText: 'text-purple-700'
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
    <div className="space-y-8 max-w-[1400px] mx-auto text-left px-4 md:px-8 py-6">
      
      {/* 1. TOP ACTION & CONTROLS BAR */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-[#EAE4DA] dark:border-slate-800">
        
        {/* Command Search Bar - Ultra Premium Linear/Stripe style */}
        <div className="relative flex-1 max-w-xl">
          <div className="relative flex items-center">
            <Icons.Search className="absolute left-4 w-4.5 h-4.5 text-[#17223B] dark:text-slate-200 pointer-events-none stroke-[2.2]" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => handleGlobalSearch(e.target.value)}
              placeholder="Search leads, deals, contacts, campaigns..."
              className="w-full h-11 pl-11 pr-20 text-xs md:text-sm bg-white dark:bg-slate-800 border-2 border-[#EAE4DA] dark:border-slate-700 rounded-xl focus:outline-none focus:ring-4 focus:ring-[#17223B]/10 focus:border-[#17223B] transition-all text-[#0F172A] dark:text-white font-semibold shadow-[0_2px_8px_rgba(23,34,59,0.03)] placeholder:text-slate-600 dark:placeholder:text-slate-400"
            />
            <div className="absolute right-3.5 flex items-center gap-1 pointer-events-none">
              <kbd className="hidden sm:inline-block text-[10px] font-mono font-bold text-[#17223B] dark:text-slate-300 bg-[#F8F5F1] dark:bg-slate-900 border border-[#EAE4DA] dark:border-slate-700 px-1.5 py-0.5 rounded shadow-2xs">
                ⌘K
              </kbd>
            </div>
          </div>

          {/* Search Results Dropdown */}
          {searchQuery && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-[#EAE4DA] dark:border-slate-700 shadow-2xl rounded-2xl overflow-hidden max-h-80 overflow-y-auto z-50 p-2 space-y-2 text-left">
              {searchResults.length === 0 ? (
                <div className="p-5 text-center text-xs text-slate-400 font-medium">
                  No lead, contact, or firm matching "{searchQuery}"
                </div>
              ) : (
                searchResults.map(({ module, records }) => (
                  <div key={module._id} className="space-y-1">
                    <div className="px-3 py-1 bg-[#F8F5F1] dark:bg-slate-900 rounded-lg text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <DynamicIcon name={module.icon} className="w-3.5 h-3.5 text-[#17223B]" />
                      {module.pluralLabel} ({records.length})
                    </div>
                    {records.map((rec: any) => {
                      const name = `${rec.data?.firstName || ''} ${rec.data?.lastName || ''}`.trim() || rec.data?.company || 'Lead Record';
                      const phone = rec.data?.phone || rec.data?.mobile || rec.data?.contactNumber || rec.data?.contact;
                      const code = rec.data?.dataCode || rec.data?.allocatedNo || rec.data?.leadNo || (rec._id ? `LND-${String(rec._id).slice(-6).toUpperCase()}` : '');
                      const company = rec.data?.company || rec.data?.firmName;

                      return (
                        <Link
                          key={rec._id}
                          to={`/modules/${module.apiPath}/${rec._id}`}
                          onClick={() => setSearchQuery('')}
                          className="flex items-center justify-between p-2.5 hover:bg-indigo-50/50 dark:hover:bg-slate-700/50 rounded-xl transition-all text-left group border border-transparent hover:border-indigo-100 dark:hover:border-slate-700"
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-bold text-slate-850 dark:text-white truncate group-hover:text-indigo-600 transition-colors">
                                {name}
                              </p>
                              {code && (
                                <span className="text-[9px] font-extrabold bg-slate-100 dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded uppercase flex-shrink-0">
                                  #{code}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-400 font-medium truncate">
                              {company && <span>Firm: <strong className="text-slate-600 dark:text-slate-300">{company}</strong></span>}
                              {phone && <span>Ph: <strong className="text-slate-600 dark:text-slate-300">{phone}</strong></span>}
                            </div>
                          </div>
                          <Icons.ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition-colors flex-shrink-0" />
                        </Link>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Right Controls & Quick Actions */}
        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap justify-between sm:justify-end">
          {/* Add Lead Button */}
          <Link 
            to="/modules/leads/new" 
            className="btn-primary-premium h-11 px-5 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_2px_8px_rgba(23,34,59,0.12)] hover:shadow-[0_4px_16px_rgba(23,34,59,0.2)] transition-all"
          >
            <Icons.Plus className="w-4 h-4" />
            Add Lead
          </Link>
        </div>
      </div>

      {/* 2. PREMIUM METRIC CARDS */}
      <div className="space-y-6">
        <div className="bg-[#F8F5F1] border border-[#EAE4DA] rounded-2xl p-6 shadow-[0_2px_8px_rgba(23,34,59,0.02)]">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4.5">
            {getDynamicMetricCards().filter(m => {
              if (activeTab === 'overview') return true;
              if (activeTab === 'pipeline') return m.category === 'pipeline' || m.label.includes('HOT') || m.label.includes('WARM');
              if (activeTab === 'followups') return m.category === 'followups' || m.label.includes('FOLLOWUP') || m.label.includes('WARM');
              return true;
            }).map((metric, idx) => {
              const Icon = metric.icon;
              const count = getStatusCount(metric.rawName || metric.label);
              const filterStatus = metric.rawName || metric.label;
              return (
                <Link
                  to={`/modules/leads?status=${encodeURIComponent(filterStatus)}`}
                  key={idx} 
                  className="group flex flex-col justify-between p-4 bg-white border border-[#EAE4DA] rounded-xl shadow-2xs hover:shadow-md hover:border-indigo-200 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer relative overflow-hidden text-left"
                >
                  {/* Top Label & Icon */}
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider leading-none">
                      {metric.label}
                    </span>
                    <div 
                      className={`p-2 rounded-lg ${metric.bg} border ${metric.border} ${metric.text} group-hover:scale-105 transition-transform`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  {/* Counter */}
                  <div className="my-2.5">
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none">
                      {count}
                    </h3>
                  </div>

                  {/* Subtext */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-semibold text-slate-500">
                      {metric.sub}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. MIDDLE ROW: Pipeline by Stage + Deal Status */}
      <div id="pipeline-section" className="grid grid-cols-1 lg:grid-cols-2 gap-8 scroll-mt-24">
        
        {/* Pipeline by Stage */}
        <div className="bg-[#F8F5F1] border border-[#EAE4DA] rounded-2xl p-6 md:p-8 shadow-[0_2px_8px_rgba(23,34,59,0.02)] flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white border border-[#EAE4DA] rounded-xl text-indigo-600 shadow-xs">
                  <Icons.GitMerge className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-sm font-[800] text-[#1F2937] tracking-tight">Pipeline by Stage</h3>
                  <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Live lead distribution & volume progress</p>
                </div>
              </div>
              <Link 
                to="/reports/lead-reports"
                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-white px-3 py-1.5 rounded-lg border border-[#EAE4DA] shadow-xs uppercase tracking-wider flex items-center gap-1 transition-all"
              >
                Lead Reports <Icons.ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="space-y-4">
              {pipelineStages.map((stage, idx) => {
                const StageIcon = stage.icon;
                return (
                  <div key={idx} className="group p-3.5 bg-white hover:border-indigo-200 border border-[#EAE4DA] rounded-xl transition-all shadow-xs">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${stage.bgLight} border ${stage.borderLight} ${stage.textLight}`}>
                          <StageIcon className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{stage.name}</span>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#F8F5F1] border border-[#EAE4DA] text-slate-600">
                          {stage.count} Leads
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{stage.pct}</span>
                        <span className="font-extrabold text-[#1F2937] text-xs">${Number(stage.val).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="w-full h-2.5 bg-[#F8F5F1] border border-[#EAE4DA]/50 rounded-full overflow-hidden shadow-inner relative">
                      <div 
                        style={{ 
                          width: animate ? stage.pct : '0%', 
                          transition: `width 1.2s cubic-bezier(0.4, 0, 0.2, 1) ${idx * 0.1}s` 
                        }}
                        className={`h-full rounded-full bg-gradient-to-r ${stage.gradient} shadow-sm`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Campaign Status Grid */}
        <div className="bg-[#F8F5F1] border border-[#EAE4DA] rounded-2xl p-6 md:p-8 shadow-[0_2px_8px_rgba(23,34,59,0.02)] flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white border border-[#EAE4DA] rounded-xl text-orange-600 shadow-xs">
                  <Icons.Megaphone className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-sm font-[800] text-[#1F2937] tracking-tight">Campaign Status</h3>
                  <p className="text-[11px] text-slate-500 font-semibold mt-0.5">My campaign execution overview</p>
                </div>
              </div>
              <Link 
                to="/modules/mycampaign" 
                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-white px-3 py-1.5 rounded-lg border border-[#EAE4DA] shadow-xs uppercase tracking-wider flex items-center gap-1 transition-all"
              >
                View Campaigns <Icons.ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {/* 2x2 Compact Metric Grid */}
            <div className="grid grid-cols-2 gap-4 mb-5">
              {[
                { 
                  label: 'TOTAL CAMPAIGNS', 
                  value: (campaignRecords && campaignRecords.length > 0) ? campaignRecords.length : (metricsData?.dealStatus?.open ? metricsData.dealStatus.open + 2 : 3), 
                  sub: 'All active drives', 
                  icon: Icons.Megaphone, 
                  color: 'text-indigo-600', 
                  bg: 'bg-indigo-50/80', 
                  border: 'border-indigo-100' 
                },
                { 
                  label: 'COMPLETED CAMPAIGN', 
                  value: metricsData?.completedCampaigns !== undefined ? metricsData.completedCampaigns : (metricsData?.dealStatus?.won || 1), 
                  sub: '100% Dialed & Closed', 
                  icon: Icons.CheckCircle2, 
                  color: 'text-emerald-600', 
                  bg: 'bg-emerald-50/80', 
                  border: 'border-emerald-100' 
                },
                { 
                  label: 'INPROGRESS', 
                  value: metricsData?.inProgressCampaigns !== undefined ? metricsData.inProgressCampaigns : (metricsData?.dealStatus?.pending || 2), 
                  sub: 'Active calling', 
                  icon: Icons.PhoneCall, 
                  color: 'text-blue-600', 
                  bg: 'bg-blue-50/80', 
                  border: 'border-blue-100' 
                },
                { 
                  label: 'YET TO START', 
                  value: metricsData?.yetToStartCampaigns !== undefined ? metricsData.yetToStartCampaigns : (metricsData?.dealStatus?.lost || 0), 
                  sub: 'Queued drives', 
                  icon: Icons.Clock, 
                  color: 'text-amber-500', 
                  bg: 'bg-amber-50/80', 
                  border: 'border-amber-100' 
                }
              ].map((box, index) => {
                const BoxIcon = box.icon;
                return (
                  <div 
                    key={index} 
                    onClick={() => navigate('/modules/mycampaign')}
                    className="p-4 bg-white border border-[#EAE4DA] hover:border-indigo-200 rounded-xl text-left flex flex-col justify-between hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer shadow-xs group"
                  >
                    <div className="flex justify-between items-start">
                      <div className={`p-2 rounded-lg ${box.bg} border ${box.border} ${box.color} group-hover:scale-105 transition-transform`}>
                        <BoxIcon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[10px] font-[800] text-slate-400 group-hover:text-slate-700 uppercase tracking-wider transition-colors">{box.label}</span>
                    </div>
                    <div>
                      <h4 className="text-xl font-[850] text-slate-900 tracking-tight mt-2.5">
                        {box.value}
                      </h4>
                      <p className="text-[10px] font-semibold text-slate-500 mt-0.5">{box.sub}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Campaign Execution Progress Bar Banner */}
            <div className="p-4 bg-white border border-[#EAE4DA] rounded-xl shadow-xs text-left">
              <div className="flex items-center justify-between text-xs mb-2">
                <div className="flex items-center gap-2">
                  <Icons.Activity className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
                  <span className="font-extrabold uppercase tracking-wider text-[10px] text-slate-800">Overall Campaign Execution</span>
                </div>
                <span className="font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 text-xs">78% Dialed</span>
              </div>

              <div className="w-full h-2 bg-[#F8F5F1] border border-[#EAE4DA]/50 rounded-full overflow-hidden mb-2.5">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full" style={{ width: '78%' }} />
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold">
                <span>Active Calling: Personal & Home Loan Drives</span>
                <span className="text-slate-700 font-bold">Target: 100% Completion</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* 4. TODAY'S & UPCOMING FOLLOWUP LEADS DETAILS */}
      <div className="bg-[#F8F5F1] border border-[#EAE4DA] rounded-2xl p-6 md:p-8 overflow-hidden text-left shadow-[0_2px_8px_rgba(23,34,59,0.02)]">
        <div className="px-2 pb-5 border-b border-[#EAE4DA] flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white border border-[#EAE4DA] flex items-center justify-center shadow-2xs">
              <Icons.CalendarClock className="w-4.5 h-4.5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-sm font-[800] text-slate-800 uppercase tracking-wider">
                Followup Leads Details
              </h2>
              <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                {followupTab === 'today' ? "Scheduled for action today" : "Upcoming scheduled followups"}
              </p>
            </div>
          </div>

          {/* Tab buttons: Today's vs Upcoming */}
          <div className="flex items-center gap-2 bg-white border border-[#EAE4DA] p-1.5 rounded-xl shadow-2xs">
            <button
              onClick={() => setFollowupTab('today')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-2 ${
                followupTab === 'today'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icons.Calendar className="w-3.5 h-3.5" />
              <span>Today's Followups</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${followupTab === 'today' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {metricsData?.todayFollowupsCount || 0}
              </span>
            </button>

            <button
              onClick={() => setFollowupTab('upcoming')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-2 ${
                followupTab === 'upcoming'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icons.Clock className="w-3.5 h-3.5" />
              <span>Upcoming Followups</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${followupTab === 'upcoming' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {metricsData?.upcomingFollowupsCount || 0}
              </span>
            </button>
          </div>
        </div>
        
        <div className="space-y-6">
          {(() => {
            const activeList = followupTab === 'today'
              ? (metricsData?.todayFollowupsList || [])
              : (metricsData?.upcomingFollowupsList?.length ? metricsData.upcomingFollowupsList : (metricsData?.todayFollowupsList || []));

            if (!activeList || activeList.length === 0) {
              return (
                <div className="py-12 bg-white border border-[#EAE4DA] rounded-xl flex flex-col items-center justify-center text-center shadow-xs">
                  <div className="w-14 h-14 rounded-full bg-[#F8F5F1] border border-[#EAE4DA] flex items-center justify-center mb-3 shadow-inner">
                    <Icons.CheckCircle2 className="w-7 h-7 text-slate-400" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">
                    {followupTab === 'today' ? "No follow-ups scheduled today." : "No upcoming follow-ups scheduled."}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">Enjoy your day.</p>
                </div>
              );
            }

            return activeList.map((rec: any, idx: number) => {
              const leadNo = rec._id.slice(-6).toUpperCase();
              return (
                <div key={rec._id} className="border border-[#EAE4DA] rounded-2xl p-5 bg-white relative mb-6 last:mb-0 text-left shadow-xs">
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
                            const leadName = `${rec.data?.firstName || ''} ${rec.data?.lastName || ''}`.trim() || 'Lead';
                            showToast(`Initiating call to ${leadName}...`, 'info');
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
            });
          })()}
        </div>
      </div>

      {/* 5. SALES PIPELINE FUNNEL */}
      <div className="bg-[#F8F5F1] border border-[#EAE4DA] rounded-2xl p-6 md:p-8 shadow-[0_2px_8px_rgba(23,34,59,0.02)] text-left">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[12px] bg-white border border-[#EAE4DA] flex items-center justify-center flex-shrink-0 shadow-xs">
              <Icons.PieChart className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-[800] text-slate-800 tracking-tight">Sales Pipeline Funnel</h3>
              <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Stage-by-stage conversion breakdown</p>
            </div>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-[#EAE4DA] rounded-[12px] shadow-xs hover:bg-slate-50 transition-colors text-xs font-semibold text-slate-700">
            <Icons.Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>This Quarter</span>
            <Icons.ChevronDown className="w-3 h-3 text-slate-400 ml-1" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start bg-white p-6 md:p-8 rounded-2xl border border-[#EAE4DA] shadow-xs">
          {/* Left Column (70% width) - Funnel Stages */}
          <div className="md:col-span-8 flex flex-col justify-between gap-6 w-full">
            <div className="flex flex-col gap-3.5 w-full items-start">
              {rawPipeline.map((stageItem, index) => {
                const val = stageItem.val;
                const pct = Math.round((val / maxPipelineVal) * 100);
                const stageName = stageItem.name;
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
                
                // Proportional widths for funnel visual shape
                const widthClass = [
                  'w-full',
                  'w-[96%]',
                  'w-[92%]',
                  'w-[88%]',
                  'w-[84%]'
                ][index] || 'w-full';

                const dealsCount = stageItem.count;

                return (
                  <div 
                    key={stageName}
                    className={`${widthClass} flex items-center justify-between py-3.5 px-4 bg-[#F8F5F1] border border-[#EAE4DA] rounded-[18px] hover:border-indigo-200 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 ease-out relative overflow-hidden group`}
                  >
                    {/* Left accent line */}
                    <div 
                      className="absolute left-0 top-0 bottom-0 w-[4px]" 
                      style={{ backgroundColor: meta.color }}
                    />
                    
                    <div className="flex items-center gap-3.5 pl-2">
                      {/* Circular icon container */}
                      <div 
                        className="w-9 h-9 rounded-full flex items-center justify-center bg-white border border-[#EAE4DA] transition-transform duration-300 group-hover:scale-105 shadow-xs"
                      >
                        <StageIcon className="w-4 h-4" style={{ color: meta.color }} />
                      </div>
                      
                      {/* Info & Value */}
                      <div className="text-left">
                        <span className={`text-[10px] font-extrabold uppercase tracking-wider block ${meta.text}`}>{stageName}</span>
                        <div className="flex items-center gap-2.5 mt-0.5">
                          <span className="text-sm font-black text-slate-800 tracking-tight">${Number(val).toLocaleString()}</span>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-white border border-[#EAE4DA] text-slate-600 shadow-2xs">
                            {dealsCount} Leads
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Conversion Stats */}
                    <div className="text-right pr-2">
                      <span className="text-xs font-black text-slate-800 block">{pct}%</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5">Conversion</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pipeline Summary Horizontal KPI Bar */}
            <div className="w-full grid grid-cols-2 sm:grid-cols-4 bg-[#F8F5F1] border border-[#EAE4DA] rounded-[18px] p-4 items-center gap-4 shadow-xs">
              <div className="flex items-center gap-3 pl-2">
                <div className="w-9 h-9 rounded-full bg-white border border-[#EAE4DA] flex items-center justify-center shadow-2xs flex-shrink-0">
                  <Icons.Briefcase className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="text-left min-w-0">
                  <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider truncate">Total Pipeline</p>
                  <p className="text-sm font-black text-slate-800 tracking-tight mt-0.5 truncate">${totalPipeline.toLocaleString()}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 pl-2 sm:border-l border-[#EAE4DA]">
                <div className="w-9 h-9 rounded-full bg-white border border-[#EAE4DA] flex items-center justify-center shadow-2xs flex-shrink-0">
                  <Icons.Percent className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-left min-w-0">
                  <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider truncate">Win Rate</p>
                  <p className="text-sm font-black text-slate-800 tracking-tight mt-0.5 truncate">{winRate}%</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 pl-2 sm:border-l border-[#EAE4DA]">
                <div className="w-9 h-9 rounded-full bg-white border border-[#EAE4DA] flex items-center justify-center shadow-2xs flex-shrink-0">
                  <Icons.Calendar className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-left min-w-0">
                  <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider truncate">Avg. Cycle</p>
                  <p className="text-sm font-black text-slate-800 tracking-tight mt-0.5 truncate">28 Days</p>
                </div>
              </div>

              <div className="flex items-center gap-3 pl-2 sm:border-l border-[#EAE4DA]">
                <div className="w-9 h-9 rounded-full bg-white border border-[#EAE4DA] flex items-center justify-center shadow-2xs flex-shrink-0">
                  <Icons.DollarSign className="w-4 h-4 text-orange-600" />
                </div>
                <div className="text-left min-w-0">
                  <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider truncate">Avg. Deal Size</p>
                  <p className="text-sm font-black text-slate-800 tracking-tight mt-0.5 truncate">${avgDealSize.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (30% width) - Conversion Overview */}
          <div className="md:col-span-4 flex flex-col gap-6">
            <div className="bg-[#F8F5F1] border border-[#EAE4DA] p-6 rounded-[20px] shadow-xs text-left">
              <h4 className="text-[10px] font-[800] text-slate-500 uppercase tracking-wider mb-5">Conversion Overview</h4>
              <div className="space-y-4">
                {rawPipeline.map((stageItem, idx) => {
                  const val = stageItem.val;
                  const pct = Math.round((val / maxPipelineVal) * 100);
                  const stageName = stageItem.name;
                  const meta = stageMeta[stageName] || { color: '#64748B' };
                  return (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: meta.color }} />
                          <span className="font-bold text-slate-800">{stageName}</span>
                        </div>
                        <span className="font-extrabold text-slate-900">${Number(val).toLocaleString()}</span>
                      </div>
                      
                      {/* Progress bar line */}
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-white border border-[#EAE4DA] rounded-full overflow-hidden shadow-inner">
                          <div
                            style={{ 
                              width: animate ? `${pct}%` : '0%', 
                              backgroundColor: meta.color, 
                              transition: `width 1.2s cubic-bezier(0.4,0,0.2,1) ${idx * 0.08}s` 
                            }}
                            className="h-full rounded-full"
                          />
                        </div>
                        <span className="text-[10px] font-black text-slate-500 w-8 text-right">{pct}%</span>
                      </div>
                    </div>
                  );
                })}
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
