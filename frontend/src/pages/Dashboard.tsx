import React, { useEffect, useState, useRef } from 'react';
import * as Icons from 'lucide-react';
import api from '../services/api';
import { useThemeStore } from '../store/themeStore';
import { Link } from 'react-router-dom';
import { DynamicIcon } from '../components/Layout';
import { useQuery } from '@tanstack/react-query';

const FUNNEL_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#f97316', '#8b5cf6'];

export default function Dashboard() {
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
      alert('File uploaded successfully!');
    } catch (err) {
      alert('Failed to upload file.');
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 rounded animate-shimmer"></div>
        <div className="h-64 rounded-lg animate-shimmer"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto text-left">
      
      {/* 1. TOP BAR SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between md:justify-end gap-4 pb-2">
        <div className="flex items-center justify-between md:justify-end gap-4 w-full md:w-auto relative">
          
          {/* Search Input bar */}
          <div className="relative flex-1 md:w-64">
            <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleGlobalSearch(e.target.value)}
              placeholder="Search anything..."
              className="w-full pl-9 pr-4 py-2.5 md:py-2 text-xs md:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-700 shadow-sm"
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
              className="p-2.5 md:p-2 bg-white border border-slate-200/60 hover:bg-slate-50 text-slate-500 hover:text-indigo-600 rounded-xl transition-all shadow-sm hover:shadow-md"
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

          <div className="w-10 h-10 md:w-9 md:h-9 rounded-full bg-indigo-600 text-white font-bold text-sm flex items-center justify-center shadow-sm shadow-indigo-600/10 flex-shrink-0">
            AK
          </div>
        </div>
      </div>

      {/* 2. DASHBOARD HEADER & PREMIUM METRIC CARDS */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl uppercase font-black text-slate-800 tracking-tight">Dashboard-Current Month</h1>
            <Link 
              to="/modules/leads/new" 
              className="px-5 py-2 bg-gradient-to-r from-lime-500 to-lime-600 hover:from-lime-400 hover:to-lime-500 text-white shadow-lg shadow-lime-500/30 text-sm font-extrabold rounded-lg transition-all transform hover:-translate-y-0.5 flex items-center gap-1.5"
            >
              <Icons.Plus className="w-4 h-4" />
              Add Lead
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { label: 'NEW LEADS', color: 'from-indigo-400 to-purple-500', icon: Icons.Sparkles },
            { label: 'HOT LEADS', color: 'from-cyan-400 to-blue-500', icon: Icons.Flame },
            { label: 'WARM LEADS', color: 'from-amber-300 to-amber-500', icon: Icons.Sun },
            { label: 'CEBIL PENDING', color: 'from-rose-400 to-pink-600', icon: Icons.FileWarning },
            { label: 'DOCUMENT PENDING', color: 'from-teal-400 to-emerald-500', icon: Icons.FileText },
            { label: 'APPROVAL PENDING', color: 'from-orange-400 to-orange-600', icon: Icons.Clock },
            { label: 'APPROVED BUT NOT DISBUSE', color: 'from-amber-400 to-orange-500', icon: Icons.CheckCircle },
            { label: 'DISBUSED', color: 'from-lime-400 to-green-600', icon: Icons.Banknote },
            { label: 'REJECTED', color: 'from-rose-500 to-red-600', icon: Icons.XOctagon },
            { label: 'FOLLOWUP', color: 'from-sky-400 to-indigo-500', icon: Icons.PhoneCall },
            { label: 'DROPPED', color: 'from-orange-50 to-red-500', icon: Icons.ArrowDownCircle },
            { label: 'PENDING', color: 'from-amber-300 to-yellow-500', icon: Icons.Hourglass },
            { label: "TODAY'S FOLLOWUPS", color: 'from-cyan-400 to-cyan-600', icon: Icons.CalendarClock },
          ].map((metric, idx) => {
            const Icon = metric.icon;
            const count = getStatusCount(metric.label);
            // Map card label → actual DB status value for URL filter
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
                className="group flex border border-slate-200/60 shadow-sm h-20 bg-white rounded-xl overflow-hidden hover:shadow-xl hover:shadow-slate-200/50 hover:-translate-y-1 transition-all duration-300 relative cursor-pointer"
              >
                {/* Colored number block */}
                <div className={`bg-gradient-to-br ${metric.color} text-white text-3xl font-bold flex items-center justify-center w-20 h-full shrink-0 shadow-inner z-10`}>
                  {count}
                </div>
                {/* Content area */}
                <div className="flex flex-col justify-center px-4 flex-1 relative z-10">
                  <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider leading-tight group-hover:text-slate-800 transition-colors">
                    {metric.label}
                  </span>
                </div>
                {/* Background watermark icon */}
                <Icon className="absolute right-[-10px] top-1/2 -translate-y-1/2 w-16 h-16 text-slate-50 opacity-50 transform group-hover:scale-110 group-hover:-rotate-6 transition-all duration-300 z-0" strokeWidth={1} />
              </Link>
            );
          })}
        </div>
      </div>

      {/* 3. MIDDLE ROW: Pipeline by Stage + Deal Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Pipeline by Stage */}
        <div className="bg-white border border-slate-200/60 rounded-3xl p-7 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 rounded-lg">
                  <Icons.BarChart3 className="w-5 h-5 text-indigo-600" />
                </div>
                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Pipeline by Stage</h3>
              </div>
            </div>

            <div className="space-y-5">
              {pipelineStages.map((stage, idx) => (
                <div key={idx} className="group">
                  <div className="flex justify-between text-xs font-bold text-slate-600 mb-1.5 group-hover:text-indigo-600 transition-colors">
                    <span>{stage.name}</span>
                    <span>${Number(stage.val).toLocaleString()}</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100/80 rounded-full overflow-hidden shadow-inner">
                    <div 
                      style={{ width: animate ? stage.pct : '0%', transition: `width 1.2s cubic-bezier(0.4, 0, 0.2, 1) ${idx * 0.1}s` }}
                      className={`h-full bg-gradient-to-r ${stage.color} rounded-full shadow-[inset_0_1px_rgba(255,255,255,0.3)]`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Deal Status Grid */}
        <div className="bg-white border border-slate-200/60 rounded-3xl p-7 shadow-sm hover:shadow-md transition-shadow flex flex-col">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded-lg">
                <Icons.Target className="w-5 h-5 text-slate-700" />
              </div>
              <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Deal Status</h3>
            </div>
            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">This Month</span>
          </div>
          <div className="grid grid-cols-2 gap-4 flex-1">
            {/* Open Box */}
            <div className="p-5 bg-gradient-to-br from-blue-50 to-blue-50/20 border border-blue-100/80 rounded-2xl text-left flex flex-col justify-between hover:scale-[1.02] transition-transform cursor-pointer shadow-sm">
              <div className="flex justify-between items-center text-blue-600">
                <div className="bg-white p-1.5 rounded-md shadow-sm">
                  <Icons.FolderOpen className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest">Open</span>
              </div>
              <h4 className="text-4xl font-extrabold text-slate-800 mt-4 tracking-tight">
                {metricsData?.dealStatus?.open || 0}
              </h4>
            </div>
            {/* Won Box */}
            <div className="p-5 bg-gradient-to-br from-emerald-50 to-emerald-50/20 border border-emerald-100/80 rounded-2xl text-left flex flex-col justify-between hover:scale-[1.02] transition-transform cursor-pointer shadow-sm">
              <div className="flex justify-between items-center text-emerald-600">
                <div className="bg-white p-1.5 rounded-md shadow-sm">
                  <Icons.Trophy className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest">Won</span>
              </div>
              <h4 className="text-4xl font-extrabold text-slate-800 mt-4 tracking-tight">
                {metricsData?.dealStatus?.won || 0}
              </h4>
            </div>
            {/* Lost Box */}
            <div className="p-5 bg-gradient-to-br from-rose-50 to-rose-50/20 border border-rose-100/80 rounded-2xl text-left flex flex-col justify-between hover:scale-[1.02] transition-transform cursor-pointer shadow-sm">
              <div className="flex justify-between items-center text-rose-600">
                <div className="bg-white p-1.5 rounded-md shadow-sm">
                  <Icons.XOctagon className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest">Lost</span>
              </div>
              <h4 className="text-4xl font-extrabold text-slate-800 mt-4 tracking-tight">
                {metricsData?.dealStatus?.lost || 0}
              </h4>
            </div>
            {/* Pending Box */}
            <div className="p-5 bg-gradient-to-br from-amber-50 to-amber-50/20 border border-amber-100/80 rounded-2xl text-left flex flex-col justify-between hover:scale-[1.02] transition-transform cursor-pointer shadow-sm">
              <div className="flex justify-between items-center text-amber-600">
                <div className="bg-white p-1.5 rounded-md shadow-sm">
                  <Icons.Clock className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest">Pending</span>
              </div>
              <h4 className="text-4xl font-extrabold text-slate-800 mt-4 tracking-tight">
                {metricsData?.dealStatus?.pending || 0}
              </h4>
            </div>
          </div>
        </div>

      </div>

      {/* 4. TODAY'S FOLLOWUP LEADS DETAILS */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Indigo top accent bar */}
        <div className="h-[3px] bg-indigo-600 w-full" />
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Icons.CalendarClock className="w-4 h-4 text-indigo-600" />
            Today's Followup Leads
          </h2>
        </div>
        
        <div className="p-4 sm:p-6 overflow-x-auto">
          {!metricsData?.todayFollowupsList || metricsData.todayFollowupsList.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm italic">
              No follow-up leads scheduled for today.
            </div>
          ) : (
            metricsData.todayFollowupsList.map((rec: any, idx: number) => {
              const leadNo = rec._id.slice(-6).toUpperCase();
              return (
                <div key={rec._id} className="bg-white border border-slate-200 rounded-2xl p-5 relative mb-4 last:mb-0 overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-[3px] bg-indigo-600" />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-y-6 gap-x-8 text-sm mt-2">
                    <div className="space-y-4">
                      <div><span className="font-bold text-slate-700">Sl No.:</span> <span className="text-slate-600">{idx + 1}</span></div>
                      <div><span className="font-bold text-slate-700">Lead No.:</span> <span className="text-slate-600">LND-{leadNo}</span></div>
                      <div><span className="font-bold text-slate-700">Product:</span> <span className="text-slate-600">{rec.data?.product || 'N/A'}</span></div>
                      <div><span className="font-bold text-slate-700">Status:</span> <span className="text-slate-600 uppercase">{rec.data?.status || 'New'}</span></div>
                    </div>

                    <div className="space-y-4">
                      <div><span className="font-bold text-slate-700">Lead Name:</span> <span className="text-slate-600">{rec.data?.firstName} {rec.data?.lastName}</span></div>
                      <div><span className="font-bold text-slate-700">Location:</span> <span className="text-slate-600">{rec.data?.location || 'N/A'}</span></div>
                      <div><span className="font-bold text-slate-700">Mobile No.:</span> <span className="text-slate-600">{rec.data?.phone || 'N/A'}</span></div>
                      <div><span className="font-bold text-slate-700">Amount:</span> <span className="text-slate-600">{rec.data?.budget ? '$' + Number(rec.data.budget).toLocaleString() : 'N/A'}</span></div>
                    </div>

                    <div className="space-y-4">
                      <div><span className="font-bold text-slate-700">Created On:</span> <span className="text-slate-600">{new Date(rec.createdAt).toLocaleDateString()}</span></div>
                      <div><span className="font-bold text-slate-700">Created By:</span> <span className="text-slate-600">System</span></div>
                      <div><span className="font-bold text-slate-700">Pending at:</span> <span className="text-slate-600">{rec.data?.pendingAt || 'Sales Review'}</span></div>
                      <div><span className="font-bold text-slate-700">PSM:</span> <span className="text-slate-600">{rec.data?.assignedTo || 'Unassigned'}</span></div>
                    </div>

                    <div className="space-y-4">
                      <div><span className="font-bold text-slate-700">Firm/Company:</span> <span className="text-slate-600">{rec.data?.company}</span></div>
                      <div><span className="font-bold text-slate-700">Modified On:</span> <span className="text-slate-600">{new Date(rec.updatedAt).toLocaleDateString()}</span></div>
                      <div><span className="font-bold text-slate-700">Assigned By:</span> <span className="text-slate-600">System Router</span></div>
                      <div>
                        <span className="font-bold text-slate-700">Remarks:</span> 
                        <span className="text-slate-500 italic ml-1 text-xs">{rec.data?.notes ? rec.data.notes.replace(/<[^>]*>/g, '') : 'Transferred to agent'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 pt-6 border-t border-slate-100">
                    <div className="mb-3">
                      <span className="bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded shadow-sm">Followup From</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button 
                        onClick={() => {
                          const phone = rec.data?.phone || rec.data?.mobile || rec.data?.contactNumber || '';
                          const cleanPhone = phone.replace(/\D/g, '');
                          if (cleanPhone) {
                            window.open(`https://wa.me/${cleanPhone}`, '_blank');
                          } else {
                            alert('No phone number available for this lead.');
                          }
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm"
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
                            alert('No phone number available for this lead.');
                          }
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm"
                      >
                        Call
                      </button>
                      
                      <button 
                        onClick={() => handleUploadClick(rec._id)}
                        className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm"
                      >
                        Upload File
                      </button>
                      
                      <Link to={`/modules/leads/${rec._id}`} className="bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm">
                        Edit
                      </Link>

                      <button 
                        onClick={() => openHistory(rec)}
                        className="bg-slate-600 hover:bg-slate-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm"
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
      <div className="bg-white border border-slate-200 rounded-2xl p-7 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <Icons.PieChart className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Sales Pipeline Funnel</h3>
              <p className="text-xs text-slate-400 mt-0.5 font-medium">Stage-by-stage conversion breakdown</p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 uppercase tracking-widest shadow-sm">This Quarter</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center bg-slate-50/50 p-6 rounded-2xl border border-slate-100/80">
          <div className="md:col-span-8 flex flex-col items-center justify-center gap-3 py-4 w-full">
            {funnelData.map((item, index) => {
              const widthPct = Math.max(30, Math.round((item.value / maxFunnelVal) * 100));
              return (
                <div 
                  key={index}
                  className="relative flex items-center justify-center text-white rounded shadow-md transition-all overflow-hidden"
                  style={{ 
                    height: '42px',
                    width: animate ? `${widthPct}%` : '0%', 
                    backgroundColor: FUNNEL_COLORS[index % FUNNEL_COLORS.length],
                    transition: `width 1.2s cubic-bezier(0.4, 0, 0.2, 1) ${index * 0.15}s` 
                  }}
                >
                  <div className="whitespace-nowrap font-bold text-xs sm:text-sm tracking-wide transition-opacity duration-700" style={{ opacity: animate ? 1 : 0 }}>
                    {item.stage}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="md:col-span-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100 w-full">
            <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-4">Conversion Stats</h4>
            <div className="space-y-4">
              {funnelData.map((item, idx) => {
                const pct = Math.round((item.value / maxFunnelVal) * 100);
                return (
                  <div key={idx}>
                    <div className="flex justify-between items-center mb-1.5">
                      <div className="flex items-center gap-2.5">
                        <span className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: FUNNEL_COLORS[idx] }} />
                        <span className="text-xs font-bold text-slate-700">{item.stage}</span>
                      </div>
                      <span className="text-xs font-extrabold text-slate-800">${Number(item.value).toLocaleString()}</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                      <div
                        style={{ width: animate ? `${pct}%` : '0%', backgroundColor: FUNNEL_COLORS[idx], transition: `width 1.2s cubic-bezier(0.4,0,0.2,1) ${idx * 0.08}s` }}
                        className="h-full rounded-full shadow-[inset_0_1px_rgba(255,255,255,0.3)]"
                      />
                    </div>
                  </div>
                );
              })}
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-white text-lg">
                  Lead Audit History
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  {activeHistoryRecord.data?.firstName} {activeHistoryRecord.data?.lastName}
                </p>
              </div>
              <button 
                onClick={() => setActiveHistoryRecord(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-500 dark:text-slate-400 transition-colors"
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
                    <h4 className="text-xs font-bold text-slate-450 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Icons.File className="w-3.5 h-3.5 text-amber-500" /> Attached Documents ({historyDocuments.length})
                    </h4>
                    {historyDocuments.length > 0 ? (
                      <div className="space-y-2">
                        {historyDocuments.map((doc: any) => (
                          <div key={doc._id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-805">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Icons.FileText className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{doc.name}</p>
                                <p className="text-[10px] text-slate-400">{(doc.size / 1024).toFixed(1)} KB</p>
                              </div>
                            </div>
                            <a 
                              href={`http://localhost:5000${doc.filePath}`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
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
                    <h4 className="text-xs font-bold text-slate-455 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Icons.Clock className="w-3.5 h-3.5 text-indigo-500" /> System Activities
                    </h4>
                    {historyActivities.length > 0 ? (
                      <div className="relative border-l border-slate-100 dark:border-slate-800 ml-2.5 pl-5 space-y-5">
                        {historyActivities.map((act: any) => (
                          <div key={act._id} className="relative">
                            <span className="absolute -left-[26px] top-1 w-3 h-3 rounded-full bg-indigo-500 ring-4 ring-white dark:ring-slate-900" />
                            <div className="text-xs">
                              <p className="font-semibold text-slate-700 dark:text-slate-200">{act.action}</p>
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
            <div className="p-4 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button 
                onClick={() => setActiveHistoryRecord(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-xl transition-colors"
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
