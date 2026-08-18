import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';

// Dynamic Icon resolver
const DynamicIcon = ({ name, className = 'w-4 h-4' }: { name: string; className?: string }) => {
  const IconComponent = (Icons as any)[name] || Icons.Layers;
  return <IconComponent className={className} />;
};

interface VerticalTemplate {
  _id: string;
  key: string;
  label: string;
  description?: string;
  icon: string;
  defaultModules: string[];
  themeSettings: {
    primaryColor: string;
    sidebarBg: string;
    headerBg: string;
    fontFamily: string;
    mode: string;
  };
  isCustom: boolean;
}

interface TenantAdminUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  userCode?: string;
  isActive: boolean;
}

interface TenantItem {
  id: string;
  name: string;
  subdomain: string;
  verticalType: string;
  vertical?: VerticalTemplate;
  status: 'active' | 'disabled' | 'archived';
  enabledModulesCount: number;
  enabledModules: string[];
  requestedModulesCount: number;
  requestedModules: any[];
  themeSettings?: any;
  logoUrl?: string;
  adminUser: TenantAdminUser | null;
  userCount: number;
  createdAt: string;
}

interface PlatformStats {
  totalTenants: number;
  activeTenants: number;
  disabledTenants: number;
  archivedTenants: number;
  verticalBreakdown: { verticalType: string; count: number }[];
  pendingModuleRequestsCount: number;
}

const ALL_SYSTEM_MODULES = [
  { key: 'dashboard', label: 'Dashboard & KPI Metrics', category: 'Core' },
  { key: 'leads', label: 'Leads Process & Pipeline', category: 'Sales & CRM' },
  { key: 'deals', label: 'Deals & Opportunities', category: 'Sales & CRM' },
  { key: 'companies', label: 'Companies Master', category: 'Sales & CRM' },
  { key: 'campaigns', label: 'Campaigns', category: 'Marketing' },
  { key: 'campaignassignments', label: 'Assign Campaigns', category: 'Marketing' },
  { key: 'lead_reports', label: 'Lead Reports & Excel', category: 'Analytics' },
  { key: 'telecaller_reports', label: "Telecaller's Reports", category: 'Analytics' },
  { key: 'telecaller_monthly', label: "Telecaller's Monthly", category: 'Analytics' },
  { key: 'funnel_daily', label: 'Daily Funnel', category: 'Funnel' },
  { key: 'funnel_monthly', label: 'Monthly Funnel', category: 'Funnel' },
  { key: 'funnel_annual', label: 'Annual Funnel', category: 'Funnel' },
  { key: 'reports', label: 'Custom Reports', category: 'Analytics' },
  { key: 'workflows', label: 'Workflows & Automation', category: 'Administration' },
  { key: 'status', label: 'Status Master', category: 'Administration' },
  { key: 'settings', label: 'System Settings', category: 'Administration' },
  { key: 'access_privilege', label: 'Access Privilege (RBAC)', category: 'Security' },
  { key: 'users_management', label: 'User Hierarchy & Staff', category: 'Security' },
  { key: 'students', label: 'Students Master', category: 'Vertical Modules' },
  { key: 'courses', label: 'Courses Master', category: 'Vertical Modules' },
  { key: 'patients', label: 'Patients Master', category: 'Vertical Modules' },
  { key: 'appointments', label: 'Appointments Master', category: 'Vertical Modules' }
];

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const { user, logout, loginAsTenant } = useAuthStore();
  const { showToast } = useToastStore();

  // Theme state (Persisted)
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return document.documentElement.classList.contains('dark');
  });

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [verticals, setVerticals] = useState<VerticalTemplate[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVertical, setSelectedVertical] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2 | 3 | 4>(1);
  const [showAddVerticalModal, setShowAddVerticalModal] = useState(false);
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [archiveModalTenant, setArchiveModalTenant] = useState<TenantItem | null>(null);
  const [archiveConfirmName, setArchiveConfirmName] = useState('');
  const [modulesModalTenant, setModulesModalTenant] = useState<TenantItem | null>(null);
  const [tempEnabledModules, setTempEnabledModules] = useState<string[]>([]);
  const [modulesSearch, setModulesSearch] = useState('');

  // Form State for Creating Tenant Admin
  const [newAdminFirstName, setNewAdminFirstName] = useState('');
  const [newAdminLastName, setNewAdminLastName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('Admin@2026!');
  const [newAdminPhone, setNewAdminPhone] = useState('');
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgSubdomain, setNewOrgSubdomain] = useState('');
  const [newVerticalType, setNewVerticalType] = useState('bank');
  const [newSelectedModules, setNewSelectedModules] = useState<string[]>([]);
  const [creatingTenant, setCreatingTenant] = useState(false);

  // Form State for Custom Vertical
  const [customKey, setCustomKey] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [customIcon, setCustomIcon] = useState('Layers');
  const [customModules, setCustomModules] = useState<string[]>([
    'dashboard', 'leads', 'deals', 'companies', 'campaigns', 'lead_reports', 'settings'
  ]);
  const [customColor, setCustomColor] = useState('#312E81');
  const [creatingVertical, setCreatingVertical] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, tenantsRes, verticalsRes, requestsRes] = await Promise.all([
        api.get('/super-admin/stats'),
        api.get('/super-admin/tenants', { params: { status: 'all' } }),
        api.get('/super-admin/verticals'),
        api.get('/super-admin/module-requests')
      ]);

      setStats(statsRes.data);
      setTenants(tenantsRes.data || []);
      setVerticals(verticalsRes.data || []);
      setPendingRequests(requestsRes.data || []);
    } catch (err: any) {
      console.error('Error loading super admin dashboard:', err);
      showToast('Failed to load platform data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Auto-slugify subdomain
  const handleOrgNameChange = (val: string) => {
    setNewOrgName(val);
    if (!newOrgSubdomain || newOrgSubdomain === newOrgName.toLowerCase().replace(/[^a-z0-9]/g, '')) {
      setNewOrgSubdomain(val.toLowerCase().replace(/[^a-z0-9]/g, ''));
    }
  };

  const handleVerticalSelect = (vKey: string) => {
    setNewVerticalType(vKey);
    const vert = verticals.find(v => v.key === vKey);
    if (vert && vert.defaultModules) {
      setNewSelectedModules(vert.defaultModules);
    } else {
      setNewSelectedModules(['dashboard', 'leads', 'deals', 'companies', 'campaigns', 'lead_reports', 'settings']);
    }
  };

  const handleOpenCreateModal = () => {
    const defaultVert = verticals[0]?.key || 'bank';
    const vert = verticals.find(v => v.key === defaultVert);
    setCreateStep(1);
    setNewAdminFirstName('');
    setNewAdminLastName('');
    setNewAdminEmail('');
    setNewAdminPassword('Admin@2026!');
    setNewAdminPhone('');
    setNewOrgName('');
    setNewOrgSubdomain('');
    setNewVerticalType(defaultVert);
    setNewSelectedModules(vert?.defaultModules || ['dashboard', 'leads', 'deals', 'companies', 'campaigns', 'lead_reports', 'settings']);
    setShowCreateModal(true);
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName || !newOrgSubdomain || !newAdminEmail || !newAdminPassword || !newAdminFirstName || !newAdminLastName) {
      showToast('Please fill in all required fields.', 'error');
      return;
    }

    try {
      setCreatingTenant(true);
      await api.post('/super-admin/tenants', {
        name: newOrgName.trim(),
        subdomain: newOrgSubdomain.trim(),
        verticalType: newVerticalType,
        admin: {
          firstName: newAdminFirstName.trim(),
          lastName: newAdminLastName.trim(),
          email: newAdminEmail.trim(),
          password: newAdminPassword,
          phone: newAdminPhone.trim()
        },
        enabledModules: newSelectedModules
      });

      showToast(`Tenant "${newOrgName}" created successfully!`, 'success');
      setShowCreateModal(false);
      loadDashboardData();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to create tenant organization.', 'error');
    } finally {
      setCreatingTenant(false);
    }
  };

  const handleCreateCustomVertical = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customKey || !customLabel) {
      showToast('Vertical key and label are required.', 'error');
      return;
    }

    try {
      setCreatingVertical(true);
      await api.post('/super-admin/verticals', {
        key: customKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        label: customLabel.trim(),
        description: customDesc.trim(),
        icon: customIcon,
        defaultModules: customModules,
        themeSettings: {
          primaryColor: customColor,
          sidebarBg: '#111827',
          headerBg: '#FFFFFF',
          fontFamily: 'Inter',
          mode: 'light'
        }
      });

      showToast(`Custom vertical "${customLabel}" registered successfully!`, 'success');
      setShowAddVerticalModal(false);
      setCustomKey('');
      setCustomLabel('');
      setCustomDesc('');
      loadDashboardData();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to register custom vertical.', 'error');
    } finally {
      setCreatingVertical(false);
    }
  };

  // Toggle Tenant Active / Suspended
  const handleToggleStatus = async (tenant: TenantItem) => {
    const newStatus = tenant.status === 'active' ? 'disabled' : 'active';
    try {
      await api.patch(`/super-admin/tenants/${tenant.id}/status`, { status: newStatus });
      showToast(`Tenant "${tenant.name}" is now ${newStatus === 'active' ? 'Active' : 'Suspended'}.`, 'success');
      setTenants(prev => prev.map(t => t.id === tenant.id ? { ...t, status: newStatus } : t));
      loadDashboardData();
    } catch (err: any) {
      showToast('Failed to update tenant status.', 'error');
    }
  };

  // Confirm Soft Delete (Archive)
  const handleArchiveConfirm = async () => {
    if (!archiveModalTenant) return;
    if (archiveConfirmName.trim() !== archiveModalTenant.name.trim()) {
      showToast('Organization name does not match. Archival canceled.', 'error');
      return;
    }

    try {
      await api.patch(`/super-admin/tenants/${archiveModalTenant.id}/status`, { status: 'archived' });
      showToast(`Tenant "${archiveModalTenant.name}" has been safely archived.`, 'success');
      setArchiveModalTenant(null);
      setArchiveConfirmName('');
      loadDashboardData();
    } catch (err: any) {
      showToast('Failed to archive tenant.', 'error');
    }
  };

  // Impersonation ("Login As")
  const handleImpersonate = async (tenant: TenantItem) => {
    try {
      const res = await api.post(`/super-admin/impersonate/${tenant.id}`);
      showToast(`Launching ${tenant.name} CRM workspace...`, 'success');
      loginAsTenant(res.data.token, res.data.user, res.data.organization, res.data.impersonationLogId);
      navigate('/');
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to establish impersonation session.', 'error');
    }
  };

  // Open Modules Quick Editor
  const handleOpenModulesEditor = (tenant: TenantItem) => {
    setModulesModalTenant(tenant);
    setTempEnabledModules([...tenant.enabledModules]);
    setModulesSearch('');
  };

  const handleSaveModules = async () => {
    if (!modulesModalTenant) return;
    try {
      await api.patch(`/super-admin/tenants/${modulesModalTenant.id}/modules`, {
        enabledModules: tempEnabledModules
      });
      showToast(`Modules for "${modulesModalTenant.name}" updated successfully!`, 'success');
      setTenants(prev => prev.map(t => t.id === modulesModalTenant.id ? { ...t, enabledModules: tempEnabledModules, enabledModulesCount: tempEnabledModules.length } : t));
      setModulesModalTenant(null);
    } catch (err: any) {
      showToast('Failed to update tenant modules.', 'error');
    }
  };

  // 1-Click Approve Module Request
  const handleApproveModuleRequest = async (orgId: string, moduleKey: string) => {
    try {
      await api.post(`/super-admin/module-requests/${orgId}/approve`, { moduleKey });
      showToast(`Module "${moduleKey}" activated successfully!`, 'success');
      loadDashboardData();
    } catch (err: any) {
      showToast('Failed to approve module request.', 'error');
    }
  };

  // Filtered tenants
  const filteredTenants = useMemo(() => {
    return tenants.filter(t => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        t.name.toLowerCase().includes(q) ||
        t.subdomain.toLowerCase().includes(q) ||
        (t.adminUser && t.adminUser.email.toLowerCase().includes(q)) ||
        (t.adminUser && `${t.adminUser.firstName} ${t.adminUser.lastName}`.toLowerCase().includes(q));

      const matchesVertical = selectedVertical === 'all' || t.verticalType === selectedVertical;

      const matchesStatus = selectedStatus === 'all'
        ? t.status !== 'archived'
        : selectedStatus === 'archived'
          ? t.status === 'archived'
          : t.status === selectedStatus;

      return matchesSearch && matchesVertical && matchesStatus;
    });
  }, [tenants, searchQuery, selectedVertical, selectedStatus]);

  return (
    <div className="h-screen w-full overflow-y-auto bg-[#F8F8FA] dark:bg-[#0B0F17] text-[#111827] dark:text-slate-100 flex flex-col font-sans transition-colors duration-150">
      
      {/* ── TOP PLATFORM NAVIGATION BAR (CLEAN & MINIMAL) ──────────────────── */}
      <header className="h-16 border-b border-[#E5E7EB] dark:border-slate-800 bg-[#FFFFFF] dark:bg-[#111827] px-8 sm:px-10 flex items-center justify-between sticky top-0 z-40 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#312E81] flex items-center justify-center text-white shadow-xs">
            <Icons.ShieldCheck className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-[#111827] dark:text-white tracking-tight">
                inkCRM <span className="text-[#312E81] dark:text-indigo-400">Platform Control</span>
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider bg-[#F1F5F9] dark:bg-slate-800 text-[#4B5563] dark:text-slate-300 border border-[#E2E8F0] dark:border-slate-700 rounded-md">
                Multi-Tenant Engine
              </span>
            </div>
            <p className="text-[11px] text-[#6B7280] dark:text-slate-400">Master tenant management, vertical presets & RBAC scoping</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Pending Requests Alert */}
          {pendingRequests.length > 0 && (
            <button
              onClick={() => setShowRequestsModal(true)}
              className="px-3 py-1.5 bg-[#FEF3C7] hover:bg-[#FDE68A] text-[#B45309] border border-[#FDE68A] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#D97706]" />
              <span>{pendingRequests.length} Requests</span>
            </button>
          )}

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="p-2 bg-[#FFFFFF] dark:bg-slate-800 hover:bg-[#F9FAFB] dark:hover:bg-slate-700 text-[#6B7280] dark:text-slate-300 border border-[#E5E7EB] dark:border-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            {isDark ? (
              <Icons.Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Icons.Moon className="w-4 h-4 text-[#4B5563]" />
            )}
          </button>

          {/* + Add Custom Vertical */}
          <button
            onClick={() => setShowAddVerticalModal(true)}
            className="px-3.5 py-2 bg-[#FFFFFF] dark:bg-slate-800 hover:bg-[#F9FAFB] dark:hover:bg-slate-700 text-[#111827] dark:text-slate-200 border border-[#E5E7EB] dark:border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Icons.Plus className="w-3.5 h-3.5 text-[#312E81] dark:text-indigo-400" />
            <span>Add Custom Vertical</span>
          </button>

          {/* + Create Admin-CRM */}
          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 bg-[#312E81] hover:bg-[#282568] text-white font-medium text-xs rounded-lg flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Icons.UserPlus className="w-3.5 h-3.5" />
            <span>Create Admin-CRM</span>
          </button>

          <div className="h-4 w-px bg-[#E5E7EB] dark:bg-slate-800 mx-1" />

          {/* Profile & Logout */}
          <div className="flex items-center gap-2 pl-1">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-[#111827] dark:text-slate-200">{user?.firstName} {user?.lastName}</div>
              <div className="text-[10px] text-[#6B7280] dark:text-slate-400 font-mono">{user?.email}</div>
            </div>
            <button
              onClick={() => logout().then(() => navigate('/login'))}
              title="Sign Out"
              className="p-2 hover:bg-[#F3F4F6] dark:hover:bg-slate-800 text-[#6B7280] hover:text-[#DC2626] rounded-lg transition-colors cursor-pointer"
            >
              <Icons.LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT CONTAINER (32-40px GUTTERS, 24px GAPS) ─────────────── */}
      <main className="flex-1 w-full max-w-[1560px] mx-auto px-8 sm:px-10 py-7 pb-32 space-y-6">

        {/* ── STAT CARDS (WHITE CARDS ON NEUTRAL GRAY WITH NAVY ACCENTS) ──── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          
          {/* Card 1: Total Tenants */}
          <div
            onClick={() => {
              setSelectedStatus('all');
              setSelectedVertical('all');
            }}
            className={`bg-[#FFFFFF] dark:bg-[#111827] border rounded-[14px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all duration-150 cursor-pointer relative overflow-hidden ${
              selectedStatus === 'all' && selectedVertical === 'all'
                ? 'border-[#312E81] ring-1 ring-[#312E81] border-l-4 border-l-[#312E81]'
                : 'border-[#E5E7EB] dark:border-slate-800 hover:border-[#D1D5DB]'
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-medium text-[#6B7280] dark:text-slate-400">Total tenants</p>
                <div className="flex items-baseline gap-2 mt-1.5">
                  <h3 className="text-2xl sm:text-3xl font-bold text-[#111827] dark:text-white tracking-tight">
                    {stats?.totalTenants ?? '—'}
                  </h3>
                  <span className="text-xs text-[#6B7280] font-normal">organizations</span>
                </div>
              </div>

              <div className="w-8 h-8 rounded-lg bg-[#F1F5F9] dark:bg-slate-800 text-[#312E81] dark:text-slate-300 flex items-center justify-center">
                <Icons.Building2 className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#F1F5F9] dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1.5 text-[#15803D] dark:text-emerald-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[#15803D]" />
                <span>{stats?.activeTenants ?? 0} active</span>
              </span>
              <span className="text-[#6B7280] dark:text-slate-400">
                {stats?.archivedTenants ?? 0} archived
              </span>
            </div>
          </div>

          {/* Card 2: Active Workspaces */}
          <div
            onClick={() => setSelectedStatus('active')}
            className={`bg-[#FFFFFF] dark:bg-[#111827] border rounded-[14px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all duration-150 cursor-pointer relative overflow-hidden ${
              selectedStatus === 'active'
                ? 'border-[#312E81] ring-1 ring-[#312E81] border-l-4 border-l-[#312E81]'
                : 'border-[#E5E7EB] dark:border-slate-800 hover:border-[#D1D5DB]'
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-medium text-[#6B7280] dark:text-slate-400">Active workspaces</p>
                <div className="flex items-baseline gap-2 mt-1.5">
                  <h3 className="text-2xl sm:text-3xl font-bold text-[#111827] dark:text-white tracking-tight">
                    {stats?.activeTenants ?? '—'}
                  </h3>
                  <span className="text-xs text-[#15803D] dark:text-emerald-400 font-medium">operational</span>
                </div>
              </div>

              <div className="w-8 h-8 rounded-lg bg-[#ECFDF5] dark:bg-emerald-950/40 text-[#15803D] dark:text-emerald-400 border border-[#A7F3D0] dark:border-emerald-800/60 flex items-center justify-center">
                <Icons.CheckCircle2 className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#F1F5F9] dark:border-slate-800 flex items-center justify-between text-xs text-[#6B7280] dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#15803D]" />
                <span>Ready for logins</span>
              </span>
              <span className="font-medium text-[#15803D] dark:text-emerald-400">Live</span>
            </div>
          </div>

          {/* Card 3: Suspended / Inactive */}
          <div
            onClick={() => setSelectedStatus('disabled')}
            className={`bg-[#FFFFFF] dark:bg-[#111827] border rounded-[14px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all duration-150 cursor-pointer relative overflow-hidden ${
              selectedStatus === 'disabled'
                ? 'border-[#312E81] ring-1 ring-[#312E81] border-l-4 border-l-[#312E81]'
                : 'border-[#E5E7EB] dark:border-slate-800 hover:border-[#D1D5DB]'
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-medium text-[#6B7280] dark:text-slate-400">Suspended / inactive</p>
                <div className="flex items-baseline gap-2 mt-1.5">
                  <h3 className="text-2xl sm:text-3xl font-bold text-[#111827] dark:text-white tracking-tight">
                    {stats?.disabledTenants ?? 0}
                  </h3>
                  <span className="text-xs text-[#6B7280] font-normal">blocked</span>
                </div>
              </div>

              <div className="w-8 h-8 rounded-lg bg-[#FEF3C7] dark:bg-amber-950/40 text-[#B45309] dark:text-amber-400 border border-[#FDE68A] dark:border-amber-800/60 flex items-center justify-center">
                <Icons.PauseCircle className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#F1F5F9] dark:border-slate-800 flex items-center justify-between text-xs text-[#6B7280] dark:text-slate-400">
              <span>Auth middleware kill-switch</span>
              <span className="font-medium text-[#111827] dark:text-slate-300">Protected</span>
            </div>
          </div>

          {/* Card 4: Vertical Templates */}
          <div
            onClick={() => setShowAddVerticalModal(true)}
            className="bg-[#FFFFFF] dark:bg-[#111827] border border-[#E5E7EB] dark:border-slate-800 hover:border-[#D1D5DB] rounded-[14px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all duration-150 cursor-pointer relative overflow-hidden"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-medium text-[#6B7280] dark:text-slate-400">Vertical templates</p>
                <div className="flex items-baseline gap-2 mt-1.5">
                  <h3 className="text-2xl sm:text-3xl font-bold text-[#111827] dark:text-white tracking-tight">
                    {verticals.length}
                  </h3>
                  <span className="text-xs text-[#6B7280] font-normal">presets</span>
                </div>
              </div>

              <div className="w-8 h-8 rounded-lg bg-[#F1F5F9] dark:bg-slate-800 text-[#312E81] dark:text-slate-300 flex items-center justify-center">
                <Icons.Boxes className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#F1F5F9] dark:border-slate-800 flex flex-wrap gap-1.5 items-center">
              {stats?.verticalBreakdown && stats.verticalBreakdown.length > 0 ? (
                stats.verticalBreakdown.slice(0, 3).map((v, i) => (
                  <span key={i} className="text-[11px] font-medium px-2 py-0.5 rounded bg-[#F1F5F9] dark:bg-slate-800 text-[#312E81] dark:text-slate-300 border border-[#E2E8F0] dark:border-slate-700">
                    {v.verticalType}: {v.count}
                  </span>
                ))
              ) : (
                <span className="text-xs text-[#6B7280]">+ Click to create preset</span>
              )}
            </div>
          </div>

        </div>

        {/* ── SEARCH & FILTER BAR ───────────────────────────────────────────── */}
        <div className="bg-[#FFFFFF] dark:bg-[#111827] border border-[#E5E7EB] dark:border-slate-800 p-3.5 sm:p-4 rounded-[14px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] space-y-3">
          
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:w-96">
              <Icons.Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search Admin, Org Name or Subdomain..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-[#F9FAFB] dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-700 rounded-lg text-xs text-[#111827] dark:text-slate-100 placeholder-[#9CA3AF] focus:outline-none focus:border-[#312E81] transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#111827] dark:hover:text-slate-200 cursor-pointer"
                >
                  <Icons.X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Controls */}
            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
              {/* Vertical Filter Dropdown */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-[#6B7280] dark:text-slate-400 hidden sm:inline">Vertical:</span>
                <select
                  value={selectedVertical}
                  onChange={(e) => setSelectedVertical(e.target.value)}
                  className="bg-[#F9FAFB] dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-700 text-xs font-medium text-[#111827] dark:text-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:border-[#312E81] cursor-pointer"
                >
                  <option value="all">All Verticals ({verticals.length})</option>
                  {verticals.map(v => (
                    <option key={v.key} value={v.key}>{v.label}</option>
                  ))}
                </select>
              </div>

              {/* Reset Filters */}
              {(selectedStatus !== 'all' || selectedVertical !== 'all' || searchQuery) && (
                <button
                  onClick={() => {
                    setSelectedStatus('all');
                    setSelectedVertical('all');
                    setSearchQuery('');
                  }}
                  className="px-3 py-2 bg-[#F1F5F9] hover:bg-[#E2E8F0] dark:bg-slate-800 text-[#111827] dark:text-slate-300 border border-[#E2E8F0] dark:border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Clear all active filters"
                >
                  <Icons.FilterX className="w-3.5 h-3.5 text-[#6B7280]" />
                  <span>Reset</span>
                </button>
              )}

              {/* Refresh Button */}
              <button
                onClick={loadDashboardData}
                title="Refresh Tenants"
                className="p-2 bg-[#F9FAFB] hover:bg-[#F3F4F6] dark:bg-slate-900 dark:hover:bg-slate-800 border border-[#E5E7EB] dark:border-slate-700 text-[#6B7280] dark:text-slate-300 rounded-lg transition-colors cursor-pointer"
              >
                <Icons.RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Active Filter Chips / Status summary */}
          <div className="flex items-center justify-between text-xs text-[#6B7280] dark:text-slate-400 pt-2 border-t border-[#F1F5F9] dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="font-medium text-[#111827] dark:text-slate-300">
                Showing {filteredTenants.length} of {tenants.length} Organizations
              </span>
              {selectedStatus !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#F1F5F9] dark:bg-slate-800 text-[#111827] dark:text-slate-300 border border-[#E2E8F0] dark:border-slate-700">
                  <span>Status: {selectedStatus}</span>
                  <button onClick={() => setSelectedStatus('all')} className="hover:text-black cursor-pointer">×</button>
                </span>
              )}
              {selectedVertical !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#F1F5F9] dark:bg-slate-800 text-[#111827] dark:text-slate-300 border border-[#E2E8F0] dark:border-slate-700">
                  <span>Vertical: {selectedVertical}</span>
                  <button onClick={() => setSelectedVertical('all')} className="hover:text-black cursor-pointer">×</button>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── ADMIN TABLE (HAIRLINE DIVIDERS, CLEAN SINGLE BADGE STYLE) ─────── */}
        <div className="bg-[#FFFFFF] dark:bg-[#111827] border border-[#E5E7EB] dark:border-slate-800 rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06)] flex flex-col">
          <div className="overflow-x-auto overflow-y-auto max-h-[620px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-20 bg-[#F9FAFB] dark:bg-slate-900 border-b border-[#E5E7EB] dark:border-slate-800 text-[#6B7280] dark:text-slate-400 uppercase tracking-wider font-semibold text-[11px]">
                <tr>
                  <th className="py-3 px-4 sm:px-6">Admin (Email / Contact)</th>
                  <th className="py-3 px-4">Vertical Assigned</th>
                  <th className="py-3 px-4">Org Name & Subdomain</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Enabled Modules</th>
                  <th className="py-3 px-4">Permissions</th>
                  <th className="py-3 px-4 sm:px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9] dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-[#6B7280]">
                      <Icons.Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#312E81]" />
                      <span className="font-medium text-xs">Loading platform tenants...</span>
                    </td>
                  </tr>
                ) : filteredTenants.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-14 text-center">
                      <div className="max-w-sm mx-auto flex flex-col items-center justify-center">
                        <div className="w-12 h-12 rounded-xl bg-[#F1F5F9] dark:bg-slate-800 flex items-center justify-center text-[#6B7280] mb-3">
                          <Icons.FolderSearch className="w-6 h-6" />
                        </div>
                        <h4 className="font-semibold text-sm text-[#111827] dark:text-white">
                          No matching tenant workspaces
                        </h4>
                        <p className="text-xs text-[#6B7280] dark:text-slate-400 mt-1 max-w-xs leading-relaxed">
                          Try adjusting your search criteria or switch filters to view all workspaces.
                        </p>
                        <div className="flex gap-2 mt-4">
                          <button
                            onClick={() => {
                              setSelectedStatus('all');
                              setSelectedVertical('all');
                              setSearchQuery('');
                            }}
                            className="px-3.5 py-1.5 bg-[#312E81] hover:bg-[#282568] text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
                          >
                            Show All Tenants
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredTenants.map((tenant) => {
                    const vert = verticals.find(v => v.key === tenant.verticalType);
                    const vLabel = vert?.label || tenant.verticalType.toUpperCase() + ' CRM';
                    const vIcon = vert?.icon || 'Layers';

                    return (
                      <tr key={tenant.id} className="hover:bg-[#F9FAFB] dark:hover:bg-slate-800/40 transition-colors">
                        
                        {/* Admin column */}
                        <td className="py-3.5 px-4 sm:px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full bg-[#F1F5F9] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 flex items-center justify-center font-bold text-[#312E81] dark:text-slate-300 text-xs flex-shrink-0">
                              {tenant.adminUser?.firstName?.[0]?.toUpperCase() || 'A'}
                            </div>
                            <div>
                              <div className="font-semibold text-[#111827] dark:text-white text-xs">
                                {tenant.adminUser ? `${tenant.adminUser.firstName} ${tenant.adminUser.lastName}` : 'No Admin Assigned'}
                              </div>
                              <div className="text-[11px] text-[#6B7280] dark:text-slate-400 font-mono">
                                {tenant.adminUser?.email || '—'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Vertical Assigned (ONE SINGLE CLEAN NEUTRAL BADGE STYLE) */}
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-[#F1F5F9] dark:bg-slate-800 text-[#1E293B] dark:text-slate-200 border border-[#E2E8F0] dark:border-slate-700">
                            <DynamicIcon name={vIcon} className="w-3.5 h-3.5 text-[#312E81] dark:text-indigo-400" />
                            <span>{vLabel}</span>
                          </span>
                        </td>

                        {/* Org Name & Subdomain */}
                        <td className="py-3.5 px-4">
                          <div>
                            <span className="font-semibold text-[#111827] dark:text-slate-100 text-xs">{tenant.name}</span>
                            <div className="flex items-center gap-1 text-[11px] text-[#6B7280] dark:text-slate-400 mt-0.5">
                              <Icons.Globe className="w-3 h-3 text-[#9CA3AF]" />
                              <span className="font-mono">{tenant.subdomain}.inkcrm</span>
                            </div>
                          </div>
                        </td>

                        {/* Status (SINGLE MUTED PALETTE) */}
                        <td className="py-3.5 px-4">
                          {tenant.status === 'archived' ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#F3F4F6] text-[#6B7280] border border-[#E5E7EB]">
                              Archived
                            </span>
                          ) : (
                            <button
                              onClick={() => handleToggleStatus(tenant)}
                              title={tenant.status === 'active' ? 'Click to Suspend' : 'Click to Activate'}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-colors cursor-pointer ${
                                tenant.status === 'active'
                                  ? 'bg-[#ECFDF5] text-[#15803D] border-[#A7F3D0] hover:bg-[#D1FAE5]'
                                  : 'bg-[#FEF3C7] text-[#B45309] border-[#FDE68A] hover:bg-[#FDE68A]'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${tenant.status === 'active' ? 'bg-[#15803D]' : 'bg-[#D97706]'}`} />
                              <span>{tenant.status === 'active' ? 'Active' : 'Suspended'}</span>
                            </button>
                          )}
                        </td>

                        {/* Enabled Modules */}
                        <td className="py-3.5 px-4">
                          <button
                            onClick={() => handleOpenModulesEditor(tenant)}
                            className="px-2.5 py-1 bg-[#FFFFFF] dark:bg-slate-800 hover:bg-[#F9FAFB] dark:hover:bg-slate-700 text-[#111827] dark:text-slate-200 rounded-md text-xs font-medium border border-[#E5E7EB] dark:border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Icons.Sliders className="w-3 h-3 text-[#6B7280]" />
                            <span>{tenant.enabledModulesCount} modules</span>
                          </button>
                        </td>

                        {/* Permissions (RBAC) */}
                        <td className="py-3.5 px-4">
                          <button
                            onClick={() => navigate(`/access-privilege?orgId=${tenant.id}`)}
                            className="px-2.5 py-1 bg-[#FFFFFF] dark:bg-slate-800 hover:bg-[#F9FAFB] dark:hover:bg-slate-700 text-[#111827] dark:text-slate-200 border border-[#E5E7EB] dark:border-slate-700 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Icons.KeyRound className="w-3 h-3 text-[#6B7280]" />
                            <span>Edit Roles & RBAC</span>
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 sm:px-6 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* 🔑 Login As */}
                            {tenant.status !== 'archived' && (
                              <button
                                onClick={() => handleImpersonate(tenant)}
                                className="px-3.5 py-1.5 bg-[#312E81] hover:bg-[#282568] text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                                title="Directly Preview Tenant CRM"
                              >
                                <Icons.LogIn className="w-3.5 h-3.5" />
                                <span>Login As</span>
                              </button>
                            )}

                            {/* Quick Suspend / Activate (Ghost Button) */}
                            {tenant.status !== 'archived' && (
                              <button
                                onClick={() => handleToggleStatus(tenant)}
                                className="p-1.5 hover:bg-[#F1F5F9] dark:hover:bg-slate-800 text-[#6B7280] hover:text-[#312E81] rounded-md transition-colors cursor-pointer"
                                title={tenant.status === 'active' ? 'Suspend Tenant' : 'Activate Tenant'}
                              >
                                {tenant.status === 'active' ? (
                                  <Icons.PauseCircle className="w-4 h-4" />
                                ) : (
                                  <Icons.PlayCircle className="w-4 h-4 text-[#15803D]" />
                                )}
                              </button>
                            )}

                            {/* Safe Soft Delete (Archive Ghost Button) */}
                            {tenant.status !== 'archived' && (
                              <button
                                onClick={() => {
                                  setArchiveModalTenant(tenant);
                                  setArchiveConfirmName('');
                                }}
                                className="p-1.5 hover:bg-[#FEF2F2] dark:hover:bg-rose-500/10 text-[#9CA3AF] hover:text-[#DC2626] rounded-md transition-colors cursor-pointer"
                                title="Safe Archive Tenant"
                              >
                                <Icons.Archive className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>

                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ── TABLE FOOTER BAR ────────────────────────────────────────── */}
          <div className="px-6 py-3 bg-[#F9FAFB] dark:bg-slate-900 border-t border-[#E5E7EB] dark:border-slate-800 flex items-center justify-between text-xs text-[#6B7280] dark:text-slate-400 flex-shrink-0">
            <span className="font-medium">
              Showing {filteredTenants.length} of {tenants.length} Organizations
            </span>
            <span className="text-[11px] font-mono text-[#9CA3AF]">
              inkCRM Multi-Tenant Platform
            </span>
          </div>
        </div>

      </main>

      {/* ── MODAL 1: CREATE ADMIN-CRM & TENANT WIZARD ──────────────────────── */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setShowCreateModal(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="relative z-10 bg-[#FFFFFF] dark:bg-[#111827] border border-[#E5E7EB] dark:border-slate-800 rounded-[14px] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-5 border-b border-[#E5E7EB] dark:border-slate-800 flex items-center justify-between bg-[#F9FAFB] dark:bg-slate-900/50">
                <div>
                  <h3 className="text-base font-bold text-[#111827] dark:text-white">Create Admin-CRM & Tenant Instance</h3>
                  <p className="text-xs text-[#6B7280] dark:text-slate-400">Set up a new scoped workspace with pre-configured vertical template</p>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1.5 text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white rounded-lg hover:bg-[#F3F4F6] cursor-pointer"
                >
                  <Icons.X className="w-5 h-5" />
                </button>
              </div>

              {/* Progress Steps */}
              <div className="grid grid-cols-4 border-b border-[#E5E7EB] dark:border-slate-800 text-xs font-medium text-center bg-[#F9FAFB]/50">
                {[
                  { step: 1, title: '1. Admin' },
                  { step: 2, title: '2. Workspace' },
                  { step: 3, title: '3. Vertical' },
                  { step: 4, title: '4. Modules' }
                ].map((s) => (
                  <div
                    key={s.step}
                    onClick={() => setCreateStep(s.step as any)}
                    className={`py-2.5 border-b-2 cursor-pointer transition-colors ${
                      createStep === s.step
                        ? 'border-[#312E81] text-[#312E81] dark:text-indigo-400 font-bold bg-[#F1F5F9]/50'
                        : 'border-transparent text-[#6B7280] hover:text-[#111827]'
                    }`}
                  >
                    {s.title}
                  </div>
                ))}
              </div>

              {/* Form Content */}
              <form onSubmit={handleCreateTenant} className="p-6 overflow-y-auto space-y-6">
                
                {/* STEP 1: Admin Credentials */}
                {createStep === 1 && (
                  <div className="space-y-4 animate-in fade-in duration-100">
                    <div className="border-b border-[#F1F5F9] dark:border-slate-800 pb-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#111827] dark:text-slate-300">
                        Primary Admin Account
                      </h4>
                      <p className="text-xs text-[#6B7280]">This user will receive full administrative control over this tenant instance.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-medium text-[#111827] dark:text-slate-300 mb-1">First Name *</label>
                        <input
                          type="text"
                          required
                          value={newAdminFirstName}
                          onChange={(e) => setNewAdminFirstName(e.target.value)}
                          placeholder="e.g. Anand"
                          className="w-full px-3.5 py-2 bg-[#F9FAFB] dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-700 rounded-lg text-xs text-[#111827] dark:text-white focus:outline-none focus:border-[#312E81]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#111827] dark:text-slate-300 mb-1">Last Name *</label>
                        <input
                          type="text"
                          required
                          value={newAdminLastName}
                          onChange={(e) => setNewAdminLastName(e.target.value)}
                          placeholder="e.g. Kumar"
                          className="w-full px-3.5 py-2 bg-[#F9FAFB] dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-700 rounded-lg text-xs text-[#111827] dark:text-white focus:outline-none focus:border-[#312E81]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#111827] dark:text-slate-300 mb-1">Admin Email *</label>
                        <input
                          type="email"
                          required
                          value={newAdminEmail}
                          onChange={(e) => setNewAdminEmail(e.target.value)}
                          placeholder="admin@bankcrm.com"
                          className="w-full px-3.5 py-2 bg-[#F9FAFB] dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-700 rounded-lg text-xs text-[#111827] dark:text-white focus:outline-none focus:border-[#312E81]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#111827] dark:text-slate-300 mb-1">Password *</label>
                        <input
                          type="text"
                          required
                          value={newAdminPassword}
                          onChange={(e) => setNewAdminPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full px-3.5 py-2 bg-[#F9FAFB] dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-700 rounded-lg text-xs text-[#111827] dark:text-white focus:outline-none focus:border-[#312E81] font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 2: Organization Details */}
                {createStep === 2 && (
                  <div className="space-y-4 animate-in fade-in duration-100">
                    <div className="border-b border-[#F1F5F9] dark:border-slate-800 pb-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#111827] dark:text-slate-300">
                        Organization & Subdomain
                      </h4>
                      <p className="text-xs text-[#6B7280]">Defines the unique company domain and brand profile.</p>
                    </div>

                    <div className="space-y-3.5">
                      <div>
                        <label className="block text-xs font-medium text-[#111827] dark:text-slate-300 mb-1">Company / Organization Name *</label>
                        <input
                          type="text"
                          required
                          value={newOrgName}
                          onChange={(e) => handleOrgNameChange(e.target.value)}
                          placeholder="e.g. Apex National Bank"
                          className="w-full px-3.5 py-2 bg-[#F9FAFB] dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-700 rounded-lg text-xs text-[#111827] dark:text-white focus:outline-none focus:border-[#312E81]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#111827] dark:text-slate-300 mb-1">Workspace Subdomain *</label>
                        <div className="flex items-center">
                          <input
                            type="text"
                            required
                            value={newOrgSubdomain}
                            onChange={(e) => setNewOrgSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                            placeholder="apexbank"
                            className="w-full px-3.5 py-2 bg-[#F9FAFB] dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-700 rounded-l-lg text-xs text-[#111827] dark:text-white focus:outline-none focus:border-[#312E81] font-mono"
                          />
                          <span className="px-3.5 py-2 bg-[#F1F5F9] dark:bg-slate-800 border border-l-0 border-[#E5E7EB] dark:border-slate-700 text-xs font-semibold text-[#6B7280] rounded-r-lg font-mono">
                            .inkcrm
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 3: Assign Vertical Preset */}
                {createStep === 3 && (
                  <div className="space-y-4 animate-in fade-in duration-100">
                    <div className="flex items-center justify-between border-b border-[#F1F5F9] dark:border-slate-800 pb-2">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#111827] dark:text-slate-300">
                          Assign Industry Vertical Template
                        </h4>
                        <p className="text-xs text-[#6B7280]">Sets industry defaults, menus, and branding theme</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAddVerticalModal(true)}
                        className="text-xs text-[#312E81] dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
                      >
                        + Add Custom
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {verticals.map((vert) => {
                        const isSelected = newVerticalType === vert.key;
                        return (
                          <div
                            key={vert.key}
                            onClick={() => handleVerticalSelect(vert.key)}
                            className={`p-3.5 rounded-[10px] border cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-[#F1F5F9] dark:bg-indigo-950/40 border-[#312E81] ring-1 ring-[#312E81]'
                                : 'bg-[#F9FAFB] dark:bg-slate-900 border-[#E5E7EB] dark:border-slate-800 hover:border-[#D1D5DB]'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <DynamicIcon name={vert.icon} className={`w-4 h-4 ${isSelected ? 'text-[#312E81]' : 'text-[#6B7280]'}`} />
                              <span className="font-semibold text-xs text-[#111827] dark:text-white">{vert.label}</span>
                            </div>
                            <p className="text-[11px] text-[#6B7280] line-clamp-2">{vert.description}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* STEP 4: Modules Checklist */}
                {createStep === 4 && (
                  <div className="space-y-4 animate-in fade-in duration-100">
                    <div className="flex items-center justify-between border-b border-[#F1F5F9] dark:border-slate-800 pb-2">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#111827] dark:text-slate-300">
                          Enabled Modules ({newSelectedModules.length} selected)
                        </h4>
                        <p className="text-xs text-[#6B7280]">Platform kill-switch: only enabled modules will be visible to this tenant</p>
                      </div>
                      <div className="flex gap-2 text-xs font-semibold">
                        <button
                          type="button"
                          onClick={() => setNewSelectedModules(ALL_SYSTEM_MODULES.map(m => m.key))}
                          className="text-[#312E81] hover:underline cursor-pointer"
                        >
                          Select All
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => setNewSelectedModules(['dashboard', 'settings'])}
                          className="text-[#6B7280] hover:underline cursor-pointer"
                        >
                          Minimal
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-[#F9FAFB] dark:bg-slate-900/60 border border-[#E5E7EB] dark:border-slate-800 rounded-lg max-h-56 overflow-y-auto">
                      {ALL_SYSTEM_MODULES.map((mod) => {
                        const checked = newSelectedModules.includes(mod.key);
                        return (
                          <label key={mod.key} className="flex items-center gap-2 text-xs text-[#111827] dark:text-slate-300 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewSelectedModules(prev => [...prev, mod.key]);
                                } else {
                                  setNewSelectedModules(prev => prev.filter(k => k !== mod.key));
                                }
                              }}
                              className="rounded border-[#D1D5DB] text-[#312E81] focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                            />
                            <span className="truncate">{mod.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Footer Controls */}
                <div className="pt-4 flex justify-between items-center border-t border-[#E5E7EB] dark:border-slate-800">
                  {createStep > 1 ? (
                    <button
                      type="button"
                      onClick={() => setCreateStep((prev) => (prev - 1) as any)}
                      className="px-3.5 py-2 bg-[#F1F5F9] hover:bg-[#E2E8F0] dark:bg-slate-800 text-[#111827] dark:text-slate-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                    >
                      Back
                    </button>
                  ) : (
                    <div />
                  )}

                  <div className="flex gap-2">
                    {createStep < 4 ? (
                      <button
                        type="button"
                        onClick={() => setCreateStep((prev) => (prev + 1) as any)}
                        className="px-4 py-2 bg-[#312E81] hover:bg-[#282568] text-white font-medium text-xs rounded-lg transition-colors cursor-pointer"
                      >
                        Next
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={creatingTenant}
                        className="px-5 py-2 bg-[#312E81] hover:bg-[#282568] text-white font-medium text-xs rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {creatingTenant ? <Icons.Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icons.Check className="w-3.5 h-3.5" />}
                        <span>Create Tenant CRM</span>
                      </button>
                    )}
                  </div>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL 2: ADD CUSTOM VERTICAL ──────────────────────────────────── */}
      <AnimatePresence>
        {showAddVerticalModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setShowAddVerticalModal(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="relative z-10 bg-[#FFFFFF] dark:bg-[#111827] border border-[#E5E7EB] dark:border-slate-800 rounded-[14px] w-full max-w-lg overflow-hidden shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-[#E5E7EB] dark:border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-bold text-[#111827] dark:text-white">Add Custom Industry Vertical</h3>
                  <p className="text-xs text-[#6B7280]">Register a new CRM template without code deployment</p>
                </div>
                <button onClick={() => setShowAddVerticalModal(false)} className="text-[#9CA3AF] hover:text-[#111827] cursor-pointer">
                  <Icons.X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateCustomVertical} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#111827] dark:text-slate-300 mb-1">Unique Key * (Immutable)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. solar_energy or hospitality"
                    value={customKey}
                    onChange={(e) => setCustomKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                    className="w-full px-3.5 py-2 bg-[#F9FAFB] dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-700 rounded-lg text-xs font-mono focus:outline-none focus:border-[#312E81]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#111827] dark:text-slate-300 mb-1">Display Label *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Solar Energy CRM"
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                    className="w-full px-3.5 py-2 bg-[#F9FAFB] dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:border-[#312E81]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#111827] dark:text-slate-300 mb-1">Description</label>
                  <input
                    type="text"
                    placeholder="e.g. Quotations, panel inventory, and site audit tracking."
                    value={customDesc}
                    onChange={(e) => setCustomDesc(e.target.value)}
                    className="w-full px-3.5 py-2 bg-[#F9FAFB] dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:border-[#312E81]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#111827] dark:text-slate-300 mb-1">Icon Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Sun, Zap, HeartPulse"
                      value={customIcon}
                      onChange={(e) => setCustomIcon(e.target.value)}
                      className="w-full px-3.5 py-2 bg-[#F9FAFB] dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:border-[#312E81]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#111827] dark:text-slate-300 mb-1">Primary Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={customColor}
                        onChange={(e) => setCustomColor(e.target.value)}
                        className="w-8 h-8 rounded border-0 bg-transparent cursor-pointer"
                      />
                      <span className="text-xs font-mono text-[#6B7280] font-bold">{customColor}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 flex justify-end gap-2 border-t border-[#E5E7EB] dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddVerticalModal(false)}
                    className="px-3.5 py-2 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#111827] rounded-lg text-xs font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingVertical}
                    className="px-4 py-2 bg-[#312E81] hover:bg-[#282568] text-white font-medium text-xs rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {creatingVertical ? <Icons.Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icons.Check className="w-3.5 h-3.5" />}
                    <span>Save Vertical</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL 3: SAFE ARCHIVE CONFIRMATION ────────────────────────────── */}
      <AnimatePresence>
        {archiveModalTenant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setArchiveModalTenant(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="relative z-10 bg-[#FFFFFF] dark:bg-[#111827] border border-[#E5E7EB] dark:border-slate-800 rounded-[14px] w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center gap-3 text-[#DC2626]">
                <div className="p-2 bg-[#FEF2F2] rounded-lg border border-[#FEE2E2]">
                  <Icons.AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#111827] dark:text-white">Archive Tenant Workspace</h3>
                  <p className="text-xs text-[#6B7280]">Safe soft-delete with history preserved</p>
                </div>
              </div>

              <p className="text-xs text-[#4B5563] dark:text-slate-300 leading-relaxed">
                Archiving <strong>"{archiveModalTenant.name}"</strong> will suspend user logins and lock the domain. Records are preserved and can be restored anytime.
              </p>

              <div className="space-y-1 bg-[#F9FAFB] dark:bg-slate-900 p-3 rounded-lg border border-[#E5E7EB] dark:border-slate-700">
                <label className="block text-[11px] font-medium text-[#111827] dark:text-slate-300">
                  Type <strong className="text-[#DC2626] font-mono">{archiveModalTenant.name}</strong> to confirm:
                </label>
                <input
                  type="text"
                  value={archiveConfirmName}
                  onChange={(e) => setArchiveConfirmName(e.target.value)}
                  placeholder={archiveModalTenant.name}
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-[#E5E7EB] dark:border-slate-700 rounded text-xs text-[#111827] dark:text-slate-100 focus:outline-none focus:border-[#DC2626] font-semibold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setArchiveModalTenant(null)}
                  className="px-3.5 py-1.5 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#111827] rounded-lg text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleArchiveConfirm}
                  disabled={archiveConfirmName.trim() !== archiveModalTenant.name.trim()}
                  className="px-4 py-1.5 bg-[#DC2626] hover:bg-[#B91C1C] disabled:opacity-40 text-white font-medium text-xs rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Icons.Archive className="w-3.5 h-3.5" />
                  <span>Confirm & Archive</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL 4: EDIT ENABLED MODULES (KILL-SWITCH) ───────────────────── */}
      <AnimatePresence>
        {modulesModalTenant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setModulesModalTenant(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="relative z-10 bg-[#FFFFFF] dark:bg-[#111827] border border-[#E5E7EB] dark:border-slate-800 rounded-[14px] w-full max-w-xl overflow-hidden shadow-2xl p-6 space-y-4 flex flex-col max-h-[85vh]"
            >
              <div className="flex items-center justify-between border-b border-[#E5E7EB] dark:border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-bold text-[#111827] dark:text-white">Configure Enabled Modules</h3>
                  <p className="text-xs text-[#6B7280]">{modulesModalTenant.name} ({modulesModalTenant.verticalType})</p>
                </div>
                <button onClick={() => setModulesModalTenant(null)} className="text-[#9CA3AF] hover:text-[#111827] cursor-pointer">
                  <Icons.X className="w-5 h-5" />
                </button>
              </div>

              {/* Search & Bulk Select */}
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Icons.Search className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search modules..."
                    value={modulesSearch}
                    onChange={(e) => setModulesSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-[#F9FAFB] dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:border-[#312E81]"
                  />
                </div>
                <div className="flex gap-2 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setTempEnabledModules(ALL_SYSTEM_MODULES.map(m => m.key))}
                    className="text-[#312E81] hover:underline cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setTempEnabledModules(['dashboard', 'settings'])}
                    className="text-[#6B7280] hover:underline cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Modules List */}
              <div className="space-y-2 overflow-y-auto p-1 max-h-96">
                {ALL_SYSTEM_MODULES.filter(m => !modulesSearch || m.label.toLowerCase().includes(modulesSearch.toLowerCase()) || m.key.toLowerCase().includes(modulesSearch.toLowerCase())).map((mod) => {
                  const checked = tempEnabledModules.includes(mod.key);
                  return (
                    <div
                      key={mod.key}
                      onClick={() => {
                        if (checked) {
                          setTempEnabledModules(prev => prev.filter(k => k !== mod.key));
                        } else {
                          setTempEnabledModules(prev => [...prev, mod.key]);
                        }
                      }}
                      className={`p-3 rounded-lg border flex items-center justify-between cursor-pointer transition-colors ${
                        checked
                          ? 'bg-[#F1F5F9] dark:bg-indigo-950/30 border-[#312E81]/40 dark:border-indigo-800/60'
                          : 'bg-[#F9FAFB] dark:bg-slate-900 border-[#E5E7EB] dark:border-slate-800 opacity-60'
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-xs text-[#111827] dark:text-slate-100">{mod.label}</div>
                        <div className="text-[10px] text-[#6B7280] font-mono">{mod.key} • {mod.category}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {}}
                        className="rounded border-[#D1D5DB] text-[#312E81] focus:ring-0 w-4 h-4 cursor-pointer"
                      />
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-[#E5E7EB] dark:border-slate-800">
                <span className="text-xs text-[#6B7280] font-medium">{tempEnabledModules.length} enabled</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setModulesModalTenant(null)}
                    className="px-3.5 py-1.5 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#111827] rounded-lg text-xs font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveModules}
                    className="px-4 py-1.5 bg-[#312E81] hover:bg-[#282568] text-white font-medium text-xs rounded-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    <Icons.Check className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL 5: MODULE REQUESTS QUEUE ─────────────────────────────────── */}
      <AnimatePresence>
        {showRequestsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setShowRequestsModal(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="relative z-10 bg-[#FFFFFF] dark:bg-[#111827] border border-[#E5E7EB] dark:border-slate-800 rounded-[14px] w-full max-w-lg overflow-hidden shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-[#E5E7EB] dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Icons.Bell className="w-4 h-4 text-[#D97706]" />
                  <h3 className="text-base font-bold text-[#111827] dark:text-white">Pending Module Requests</h3>
                </div>
                <button onClick={() => setShowRequestsModal(false)} className="text-[#9CA3AF] hover:text-[#111827] cursor-pointer">
                  <Icons.X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2.5 max-h-96 overflow-y-auto">
                {pendingRequests.length === 0 ? (
                  <p className="text-xs text-[#6B7280] py-8 text-center">No pending module activation requests.</p>
                ) : (
                  pendingRequests.map((req, i) => (
                    <div key={i} className="p-3 bg-[#F9FAFB] dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-800 rounded-lg flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-xs text-[#111827] dark:text-white">{req.organizationName}</div>
                        <div className="text-[11px] text-[#312E81] dark:text-indigo-400 font-semibold mt-0.5">
                          Requested: <span className="uppercase">{req.moduleKey}</span>
                        </div>
                        {req.note && <div className="text-[10px] text-[#6B7280] italic mt-0.5">"{req.note}"</div>}
                      </div>
                      <button
                        onClick={() => handleApproveModuleRequest(req.organizationId, req.moduleKey)}
                        className="px-3 py-1 bg-[#15803D] hover:bg-[#166534] text-white rounded-md text-xs font-medium flex items-center gap-1 shadow-2xs cursor-pointer"
                      >
                        <Icons.Check className="w-3 h-3" />
                        <span>Approve</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
