import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
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
  SidebarGroup,
  SidebarSearch,
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
  const { fetchModules } = useModuleStore();
  const { user, logout } = useAuthStore();
  const { branding, fetchBranding } = useThemeStore();
  const { toasts, hideToast, confirm, hideConfirm } = useToastStore();

  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark' || (localStorage.getItem('theme') === null && branding?.themeSettings?.mode === 'dark');
  });
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

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

  const { data: notificationsData } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get('/audit', { params: { limit: 5 } });
      return res.data;
    },
    refetchInterval: (query) => (query.state.error ? false : 15000),
    enabled: !!user
  });

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
        // focus search input logic
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#f1f5f9] dark:bg-[#0f1115] text-slate-800 dark:text-white selection:bg-lime-500/30 selection:text-lime-200">
      
      {/* Animated Background Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-500/10 blur-[120px] rounded-full animate-blob1" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 blur-[120px] rounded-full animate-blob2" />
        <div className="absolute top-[30%] right-[20%] w-[30%] h-[30%] bg-lime-500/10 blur-[100px] rounded-full animate-blob3" />
        
        {/* Subtle noise texture */}
        <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>
      </div>

      <div className="relative z-10 flex h-screen p-2 sm:p-5 gap-5">
        
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

        {/* Floating Sidebar */}
        <aside className={cn(
          "fixed inset-y-2 sm:inset-y-5 left-2 sm:left-5 z-50 lg:relative lg:inset-0",
          "flex-shrink-0 w-[290px] rounded-[26px] bg-[#0f172a] dark:bg-[#0f1115]/95 border border-[#1e293b] shadow-[0_4px_30px_rgba(0,0,0,0.15)] flex flex-col transition-transform duration-300",
          sidebarOpen ? "translate-x-0" : "-translate-x-[120%]",
          "lg:translate-x-0"
        )}>
          
          {/* Logo Area */}
          <div className="p-6 pb-2">
            <div className="flex items-center gap-4 p-3 rounded-[18px] bg-white/[0.05] border border-white/[0.08] shadow-[0_10px_40px_rgba(255,170,0,0.15)] relative overflow-hidden group hover:shadow-[0_15px_50px_rgba(255,170,0,0.25)] transition-all duration-500">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative w-12 h-12 rounded-[14px] bg-white flex items-center justify-center p-1 shadow-md flex-shrink-0">
                <img src={branding?.logoUrl || loginLogo} alt="Ink CRM" className="w-full h-full object-contain" style={{ imageRendering: 'crisp-edges' }} />
              </div>
              <div className="flex flex-col min-w-0">
                <h1 className="text-lg sm:text-xl font-[800] tracking-tight bg-gradient-to-r from-orange-400 to-amber-300 text-transparent bg-clip-text leading-tight uppercase line-clamp-2 max-w-[170px]">
                  {branding?.name || 'INK CRM'}
                </h1>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar py-4 px-2 mt-2">
            <div className="space-y-1 px-3 mt-4">
              {/* 1. Create Lead */}
              <SidebarItem to="/modules/leads/new" label="CREATE LEAD" icon={Icons.UserPlus} colorClass="text-emerald-400" />
              
              {/* 2. Dashboard */}
              <SidebarItem to="/" label="DASHBOARD" icon={Icons.LayoutDashboard} colorClass="text-blue-400" />

              {/* 3. Campaign */}
              <SidebarAccordion label="CAMPAIGN" icon={Icons.Megaphone} colorClass="text-orange-400">
                <SidebarItem to="/modules/campaigns" label="Campaign" icon={Icons.Target} colorClass="text-orange-400" indent />
                <SidebarItem to="/modules/campaignassignments" label="Assign Campaign" icon={Icons.UserCheck} colorClass="text-orange-400" indent />
              </SidebarAccordion>

              {/* 4. Process */}
              <SidebarAccordion label="PROCESS" icon={Icons.GitMerge} colorClass="text-indigo-400" defaultOpen={true}>
                <SidebarItem to="/modules/leads" label="All Leads" icon={Icons.Layers} colorClass="text-indigo-400" indent badge={leadsData?.pagination?.totalRecords || leadsData?.records?.length || 0} />
                {(() => {
                  const statusCategories = [
                    { label: 'New', icon: Icons.Sparkles, color: 'text-indigo-400' },
                    { label: 'Hot', icon: Icons.Flame, color: 'text-red-400' },
                    { label: 'Warm', icon: Icons.Sun, color: 'text-amber-400' },
                    { label: 'Cedil Pending', icon: Icons.FileWarning, color: 'text-pink-400' },
                    { label: 'Document Pending', icon: Icons.FileText, color: 'text-teal-400' },
                    { label: 'Approval Pending', icon: Icons.Clock, color: 'text-orange-400' },
                    { label: 'Approved', icon: Icons.CheckCircle, color: 'text-green-400' },
                    { label: 'Disbursed', icon: Icons.Banknote, color: 'text-lime-400' },
                    { label: 'Rejected', icon: Icons.XOctagon, color: 'text-rose-400' },
                    { label: 'Followup', icon: Icons.PhoneCall, color: 'text-sky-400' },
                    { label: 'Dropped', icon: Icons.ArrowDownCircle, color: 'text-red-400' },
                    { label: 'Pending', icon: Icons.Hourglass, color: 'text-yellow-400' },
                  ];
                  const records = leadsData?.records || [];
                  return statusCategories.map((cat) => {
                    const count = records.filter((r: any) =>
                      (r.data?.status || '').toLowerCase() === cat.label.toLowerCase()
                    ).length;
                    return (
                      <SidebarItem
                        key={cat.label}
                        to={`/modules/leads?status=${encodeURIComponent(cat.label)}`}
                        label={cat.label}
                        icon={cat.icon}
                        colorClass={cat.color}
                        indent
                        badge={count}
                      />
                    );
                  });
                })()}
              </SidebarAccordion>

              {/* 5. Setting */}
              <SidebarItem to="/settings" label="SETTING" icon={Icons.Settings} colorClass="text-amber-400" />

              {/* 6. Security */}
              <SidebarAccordion label="SECURITY" icon={Icons.ShieldCheck} colorClass="text-red-400">
                <SidebarItem to="/access-privilege" label="Access Privilege" icon={Icons.ShieldCheck} colorClass="text-red-400" indent />
                <SidebarItem to="/lead-transfer" label="Lead Transfer" icon={Icons.Send} colorClass="text-red-400" indent />
              </SidebarAccordion>

              {/* 7. Users Management */}
              <SidebarItem to="/users-management" label="USERS MANAGEMENT" icon={Icons.Users} colorClass="text-pink-500" />
            </div>
          </div>

          <SidebarProfile />
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 rounded-[26px] bg-white dark:bg-slate-900 shadow-[0_0_40px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col relative border border-white/20">
          
          {/* Dashboard Header */}
          <header className="h-[70px] sm:h-[80px] bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-20 transition-colors duration-300">
            <div className="flex flex-col">
              <div className="flex items-center gap-2 sm:gap-3 mb-1">
                <button 
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden p-1.5 -ml-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  <Icons.Menu className="w-5 h-5 dark:text-slate-400" />
                </button>
                <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                  <Icons.Home className="w-3 h-3 hidden sm:block" />
                  <span className="hidden sm:block">/</span>
                  <span>Dashboard</span>
                </div>
              </div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                Overview
                <span className="px-2 py-0.5 rounded-full bg-lime-100 dark:bg-lime-950/40 text-lime-700 dark:text-lime-400 text-[10px] font-bold uppercase tracking-wider ml-2">Production</span>
              </h2>
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
                  title="View Alerts"
                >
                  <Icons.Bell className="w-4 h-4" />
                  {notificationsData && notificationsData.length > 0 && (
                    <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse"></span>
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
                    className="absolute right-0 md:right-[110px] top-12 w-[calc(100vw-32px)] sm:w-80 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-slate-950/80 p-4 z-40"
                  >
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800 mb-3">
                      <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Icons.Bell className="w-3.5 h-3.5 text-indigo-500" /> Recent Actions
                      </h4>
                      <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full font-semibold">Live</span>
                    </div>

                    <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                      {notificationsData && notificationsData.length > 0 ? (
                        notificationsData.map((item: any) => (
                          <div key={item._id} className="flex gap-2.5 items-start text-xs border-b border-slate-50 dark:border-slate-800/30 pb-2.5 last:border-0 last:pb-0">
                            <div className="p-1 rounded-lg bg-slate-50 dark:bg-slate-800 text-indigo-500 mt-0.5">
                              <Icons.Activity className="w-3 h-3" />
                            </div>
                            <div className="flex-1 text-left min-w-0">
                              <p className="font-semibold text-slate-700 dark:text-slate-200 truncate">
                                {item.action}
                              </p>
                              <p className="text-[10px] text-slate-400 mt-0.5 flex justify-between">
                                <span>{item.performedBy?.firstName || 'System'}</span>
                                <span>{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-6 text-slate-400 text-xs">
                          No recent actions logged.
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

          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="flex-1 overflow-auto p-4 sm:p-5 bg-[#f8fafc] text-slate-800"
            >
              {children}
            </motion.div>
          </AnimatePresence>

          <footer className="h-14 bg-white border-t border-slate-200/60 flex items-center justify-between px-8 text-xs font-semibold text-slate-400 flex-shrink-0">
            <div>
              <span>© {new Date().getFullYear()} {branding?.name || 'INK CRM'}. All Rights Reserved.</span>
            </div>
            <div className="flex gap-4">
              <a href="#" className="hover:text-indigo-600 transition-colors">Privacy Policy</a>
              <span className="text-slate-200">|</span>
              <a href="#" className="hover:text-indigo-600 transition-colors">Terms of Service</a>
            </div>
          </footer>
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
    </div>
  );
}
