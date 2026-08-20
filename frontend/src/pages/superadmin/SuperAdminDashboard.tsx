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

interface SuperAdminProfile {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  userCode?: string;
  createdAt: string;
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

  // Navigation tab: 'dashboard' | 'users' | 'settings'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'settings'>('dashboard');
  const [settingsSubTab, setSettingsSubTab] = useState<'branding' | 'profile' | 'security' | 'team' | 'system'>('branding');

  // Platform Branding State (Persisted)
  const [platformBrandName, setPlatformBrandName] = useState<string>(() => localStorage.getItem('superadmin_brand_name') || 'inkCRM Platform');
  const [platformBrandTagline, setPlatformBrandTagline] = useState<string>(() => localStorage.getItem('superadmin_brand_tagline') || 'Super Admin Engine');
  const [platformLogoUrl, setPlatformLogoUrl] = useState<string>(() => localStorage.getItem('superadmin_logo_url') || '/logo.png');
  const [platformCompanyCode, setPlatformCompanyCode] = useState<string>(() => localStorage.getItem('superadmin_company_code') || 'COMP01');
  const [savingBranding, setSavingBranding] = useState(false);

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

  // ── USER MANAGEMENT STATE ──────────────────────────────────────────────────
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userOrgFilter, setUserOrgFilter] = useState('all');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'active' | 'disabled' | 'pending'>('all');
  const [togglingUserSecurity, setTogglingUserSecurity] = useState<string | null>(null);

  // Super Admin Profile & Settings state
  const [adminProfile, setAdminProfile] = useState<SuperAdminProfile | null>(null);
  const [systemDiag, setSystemDiag] = useState<any>(null);
  const [profileFirstName, setProfileFirstName] = useState('');
  const [profileLastName, setProfileLastName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Super Admin Team state
  const [adminTeam, setAdminTeam] = useState<any[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [newTeamFirst, setNewTeamFirst] = useState('');
  const [newTeamLast, setNewTeamLast] = useState('');
  const [newTeamEmail, setNewTeamEmail] = useState('');
  const [newTeamPassword, setNewTeamPassword] = useState('SuperAdmin@2026!');
  const [newTeamPhone, setNewTeamPhone] = useState('');
  const [creatingTeamUser, setCreatingTeamUser] = useState(false);

  // Search & Filter state for Tenants Dashboard
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
  const [newOrgLogoUrl, setNewOrgLogoUrl] = useState('');
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

  // State for Editing Tenant
  const [editModalTenant, setEditModalTenant] = useState<TenantItem | null>(null);
  const [editOrgName, setEditOrgName] = useState('');
  const [editOrgSubdomain, setEditOrgSubdomain] = useState('');
  const [editOrgLogoUrl, setEditOrgLogoUrl] = useState('');
  const [editVerticalType, setEditVerticalType] = useState('bank');
  const [editAdminFirstName, setEditAdminFirstName] = useState('');
  const [editAdminLastName, setEditAdminLastName] = useState('');
  const [editAdminEmail, setEditAdminEmail] = useState('');
  const [editAdminPhone, setEditAdminPhone] = useState('');
  const [editAdminPassword, setEditAdminPassword] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'disabled'>('active');
  const [savingEditTenant, setSavingEditTenant] = useState(false);

  // State for Resetting Single User Password
  const [resetPassUser, setResetPassUser] = useState<any | null>(null);
  const [newUserPassword, setNewUserPassword] = useState('');
  const [savingUserPassword, setSavingUserPassword] = useState(false);

  const handleOpenEditModal = (tenant: TenantItem) => {
    setEditModalTenant(tenant);
    setEditOrgName(tenant.name || '');
    setEditOrgSubdomain(tenant.subdomain || '');
    setEditOrgLogoUrl(tenant.logoUrl || '');
    setEditVerticalType(tenant.verticalType || 'bank');
    setEditAdminFirstName(tenant.adminUser?.firstName || '');
    setEditAdminLastName(tenant.adminUser?.lastName || '');
    setEditAdminEmail(tenant.adminUser?.email || '');
    setEditAdminPhone(tenant.adminUser?.phone || '');
    setEditAdminPassword('');
    setEditStatus(tenant.status === 'disabled' ? 'disabled' : 'active');
  };

  const handleSaveEditTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModalTenant) return;
    try {
      setSavingEditTenant(true);
      await api.put(`/super-admin/tenants/${editModalTenant.id}`, {
        name: editOrgName.trim(),
        subdomain: editOrgSubdomain.trim(),
        logoUrl: editOrgLogoUrl,
        verticalType: editVerticalType,
        status: editStatus,
        adminFirstName: editAdminFirstName.trim(),
        adminLastName: editAdminLastName.trim(),
        adminEmail: editAdminEmail.trim(),
        adminPhone: editAdminPhone.trim(),
        ...(editAdminPassword ? { adminPassword: editAdminPassword } : {})
      });
      showToast(`Tenant "${editOrgName}" updated successfully!`, 'success');
      setEditModalTenant(null);
      loadDashboardData();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to update tenant.', 'error');
    } finally {
      setSavingEditTenant(false);
    }
  };

  const handleNewLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      showToast('Logo file size must be under 3MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setNewOrgLogoUrl(reader.result as string);
      showToast('New tenant logo loaded!', 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleEditLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      showToast('Logo file size must be under 3MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setEditOrgLogoUrl(reader.result as string);
      showToast('Tenant logo updated!', 'success');
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    loadDashboardData();
    loadSuperAdminProfile();
    loadAllUsers();
    loadPlatformBranding();
  }, []);

  const loadPlatformBranding = async () => {
    try {
      const res = await api.get('/super-admin/branding');
      if (res.data) {
        if (res.data.platformName) {
          setPlatformBrandName(res.data.platformName);
          localStorage.setItem('superadmin_brand_name', res.data.platformName);
        }
        if (res.data.platformTagline) {
          setPlatformBrandTagline(res.data.platformTagline);
          localStorage.setItem('superadmin_brand_tagline', res.data.platformTagline);
        }
        if (res.data.logoUrl) {
          setPlatformLogoUrl(res.data.logoUrl);
          localStorage.setItem('superadmin_logo_url', res.data.logoUrl);
        }
        if (res.data.companyCode) {
          setPlatformCompanyCode(res.data.companyCode);
          localStorage.setItem('superadmin_company_code', res.data.companyCode);
        }
      }
    } catch (err) {
      console.warn('Could not load platform branding:', err);
    }
  };

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBranding(true);
    try {
      await api.patch('/super-admin/branding', {
        platformName: platformBrandName,
        platformTagline: platformBrandTagline,
        logoUrl: platformLogoUrl,
        companyCode: platformCompanyCode,
        phone: profilePhone
      });
      localStorage.setItem('superadmin_brand_name', platformBrandName);
      localStorage.setItem('superadmin_brand_tagline', platformBrandTagline);
      localStorage.setItem('superadmin_logo_url', platformLogoUrl);
      localStorage.setItem('superadmin_company_code', platformCompanyCode);
      showToast('Platform branding & logo updated successfully!', 'success');
    } catch (err) {
      showToast('Failed to update platform branding.', 'error');
    } finally {
      setSavingBranding(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      showToast('Logo file size must be under 3MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setPlatformLogoUrl(base64String);
      localStorage.setItem('superadmin_logo_url', base64String);
      showToast('Logo updated! Click "Save Branding Changes" to persist.', 'success');
    };
    reader.readAsDataURL(file);
  };

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

  const loadAllUsers = async () => {
    try {
      setLoadingUsers(true);
      const res = await api.get('/super-admin/users');
      setAllUsers(res.data || []);
    } catch (err: any) {
      console.error('Failed to load platform users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleToggleUserSecurity = async (userId: string, field: 'skipFace' | 'skipLocation' | 'isActive', currentValue: boolean) => {
    try {
      setTogglingUserSecurity(userId + field);
      await api.patch(`/super-admin/users/${userId}/security-override`, {
        [field]: !currentValue
      });
      
      const label = field === 'skipFace' 
        ? `Face verification ${!currentValue ? 'Bypassed (Skip)' : 'Enforced'}`
        : field === 'skipLocation'
          ? `GPS Location check ${!currentValue ? 'Bypassed (Skip)' : 'Enforced'}`
          : `User account ${!currentValue ? 'Activated' : 'Suspended'}`;

      showToast(label, 'success');
      setAllUsers(prev => prev.map(u => u._id === userId ? { ...u, [field]: !currentValue } : u));
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to update security setting.', 'error');
    } finally {
      setTogglingUserSecurity(null);
    }
  };

  const handleApprovePlatformUser = async (userId: string, approve: boolean) => {
    try {
      await api.patch(`/super-admin/users/${userId}/security-override`, {
        isApproved: approve,
        approvalStatus: approve ? 'approved' : 'rejected',
        isActive: approve
      });
      showToast(approve ? 'User approved successfully!' : 'User registration rejected.', approve ? 'success' : 'warning');
      setAllUsers(prev => prev.map(u => u._id === userId ? { ...u, isApproved: approve, approvalStatus: approve ? 'approved' : 'rejected', isActive: approve } : u));
    } catch (err: any) {
      showToast('Failed to update approval status.', 'error');
    }
  };

  const handleSaveUserPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPassUser || !newUserPassword || newUserPassword.length < 6) {
      showToast('Password must be at least 6 characters.', 'error');
      return;
    }

    try {
      setSavingUserPassword(true);
      await api.patch(`/super-admin/users/${resetPassUser._id}/security-override`, {
        password: newUserPassword
      });
      showToast(`Password for ${resetPassUser.firstName} reset successfully!`, 'success');
      setResetPassUser(null);
      setNewUserPassword('');
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to reset password.', 'error');
    } finally {
      setSavingUserPassword(false);
    }
  };

  const loadSuperAdminProfile = async () => {
    try {
      const res = await api.get('/super-admin/profile');
      if (res.data?.admin) {
        setAdminProfile(res.data.admin);
        setProfileFirstName(res.data.admin.firstName || '');
        setProfileLastName(res.data.admin.lastName || '');
        setProfilePhone(res.data.admin.phone || '');
      }
      if (res.data?.stats?.systemInfo) {
        setSystemDiag(res.data.stats.systemInfo);
      }
    } catch (err: any) {
      console.warn('Could not load super admin profile:', err);
    }
  };

  const loadAdminTeam = async () => {
    try {
      setLoadingTeam(true);
      const res = await api.get('/super-admin/team');
      setAdminTeam(res.data || []);
    } catch (err: any) {
      showToast('Failed to load super admin team.', 'error');
    } finally {
      setLoadingTeam(false);
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
    setNewOrgLogoUrl('');
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
        logoUrl: newOrgLogoUrl,
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
      loadAllUsers();
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

  // Update Super Admin Profile
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingProfile(true);
      await api.put('/super-admin/profile', {
        firstName: profileFirstName,
        lastName: profileLastName,
        phone: profilePhone
      });
      showToast('Super Admin profile updated successfully!', 'success');
      loadSuperAdminProfile();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to update profile.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  // Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match.', 'error');
      return;
    }
    if (newPassword.length < 6) {
      showToast('Password must be at least 6 characters.', 'error');
      return;
    }

    try {
      setSavingPassword(true);
      await api.put('/super-admin/change-password', {
        currentPassword,
        newPassword
      });
      showToast('Password changed successfully!', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to change password.', 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  // Add Super Admin User
  const handleCreateTeamAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamFirst || !newTeamLast || !newTeamEmail || !newTeamPassword) {
      showToast('Please fill all required fields.', 'error');
      return;
    }

    try {
      setCreatingTeamUser(true);
      await api.post('/super-admin/team', {
        firstName: newTeamFirst.trim(),
        lastName: newTeamLast.trim(),
        email: newTeamEmail.trim(),
        password: newTeamPassword,
        phone: newTeamPhone.trim()
      });
      showToast(`Super Admin "${newTeamFirst}" created successfully!`, 'success');
      setShowAddAdminModal(false);
      setNewTeamFirst('');
      setNewTeamLast('');
      setNewTeamEmail('');
      setNewTeamPhone('');
      loadAdminTeam();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to create super admin user.', 'error');
    } finally {
      setCreatingTeamUser(false);
    }
  };

  const handleToggleAdminStatus = async (adminUser: any) => {
    const newStatus = !adminUser.isActive;
    try {
      await api.patch(`/super-admin/team/${adminUser._id}/status`, { isActive: newStatus });
      showToast(`Super Admin account ${newStatus ? 'activated' : 'deactivated'}.`, 'success');
      loadAdminTeam();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to update super admin status.', 'error');
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

  // Filtered users for User Management
  const filteredUsers = useMemo(() => {
    return allUsers.filter(u => {
      const q = userSearch.toLowerCase().trim();
      const fullName = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
      const matchesSearch = !q ||
        fullName.includes(q) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.userCode && u.userCode.toLowerCase().includes(q)) ||
        (u.organizationId?.name && u.organizationId.name.toLowerCase().includes(q));

      const orgId = typeof u.organizationId === 'object' ? u.organizationId?._id : u.organizationId;
      const matchesOrg = userOrgFilter === 'all' || orgId === userOrgFilter;

      const matchesStatus = userStatusFilter === 'all'
        ? true
        : userStatusFilter === 'active'
          ? u.isActive === true
          : userStatusFilter === 'disabled'
            ? u.isActive === false
            : u.approvalStatus === 'pending';

      return matchesSearch && matchesOrg && matchesStatus;
    });
  }, [allUsers, userSearch, userOrgFilter, userStatusFilter]);

  return (
    <div className="h-screen w-full overflow-hidden bg-[#F8F8FA] dark:bg-[#0B0F17] text-[#111827] dark:text-slate-100 flex font-sans transition-colors duration-150">
      
      {/* ── LEFT SUPER ADMIN SIDEBAR ────────────────────────────────────────── */}
      <aside className="w-64 flex-shrink-0 bg-[#FFFFFF] dark:bg-[#111827] border-r border-[#E5E7EB] dark:border-slate-800 flex flex-col justify-between h-screen sticky top-0 z-30 select-none shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        
        {/* Top Branding Section */}
        <div>
          <div className="h-16 border-b border-[#E5E7EB] dark:border-slate-800 px-4 flex items-center gap-3">
            {platformLogoUrl ? (
              <div className="w-9 h-9 rounded-lg bg-[#312E81]/5 dark:bg-white/5 border border-slate-200 dark:border-slate-800 flex items-center justify-center overflow-hidden flex-shrink-0 p-1">
                <img
                  src={platformLogoUrl}
                  alt="Platform Logo"
                  className="w-full h-full object-contain rounded"
                  onError={(e) => {
                    (e.target as any).style.display = 'none';
                  }}
                />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-lg bg-[#312E81] flex items-center justify-center text-white shadow-xs flex-shrink-0">
                <Icons.ShieldCheck className="w-4.5 h-4.5 stroke-[2.2]" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-[#111827] dark:text-white tracking-tight truncate">
                {platformBrandName}
              </div>
              <div className="text-[10px] text-[#6B7280] dark:text-slate-400 truncate font-medium">
                {platformBrandTagline}
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="p-3 space-y-1">
            <div className="px-3 py-1.5 text-[10px] font-semibold tracking-wider text-[#9CA3AF] uppercase">
              Platform Navigation
            </div>

            {/* Tab 1: Dashboard */}
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-[#F1F5F9] dark:bg-slate-800 text-[#312E81] dark:text-white font-semibold'
                  : 'text-[#4B5563] dark:text-slate-400 hover:bg-[#F9FAFB] dark:hover:bg-slate-800/60 hover:text-[#111827]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icons.LayoutDashboard className={`w-4 h-4 ${activeTab === 'dashboard' ? 'text-[#312E81] dark:text-indigo-400' : 'text-[#6B7280]'}`} />
                <span>Dashboard</span>
              </div>
              <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-[#6B7280]">
                {tenants.length}
              </span>
            </button>

            {/* Tab 2: User Management (Face / Location Bypass) */}
            <button
              onClick={() => {
                setActiveTab('users');
                loadAllUsers();
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'users'
                  ? 'bg-[#F1F5F9] dark:bg-slate-800 text-[#312E81] dark:text-white font-semibold'
                  : 'text-[#4B5563] dark:text-slate-400 hover:bg-[#F9FAFB] dark:hover:bg-slate-800/60 hover:text-[#111827]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icons.Users className={`w-4 h-4 ${activeTab === 'users' ? 'text-[#312E81] dark:text-indigo-400' : 'text-[#6B7280]'}`} />
                <span>User Management</span>
              </div>
              <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-[#6B7280]">
                {allUsers.length}
              </span>
            </button>

            {/* Tab 3: Settings */}
            <button
              onClick={() => {
                setActiveTab('settings');
                if (settingsSubTab === 'team') loadAdminTeam();
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-[#F1F5F9] dark:bg-slate-800 text-[#312E81] dark:text-white font-semibold'
                  : 'text-[#4B5563] dark:text-slate-400 hover:bg-[#F9FAFB] dark:hover:bg-slate-800/60 hover:text-[#111827]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icons.Settings className={`w-4 h-4 ${activeTab === 'settings' ? 'text-[#312E81] dark:text-indigo-400' : 'text-[#6B7280]'}`} />
                <span>Settings</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-[#312E81] dark:text-indigo-300 font-semibold">
                Super Admin
              </span>
            </button>

            <div className="pt-3 px-3 py-1.5 text-[10px] font-semibold tracking-wider text-[#9CA3AF] uppercase">
              Platform Actions
            </div>

            {/* Action 1: Create Admin-CRM */}
            <button
              onClick={handleOpenCreateModal}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-[#111827] dark:text-slate-200 bg-[#F9FAFB] dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-800 hover:bg-[#F1F5F9] dark:hover:bg-slate-800 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-2.5">
                <Icons.UserPlus className="w-4 h-4 text-[#312E81] dark:text-indigo-400 group-hover:scale-105 transition-transform" />
                <span className="font-semibold">Create Admin-CRM</span>
              </div>
              <Icons.Plus className="w-3.5 h-3.5 text-[#6B7280]" />
            </button>

            {/* Action 2: Add Custom Vertical */}
            <button
              onClick={() => setShowAddVerticalModal(true)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-[#4B5563] dark:text-slate-300 hover:bg-[#F9FAFB] dark:hover:bg-slate-800/60 hover:text-[#111827] transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-2.5">
                <Icons.Boxes className="w-4 h-4 text-[#6B7280] group-hover:text-[#312E81] dark:group-hover:text-indigo-400 transition-colors" />
                <span>Add Custom Vertical</span>
              </div>
              <Icons.Plus className="w-3.5 h-3.5 text-[#9CA3AF]" />
            </button>
          </div>
        </div>

        {/* Bottom Sidebar User Section */}
        <div className="p-3 border-t border-[#E5E7EB] dark:border-slate-800 space-y-2">
          
          {/* Super Admin User Info */}
          <div className="p-2.5 rounded-lg bg-[#F9FAFB] dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-800 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[#312E81] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
              {user?.firstName?.[0]?.toUpperCase() || 'S'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-[#111827] dark:text-white truncate">
                {user?.firstName} {user?.lastName}
              </div>
              <div className="text-[10px] text-[#6B7280] dark:text-slate-400 truncate font-mono">
                {user?.email}
              </div>
            </div>
          </div>

          {/* Theme & Logout Buttons */}
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={toggleTheme}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-[#F1F5F9] dark:hover:bg-slate-800 text-xs font-medium text-[#6B7280] dark:text-slate-400 transition-colors cursor-pointer"
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDark ? <Icons.Sun className="w-3.5 h-3.5 text-amber-400" /> : <Icons.Moon className="w-3.5 h-3.5 text-[#6B7280]" />}
              <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
            </button>

            <button
              onClick={() => logout().then(() => navigate('/login'))}
              className="p-1.5 hover:bg-[#FEF2F2] dark:hover:bg-rose-500/10 text-[#6B7280] hover:text-[#DC2626] rounded-md transition-colors cursor-pointer"
              title="Sign Out"
            >
              <Icons.LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

      </aside>

      {/* ── RIGHT MAIN CONTENT VIEWPORT ────────────────────────────────────── */}
      <div className="flex-1 h-screen overflow-y-auto flex flex-col">
        
        {/* ── TOP ACTION HEADER BAR ────────────────────────────────────────── */}
        <header className="h-16 border-b border-[#E5E7EB] dark:border-slate-800 bg-[#FFFFFF] dark:bg-[#111827] px-6 sm:px-8 flex items-center justify-between sticky top-0 z-20 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex-shrink-0">
          
          {/* Active Page Indicator with Icon & Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#312E81] to-[#4F46E5] text-white shadow-md shadow-indigo-500/20 flex items-center justify-center flex-shrink-0">
              {activeTab === 'dashboard' ? (
                <Icons.LayoutDashboard className="w-4.5 h-4.5" />
              ) : activeTab === 'users' ? (
                <Icons.Users className="w-4.5 h-4.5" />
              ) : (
                <Icons.Settings className="w-4.5 h-4.5" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] leading-none mb-1">
                <span className="font-semibold text-[#6B7280] dark:text-slate-400">
                  Platform
                </span>
                <Icons.ChevronRight className="w-3 h-3 text-[#9CA3AF]" />
                <span className="font-bold text-[#312E81] dark:text-indigo-400 uppercase tracking-wider text-[10.5px]">
                  {activeTab === 'dashboard'
                    ? 'Dashboard'
                    : activeTab === 'users'
                      ? 'User Management'
                      : 'Settings'}
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-bold text-[#111827] dark:text-white tracking-tight truncate">
                {activeTab === 'dashboard'
                  ? 'Platform Control Center'
                  : activeTab === 'users'
                    ? 'User Management & Security Overrides'
                    : 'Super Admin Settings & Security'}
              </h2>
            </div>
          </div>

          {/* Right Controls: Super Admin Identity Badge & Action Buttons */}
          <div className="flex items-center gap-3 flex-shrink-0">
            
            {/* 👑 Super Admin Status Pill */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/60 dark:to-purple-950/60 border border-indigo-200 dark:border-indigo-800 shadow-2xs select-none">
              <div className="w-5 h-5 rounded-full bg-[#312E81] text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                👑
              </div>
              <div className="flex flex-col text-left">
                <div className="flex items-center gap-1">
                  <span className="text-[10.5px] font-extrabold text-[#312E81] dark:text-indigo-300 tracking-wider">
                    SUPER ADMIN
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#15803D] animate-pulse" />
                </div>
                <span className="text-[9.5px] text-[#6B7280] dark:text-slate-400 font-medium">
                  Master Platform Access
                </span>
              </div>
            </div>

            {activeTab === 'dashboard' ? (
              <>
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
              </>
            ) : (
              <button
                onClick={() => setActiveTab('dashboard')}
                className="px-3.5 py-1.5 bg-[#F1F5F9] hover:bg-[#E2E8F0] dark:bg-slate-800 text-[#111827] dark:text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Icons.ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Dashboard</span>
              </button>
            )}
          </div>
        </header>

        {/* ── TAB 1: DASHBOARD VIEW ─────────────────────────────────────────── */}
        {activeTab === 'dashboard' && (
          <main className="flex-1 w-full max-w-[1560px] mx-auto px-8 py-7 pb-32 space-y-6">

            {/* ── STAT CARDS DECK (Compact Flat Horizontal SaaS Design) ──────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3.5 sm:gap-4">
              
              {/* ── CARD 1: TOTAL USERS (Indigo Accent) ────────────────────────── */}
              <div
                onClick={() => {
                  setUserStatusFilter('all');
                  setActiveTab('users');
                  loadAllUsers();
                }}
                className="group relative flex flex-col justify-between rounded-xl bg-white dark:bg-[#111827] border border-slate-200/90 dark:border-slate-800 p-4 shadow-2xs hover:shadow-xs hover:border-indigo-300 dark:hover:border-indigo-700/70 transition-all duration-150 cursor-pointer min-h-[124px]"
              >
                {/* First Row: [ICON] + TITLE */}
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/60 text-[#312E81] dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                    <Icons.Users className="w-4 h-4 stroke-[2]" />
                  </div>
                  <span className="text-[11.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
                    Total Users
                  </span>
                </div>

                {/* Second Row: 4 [All Staff] */}
                <div className="flex items-baseline gap-2 pl-0.5 my-1">
                  <span className="text-2xl sm:text-[28px] font-bold text-slate-900 dark:text-white tracking-tight leading-none">
                    {allUsers.length}
                  </span>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-[#312E81] dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/40">
                    All Staff
                  </span>
                </div>

                {/* Third Row: 3 active accounts   Manage → */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-[11.5px] text-slate-500 dark:text-slate-400 font-normal truncate">
                    {allUsers.filter(u => u.isActive).length} active accounts
                  </span>
                  <span className="text-[11.5px] font-semibold text-[#312E81] dark:text-indigo-400 flex items-center gap-0.5 group-hover:gap-1 transition-all flex-shrink-0">
                    <span>Manage</span>
                    <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
                  </span>
                </div>
              </div>

              {/* ── CARD 2: ACTIVE WORKSPACES (Emerald Accent) ─────────────────── */}
              <div
                onClick={() => setSelectedStatus('active')}
                className="group relative flex flex-col justify-between rounded-xl bg-white dark:bg-[#111827] border border-slate-200/90 dark:border-slate-800 p-4 shadow-2xs hover:shadow-xs hover:border-emerald-300 dark:hover:border-emerald-700/70 transition-all duration-150 cursor-pointer min-h-[124px]"
              >
                {/* First Row: [ICON] + TITLE */}
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                    <Icons.Building2 className="w-4 h-4 stroke-[2]" />
                  </div>
                  <span className="text-[11.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
                    Active Workspaces
                  </span>
                </div>

                {/* Second Row: 2 Operational */}
                <div className="flex items-baseline gap-2 pl-0.5 my-1">
                  <span className="text-2xl sm:text-[28px] font-bold text-slate-900 dark:text-white tracking-tight leading-none">
                    {stats?.activeTenants ?? 0}
                  </span>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/40">
                    Operational
                  </span>
                </div>

                {/* Third Row: 3 organizations   Live ● */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-[11.5px] text-slate-500 dark:text-slate-400 font-normal truncate">
                    {stats?.totalTenants ?? 0} organizations
                  </span>
                  <span className="text-[11.5px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 flex-shrink-0">
                    <span>Live</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  </span>
                </div>
              </div>

              {/* ── CARD 3: PENDING APPROVAL (Amber Accent) ────────────────────── */}
              <div
                onClick={() => {
                  setUserStatusFilter('pending');
                  setActiveTab('users');
                  loadAllUsers();
                }}
                className="group relative flex flex-col justify-between rounded-xl bg-white dark:bg-[#111827] border border-slate-200/90 dark:border-slate-800 p-4 shadow-2xs hover:shadow-xs hover:border-amber-300 dark:hover:border-amber-700/70 transition-all duration-150 cursor-pointer min-h-[124px]"
              >
                {/* First Row: [ICON] + TITLE */}
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-100 dark:border-amber-900/60 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                    <Icons.Clock className="w-4 h-4 stroke-[2]" />
                  </div>
                  <span className="text-[11.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
                    Pending Approval
                  </span>
                </div>

                {/* Second Row: 0 Awaiting */}
                <div className="flex items-baseline gap-2 pl-0.5 my-1">
                  <span className="text-2xl sm:text-[28px] font-bold text-slate-900 dark:text-white tracking-tight leading-none">
                    {allUsers.filter(u => u.approvalStatus === 'pending').length}
                  </span>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-900/40">
                    Awaiting
                  </span>
                </div>

                {/* Third Row: Requires verification   Review → */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-[11.5px] text-slate-500 dark:text-slate-400 font-normal truncate">
                    Requires verification
                  </span>
                  <span className="text-[11.5px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-0.5 group-hover:gap-1 transition-all flex-shrink-0">
                    <span>Review</span>
                    <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
                  </span>
                </div>
              </div>

              {/* ── CARD 4: SUSPENDED USERS (Rose Accent) ──────────────────────── */}
              <div
                onClick={() => {
                  setUserStatusFilter('disabled');
                  setActiveTab('users');
                  loadAllUsers();
                }}
                className="group relative flex flex-col justify-between rounded-xl bg-white dark:bg-[#111827] border border-slate-200/90 dark:border-slate-800 p-4 shadow-2xs hover:shadow-xs hover:border-rose-300 dark:hover:border-rose-700/70 transition-all duration-150 cursor-pointer min-h-[124px]"
              >
                {/* First Row: [ICON] + TITLE */}
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-100 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
                    <Icons.ShieldAlert className="w-4 h-4 stroke-[2]" />
                  </div>
                  <span className="text-[11.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
                    Suspended Users
                  </span>
                </div>

                {/* Second Row: 1 Disabled */}
                <div className="flex items-baseline gap-2 pl-0.5 my-1">
                  <span className="text-2xl sm:text-[28px] font-bold text-slate-900 dark:text-white tracking-tight leading-none">
                    {allUsers.filter(u => u.isActive === false).length}
                  </span>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-100 dark:border-rose-900/40">
                    Disabled
                  </span>
                </div>

                {/* Third Row: Blocked from CRM   Manage → */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-[11.5px] text-slate-500 dark:text-slate-400 font-normal truncate">
                    Blocked from CRM
                  </span>
                  <span className="text-[11.5px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-0.5 group-hover:gap-1 transition-all flex-shrink-0">
                    <span>Manage</span>
                    <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
                  </span>
                </div>
              </div>

              {/* ── CARD 5: VERTICAL TEMPLATES (Purple Accent) ─────────────────── */}
              <div
                onClick={() => setShowAddVerticalModal(true)}
                className="group relative flex flex-col justify-between rounded-xl bg-white dark:bg-[#111827] border border-slate-200/90 dark:border-slate-800 p-4 shadow-2xs hover:shadow-xs hover:border-purple-300 dark:hover:border-purple-700/70 transition-all duration-150 cursor-pointer min-h-[124px]"
              >
                {/* First Row: [ICON] + TITLE */}
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/60 border border-purple-100 dark:border-purple-900/60 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0">
                    <Icons.Boxes className="w-4 h-4 stroke-[2]" />
                  </div>
                  <span className="text-[11.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
                    Vertical Templates
                  </span>
                </div>

                {/* Second Row: 6 Presets */}
                <div className="flex items-baseline gap-2 pl-0.5 my-1">
                  <span className="text-2xl sm:text-[28px] font-bold text-slate-900 dark:text-white tracking-tight leading-none">
                    {verticals.length}
                  </span>
                  <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-900/40">
                    Presets
                  </span>
                </div>

                {/* Third Row: 3 active in use   Add Preset + */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-[11.5px] text-slate-500 dark:text-slate-400 font-normal truncate">
                    {stats?.verticalBreakdown?.length || 0} active in use
                  </span>
                  <span className="text-[11.5px] font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-0.5 group-hover:gap-1 transition-all flex-shrink-0">
                    <span>Add Preset</span>
                    <span className="inline-block transition-transform group-hover:translate-x-0.5">+</span>
                  </span>
                </div>
              </div>

            </div>

            {/* ── SEARCH & FILTER BAR ───────────────────────────────────────── */}
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

              {/* Active Filter summary */}
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

            {/* ── ADMIN TABLE ───────────────────────────────────────────────── */}
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

                            {/* Vertical Assigned */}
                            <td className="py-3.5 px-4">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-[#F1F5F9] dark:bg-slate-800 text-[#1E293B] dark:text-slate-200 border border-[#E2E8F0] dark:border-slate-700">
                                <DynamicIcon name={vIcon} className="w-3.5 h-3.5 text-[#312E81] dark:text-indigo-400" />
                                <span>{vLabel}</span>
                              </span>
                            </td>

                            {/* Org Name & Subdomain */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-black/5 dark:bg-white/5 border border-slate-200 dark:border-slate-800 p-0.5 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                  {tenant.logoUrl ? (
                                    <img
                                      src={tenant.logoUrl}
                                      alt={tenant.name}
                                      className="w-full h-full object-contain rounded"
                                      onError={(e) => {
                                        (e.target as any).style.display = 'none';
                                      }}
                                    />
                                  ) : (
                                    <Icons.Building2 className="w-4 h-4 text-[#6B7280]" />
                                  )}
                                </div>
                                <div>
                                  <span className="font-semibold text-[#111827] dark:text-slate-100 text-xs">{tenant.name}</span>
                                  <div className="flex items-center gap-1 text-[11px] text-[#6B7280] dark:text-slate-400 mt-0.5">
                                    <Icons.Globe className="w-3 h-3 text-[#9CA3AF]" />
                                    <span className="font-mono">{tenant.subdomain}.inkcrm</span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Status */}
                            <td className="py-3.5 px-4">
                              {tenant.status === 'archived' ? (
                                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#F3F4F6] text-[#6B7280] border border-[#E5E7EB]">
                                  Archived
                                </span>
                              ) : (
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                                  tenant.status === 'active'
                                    ? 'bg-[#ECFDF5] text-[#15803D] border-[#A7F3D0]'
                                    : 'bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${tenant.status === 'active' ? 'bg-[#15803D]' : 'bg-[#D97706]'}`} />
                                  <span>{tenant.status === 'active' ? 'Active' : 'Suspended'}</span>
                                </span>
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

                                {/* ✏️ Edit Tenant */}
                                {tenant.status !== 'archived' && (
                                  <button
                                    onClick={() => handleOpenEditModal(tenant)}
                                    className="p-1.5 hover:bg-[#F1F5F9] dark:hover:bg-slate-800 text-[#6B7280] hover:text-[#312E81] dark:hover:text-indigo-400 rounded-md transition-colors cursor-pointer"
                                    title="Edit Tenant & Admin Details"
                                  >
                                    <Icons.Edit2 className="w-4 h-4" />
                                  </button>
                                )}

                                {/* Safe Soft Delete (Archive) */}
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
        )}

        {/* ── TAB 2: USER MANAGEMENT & SECURITY OVERRIDES (FACE / LOCATION BYPASS) ── */}
        {activeTab === 'users' && (
          <main className="flex-1 w-full max-w-[1560px] mx-auto px-8 py-7 pb-32 space-y-6">

            {/* ── USER STATS OVERVIEW ────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              
              {/* Card 1: Total Platform Users */}
              <div className="bg-[#FFFFFF] dark:bg-[#111827] border border-[#E5E7EB] dark:border-slate-800 rounded-[14px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-medium text-[#6B7280]">Total Staff / Users</p>
                    <div className="flex items-baseline gap-2 mt-1.5">
                      <h3 className="text-2xl sm:text-3xl font-bold text-[#111827] dark:text-white">
                        {allUsers.length}
                      </h3>
                      <span className="text-xs text-[#6B7280]">registered</span>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-[#F1F5F9] dark:bg-slate-800 text-[#312E81] dark:text-slate-300 flex items-center justify-center">
                    <Icons.Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-[#F1F5F9] dark:border-slate-800 text-xs text-[#6B7280]">
                  <span>Across {tenants.length} tenant organizations</span>
                </div>
              </div>

              {/* Card 2: Face Bypass Enabled */}
              <div className="bg-[#FFFFFF] dark:bg-[#111827] border border-[#E5E7EB] dark:border-slate-800 rounded-[14px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-medium text-[#6B7280]">Face Bypass (Skip)</p>
                    <div className="flex items-baseline gap-2 mt-1.5">
                      <h3 className="text-2xl sm:text-3xl font-bold text-[#15803D] dark:text-emerald-400">
                        {allUsers.filter(u => u.skipFace).length}
                      </h3>
                      <span className="text-xs text-[#15803D] font-medium">exempted</span>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-[#ECFDF5] text-[#15803D] border border-[#A7F3D0] flex items-center justify-center">
                    <Icons.ScanFace className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-[#F1F5F9] dark:border-slate-800 text-xs text-[#6B7280]">
                  <span>Biometric check bypassed</span>
                </div>
              </div>

              {/* Card 3: Location Bypass Enabled */}
              <div className="bg-[#FFFFFF] dark:bg-[#111827] border border-[#E5E7EB] dark:border-slate-800 rounded-[14px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-medium text-[#6B7280]">Location Bypass (Skip)</p>
                    <div className="flex items-baseline gap-2 mt-1.5">
                      <h3 className="text-2xl sm:text-3xl font-bold text-[#15803D] dark:text-emerald-400">
                        {allUsers.filter(u => u.skipLocation).length}
                      </h3>
                      <span className="text-xs text-[#15803D] font-medium">exempted</span>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-[#ECFDF5] text-[#15803D] border border-[#A7F3D0] flex items-center justify-center">
                    <Icons.MapPinOff className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-[#F1F5F9] dark:border-slate-800 text-xs text-[#6B7280]">
                  <span>GPS radius check bypassed</span>
                </div>
              </div>

              {/* Card 4: Pending Approvals */}
              <div className="bg-[#FFFFFF] dark:bg-[#111827] border border-[#E5E7EB] dark:border-slate-800 rounded-[14px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-medium text-[#6B7280]">Pending Approvals</p>
                    <div className="flex items-baseline gap-2 mt-1.5">
                      <h3 className="text-2xl sm:text-3xl font-bold text-[#B45309] dark:text-amber-400">
                        {allUsers.filter(u => u.approvalStatus === 'pending').length}
                      </h3>
                      <span className="text-xs text-[#B45309] font-medium">awaiting</span>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A] flex items-center justify-center">
                    <Icons.UserCheck className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-[#F1F5F9] dark:border-slate-800 text-xs text-[#6B7280]">
                  <span>Requires admin verification</span>
                </div>
              </div>

            </div>

            {/* ── SEARCH & FILTER BAR FOR USERS ─────────────────────────────── */}
            <div className="bg-[#FFFFFF] dark:bg-[#111827] border border-[#E5E7EB] dark:border-slate-800 p-3.5 sm:p-4 rounded-[14px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] space-y-3">
              
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                {/* Search Input */}
                <div className="relative w-full sm:w-96">
                  <Icons.Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search User Name, Email, Code or Tenant..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 bg-[#F9FAFB] dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-700 rounded-lg text-xs text-[#111827] dark:text-slate-100 placeholder-[#9CA3AF] focus:outline-none focus:border-[#312E81]"
                  />
                  {userSearch && (
                    <button
                      onClick={() => setUserSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#111827] cursor-pointer"
                    >
                      <Icons.X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
                  
                  {/* Org Filter */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-[#6B7280]">Tenant:</span>
                    <select
                      value={userOrgFilter}
                      onChange={(e) => setUserOrgFilter(e.target.value)}
                      className="bg-[#F9FAFB] dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-700 text-xs font-medium text-[#111827] dark:text-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:border-[#312E81] cursor-pointer"
                    >
                      <option value="all">All Organizations ({tenants.length})</option>
                      {tenants.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Status Filter */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-[#6B7280]">Status:</span>
                    <select
                      value={userStatusFilter}
                      onChange={(e) => setUserStatusFilter(e.target.value as any)}
                      className="bg-[#F9FAFB] dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-700 text-xs font-medium text-[#111827] dark:text-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:border-[#312E81] cursor-pointer"
                    >
                      <option value="all">All Status</option>
                      <option value="active">Active Only</option>
                      <option value="disabled">Disabled Only</option>
                      <option value="pending">Pending Approval</option>
                    </select>
                  </div>

                  {/* Refresh Button */}
                  <button
                    onClick={loadAllUsers}
                    title="Refresh Users"
                    className="p-2 bg-[#F9FAFB] hover:bg-[#F3F4F6] dark:bg-slate-900 dark:hover:bg-slate-800 border border-[#E5E7EB] dark:border-slate-700 text-[#6B7280] dark:text-slate-300 rounded-lg transition-colors cursor-pointer"
                  >
                    <Icons.RefreshCw className={`w-3.5 h-3.5 ${loadingUsers ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-[#6B7280] pt-2 border-t border-[#F1F5F9] dark:border-slate-800">
                <span className="font-medium">
                  Showing {filteredUsers.length} of {allUsers.length} Users
                </span>
                <span className="text-[11px] text-[#312E81] dark:text-indigo-400 font-medium">
                  Click on Face or Location badge to toggle bypass in real-time
                </span>
              </div>
            </div>

            {/* ── USERS TABLE WITH FACE & LOCATION BYPASS TOGGLES ───────────── */}
            <div className="bg-[#FFFFFF] dark:bg-[#111827] border border-[#E5E7EB] dark:border-slate-800 rounded-[14px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06)] flex flex-col">
              <div className="overflow-x-auto overflow-y-auto max-h-[620px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 z-20 bg-[#F9FAFB] dark:bg-slate-900 border-b border-[#E5E7EB] dark:border-slate-800 text-[#6B7280] dark:text-slate-400 uppercase tracking-wider font-semibold text-[11px]">
                    <tr>
                      <th className="py-3 px-4 sm:px-6">User / Staff</th>
                      <th className="py-3 px-4">Organization / Tenant</th>
                      <th className="py-3 px-4">Role & Dept</th>
                      <th className="py-3 px-4 text-center">Face Recognition (Skip)</th>
                      <th className="py-3 px-4 text-center">GPS Location (Skip)</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 sm:px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9] dark:divide-slate-800">
                    {loadingUsers ? (
                      <tr>
                        <td colSpan={7} className="py-16 text-center text-[#6B7280]">
                          <Icons.Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#312E81]" />
                          <span className="font-medium text-xs">Loading platform users...</span>
                        </td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-14 text-center">
                          <div className="max-w-sm mx-auto flex flex-col items-center justify-center">
                            <div className="w-12 h-12 rounded-xl bg-[#F1F5F9] dark:bg-slate-800 flex items-center justify-center text-[#6B7280] mb-3">
                              <Icons.UserX className="w-6 h-6" />
                            </div>
                            <h4 className="font-semibold text-sm text-[#111827] dark:text-white">
                              No matching users found
                            </h4>
                            <p className="text-xs text-[#6B7280] mt-1">
                              Try clearing filters or search query.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((usr) => {
                        const orgName = usr.organizationId?.name || 'Platform Admin';
                        const orgSubdomain = usr.organizationId?.subdomain;
                        const roleName = usr.roleId?.name || (usr.isPlatformSuperAdmin ? 'Super Admin' : 'Admin');
                        const isTogglingFace = togglingUserSecurity === usr._id + 'skipFace';
                        const isTogglingLoc = togglingUserSecurity === usr._id + 'skipLocation';

                        return (
                          <tr key={usr._id} className="hover:bg-[#F9FAFB] dark:hover:bg-slate-800/40 transition-colors">
                            
                            {/* User Column */}
                            <td className="py-3.5 px-4 sm:px-6">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                                  usr.isPlatformSuperAdmin
                                    ? 'bg-[#312E81] text-white ring-2 ring-indigo-300 dark:ring-indigo-700'
                                    : 'bg-[#F1F5F9] dark:bg-slate-800 text-[#312E81] dark:text-slate-200 border border-[#E2E8F0] dark:border-slate-700'
                                }`}>
                                  {usr.isPlatformSuperAdmin ? '👑' : (usr.firstName?.[0]?.toUpperCase() || 'U')}
                                </div>
                                <div>
                                  <div className="font-semibold text-[#111827] dark:text-white text-xs flex items-center gap-1.5 flex-wrap">
                                    <span>{usr.firstName} {usr.lastName}</span>
                                    {usr.isPlatformSuperAdmin && (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-[#312E81] text-white tracking-wide shadow-2xs">
                                        SUPER ADMIN
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-[#6B7280] font-mono">{usr.email}</div>
                                  {usr.userCode && (
                                    <div className="text-[10px] text-[#9CA3AF] font-mono">{usr.userCode}</div>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Organization Column */}
                            <td className="py-3.5 px-4">
                              {usr.isPlatformSuperAdmin ? (
                                <div>
                                  <div className="font-bold text-[#312E81] dark:text-indigo-400 text-xs flex items-center gap-1">
                                    <Icons.ShieldCheck className="w-3.5 h-3.5" />
                                    <span>Master Platform</span>
                                  </div>
                                  <div className="text-[10px] text-[#6B7280] font-medium">All Tenants Control</div>
                                </div>
                              ) : (
                                <div>
                                  <div className="font-medium text-[#111827] dark:text-slate-200 text-xs">
                                    {orgName}
                                  </div>
                                  {orgSubdomain && (
                                    <div className="text-[11px] text-[#6B7280] font-mono">
                                      {orgSubdomain}.inkcrm
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* Role & Dept Column */}
                            <td className="py-3.5 px-4">
                              {usr.isPlatformSuperAdmin ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-[#312E81] dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                  Platform Super Admin
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-[#F1F5F9] dark:bg-slate-800 text-[#312E81] dark:text-slate-300 border border-[#E2E8F0] dark:border-slate-700">
                                  {roleName}
                                </span>
                              )}
                              {usr.department && (
                                <div className="text-[11px] text-[#6B7280] mt-0.5">{usr.department}</div>
                              )}
                            </td>

                            {/* 👤 FACE RECOGNITION BYPASS TOGGLE */}
                            <td className="py-3.5 px-4 text-center">
                              <button
                                onClick={() => handleToggleUserSecurity(usr._id, 'skipFace', !!usr.skipFace)}
                                disabled={isTogglingFace}
                                title={usr.skipFace ? 'Click to ENFORCE Face Recognition' : 'Click to BYPASS (Skip) Face Recognition'}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer shadow-2xs ${
                                  usr.skipFace
                                    ? 'bg-[#ECFDF5] text-[#15803D] border-[#A7F3D0] hover:bg-[#D1FAE5]'
                                    : 'bg-[#F9FAFB] text-[#4B5563] border-[#E5E7EB] hover:bg-[#F3F4F6]'
                                }`}
                              >
                                {isTogglingFace ? (
                                  <Icons.Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : usr.skipFace ? (
                                  <Icons.CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" />
                                ) : (
                                  <Icons.ScanFace className="w-3.5 h-3.5 text-[#6B7280]" />
                                )}
                                <span>{usr.skipFace ? 'Bypassed (Skip)' : 'Enforced (Check)'}</span>
                              </button>
                            </td>

                            {/* 📍 GPS LOCATION BYPASS TOGGLE */}
                            <td className="py-3.5 px-4 text-center">
                              <button
                                onClick={() => handleToggleUserSecurity(usr._id, 'skipLocation', !!usr.skipLocation)}
                                disabled={isTogglingLoc}
                                title={usr.skipLocation ? 'Click to ENFORCE GPS Location check' : 'Click to BYPASS (Skip) GPS Location check'}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer shadow-2xs ${
                                  usr.skipLocation
                                    ? 'bg-[#ECFDF5] text-[#15803D] border-[#A7F3D0] hover:bg-[#D1FAE5]'
                                    : 'bg-[#F9FAFB] text-[#4B5563] border-[#E5E7EB] hover:bg-[#F3F4F6]'
                                }`}
                              >
                                {isTogglingLoc ? (
                                  <Icons.Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : usr.skipLocation ? (
                                  <Icons.CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" />
                                ) : (
                                  <Icons.MapPin className="w-3.5 h-3.5 text-[#6B7280]" />
                                )}
                                <span>{usr.skipLocation ? 'Bypassed (Skip)' : 'Enforced (Check)'}</span>
                              </button>
                            </td>

                            {/* Status Column */}
                            <td className="py-3.5 px-4">
                              {usr.approvalStatus === 'pending' ? (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => handleApprovePlatformUser(usr._id, true)}
                                    className="px-2 py-0.5 bg-[#15803D] hover:bg-[#166534] text-white rounded text-[11px] font-semibold cursor-pointer"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => handleApprovePlatformUser(usr._id, false)}
                                    className="px-2 py-0.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded text-[11px] font-semibold cursor-pointer"
                                  >
                                    Reject
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleToggleUserSecurity(usr._id, 'isActive', !!usr.isActive)}
                                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border cursor-pointer ${
                                    usr.isActive
                                      ? 'bg-[#ECFDF5] text-[#15803D] border-[#A7F3D0]'
                                      : 'bg-[#FEF2F2] text-[#DC2626] border-[#FEE2E2]'
                                  }`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${usr.isActive ? 'bg-[#15803D]' : 'bg-[#DC2626]'}`} />
                                  <span>{usr.isActive ? 'Active' : 'Disabled'}</span>
                                </button>
                              )}
                            </td>

                            {/* Actions Column */}
                            <td className="py-3.5 px-4 sm:px-6 text-right">
                              <button
                                onClick={() => {
                                  setResetPassUser(usr);
                                  setNewUserPassword('');
                                }}
                                className="px-2.5 py-1 bg-[#FFFFFF] dark:bg-slate-800 hover:bg-[#F9FAFB] text-[#111827] dark:text-slate-200 border border-[#E5E7EB] dark:border-slate-700 rounded-md text-xs font-medium flex items-center gap-1 ml-auto cursor-pointer"
                                title="Reset User Password"
                              >
                                <Icons.Key className="w-3 h-3 text-[#6B7280]" />
                                <span>Reset Pass</span>
                              </button>
                            </td>

                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="px-6 py-3 bg-[#F9FAFB] dark:bg-slate-900 border-t border-[#E5E7EB] dark:border-slate-800 flex items-center justify-between text-xs text-[#6B7280]">
                <span>Showing {filteredUsers.length} of {allUsers.length} Users</span>
                <span className="font-mono text-[#9CA3AF]">inkCRM Security Control</span>
              </div>
            </div>

          </main>
        )}

        {/* ── TAB 3: SETTINGS & SUPER ADMIN MANAGEMENT VIEW ─────────────────── */}
        {activeTab === 'settings' && (
          <main className="flex-1 w-full max-w-5xl mx-auto px-8 py-7 pb-32 space-y-6">
            
            {/* Settings Sub-navigation Chips */}
            <div className="flex flex-wrap items-center gap-2 border-b border-[#E5E7EB] dark:border-slate-800 pb-3">
              {[
                { key: 'branding', label: 'Company & Branding', icon: Icons.Image },
                { key: 'profile', label: 'Super Admin Profile', icon: Icons.UserCheck },
                { key: 'security', label: 'Password & Security', icon: Icons.KeyRound },
                { key: 'team', label: 'Super Admin Team', icon: Icons.ShieldCheck },
                { key: 'system', label: 'System & Database Health', icon: Icons.Activity }
              ].map(sub => {
                const isCurrent = settingsSubTab === sub.key;
                const SubIcon = sub.icon;
                return (
                  <button
                    key={sub.key}
                    onClick={() => {
                      setSettingsSubTab(sub.key as any);
                      if (sub.key === 'team') loadAdminTeam();
                      if (sub.key === 'profile' || sub.key === 'system') loadSuperAdminProfile();
                      if (sub.key === 'branding') loadPlatformBranding();
                    }}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      isCurrent
                        ? 'bg-[#312E81] text-white shadow-xs'
                        : 'bg-[#FFFFFF] dark:bg-slate-800 text-[#4B5563] dark:text-slate-300 border border-[#E5E7EB] dark:border-slate-700 hover:bg-[#F9FAFB]'
                    }`}
                  >
                    <SubIcon className="w-3.5 h-3.5" />
                    <span>{sub.label}</span>
                  </button>
                );
              })}
            </div>

            {/* SUBTAB 0: COMPANY & BRANDING SETTING (Matching Image 2) */}
            {settingsSubTab === 'branding' && (
              <div className="bg-[#FFFFFF] dark:bg-[#111827] border border-[#E5E7EB] dark:border-slate-800 rounded-[14px] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)] space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-[#111827] dark:text-white">Platform Logo & Company Details</h3>
                    <p className="text-xs text-[#6B7280]">Update the platform logo thumbnail and company name to sync the sidebar and header branding dynamically in real-time</p>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 rounded-md border border-emerald-200 dark:border-emerald-800 text-[11px] font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Live Sidebar Sync</span>
                  </div>
                </div>

                <form onSubmit={handleSaveBranding} className="space-y-6">
                  <div className="flex flex-col md:flex-row gap-6 items-start">
                    
                    {/* ── LEFT: LOGO THUMBNAIL (Exact Match to Image 2) ─────────────── */}
                    <div className="w-full md:w-56 flex-shrink-0 flex flex-col items-center p-5 rounded-xl border border-[#E5E7EB] dark:border-slate-800 bg-[#F9FAFB] dark:bg-slate-900/50 text-center">
                      <div className="w-28 h-28 rounded-xl bg-black flex items-center justify-center overflow-hidden border border-slate-700 shadow-inner p-2 mb-3">
                        {platformLogoUrl ? (
                          <img
                            src={platformLogoUrl}
                            alt="Logo Thumbnail"
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <Icons.Image className="w-10 h-10 text-slate-500" />
                        )}
                      </div>

                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-slate-400 mb-3">
                        LOGO THUMBNAIL
                      </span>

                      <label className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-full text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-xs cursor-pointer transition-colors">
                        <span>Choose file</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                      </label>
                      <span className="text-[10px] text-[#9CA3AF] mt-2">PNG, JPG, SVG, WebP</span>
                    </div>

                    {/* ── RIGHT: COMPANY & BRANDING INPUTS (Matching Image 2) ────────── */}
                    <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-[#111827] dark:text-slate-300 mb-1">
                          COMPANY CODE *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. COMP01"
                          value={platformCompanyCode}
                          onChange={(e) => setPlatformCompanyCode(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-[#F9FAFB] dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-700 rounded-lg text-xs text-[#111827] dark:text-white focus:outline-none focus:border-[#312E81]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#111827] dark:text-slate-300 mb-1">
                          COMPANY NAME *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. inkCRM Platform"
                          value={platformBrandName}
                          onChange={(e) => setPlatformBrandName(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-[#F9FAFB] dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-700 rounded-lg text-xs text-[#111827] dark:text-white focus:outline-none focus:border-[#312E81] font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#111827] dark:text-slate-300 mb-1">
                          PLATFORM TAGLINE / SUBTITLE
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Super Admin Engine"
                          value={platformBrandTagline}
                          onChange={(e) => setPlatformBrandTagline(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-[#F9FAFB] dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-700 rounded-lg text-xs text-[#111827] dark:text-white focus:outline-none focus:border-[#312E81]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#111827] dark:text-slate-300 mb-1">
                          PHONE NUMBER *
                        </label>
                        <input
                          type="text"
                          placeholder="+1 (555) 019-2834"
                          value={profilePhone}
                          onChange={(e) => setProfilePhone(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-[#F9FAFB] dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-700 rounded-lg text-xs text-[#111827] dark:text-white focus:outline-none focus:border-[#312E81]"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-[#111827] dark:text-slate-300 mb-1">
                          OFFICIAL SYSTEM EMAIL
                        </label>
                        <input
                          type="email"
                          disabled
                          value={adminProfile?.email || user?.email || 'superadmin@inkcrm.com'}
                          className="w-full px-3.5 py-2 bg-[#F3F4F6] dark:bg-slate-800 border border-[#E5E7EB] dark:border-slate-700 rounded-lg text-xs text-[#6B7280] font-mono cursor-not-allowed"
                        />
                        <span className="text-[11px] text-[#6B7280] dark:text-slate-400 mt-1 block">
                          Any changes made to the Logo Thumbnail or Company Name will automatically sync and update the top-left sidebar in real-time.
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end border-t border-[#F1F5F9] dark:border-slate-800">
                    <button
                      type="submit"
                      disabled={savingBranding}
                      className="px-5 py-2 bg-[#312E81] hover:bg-[#282568] text-white font-medium text-xs rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                    >
                      {savingBranding ? <Icons.Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icons.Check className="w-3.5 h-3.5" />}
                      <span>Save Branding Changes</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* SUBTAB 1: SUPER ADMIN PROFILE */}
            {settingsSubTab === 'profile' && (
              <div className="bg-[#FFFFFF] dark:bg-[#111827] border border-[#E5E7EB] dark:border-slate-800 rounded-[14px] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)] space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-[#111827] dark:text-white">Super Admin User Profile</h3>
                  <p className="text-xs text-[#6B7280]">Primary administrative account credentials and contact details</p>
                </div>

                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[#111827] dark:text-slate-300 mb-1">First Name</label>
                      <input
                        type="text"
                        required
                        value={profileFirstName}
                        onChange={(e) => setProfileFirstName(e.target.value)}
                        className="w-full px-3.5 py-2 bg-[#F9FAFB] dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-700 rounded-lg text-xs text-[#111827] dark:text-white focus:outline-none focus:border-[#312E81]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#111827] dark:text-slate-300 mb-1">Last Name</label>
                      <input
                        type="text"
                        required
                        value={profileLastName}
                        onChange={(e) => setProfileLastName(e.target.value)}
                        className="w-full px-3.5 py-2 bg-[#F9FAFB] dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-700 rounded-lg text-xs text-[#111827] dark:text-white focus:outline-none focus:border-[#312E81]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#111827] dark:text-slate-300 mb-1">Email Address</label>
                      <input
                        type="email"
                        disabled
                        value={adminProfile?.email || user?.email || 'superadmin@inkcrm.com'}
                        className="w-full px-3.5 py-2 bg-[#F3F4F6] dark:bg-slate-800 border border-[#E5E7EB] dark:border-slate-700 rounded-lg text-xs text-[#6B7280] font-mono cursor-not-allowed"
                      />
                      <span className="text-[10px] text-[#9CA3AF] mt-0.5 block">Master account identifier cannot be altered</span>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#111827] dark:text-slate-300 mb-1">Contact Phone</label>
                      <input
                        type="text"
                        placeholder="+1 (555) 019-2834"
                        value={profilePhone}
                        onChange={(e) => setProfilePhone(e.target.value)}
                        className="w-full px-3.5 py-2 bg-[#F9FAFB] dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-700 rounded-lg text-xs text-[#111827] dark:text-white focus:outline-none focus:border-[#312E81]"
                      />
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end border-t border-[#F1F5F9] dark:border-slate-800">
                    <button
                      type="submit"
                      disabled={savingProfile}
                      className="px-5 py-2 bg-[#312E81] hover:bg-[#282568] text-white font-medium text-xs rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                    >
                      {savingProfile ? <Icons.Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icons.Check className="w-3.5 h-3.5" />}
                      <span>Save Profile Changes</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* SUBTAB 2: PASSWORD & SECURITY */}
            {settingsSubTab === 'security' && (
              <div className="bg-[#FFFFFF] dark:bg-[#111827] border border-[#E5E7EB] dark:border-slate-800 rounded-[14px] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)] space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-[#111827] dark:text-white">Security & Password Management</h3>
                  <p className="text-xs text-[#6B7280]">Update credentials and review authentication controls</p>
                </div>

                <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-xs font-medium text-[#111827] dark:text-slate-300 mb-1">Current Password</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-3.5 py-2 bg-[#F9FAFB] dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-700 rounded-lg text-xs text-[#111827] dark:text-white focus:outline-none focus:border-[#312E81]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#111827] dark:text-slate-300 mb-1">New Password</label>
                    <input
                      type="password"
                      required
                      placeholder="At least 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3.5 py-2 bg-[#F9FAFB] dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-700 rounded-lg text-xs text-[#111827] dark:text-white focus:outline-none focus:border-[#312E81]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#111827] dark:text-slate-300 mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3.5 py-2 bg-[#F9FAFB] dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-700 rounded-lg text-xs text-[#111827] dark:text-white focus:outline-none focus:border-[#312E81]"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={savingPassword || !newPassword}
                      className="px-5 py-2 bg-[#312E81] hover:bg-[#282568] text-white font-medium text-xs rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                    >
                      {savingPassword ? <Icons.Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icons.Lock className="w-3.5 h-3.5" />}
                      <span>Update Password</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* SUBTAB 3: SUPER ADMIN TEAM */}
            {settingsSubTab === 'team' && (
              <div className="bg-[#FFFFFF] dark:bg-[#111827] border border-[#E5E7EB] dark:border-slate-800 rounded-[14px] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)] space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-[#111827] dark:text-white">Platform Super Admin Team</h3>
                    <p className="text-xs text-[#6B7280]">Staff with elevated master platform control and tenant provisioning privileges</p>
                  </div>
                  <button
                    onClick={() => setShowAddAdminModal(true)}
                    className="px-3.5 py-2 bg-[#312E81] hover:bg-[#282568] text-white font-medium text-xs rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Icons.UserPlus className="w-3.5 h-3.5" />
                    <span>Add Super Admin</span>
                  </button>
                </div>

                <div className="border border-[#E5E7EB] dark:border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F9FAFB] dark:bg-slate-900 border-b border-[#E5E7EB] dark:border-slate-800 text-[#6B7280] font-semibold">
                      <tr>
                        <th className="py-3 px-4">User</th>
                        <th className="py-3 px-4">Role</th>
                        <th className="py-3 px-4">User Code</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1F5F9] dark:divide-slate-800">
                      {loadingTeam ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-[#6B7280]">
                            <Icons.Loader2 className="w-4 h-4 animate-spin mx-auto mb-1 text-[#312E81]" />
                            <span>Loading super admin team...</span>
                          </td>
                        </tr>
                      ) : adminTeam.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-[#6B7280]">
                            No secondary super admins found.
                          </td>
                        </tr>
                      ) : (
                        adminTeam.map((member) => (
                          <tr key={member._id} className="hover:bg-[#F9FAFB] dark:hover:bg-slate-800/40">
                            <td className="py-3 px-4">
                              <div className="font-semibold text-[#111827] dark:text-white">
                                {member.firstName} {member.lastName}
                              </div>
                              <div className="text-[11px] text-[#6B7280] font-mono">{member.email}</div>
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded text-[10.5px] font-semibold bg-[#F1F5F9] text-[#312E81] border border-[#E2E8F0]">
                                Super Admin
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-500">
                              {member.userCode || 'SADM-ROOT'}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                                member.isActive
                                  ? 'bg-[#ECFDF5] text-[#15803D] border-[#A7F3D0]'
                                  : 'bg-[#FEF2F2] text-[#DC2626] border-[#FEE2E2]'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${member.isActive ? 'bg-[#15803D]' : 'bg-[#DC2626]'}`} />
                                <span>{member.isActive ? 'Active' : 'Disabled'}</span>
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              {member.email !== 'superadmin@inkcrm.com' && (
                                <button
                                  onClick={() => handleToggleAdminStatus(member)}
                                  className="text-xs font-medium text-[#312E81] hover:underline cursor-pointer"
                                >
                                  {member.isActive ? 'Deactivate' : 'Activate'}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SUBTAB 4: PLATFORM & SYSTEM HEALTH */}
            {settingsSubTab === 'system' && (
              <div className="bg-[#FFFFFF] dark:bg-[#111827] border border-[#E5E7EB] dark:border-slate-800 rounded-[14px] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)] space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-[#111827] dark:text-white">Platform Diagnostics & Database Health</h3>
                  <p className="text-xs text-[#6B7280]">Live runtime environment and MongoDB persistence metrics</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-[#F9FAFB] dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-800 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#111827] dark:text-white">
                      <Icons.Database className="w-4 h-4 text-[#312E81]" />
                      <span>MongoDB Connection</span>
                    </div>
                    <div className="text-xs text-[#6B7280] space-y-1">
                      <div>Status: <strong className="text-[#15803D]">{systemDiag?.dbStatus || 'Connected'}</strong></div>
                      <div>Target Database: <strong className="font-mono text-[#111827] dark:text-slate-200">{systemDiag?.dbName || 'inkcrm_generic'}</strong></div>
                      <div>Total Organizations: <strong>{tenants.length}</strong></div>
                    </div>
                  </div>

                  <div className="p-4 bg-[#F9FAFB] dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-800 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#111827] dark:text-white">
                      <Icons.Server className="w-4 h-4 text-[#312E81]" />
                      <span>Server Runtime</span>
                    </div>
                    <div className="text-xs text-[#6B7280] space-y-1">
                      <div>Node.js Version: <strong className="font-mono">{systemDiag?.nodeVersion || 'v20.16.0'}</strong></div>
                      <div>Platform Architecture: <strong className="font-mono">{systemDiag?.platform || 'win32 (x64)'}</strong></div>
                      <div>API Endpoint: <strong className="font-mono">http://localhost:5000</strong></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </main>
        )}

      </div>

      {/* ── MODAL: RESET USER PASSWORD ────────────────────────────────────── */}
      <AnimatePresence>
        {resetPassUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setResetPassUser(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="relative z-10 bg-[#FFFFFF] dark:bg-[#111827] border border-[#E5E7EB] dark:border-slate-800 rounded-[14px] w-full max-w-sm overflow-hidden shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-[#E5E7EB] dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Icons.Key className="w-4 h-4 text-[#312E81]" />
                  <h3 className="text-base font-bold text-[#111827] dark:text-white">Reset User Password</h3>
                </div>
                <button onClick={() => setResetPassUser(null)} className="text-[#9CA3AF] hover:text-[#111827] cursor-pointer">
                  <Icons.X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-[#6B7280]">
                Set a new password for <strong>{resetPassUser.firstName} {resetPassUser.lastName}</strong> ({resetPassUser.email}).
              </p>

              <form onSubmit={handleSaveUserPasswordReset} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#111827] dark:text-slate-300 mb-1">New Password *</label>
                  <input
                    type="text"
                    required
                    placeholder="At least 6 characters"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    className="w-full px-3.5 py-2 bg-[#F9FAFB] dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-700 rounded-lg text-xs font-mono focus:outline-none focus:border-[#312E81]"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setResetPassUser(null)}
                    className="px-3.5 py-1.5 bg-[#F1F5F9] text-[#111827] rounded-lg text-xs font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingUserPassword || !newUserPassword}
                    className="px-4 py-1.5 bg-[#312E81] hover:bg-[#282568] text-white font-medium text-xs rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                  >
                    {savingUserPassword ? <Icons.Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icons.Check className="w-3.5 h-3.5" />}
                    <span>Set Password</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL: CREATE SUPER ADMIN TEAM USER ────────────────────────────── */}
      <AnimatePresence>
        {showAddAdminModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setShowAddAdminModal(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="relative z-10 bg-[#FFFFFF] dark:bg-[#111827] border border-[#E5E7EB] dark:border-slate-800 rounded-[14px] w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-[#E5E7EB] dark:border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-bold text-[#111827] dark:text-white">Add Super Admin User</h3>
                  <p className="text-xs text-[#6B7280]">Grant platform master authority</p>
                </div>
                <button onClick={() => setShowAddAdminModal(false)} className="text-[#9CA3AF] hover:text-[#111827] cursor-pointer">
                  <Icons.X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateTeamAdmin} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#111827] dark:text-slate-300 mb-1">First Name *</label>
                    <input
                      type="text"
                      required
                      value={newTeamFirst}
                      onChange={(e) => setNewTeamFirst(e.target.value)}
                      className="w-full px-3 py-1.5 bg-[#F9FAFB] dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:border-[#312E81]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#111827] dark:text-slate-300 mb-1">Last Name *</label>
                    <input
                      type="text"
                      required
                      value={newTeamLast}
                      onChange={(e) => setNewTeamLast(e.target.value)}
                      className="w-full px-3 py-1.5 bg-[#F9FAFB] dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:border-[#312E81]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#111827] dark:text-slate-300 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={newTeamEmail}
                    onChange={(e) => setNewTeamEmail(e.target.value)}
                    placeholder="admin2@inkcrm.com"
                    className="w-full px-3 py-1.5 bg-[#F9FAFB] dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:border-[#312E81]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#111827] dark:text-slate-300 mb-1">Password *</label>
                  <input
                    type="text"
                    required
                    value={newTeamPassword}
                    onChange={(e) => setNewTeamPassword(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#F9FAFB] dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-700 rounded-lg text-xs font-mono focus:outline-none focus:border-[#312E81]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#111827] dark:text-slate-300 mb-1">Phone</label>
                  <input
                    type="text"
                    value={newTeamPhone}
                    onChange={(e) => setNewTeamPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full px-3 py-1.5 bg-[#F9FAFB] dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:border-[#312E81]"
                  />
                </div>

                <div className="pt-3 flex justify-end gap-2 border-t border-[#E5E7EB] dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddAdminModal(false)}
                    className="px-3.5 py-1.5 bg-[#F1F5F9] text-[#111827] rounded-lg text-xs font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingTeamUser}
                    className="px-4 py-1.5 bg-[#312E81] hover:bg-[#282568] text-white font-medium text-xs rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {creatingTeamUser ? <Icons.Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icons.Check className="w-3.5 h-3.5" />}
                    <span>Create Admin</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL: CREATE ADMIN-CRM & TENANT WIZARD ────────────────────────── */}
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
              <div className="p-5 border-b border-[#E5E7EB] dark:border-slate-800 flex items-center justify-between bg-[#F9FAFB] dark:bg-slate-900/50">
                <div>
                  <h3 className="text-base font-bold text-[#111827] dark:text-white">Create Admin-CRM & Tenant Instance</h3>
                  <p className="text-xs text-[#6B7280]">Set up a new scoped workspace with pre-configured vertical template</p>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1.5 text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white rounded-lg hover:bg-[#F3F4F6] cursor-pointer"
                >
                  <Icons.X className="w-5 h-5" />
                </button>
              </div>

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

              <form onSubmit={handleCreateTenant} className="p-6 overflow-y-auto space-y-6">
                {createStep === 1 && (
                  <div className="space-y-4">
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

                {createStep === 2 && (
                  <div className="space-y-4">
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
                        <label className="block text-xs font-medium text-[#111827] dark:text-slate-300 mb-1">Organization Logo (Optional)</label>
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg bg-black flex items-center justify-center overflow-hidden border border-slate-700 p-1 flex-shrink-0">
                            {newOrgLogoUrl ? (
                              <img src={newOrgLogoUrl} alt="Logo Preview" className="w-full h-full object-contain" />
                            ) : (
                              <Icons.Image className="w-5 h-5 text-slate-500" />
                            )}
                          </div>
                          <label className="px-3.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-slate-50">
                            <span>Choose logo file</span>
                            <input type="file" accept="image/*" onChange={handleNewLogoFile} className="hidden" />
                          </label>
                          {newOrgLogoUrl && (
                            <button type="button" onClick={() => setNewOrgLogoUrl('')} className="text-xs text-rose-500 hover:underline">
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {createStep === 3 && (
                  <div className="space-y-4">
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

                {createStep === 4 && (
                  <div className="space-y-4">
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

                <div className="pt-4 flex justify-between items-center border-t border-[#E5E7EB] dark:border-slate-800">
                  {createStep > 1 ? (
                    <button
                      type="button"
                      onClick={() => setCreateStep((prev) => (prev - 1) as any)}
                      className="px-3.5 py-2 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#111827] rounded-lg text-xs font-medium cursor-pointer"
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

      {/* ── MODAL: ADD CUSTOM VERTICAL ────────────────────────────────────── */}
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

      {/* ── MODAL: SAFE ARCHIVE CONFIRMATION ──────────────────────────────── */}
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

      {/* ── MODAL: EDIT ENABLED MODULES (KILL-SWITCH) ─────────────────────── */}
      <AnimatePresence>
        {modulesModalTenant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setShowRequestsModal(false)} />
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

      {/* ── MODAL: MODULE REQUESTS QUEUE ───────────────────────────────────── */}
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

      {/* ── MODAL: EDIT TENANT & ADMIN DETAILS ────────────────────────────── */}
      <AnimatePresence>
        {editModalTenant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setEditModalTenant(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="relative z-10 bg-[#FFFFFF] dark:bg-[#111827] border border-[#E5E7EB] dark:border-slate-800 rounded-[14px] w-full max-w-lg overflow-hidden shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-[#E5E7EB] dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#F1F5F9] dark:bg-slate-800 text-[#312E81] dark:text-indigo-400 flex items-center justify-center">
                    <Icons.Edit2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#111827] dark:text-white">Edit Tenant & Admin</h3>
                    <p className="text-xs text-[#6B7280]">Update organization info and primary admin credentials</p>
                  </div>
                </div>
                <button onClick={() => setEditModalTenant(null)} className="text-[#9CA3AF] hover:text-[#111827] cursor-pointer">
                  <Icons.X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEditTenant} className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-[#111827] dark:text-slate-300 mb-1">Company / Organization Name *</label>
                    <input
                      type="text"
                      required
                      value={editOrgName}
                      onChange={(e) => setEditOrgName(e.target.value)}
                      className="w-full px-3.5 py-2 bg-[#F9FAFB] dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-700 rounded-lg text-xs text-[#111827] dark:text-white focus:outline-none focus:border-[#312E81]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#111827] dark:text-slate-300 mb-1">Organization Logo</label>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-black flex items-center justify-center overflow-hidden border border-slate-700 p-1 flex-shrink-0">
                        {editOrgLogoUrl ? (
                          <img src={editOrgLogoUrl} alt="Logo Preview" className="w-full h-full object-contain" />
                        ) : (
                          <Icons.Image className="w-5 h-5 text-slate-500" />
                        )}
                      </div>
                      <label className="px-3.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-slate-50">
                        <span>Choose logo file</span>
                        <input type="file" accept="image/*" onChange={handleEditLogoFile} className="hidden" />
                      </label>
                      {editOrgLogoUrl && (
                        <button type="button" onClick={() => setEditOrgLogoUrl('')} className="text-xs text-rose-500 hover:underline">
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[#111827] dark:text-slate-300 mb-1">Subdomain *</label>
                      <div className="flex items-center">
                        <input
                          type="text"
                          required
                          value={editOrgSubdomain}
                          onChange={(e) => setEditOrgSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                          className="w-full px-3 py-2 bg-[#F9FAFB] dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-700 rounded-l-lg text-xs text-[#111827] dark:text-white font-mono focus:outline-none focus:border-[#312E81]"
                        />
                        <span className="px-2 py-2 bg-[#F1F5F9] dark:bg-slate-800 border border-l-0 border-[#E5E7EB] dark:border-slate-700 text-[11px] font-mono text-[#6B7280] rounded-r-lg">
                          .inkcrm
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#111827] dark:text-slate-300 mb-1">Industry Vertical</label>
                      <select
                        value={editVerticalType}
                        onChange={(e) => setEditVerticalType(e.target.value)}
                        className="w-full px-3 py-2 bg-[#F9FAFB] dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-700 rounded-lg text-xs text-[#111827] dark:text-white focus:outline-none focus:border-[#312E81]"
                      >
                        {verticals.map(v => (
                          <option key={v.key} value={v.key}>{v.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#111827] dark:text-slate-300 mb-1">Status</label>
                    <div className="flex gap-3">
                      <label className="flex items-center gap-2 text-xs text-[#111827] dark:text-slate-300 cursor-pointer">
                        <input
                          type="radio"
                          name="editStatus"
                          value="active"
                          checked={editStatus === 'active'}
                          onChange={() => setEditStatus('active')}
                          className="text-[#15803D] focus:ring-0"
                        />
                        <span className="text-[#15803D] font-medium">Active (Operational)</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-[#111827] dark:text-slate-300 cursor-pointer">
                        <input
                          type="radio"
                          name="editStatus"
                          value="disabled"
                          checked={editStatus === 'disabled'}
                          onChange={() => setEditStatus('disabled')}
                          className="text-[#B45309] focus:ring-0"
                        />
                        <span className="text-[#B45309] font-medium">Suspended (Blocked)</span>
                      </label>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#F1F5F9] dark:border-slate-800">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#111827] dark:text-slate-300 mb-2">
                      Primary Admin Contact
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-[#6B7280] mb-1">First Name</label>
                        <input
                          type="text"
                          value={editAdminFirstName}
                          onChange={(e) => setEditAdminFirstName(e.target.value)}
                          className="w-full px-3 py-1.5 bg-[#F9FAFB] dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-700 rounded-lg text-xs text-[#111827] dark:text-white focus:outline-none focus:border-[#312E81]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#6B7280] mb-1">Last Name</label>
                        <input
                          type="text"
                          value={editAdminLastName}
                          onChange={(e) => setEditAdminLastName(e.target.value)}
                          className="w-full px-3 py-1.5 bg-[#F9FAFB] dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-700 rounded-lg text-xs text-[#111827] dark:text-white focus:outline-none focus:border-[#312E81]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#6B7280] mb-1">Email</label>
                        <input
                          type="email"
                          value={editAdminEmail}
                          onChange={(e) => setEditAdminEmail(e.target.value)}
                          className="w-full px-3 py-1.5 bg-[#F9FAFB] dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-700 rounded-lg text-xs text-[#111827] dark:text-white focus:outline-none focus:border-[#312E81]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#6B7280] mb-1">Phone</label>
                        <input
                          type="text"
                          value={editAdminPhone}
                          onChange={(e) => setEditAdminPhone(e.target.value)}
                          className="w-full px-3 py-1.5 bg-[#F9FAFB] dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-700 rounded-lg text-xs text-[#111827] dark:text-white focus:outline-none focus:border-[#312E81]"
                        />
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="block text-xs font-medium text-[#6B7280] mb-1">Reset Password (Optional)</label>
                      <input
                        type="text"
                        placeholder="Leave blank to keep unchanged"
                        value={editAdminPassword}
                        onChange={(e) => setEditAdminPassword(e.target.value)}
                        className="w-full px-3 py-1.5 bg-[#F9FAFB] dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-700 rounded-lg text-xs font-mono text-[#111827] dark:text-white focus:outline-none focus:border-[#312E81]"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-[#E5E7EB] dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEditModalTenant(null)}
                    className="px-3.5 py-1.5 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#111827] rounded-lg text-xs font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingEditTenant}
                    className="px-4 py-1.5 bg-[#312E81] hover:bg-[#282568] text-white font-medium text-xs rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                  >
                    {savingEditTenant ? <Icons.Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icons.Check className="w-3.5 h-3.5" />}
                    <span>Save Changes</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
