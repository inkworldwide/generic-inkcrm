import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { useModuleStore } from '../store/moduleStore';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { useToastStore } from '../store/toastStore';
import loginLogo from '../assets/login-logo.png';
import * as Icons from 'lucide-react';
import {
  SidebarItem,
  SidebarAccordion,
  SidebarSubAccordion,
  SidebarGroup,
  SidebarProfile,
  cn
} from './layout/SidebarComponents';

// Dynamic Icon resolver (Required by Dashboard and ModuleView)
export const DynamicIcon = ({ name, className = 'w-5 h-5' }: { name: string; className?: string }) => {
  const IconComponent = (Icons as any)[name] || Icons.FileText;
  return <IconComponent className={className} />;
};

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 1024);
  const { modules, fetchModules } = useModuleStore();
  const { user, logout, canAccessMenu } = useAuthStore();
  const { branding, fetchBranding } = useThemeStore();
  const { toasts, hideToast, confirm, hideConfirm, alertModal, hideAlertModal } = useToastStore();

  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark' || (localStorage.getItem('theme') === null && branding?.themeSettings?.mode === 'dark');
  });
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const handleGlobalSearch = async (val: string) => {
    setSearchQuery(val);
    if (!val.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await api.get('/search', { params: { q: val } });
      setSearchResults(res.data || []);
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      setIsSearching(false);
    }
  };

  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    if (!branding) {
      const cachedSub = localStorage.getItem('tenantSubdomain') || 'sales';
      fetchBranding(cachedSub);
    }
  }, [branding, fetchBranding]);

  const { data: leadsData } = useQuery({
    queryKey: ['sidebar-leads'],
    queryFn: async () => {
      const res = await api.get('/records/leads', { params: { limit: 100 } });
      return res.data;
    },
    refetchInterval: (query) => (query.state.error ? false : 5000)
  });

  const { data: dbStatuses } = useQuery({
    queryKey: ['statuses-list'],
    queryFn: async () => {
      const res = await api.get('/statuses');
      return res.data || [];
    },
    refetchInterval: (query) => (query.state.error ? false : 5000)
  });

  const queryClient = useQueryClient();

  const { data: notificationsData, refetch: refetchNotifications } = useQuery({
    queryKey: ['user-notifications'],
    queryFn: async () => {
      const res = await api.get('/notifications', { params: { limit: 20 } });
      return res.data;
    },
    refetchInterval: (query) => (query.state.error ? false : 5000),
    enabled: !!user
  });

  const { data: unreadData, refetch: refetchUnread } = useQuery({
    queryKey: ['unread-notifications-count'],
    queryFn: async () => {
      const res = await api.get('/notifications/unread-count');
      return res.data;
    },
    refetchInterval: (query) => (query.state.error ? false : 5000),
    enabled: !!user
  });

  const handleMarkAsRead = async (id: string, link?: string) => {
    try {
      await api.put(`/notifications/${id}/read`);
      refetchNotifications();
      refetchUnread();
      if (link) {
        setShowNotifications(false);
        navigate(link);
      }
    } catch (e) {
      console.error('Failed to mark notification read', e);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      refetchNotifications();
      refetchUnread();
    } catch (e) {
      console.error('Failed to mark all read', e);
    }
  };

  const handleClearAllNotifications = async () => {
    try {
      await api.delete('/notifications/clear-all');
      refetchNotifications();
      refetchUnread();
    } catch (e) {
      console.error('Failed to clear notifications', e);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  useEffect(() => {
    fetchModules();
    
    // Global keyboard shortcut for search
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#F8F5F1] dark:bg-[#0f1115] text-[#1F2937] dark:text-white selection:bg-navy-800/20 selection:text-navy-800 flex flex-col">
      
      {/* Clean Subtle Background Layer */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 bg-[#F8F5F1] dark:bg-[#0f1115]" />

      <div className="relative z-10 flex h-full w-full p-2 sm:p-4 gap-4 overflow-hidden">
        
        {/* Mobile Backdrop */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-[#0f1115]/60 backdrop-blur-md z-40 lg:hidden"
            />
          )}
        </AnimatePresence>

        {/* Pure White Light Sidebar with Rich Elevation Shadow */}
        <aside className={cn(
          "fixed inset-y-2 sm:inset-y-4 left-2 sm:left-4 z-50 lg:relative lg:inset-auto",
          "flex-shrink-0 rounded-2xl bg-white !bg-white border border-[#E5E7EB] shadow-[0_4px_25px_rgba(0,0,0,0.08),4px_0_15px_rgba(0,0,0,0.05)] flex flex-col h-full transition-all duration-250 ease-in-out",
          isCollapsed ? "w-[68px]" : "w-[250px]",
          sidebarOpen ? "translate-x-0" : "-translate-x-[120%]",
          "lg:translate-x-0"
        )}>
          
          {/* Sleek Premium Enterprise Logo Header */}
          <div className="h-[72px] px-3.5 flex items-center gap-3 border-b border-[#E5E7EB] bg-gradient-to-r from-white via-slate-50/40 to-indigo-50/20 rounded-t-2xl min-w-0 select-none">
            <div className="w-11 h-11 rounded-xl bg-white p-1 flex items-center justify-center shadow-md shadow-indigo-950/5 flex-shrink-0 border border-slate-200/80 transition-all duration-200 overflow-hidden">
              <img 
                src={branding?.logoUrl || loginLogo} 
                alt="Logo" 
                className="w-full h-full object-contain" 
              />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0 text-left">
                <span className="text-[14px] font-extrabold text-[#111827] tracking-tight truncate leading-tight font-sans">
                  {branding?.name || 'inkSales Enterprises'}
                </span>
                <span className="text-[9.5px] font-bold text-indigo-600 uppercase tracking-wider leading-none mt-1">
                  Enterprise CRM
                </span>
              </div>
            )}
          </div>

          {/* Navigation Items Area */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            
            {/* Group 1: Quick Actions */}
            <SidebarGroup title="QUICK ACTIONS" isCollapsed={isCollapsed}>
              {(!branding || branding.enabledModules.includes('leads')) && (
                <SidebarItem 
                  to="/modules/leads/new" 
                  label="CREATE LEAD" 
                  icon={Icons.UserPlus} 
                  colorClass="text-emerald-400"
                  isCollapsed={isCollapsed}
                />
              )}
              <SidebarItem 
                to="/my-campaign" 
                label="MY CAMPAIGN" 
                icon={Icons.Megaphone} 
                colorClass="text-orange-400"
                isCollapsed={isCollapsed}
              />
            </SidebarGroup>

            {/* Group 2: Main Menu */}
            {(canAccessMenu('dashboard') ||
              canAccessMenu('leads') ||
              canAccessMenu('campaigns') ||
              canAccessMenu('campaignassignments') ||
              canAccessMenu('lead_reports') ||
              canAccessMenu('telecaller_reports') ||
              canAccessMenu('telecaller_monthly') ||
              canAccessMenu('funnel_daily') ||
              canAccessMenu('funnel_monthly') ||
              canAccessMenu('funnel_annual') ||
              modules.some(m => canAccessMenu(m.apiPath))) && (
              <SidebarGroup title="MAIN MENU" isCollapsed={isCollapsed}>
                {canAccessMenu('dashboard') && (
                  <SidebarItem 
                    to="/" 
                    label="DASHBOARD" 
                    icon={Icons.LayoutDashboard} 
                    colorClass="text-indigo-400"
                    isCollapsed={isCollapsed}
                  />
                )}

                {/* Dynamic Modules */}
                {modules.filter(m => {
                  const hiddenSettingsModules = ['departments', 'products', 'bankmasters', 'bankingpartners', 'companies', 'deals'];
                  if (hiddenSettingsModules.includes(m.apiPath.toLowerCase())) return false;
                  if (!canAccessMenu(m.apiPath.toLowerCase())) return false;
                  if (!branding) return true;
                  return branding.enabledModules.includes(m.apiPath.toLowerCase());
                }).map(m => {
                  let icon = Icons.FileText;
                  let colorClass = "text-indigo-400";
                  
                  const path = m.apiPath.toLowerCase();
                  if (path === 'leads') {
                    icon = Icons.Layers;
                    colorClass = "text-indigo-400";
                  } else if (path === 'deals') {
                    icon = Icons.DollarSign;
                    colorClass = "text-emerald-400";
                  } else if (path === 'companies') {
                    icon = Icons.Building2;
                    colorClass = "text-cyan-400";
                  } else if (path === 'campaigns') {
                    icon = Icons.Target;
                    colorClass = "text-orange-400";
                  } else if (path === 'campaignassignments') {
                    icon = Icons.UserCheck;
                    colorClass = "text-orange-400";
                  } else if (path === 'students') {
                    icon = Icons.GraduationCap;
                    colorClass = "text-pink-400";
                  } else if (path === 'courses') {
                    icon = Icons.BookOpen;
                    colorClass = "text-teal-400";
                  } else if (path === 'patients') {
                    icon = Icons.HeartPulse;
                    colorClass = "text-rose-400";
                  } else if (path === 'appointments') {
                    icon = Icons.Calendar;
                    colorClass = "text-sky-400";
                  } else if (m.icon) {
                    icon = (Icons as any)[m.icon] || Icons.FileText;
                  }

                  if (path === 'leads') {
                    if (!canAccessMenu('leads')) return null;
                    return (
                      <SidebarAccordion 
                        key={m._id} 
                        label="LEADS PROCESS" 
                        icon={icon} 
                        colorClass={colorClass} 
                        defaultOpen={false}
                        isCollapsed={isCollapsed}
                      >
                        <SidebarItem 
                          to="/modules/leads" 
                          label="ALL LEADS" 
                          icon={Icons.Layers} 
                          colorClass="text-indigo-400" 
                          indent 
                          badge={leadsData?.pagination?.totalRecords || leadsData?.records?.length || 0} 
                          isCollapsed={isCollapsed}
                        />
                        {(() => {
                          const getStatusIcon = (statusName: string, iconName?: string) => {
                            if (iconName && (Icons as any)[iconName]) {
                              return (Icons as any)[iconName];
                            }
                            const lower = statusName.toLowerCase();
                            if (lower.includes('new') || lower.includes('fresh')) return Icons.Sparkles;
                            if (lower.includes('hot')) return Icons.Flame;
                            if (lower.includes('warm')) return Icons.Sun;
                            if (lower.includes('cedil')) return Icons.FileWarning;
                            if (lower.includes('document') || lower.includes('doc')) return Icons.FileText;
                            if (lower.includes('approval') || lower.includes('approve')) return Icons.Clock;
                            if (lower.includes('approved')) return Icons.CheckCircle;
                            if (lower.includes('disburs') || lower.includes('paid')) return Icons.Banknote;
                            if (lower.includes('reject') || lower.includes('decline')) return Icons.XOctagon;
                            if (lower.includes('follow') || lower.includes('call')) return Icons.PhoneCall;
                            if (lower.includes('drop') || lower.includes('lost')) return Icons.ArrowDownCircle;
                            if (lower.includes('pending') || lower.includes('wait')) return Icons.Hourglass;
                            if (lower.includes('kyc') || lower.includes('verify')) return Icons.ShieldCheck;
                            if (lower.includes('underwrit')) return Icons.FileCheck;
                            return Icons.Tag;
                          };

                          const getStatusColor = (statusName: string, colorHex?: string) => {
                            const lower = statusName.toLowerCase();
                            if (lower.includes('hot') || lower.includes('reject') || lower.includes('drop')) return 'text-rose-400';
                            if (lower.includes('warm') || lower.includes('pending') || lower.includes('cedil')) return 'text-amber-400';
                            if (lower.includes('approved') || lower.includes('disburs') || lower.includes('success')) return 'text-emerald-400';
                            if (lower.includes('document')) return 'text-teal-400';
                            if (lower.includes('approval')) return 'text-orange-400';
                            if (lower.includes('follow')) return 'text-sky-400';
                            if (lower.includes('new')) return 'text-indigo-400';
                            return 'text-indigo-400';
                          };

                          const activeStatuses = (Array.isArray(dbStatuses) && dbStatuses.length > 0)
                            ? dbStatuses
                            : [
                                { name: 'New', icon: 'Sparkles', color: '#4F46E5' },
                                { name: 'Hot', icon: 'Flame', color: '#EF4444' },
                                { name: 'Warm', icon: 'Sun', color: '#F59E0B' },
                                { name: 'Cedil Pending', icon: 'FileWarning', color: '#EC4899' },
                                { name: 'Document Pending', icon: 'FileText', color: '#14B8A6' },
                                { name: 'Approval Pending', icon: 'Clock', color: '#F97316' },
                                { name: 'Approved', icon: 'CheckCircle', color: '#10B981' },
                                { name: 'Disbursed', icon: 'Banknote', color: '#84CC16' },
                                { name: 'Rejected', icon: 'XOctagon', color: '#F43F5E' },
                                { name: 'Followup', icon: 'PhoneCall', color: '#0EA5E9' },
                                { name: 'Dropped', icon: 'ArrowDownCircle', color: '#EF4444' },
                                { name: 'Pending', icon: 'Hourglass', color: '#EAB308' },
                              ];

                          const records = leadsData?.records || [];
                          return activeStatuses.map((st: any) => {
                            const statusName = st.name || '';
                            const count = records.filter((r: any) =>
                              (r.data?.status || '').toString().trim().toLowerCase() === statusName.trim().toLowerCase()
                            ).length;
                            return (
                              <SidebarItem
                                key={st._id || statusName}
                                to={`/modules/leads?status=${encodeURIComponent(statusName)}`}
                                label={statusName.toUpperCase()}
                                icon={getStatusIcon(statusName, st.icon)}
                                colorClass={getStatusColor(statusName, st.color)}
                                indent
                                badge={count}
                                isCollapsed={isCollapsed}
                              />
                            );
                          });
                        })()}
                      </SidebarAccordion>
                    );
                  }

                  return (
                    <SidebarItem 
                      key={m._id} 
                      to={`/modules/${m.apiPath}`} 
                      label={m.pluralLabel.toUpperCase()} 
                      icon={icon} 
                      colorClass={colorClass}
                      isCollapsed={isCollapsed}
                    />
                  );
                })}

                {/* Campaigns accordion */}
                {modules.some(m => m.apiPath === 'campaigns') && (!branding || branding.enabledModules.includes('leads') || branding.enabledModules.includes('campaigns')) && (canAccessMenu('campaigns') || canAccessMenu('campaignassignments')) && (
                  <SidebarAccordion label="CAMPAIGNS" icon={Icons.Megaphone} colorClass="text-orange-400" isCollapsed={isCollapsed}>
                    {canAccessMenu('campaigns') && (
                      <SidebarItem to="/modules/campaigns" label="CAMPAIGN LIST" icon={Icons.Target} colorClass="text-orange-400" indent isCollapsed={isCollapsed} />
                    )}
                    {canAccessMenu('campaignassignments') && (
                      <SidebarItem to="/modules/campaignassignments" label="ASSIGN CAMPAIGN" icon={Icons.UserCheck} colorClass="text-orange-400" indent isCollapsed={isCollapsed} />
                    )}
                  </SidebarAccordion>
                )}

                {/* Reports accordion */}
                {(canAccessMenu('lead_reports') || canAccessMenu('telecaller_reports') || canAccessMenu('telecaller_monthly')) && (
                  <SidebarAccordion label="REPORTS & ANALYTICS" icon={Icons.BarChart3} colorClass="text-emerald-400" isCollapsed={isCollapsed}>
                    {canAccessMenu('lead_reports') && (
                      <SidebarItem to="/reports/lead-reports" label="LEAD REPORTS" icon={Icons.ListFilter} colorClass="text-emerald-400" indent isCollapsed={isCollapsed} />
                    )}
                    {canAccessMenu('telecaller_reports') && (
                      <SidebarItem to="/reports/telecaller-reports" label="TELECALLER'S REPORTS" icon={Icons.PhoneCall} colorClass="text-emerald-400" indent isCollapsed={isCollapsed} />
                    )}
                    {canAccessMenu('telecaller_monthly') && (
                      <SidebarItem to="/reports/telecaller-monthly" label="TELECALLER'S MONTHLY" icon={Icons.Calendar} colorClass="text-emerald-400" indent isCollapsed={isCollapsed} />
                    )}
                  </SidebarAccordion>
                )}

                {/* Separate Funnel Accordion */}
                {(canAccessMenu('funnel_daily') || canAccessMenu('funnel_monthly') || canAccessMenu('funnel_annual')) && (
                  <SidebarAccordion label="FUNNEL" icon={Icons.Filter} colorClass="text-indigo-500" isCollapsed={isCollapsed}>
                    {canAccessMenu('funnel_daily') && (
                      <SidebarItem to="/reports/funnel-daily" label="DAILY FUNNEL" icon={Icons.CalendarRange} colorClass="text-indigo-500" indent isCollapsed={isCollapsed} />
                    )}
                    {canAccessMenu('funnel_monthly') && (
                      <SidebarItem to="/reports/funnel-monthly" label="MONTHLY FUNNEL" icon={Icons.CalendarDays} colorClass="text-indigo-500" indent isCollapsed={isCollapsed} />
                    )}
                    {canAccessMenu('funnel_annual') && (
                      <SidebarItem to="/reports/funnel-annual" label="ANNUAL FUNNEL" icon={Icons.TrendingUp} colorClass="text-indigo-500" indent isCollapsed={isCollapsed} />
                    )}
                  </SidebarAccordion>
                )}
              </SidebarGroup>
            )}

            {/* Group 3: Administration */}
            {(canAccessMenu('settings') || canAccessMenu('access_privilege') || canAccessMenu('lead_transfer') || canAccessMenu('users_management')) && (
              <SidebarGroup title="ADMINISTRATION" isCollapsed={isCollapsed}>
                {canAccessMenu('settings') && (
                  <SidebarItem to="/settings" label="SETTINGS" icon={Icons.Settings} colorClass="text-amber-400" isCollapsed={isCollapsed} />
                )}

                {(canAccessMenu('access_privilege') || canAccessMenu('lead_transfer')) && (
                  <SidebarAccordion label="SECURITY" icon={Icons.ShieldCheck} colorClass="text-red-400" defaultOpen={true} isCollapsed={isCollapsed}>
                    {canAccessMenu('access_privilege') && (
                      <SidebarItem to="/access-privilege" label="ACCESS PRIVILEGE" icon={Icons.ShieldCheck} colorClass="text-red-400" indent isCollapsed={isCollapsed} />
                    )}
                    {canAccessMenu('lead_transfer') && (
                      <SidebarItem to="/lead-transfer" label="LEAD TRANSFER" icon={Icons.Send} colorClass="text-red-400" indent isCollapsed={isCollapsed} />
                    )}
                  </SidebarAccordion>
                )}

                {canAccessMenu('users_management') && (
                  <SidebarItem to="/users-management" label="USERS MANAGEMENT" icon={Icons.Users} colorClass="text-pink-400" isCollapsed={isCollapsed} />
                )}
              </SidebarGroup>
            )}
          </div>

          {/* Single Row Profile Footer */}
          <SidebarProfile isCollapsed={isCollapsed} />
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 min-h-0 rounded-[26px] bg-white dark:bg-slate-900 shadow-[0_4px_24px_rgba(23,34,59,0.04)] overflow-hidden flex flex-col relative border border-[#EAE4DA]">
          
          {/* Dashboard Header */}
          <header className="h-[70px] sm:h-[80px] flex-shrink-0 bg-[#FDFBF7]/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-[#EAE4DA] dark:border-slate-800/60 flex items-center justify-between px-4 sm:px-8 z-20 transition-colors duration-300">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-slate-600 hover:bg-[#F8F5F1] dark:hover:bg-slate-800 rounded-xl transition-colors -ml-2"
              >
                <Icons.Menu className="w-5 h-5 dark:text-slate-400" />
              </button>
              <div className="flex flex-col text-left">
                <h2 className="text-lg font-bold text-[#0F172A] dark:text-white tracking-tight leading-snug">
                  {(() => {
                    const path = location.pathname;
                    if (path === '/reports/lead-reports') return 'Lead Reports';
                    if (path === '/reports/telecaller-reports') return "Telecaller's Reports";
                    if (path === '/reports/telecaller-monthly') return "Telecaller's Monthly Report";
                    if (path === '/reports/campaign-report') return 'My Campaign Report';
                    if (path === '/reports/funnel-daily') return 'Daily Lead Funnel';
                    if (path === '/reports/funnel-monthly') return 'Monthly Lead Funnel';
                    if (path === '/reports/funnel-annual') return 'Annual Lead Funnel';
                    if (path === '/reports') return 'Reports & Analytics';
                    if (path === '/users-management') return 'Users Management';
                    if (path === '/settings') return 'Settings';
                    if (path === '/access-privilege') return 'Access Privilege';
                    if (path === '/lead-transfer') return 'Lead Transfer';
                    if (path === '/my-campaign') return 'My Campaign';
                    if (path === '/workflows') return 'Workflows & Automation';
                    if (path === '/status') return 'Status Pipeline Stages';
                    if (path === '/modules/leads/new') return 'Create Lead';
                    if (path.startsWith('/modules/leads')) return 'Leads Process';
                    if (path.startsWith('/modules/deals')) return 'Deals';
                    if (path.startsWith('/modules/campaigns')) return 'Campaigns';
                    if (path.startsWith('/modules/campaignassignments')) return 'Assign Campaign';
                    if (path.startsWith('/modules/')) {
                      const parts = path.split('/');
                      const modApi = parts[2];
                      const found = modules.find(m => m.apiPath.toLowerCase() === modApi?.toLowerCase());
                      if (parts.length > 3 && parts[3] === 'new') {
                        return `Create ${found?.name || 'Record'}`;
                      }
                      if (parts.length > 3) {
                        return `Edit ${found?.name || 'Record'}`;
                      }
                      if (found) return found.pluralLabel || found.name;
                      return 'Module';
                    }
                    return 'Dashboard Overview';
                  })()}
                </h2>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {(() => {
                    const path = location.pathname;
                    if (path === '/reports/lead-reports') return 'Filter, generate, and analyze lead distribution by month, year, status, and loan type.';
                    if (path === '/reports/telecaller-reports') return 'Detailed call logs, lead allocations, and agent productivity performance audit.';
                    if (path === '/reports/telecaller-monthly') return 'Monthly target tracking, telecaller performance matrix, and historical revenue trends.';
                    if (path === '/reports/campaign-report') return 'Individual campaign lead performance, calls conducted, and conversion metrics.';
                    if (path === '/reports/funnel-daily') return 'Analyze daily lead flow, day-of-week trends, and stage conversions.';
                    if (path === '/reports/funnel-monthly') return 'Campaign lead status breakdown, conversion ring chart, and monthly progression.';
                    if (path === '/reports/funnel-annual') return 'Yearly lead distribution, 12-month funnel progression, and annual yield.';
                    if (path === '/reports') return 'Visual report designer and automated performance reports.';
                    if (path === '/users-management') return 'Manage team members, roles, permissions, and reporting hierarchies.';
                    if (path === '/settings') return 'Configure organization branding, modules, and system preferences.';
                    if (path === '/access-privilege') return 'Configure role-based navigation menu access and data visibility across the CRM.';
                    if (path === '/lead-transfer') return 'Reassign leads and bulk transfers across telecallers and sales managers.';
                    if (path === '/my-campaign') return 'Quick calling workspace and customer interaction queue.';
                    if (path === '/workflows') return 'Manage automated triggers, rules, and business processes.';
                    if (path === '/status') return 'Configure custom lead statuses, progression pipeline, and display colors.';
                    if (path.startsWith('/modules/leads/new')) return 'Create a new customer lead with complete contact and qualification details.';
                    if (path.startsWith('/modules/leads')) return 'View, manage, and track client lead records.';
                    if (path.startsWith('/modules/deals')) return 'Pipeline opportunities and sales deal stages.';
                    if (path.startsWith('/modules/campaigns')) return 'Marketing campaigns and audience targeting drive.';
                    if (path.startsWith('/modules/campaignassignments')) return 'Batch lead assignment to telecallers and marketing agents.';
                    if (path.startsWith('/modules/')) return 'Manage records, custom fields, and data workflows.';
                    return "Welcome back. Here is today's business summary.";
                  })()}
                </p>
              </div>
            </div>

            {/* Header Global Search Bar */}
            <div className="hidden md:flex items-center relative max-w-xs lg:max-w-md w-full mx-4">
              <div className="relative w-full flex items-center">
                <Icons.Search className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleGlobalSearch(e.target.value)}
                  placeholder="Search lead no, contact no, name, firm..."
                  className="w-full h-9 pl-9 pr-14 text-xs bg-slate-100/80 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-slate-800 dark:text-white font-semibold placeholder:text-slate-400 transition-all shadow-2xs"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                    className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <Icons.X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <kbd className="absolute right-3 hidden lg:inline-block text-[9px] font-mono font-bold text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded shadow-2xs">
                    ⌘K
                  </kbd>
                )}
              </div>

              {/* Global Search Results Dropdown */}
              <AnimatePresence>
                {searchQuery && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setSearchQuery('')} />
                    <motion.div 
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                      className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl overflow-hidden max-h-96 overflow-y-auto z-40 p-2 space-y-2 text-left"
                    >
                      {isSearching ? (
                        <div className="p-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2 font-medium">
                          <Icons.Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                          Searching leads...
                        </div>
                      ) : searchResults.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-400 font-medium">
                          No lead, contact, or firm matching "{searchQuery}"
                        </div>
                      ) : (
                        searchResults.map(({ module, records }) => (
                          <div key={module._id} className="space-y-1">
                            <div className="px-3 py-1 bg-slate-50 dark:bg-slate-800/80 rounded-lg text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                              <Icons.Layers className="w-3 h-3 text-indigo-500" />
                              {module.pluralLabel} ({records.length})
                            </div>
                            {records.map((rec: any) => {
                              const name = `${rec.data?.firstName || ''} ${rec.data?.lastName || ''}`.trim() || rec.data?.company || 'Lead Record';
                              const phone = rec.data?.phone || rec.data?.mobile || rec.data?.contactNumber || rec.data?.contact;
                              const code = rec.data?.dataCode || rec.data?.allocatedNo || rec.data?.leadNo || (rec._id ? `LND-${String(rec._id).slice(-6).toUpperCase()}` : '');
                              const company = rec.data?.company || rec.data?.firmName;

                              return (
                                <button
                                  key={rec._id}
                                  type="button"
                                  onClick={() => {
                                    setSearchQuery('');
                                    setSearchResults([]);
                                    navigate(`/modules/${module.apiPath}/${rec._id}`);
                                  }}
                                  className="w-full flex items-center justify-between p-2.5 hover:bg-indigo-50/50 dark:hover:bg-slate-800 rounded-xl transition-all text-left cursor-pointer group border border-transparent hover:border-indigo-100 dark:hover:border-slate-700"
                                >
                                  <div className="min-w-0 flex-1 pr-2">
                                    <div className="flex items-center gap-2">
                                      <p className="text-xs font-bold text-slate-850 dark:text-white truncate group-hover:text-indigo-600 transition-colors">
                                        {name}
                                      </p>
                                      {code && (
                                        <span className="text-[9px] font-extrabold bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded uppercase flex-shrink-0">
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
                                </button>
                              );
                            })}
                          </div>
                        ))
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <div className="flex items-center gap-5 relative">
              {/* Backdrops to close popovers when clicking outside */}
              {(showNotifications || showUserDropdown) && (
                <div 
                  className="fixed inset-0 z-30" 
                  onClick={() => {
                    setShowNotifications(false);
                    setShowUserDropdown(false);
                  }}
                />
              )}

              {/* Theme & Notification Buttons */}
              <div className="flex items-center gap-2 bg-slate-100/80 dark:bg-slate-800 rounded-full p-1 border border-slate-200/50 dark:border-slate-700/50 shadow-inner z-40">
                {/* Theme Toggle */}
                <button 
                  onClick={() => setDarkMode(!darkMode)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-700 shadow-sm transition-all"
                  title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                >
                  {darkMode ? (
                    <Icons.Sun className="w-4 h-4 text-amber-500 animate-pulse" />
                  ) : (
                    <Icons.Moon className="w-4 h-4" />
                  )}
                </button>

                {/* Notifications Bell */}
                <button 
                  onClick={() => {
                    setShowNotifications(!showNotifications);
                    setShowUserDropdown(false);
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-700 shadow-sm transition-all relative"
                  title="View Alerts & Notifications"
                >
                  <Icons.Bell className="w-4 h-4" />
                  {unreadData?.unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 bg-rose-500 text-white text-[9px] font-extrabold rounded-full flex items-center justify-center animate-pulse border-2 border-white dark:border-slate-800">
                      {unreadData.unreadCount > 9 ? '9+' : unreadData.unreadCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Notifications Popover */}
              <AnimatePresence>
                {showNotifications && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 md:right-[110px] top-12 w-[calc(100vw-32px)] sm:w-88 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-slate-950/80 p-4 z-40"
                  >
                    <div className="flex justify-between items-center pb-2.5 border-b border-slate-100 dark:border-slate-800 mb-3">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                          <Icons.Bell className="w-3.5 h-3.5 text-indigo-500" /> Notifications
                        </h4>
                        {unreadData?.unreadCount > 0 && (
                          <span className="text-[10px] bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-full font-bold">
                            {unreadData.unreadCount} New
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px]">
                        {unreadData?.unreadCount > 0 && (
                          <button
                            onClick={handleMarkAllAsRead}
                            className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 font-bold hover:underline cursor-pointer"
                          >
                            Mark all read
                          </button>
                        )}
                        {notificationsData && notificationsData.length > 0 && (
                          <button
                            onClick={handleClearAllNotifications}
                            className="text-slate-400 hover:text-rose-500 font-medium cursor-pointer"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {notificationsData && notificationsData.length > 0 ? (
                        notificationsData.map((item: any) => (
                          <div 
                            key={item._id} 
                            onClick={() => handleMarkAsRead(item._id, item.link)}
                            className={`flex gap-3 items-start p-2.5 rounded-xl border transition-all cursor-pointer text-left ${
                              !item.isRead
                                ? 'bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-100 dark:border-indigo-900/50 hover:bg-indigo-100/50'
                                : 'bg-white dark:bg-slate-900 border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60'
                            }`}
                          >
                            <div className={`p-1.5 rounded-xl mt-0.5 flex-shrink-0 ${
                              item.title?.includes('Assigned') || item.title?.includes('Transferred')
                                ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                                : item.type === 'success'
                                  ? 'bg-emerald-500/10 text-emerald-600'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                            }`}>
                              {item.title?.includes('Assigned') || item.title?.includes('Transferred') ? (
                                <Icons.UserCheck className="w-3.5 h-3.5" />
                              ) : (
                                <Icons.Sparkles className="w-3.5 h-3.5" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-0.5">
                                <p className={`text-xs font-bold truncate ${
                                  !item.isRead ? 'text-indigo-950 dark:text-white' : 'text-slate-700 dark:text-slate-300'
                                }`}>
                                  {item.title}
                                </p>
                                <span className="text-[10px] text-slate-400 flex-shrink-0 font-medium">
                                  {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug line-clamp-2">
                                {item.message}
                              </p>
                            </div>

                            {!item.isRead && (
                              <span className="w-2 h-2 rounded-full bg-indigo-600 flex-shrink-0 mt-1.5"></span>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-slate-400 text-xs">
                          <Icons.BellOff className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                          No notifications yet.
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 z-40"></div>

              {/* User Dropdown Button */}
              <div 
                onClick={() => {
                  setShowUserDropdown(!showUserDropdown);
                  setShowNotifications(false);
                }}
                className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-1.5 rounded-full pr-4 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 z-40"
              >
                <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                  {user ? `${user.firstName?.charAt(0) || ''}${user.lastName?.charAt(0) || ''}`.toUpperCase() || 'AD' : 'AD'}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 leading-none">{user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Admin User' : 'Admin User'}</p>
                  <p className="text-[10px] text-slate-400 font-medium mt-1">{user?.email || 'ink@crm.com'}</p>
                </div>
                <Icons.ChevronDown className="w-4 h-4 text-slate-400 ml-2" />
              </div>

              {/* User Dropdown Menu */}
              <AnimatePresence>
                {showUserDropdown && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 top-14 w-52 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-slate-950/80 py-2.5 z-40"
                  >
                    <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 mb-2 text-left">
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Signed in as</p>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate mt-0.5">{user?.email || 'ink@crm.com'}</p>
                    </div>

                    <button
                      onClick={() => {
                        setShowUserDropdown(false);
                        navigate('/settings');
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2.5"
                    >
                      <Icons.Settings className="w-4 h-4 text-indigo-500" />
                      Account Settings
                    </button>

                    <button
                      onClick={() => {
                        setShowUserDropdown(false);
                        handleLogout();
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors flex items-center gap-2.5 border-t border-slate-100 dark:border-slate-800 mt-2 pt-2.5"
                    >
                      <Icons.LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </header>

          {/* Scrollable Main Content Area */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col bg-[#fdfbf7] dark:bg-slate-900 custom-scrollbar">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="flex-1 flex flex-col p-4 sm:p-6 text-slate-800 dark:text-slate-100 min-h-full"
              >
                <div className="flex-1">
                  {children}
                </div>

                <footer className="mt-8 pt-4 pb-2 border-t border-slate-200/60 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-semibold text-slate-400 flex-shrink-0">
                  <div>
                    <span>© {new Date().getFullYear()} {branding?.name || 'INK CRM'}. All Rights Reserved.</span>
                  </div>
                  <div className="flex gap-4">
                    <a href="#" className="hover:text-indigo-600 transition-colors">Privacy Policy</a>
                    <span className="text-slate-200 dark:text-slate-700">|</span>
                    <a href="#" className="hover:text-indigo-600 transition-colors">Terms of Service</a>
                  </div>
                </footer>
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Premium Toast Notifications Overlay */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-3 max-w-md w-[calc(100vw-40px)] pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => {
            let bgColor = 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100';
            let icon = <Icons.Info className="w-5 h-5 text-blue-500" />;
            if (toast.type === 'success') {
              bgColor = 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300';
              icon = <Icons.CheckCircle2 className="w-5 h-5 text-emerald-505" />;
            } else if (toast.type === 'error') {
              bgColor = 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300';
              icon = <Icons.AlertCircle className="w-5 h-5 text-rose-500" />;
            } else if (toast.type === 'warning') {
              bgColor = 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300';
              icon = <Icons.AlertTriangle className="w-5 h-5 text-amber-505" />;
            }

            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: 20, x: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85, x: 50, transition: { duration: 0.2 } }}
                className={cn(
                  "p-4 rounded-2xl border shadow-lg flex items-start gap-3 pointer-events-auto backdrop-blur-md",
                  bgColor
                )}
              >
                <div className="flex-shrink-0 mt-0.5">{icon}</div>
                <div className="flex-grow text-xs font-bold leading-relaxed">{toast.message}</div>
                <button
                  onClick={() => hideToast(toast.id)}
                  className="flex-shrink-0 text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 transition-colors"
                >
                  <Icons.X className="w-4 h-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Premium Confirm Dialog Modal */}
      <AnimatePresence>
        {confirm && (
          <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={hideConfirm}
              className="absolute inset-0 bg-[#0f1115]/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl p-6 text-center z-10"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 dark:bg-amber-500/5 flex items-center justify-center mx-auto mb-4 text-amber-500">
                <Icons.HelpCircle className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-[800] text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-2">{confirm.title}</h3>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 leading-relaxed mb-6">{confirm.message}</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => {
                    if (confirm.onCancel) confirm.onCancel();
                    hideConfirm();
                  }}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors text-xs font-bold text-slate-650 dark:text-slate-350 shadow-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    confirm.onConfirm();
                    hideConfirm();
                  }}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition-colors text-xs font-bold text-white shadow-md shadow-indigo-600/20"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Premium Alert/Success Dialog Modal */}
      <AnimatePresence>
        {alertModal && (() => {
          let alertIcon = <Icons.CheckCircle className="w-6 h-6 animate-pulse" />;
          let iconBg = 'bg-emerald-500/10 text-emerald-600';
          if (alertModal.type === 'error') {
            alertIcon = <Icons.AlertOctagon className="w-6 h-6 animate-pulse" />;
            iconBg = 'bg-rose-500/10 text-rose-600';
          } else if (alertModal.type === 'warning') {
            alertIcon = <Icons.AlertTriangle className="w-6 h-6 animate-pulse" />;
            iconBg = 'bg-amber-500/10 text-amber-600';
          } else if (alertModal.type === 'info') {
            alertIcon = <Icons.Info className="w-6 h-6" />;
            iconBg = 'bg-blue-500/10 text-blue-600';
          }
          
          return (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  if (alertModal.onClose) alertModal.onClose();
                  hideAlertModal();
                }}
                className="absolute inset-0 bg-[#0f1115]/50 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ type: "spring", duration: 0.4 }}
                className="relative w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl p-6 text-center z-10"
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 ${iconBg}`}>
                  {alertIcon}
                </div>
                <h3 className="text-sm font-[800] text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-2">{alertModal.title}</h3>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 leading-relaxed mb-6">{alertModal.message}</p>
                <div className="flex justify-center">
                  <button
                    onClick={() => {
                      if (alertModal.onClose) alertModal.onClose();
                      hideAlertModal();
                    }}
                    className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition-colors text-xs font-bold text-white shadow-md shadow-indigo-600/20"
                  >
                    Got it
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
