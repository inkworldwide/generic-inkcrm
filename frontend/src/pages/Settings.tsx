import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useThemeStore, ThemeSettings } from '../store/themeStore';
import { useModuleStore, FieldDefinition } from '../store/moduleStore';
import api from '../services/api';
import * as Icons from 'lucide-react';
import FaceEnrollment from '../components/FaceEnrollment';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';

const PRESET_COLORS = [
  { name: 'Indigo', rgb: '79 70 229', hex: '#4F46E5' },
  { name: 'Emerald', rgb: '16 185 129', hex: '#10B981' },
  { name: 'Teal', rgb: '13 148 136', hex: '#0D9488' },
  { name: 'Rose', rgb: '244 63 94', hex: '#F43F5E' },
  { name: 'Amber', rgb: '245 158 11', hex: '#F59E0B' },
  { name: 'Sky', rgb: '14 165 233', hex: '#0EA5E9' }
];

const FONTS = ['Inter', 'Outfit', 'Roboto'];

export default function Settings() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { showConfirm, showToast } = useToastStore();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const currentTab = queryParams.get('tab') || 'company';

  const { branding, fetchBranding, applyTheme } = useThemeStore();
  const { modules } = useModuleStore();

  const [companyName, setCompanyName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [selectedColor, setSelectedColor] = useState('79 70 229');
  const [sidebarBg, setSidebarBg] = useState('#0f172a');
  const [fontFamily, setFontFamily] = useState('Inter');
  const [mode, setMode] = useState<'light' | 'dark' | 'system'>('light');

  // Company Setting sub-tab active state
  const [companySubTab, setCompanySubTab] = useState<'details' | 'address' | 'admin'>('details');

  // Extended Company details state
  const [companyCode, setCompanyCode] = useState('');
  const [registrationId, setRegistrationId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [companyDocUrl, setCompanyDocUrl] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [fax, setFax] = useState('');
  const [website, setWebsite] = useState('');

  // Address state
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [companyState, setCompanyState] = useState('');
  const [country, setCountry] = useState('India');
  const [postalCode, setPostalCode] = useState('');

  // Admin Details state
  const [adminFirstName, setAdminFirstName] = useState('');
  const [adminLastName, setAdminLastName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState('');
  const [financialYear, setFinancialYear] = useState('');
  const [roleType, setRoleType] = useState('');

  // RBAC permissions state
  const [roles, setRoles] = useState<any[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [rolePermissions, setRolePermissions] = useState<any[]>([]);
  const [roleFormName, setRoleFormName] = useState('');
  const [roleFormActive, setRoleFormActive] = useState(true);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [rolePage, setRolePage] = useState(1);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Status settings state
  const [statuses, setStatuses] = useState<any[]>([]);
  const [statusForm, setStatusForm] = useState<any>({
    id: '', name: '', color: '#4F46E5', icon: 'Circle', pipelinePosition: 0,
    dashboardVisibility: true, isFinal: false, isSuccess: false, order: 0
  });
  const [statusEditing, setStatusEditing] = useState(false);

  // User management state
  const [users, setUsers] = useState<any[]>([]);
  const [userForm, setUserForm] = useState({
    id: '', email: '', password: '', firstName: '', lastName: '', roleId: ''
  });
  const [userEditing, setUserEditing] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);

  // Dynamic Module settings state
  const [moduleRecords, setModuleRecords] = useState<any[]>([]);
  const [moduleForm, setModuleForm] = useState<any>({});
  const [moduleEditingId, setModuleEditingId] = useState('');
  const [moduleModalOpen, setModuleModalOpen] = useState(false);

  // Custom Banking Partner state — hardcoded Indian bank list
  const INDIAN_BANKS = [
    'State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra Bank',
    'Punjab National Bank', 'Bank of Baroda', 'Canara Bank', 'IndusInd Bank', 'IDFC FIRST Bank',
    'Union Bank of India', 'Bank of India', 'Central Bank of India', 'Indian Bank',
    'Yes Bank', 'Federal Bank', 'South Indian Bank', 'Karur Vysya Bank', 'Tata Capital',
    'L&T Finance', 'Bajaj Finserv', 'Shriram Finance', 'Fullerton India', 'Cholamandalam Finance'
  ];
  const [bankMastersList, setBankMastersList] = useState<string[]>(INDIAN_BANKS);
  const [bpForm, setBpForm] = useState({ bank: '', loanType: '', psm: '' });
  const [selectedBanks, setSelectedBanks] = useState<string[]>([]);
  const [editingBpId, setEditingBpId] = useState<string | null>(null);
  const [bpEditModalOpen, setBpEditModalOpen] = useState(false);
  const [bpEditForm, setBpEditForm] = useState({ bank: '', loanType: '', psm: '' });
  const [selectedEditBanks, setSelectedEditBanks] = useState<string[]>([]);
  const [bpFilterBank, setBpFilterBank] = useState('');
  const [bpFilterBankShow, setBpFilterBankShow] = useState('');
  const [showAllBp, setShowAllBp] = useState(false);
  const [bpConflictModal, setBpConflictModal] = useState<{
    isOpen: boolean;
    psmName: string;
    bankName: string;
    loanType: string;
  } | null>(null);

  const handleBankCheckboxChange = (bankName: string, checked: boolean) => {
    if (checked) {
      setSelectedBanks([...selectedBanks, bankName]);
    } else {
      setSelectedBanks(selectedBanks.filter((b) => b !== bankName));
    }
  };

  const handleEditBankCheckboxChange = (bankName: string, checked: boolean) => {
    if (checked) {
      setSelectedEditBanks([...selectedEditBanks, bankName]);
    } else {
      setSelectedEditBanks(selectedEditBanks.filter((b) => b !== bankName));
    }
  };
  const SETTINGS_TABS = [
    { id: 'company', label: 'Company Setting', icon: Icons.Building2 },
    { id: 'role', label: 'Role', icon: Icons.Shield },
    { id: 'department', label: 'Department', icon: Icons.Network },
    { id: 'product', label: 'Product', icon: Icons.Package },
    { id: 'bankmaster', label: 'Bank Master', icon: Icons.Landmark },
    { id: 'bankingpartner', label: 'Banking Partner', icon: Icons.Briefcase },
    { id: 'status', label: 'Status', icon: Icons.Tag },
  ];

  const currentUserRole = roles.find(r => r._id === user?.roleId);
  const isSuperAdmin = currentUserRole?.name === 'Super Admin';
  const visibleTabs = SETTINGS_TABS;
  const accessDenied = false;

  const tabToApiPath: Record<string, string> = {
    department: 'departments',
    product: 'products',
    bankmaster: 'bankmasters',
    bankingpartner: 'bankingpartners'
  };

  useEffect(() => {
    setBpForm({ bank: '', loanType: '', psm: '' });
    setSelectedBanks([]);
    setBpFilterBank('');
    setBpFilterBankShow('');
    setShowAllBp(false);
    loadSettingsData();
  }, [branding, currentTab]);

  const loadSettingsData = async () => {
    let activeBranding = branding;
    if (!activeBranding) {
      const cachedSub = localStorage.getItem('tenantSubdomain') || 'sales';
      activeBranding = await fetchBranding(cachedSub);
    }
    
    if (activeBranding) {
      setCompanyName(activeBranding.name);
      setLogoUrl(activeBranding.logoUrl || '');
      setSelectedColor(activeBranding.themeSettings.primaryColor);
      setSidebarBg(activeBranding.themeSettings.sidebarBg);
      setFontFamily(activeBranding.themeSettings.fontFamily);
      setMode(activeBranding.themeSettings.mode);

      // Populate extended fields
      setCompanyCode(activeBranding.companyCode || '');
      setRegistrationId(activeBranding.registrationId || '');
      setStartDate(activeBranding.startDate || '');
      setEndDate(activeBranding.endDate || '');
      setCompanyDocUrl(activeBranding.companyDocUrl || '');
      setPhoneNumber(activeBranding.phoneNumber || '');
      setMobile(activeBranding.mobile || '');
      setEmail(activeBranding.email || '');
      setFax(activeBranding.fax || '');
      setWebsite(activeBranding.website || '');

      setAddress(activeBranding.address || '');
      setCity(activeBranding.city || '');
      setCompanyState(activeBranding.state || '');
      setCountry(activeBranding.country || 'India');
      setPostalCode(activeBranding.postalCode || '');

      if (activeBranding.adminDetails) {
        setAdminFirstName(activeBranding.adminDetails.firstName || '');
        setAdminLastName(activeBranding.adminDetails.lastName || '');
        setAdminUsername(activeBranding.adminDetails.username || '');
        setAdminPassword(activeBranding.adminDetails.password || '');
        setAdminConfirmPassword(activeBranding.adminDetails.password || '');
        setFinancialYear(activeBranding.adminDetails.financialYear || '');
        setRoleType(activeBranding.adminDetails.roleType || '');
      }
    }

    try {
      // Load Roles from backend
      const resRoles = await api.get('/auth/roles');
      const fetchedRoles = resRoles.data || [];
      setRoles(fetchedRoles);
      
      if (fetchedRoles.length > 0 && !selectedRoleId) {
        setSelectedRoleId(fetchedRoles[0]._id);
        setRolePermissions(fetchedRoles[0].permissions?.modules || []);
      }

      // Load specific tab data
      if (currentTab === 'status') {
        const resStatus = await api.get('/statuses');
        setStatuses(resStatus.data || []);
      } else if (currentTab === 'users') {
        const resUsers = await api.get('/auth/users');
        setUsers(resUsers.data || []);
      } else if (tabToApiPath[currentTab]) {
        const apiPath = tabToApiPath[currentTab];
        const resModRecords = await api.get(`/records/${apiPath}`);
        setModuleRecords(resModRecords.data?.records || []);

        if (currentTab === 'bankingpartner') {
          // Fetch users for PSM dropdown (always, independent of bank masters)
          try {
            const resUsers = await api.get('/auth/users');
            setUsers(resUsers.data || []);
          } catch { console.warn('Could not load users for PSM'); }
          // Merge any custom banks added via Bank Master settings
          try {
            const resBM = await api.get('/records/bankmasters');
            const apiNames: string[] = (resBM.data?.records || []).map((r: any) => r.data?.bankName).filter(Boolean);
            if (apiNames.length > 0) {
              setBankMastersList(prev => {
                const merged = [...new Set([...prev, ...apiNames])];
                return merged;
              });
            }
          } catch { /* use hardcoded list */ }
        }
      }
    } catch (e) {
      console.error('Failed to load settings dependency data', e);
    } finally {
      setLoading(false);
    }
  };

  // Branding Customizer updates applied locally in real time
  const handleColorChange = (rgbTriplet: string) => {
    setSelectedColor(rgbTriplet);
    applyTheme({
      primaryColor: rgbTriplet,
      sidebarBg,
      headerBg: '#ffffff',
      fontFamily,
      mode
    });
  };

  const handleFontChange = (font: string) => {
    setFontFamily(font);
    applyTheme({
      primaryColor: selectedColor,
      sidebarBg,
      headerBg: '#ffffff',
      fontFamily: font,
      mode
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    try {
      const res = await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const uploadedPath = `http://localhost:5000${res.data.filePath}`;
      setLogoUrl(uploadedPath);
    } catch (err) {
      alert('Failed to upload logo.');
    } finally {
      setUploading(false);
    }
  };

  const handleModeChange = (selectedMode: 'light' | 'dark' | 'system') => {
    setMode(selectedMode);
    applyTheme({
      primaryColor: selectedColor,
      sidebarBg,
      headerBg: '#ffffff',
      fontFamily,
      mode: selectedMode
    });
  };

  const handleSaveBranding = async () => {
    setSaving(true);
    try {
      const themeSettings: ThemeSettings = {
        primaryColor: selectedColor,
        sidebarBg,
        headerBg: '#ffffff',
        fontFamily,
        mode
      };

      await api.put('/tenants/branding', {
        name: companyName,
        logoUrl,
        themeSettings,

        companyCode,
        registrationId,
        startDate,
        endDate,
        companyDocUrl,
        phoneNumber,
        mobile,
        email,
        fax,
        website,

        address,
        city,
        state: companyState,
        country,
        postalCode,

        adminDetails: {
          firstName: adminFirstName,
          lastName: adminLastName,
          username: adminUsername,
          password: adminPassword,
          financialYear,
          roleType
        }
      });

      await fetchBranding();
      alert('Company settings saved successfully.');
    } catch (err) {
      alert('Failed to save company settings.');
    } finally {
      setSaving(false);
    }
  };

  const handlePermissionChange = (moduleName: string, action: string, val: any) => {
    const updated = rolePermissions.map((p) => {
      if (p.moduleName.toLowerCase() === moduleName.toLowerCase()) {
        return { ...p, [action]: val };
      }
      return p;
    });
    setRolePermissions(updated);
  };

  const handleSaveRole = async () => {
    if (!roleFormName.trim()) {
      alert('Role name cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      if (editingRoleId) {
        // Update existing
        await api.put(`/auth/roles/${editingRoleId}`, { name: roleFormName, isActive: roleFormActive });
        alert('Role updated successfully.');
      } else {
        // Create new
        await api.post('/auth/roles', { name: roleFormName, isActive: roleFormActive });
        alert('Role created successfully.');
      }
      setRoleFormName('');
      setRoleFormActive(true);
      setEditingRoleId(null);
      
      // Reload roles list
      const res = await api.get('/auth/roles');
      setRoles(res.data || []);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save role.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = (id: string) => {
    showConfirm({
      title: 'Delete Role',
      message: 'Are you sure you want to delete this role? This will permanently remove its permissions settings.',
      onConfirm: async () => {
        try {
          await api.delete(`/auth/roles/${id}`);
          showToast('Role deleted successfully.', 'success');
          // Reload roles list
          const res = await api.get('/auth/roles');
          setRoles(res.data || []);
        } catch (err: any) {
          showToast(err.response?.data?.error || 'Failed to delete role.', 'error');
        }
      }
    });
  };

  const handleCancelRoleEdit = () => {
    setRoleFormName('');
    setRoleFormActive(true);
    setEditingRoleId(null);
  };

  // Status Handlers
  const handleSaveStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (statusEditing) {
        await api.put(`/statuses/${statusForm.id}`, statusForm);
        alert('Status updated successfully.');
      } else {
        await api.post('/statuses', statusForm);
        alert('Status created successfully.');
      }
      setStatusForm({
        id: '', name: '', color: '#4F46E5', icon: 'Circle', pipelinePosition: 0,
        dashboardVisibility: true, isFinal: false, isSuccess: false, order: 0
      });
      setStatusEditing(false);
      loadSettingsData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save status.');
    }
  };

  const handleEditStatus = (status: any) => {
    setStatusForm({
      id: status._id,
      name: status.name,
      color: status.color,
      icon: status.icon,
      pipelinePosition: status.pipelinePosition || 0,
      dashboardVisibility: status.dashboardVisibility,
      isFinal: status.isFinal,
      isSuccess: status.isSuccess,
      order: status.order
    });
    setStatusEditing(true);
  };

  const handleDeleteStatus = (id: string) => {
    showConfirm({
      title: 'Delete Status',
      message: 'Are you sure you want to delete this status? Leads using this status will lose their mapping.',
      onConfirm: async () => {
        try {
          await api.delete(`/statuses/${id}`);
          showToast('Status deleted successfully.', 'success');
          loadSettingsData();
        } catch (err) {
          showToast('Failed to delete status.', 'error');
        }
      }
    });
  };

  // User Handlers
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (userEditing) {
        await api.put(`/auth/users/${userForm.id}`, userForm);
        alert('User updated successfully.');
      } else {
        await api.post('/auth/users', userForm);
        alert('User created successfully.');
      }
      setUserModalOpen(false);
      setUserEditing(false);
      setUserForm({ id: '', email: '', password: '', firstName: '', lastName: '', roleId: '' });
      loadSettingsData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save user.');
    }
  };

  const handleEditUser = (user: any) => {
    setUserForm({
      id: user._id,
      email: user.email,
      password: '',
      firstName: user.firstName,
      lastName: user.lastName,
      roleId: user.roleId?._id || ''
    });
    setUserEditing(true);
    setUserModalOpen(true);
  };

  const handleDeleteUser = (id: string) => {
    showConfirm({
      title: 'Remove User',
      message: 'Are you sure you want to remove this user? This action cannot be undone.',
      onConfirm: async () => {
        try {
          await api.delete(`/auth/users/${id}`);
          showToast('User removed successfully.', 'success');
          loadSettingsData();
        } catch (err) {
          showToast('Failed to delete user.', 'error');
        }
      }
    });
  };

  const handleToggleUserSetting = async (userId: string, field: 'skipFace' | 'skipLocation' | 'isActive', currentValue: boolean) => {
    try {
      await api.put(`/auth/users/${userId}`, { [field]: !currentValue });
      loadSettingsData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update user setting.');
    }
  };

  const handleUserRoleChange = async (userId: string, newRoleId: string) => {
    try {
      await api.put(`/auth/users/${userId}`, { roleId: newRoleId });
      alert('Role updated successfully.');
      loadSettingsData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update user role.');
    }
  };

  // Dynamic Module Record Handlers
  const activeModuleDef = modules.find(m => m.apiPath === tabToApiPath[currentTab]);

  const handleSaveModuleRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModuleDef) return;
    const apiPath = activeModuleDef.apiPath;
    try {
      if (moduleEditingId) {
        await api.put(`/records/${apiPath}/${moduleEditingId}`, moduleForm);
        alert('Record updated successfully.');
      } else {
        await api.post(`/records/${apiPath}`, moduleForm);
        alert('Record created successfully.');
      }
      setModuleModalOpen(false);
      setModuleForm({});
      setModuleEditingId('');
      loadSettingsData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save record.');
    }
  };

  const handleEditModuleRecord = (rec: any) => {
    setModuleForm(rec.data || {});
    setModuleEditingId(rec._id);
    setModuleModalOpen(true);
  };

  const handleDeleteModuleRecord = (id: string) => {
    if (!activeModuleDef) return;
    showConfirm({
      title: 'Delete Record',
      message: `Are you sure you want to delete this ${activeModuleDef.singularLabel} record?`,
      onConfirm: async () => {
        try {
          await api.delete(`/records/${activeModuleDef.apiPath}/${id}`);
          showToast('Record deleted successfully.', 'success');
          loadSettingsData();
        } catch (err) {
          showToast('Failed to delete record.', 'error');
        }
      }
    });
  };

  // Banking Partner Handlers
  const checkBpConflict = (banks: string[], loanType: string, excludeId?: string) => {
    for (const bank of banks) {
      const targetBank = bank.trim().toLowerCase();
      const targetLoan = loanType.trim().toLowerCase();
      
      const conflict = moduleRecords.find((rec: any) => {
        if (excludeId && rec._id === excludeId) return false;
        
        const bpLoanType = rec.data?.loanType || rec.loanType || '';
        const bpBanks = (rec.data?.bank || rec.bank || '')
          .split(',')
          .map((s: string) => s.trim().toLowerCase());
          
        return bpLoanType.trim().toLowerCase() === targetLoan && bpBanks.includes(targetBank);
      });
      
      if (conflict) {
        return {
          bank,
          psmName: conflict.data?.psm || conflict.psm,
          loanType
        };
      }
    }
    return null;
  };

  const handleSaveBankingPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    const banksStr = selectedBanks.join(', ');
    if (!banksStr || !bpForm.loanType || !bpForm.psm) {
      showToast('Please select all required fields (including at least one bank).', 'warning');
      return;
    }

    const conflict = checkBpConflict(selectedBanks, bpForm.loanType);
    if (conflict) {
      setBpConflictModal({
        isOpen: true,
        psmName: conflict.psmName,
        bankName: conflict.bank,
        loanType: conflict.loanType
      });
      return;
    }

    try {
      await api.post('/records/bankingpartners', {
        bank: banksStr,
        loanType: bpForm.loanType,
        psm: bpForm.psm
      });
      showToast('Banking Partner saved successfully.', 'success');
      setBpForm({ bank: '', loanType: '', psm: '' });
      setSelectedBanks([]);
      loadSettingsData();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to save banking partner.', 'error');
    }
  };

  const handleEditBankingPartner = (bp: any) => {
    setEditingBpId(bp._id);
    setBpEditForm({
      bank: bp.bank || '',
      loanType: bp.loanType || '',
      psm: bp.psm || ''
    });
    const banks = (bp.bank || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    setSelectedEditBanks(banks);
    setBpEditModalOpen(true);
  };

  const handleSaveEditedBankingPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    const banksStr = selectedEditBanks.join(', ');
    if (!banksStr || !bpEditForm.loanType || !bpEditForm.psm) {
      showToast('Please select all required fields (including at least one bank).', 'warning');
      return;
    }

    const conflict = checkBpConflict(selectedEditBanks, bpEditForm.loanType, editingBpId || undefined);
    if (conflict) {
      setBpConflictModal({
        isOpen: true,
        psmName: conflict.psmName,
        bankName: conflict.bank,
        loanType: conflict.loanType
      });
      return;
    }

    try {
      await api.put(`/records/bankingpartners/${editingBpId}`, {
        bank: banksStr,
        loanType: bpEditForm.loanType,
        psm: bpEditForm.psm
      });
      showToast('Banking Partner updated successfully.', 'success');
      setBpEditForm({ bank: '', loanType: '', psm: '' });
      setSelectedEditBanks([]);
      setEditingBpId(null);
      setBpEditModalOpen(false);
      loadSettingsData();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to save banking partner.', 'error');
    }
  };

  const handleCancelEditBankingPartner = () => {
    setBpEditForm({ bank: '', loanType: '', psm: '' });
    setSelectedEditBanks([]);
    setEditingBpId(null);
    setBpEditModalOpen(false);
  };

  const handleDeleteBankingPartner = (id: string) => {
    showConfirm({
      title: 'Delete Banking Partner',
      message: 'Are you sure you want to delete this banking partner?',
      onConfirm: async () => {
        try {
          await api.delete(`/records/bankingpartners/${id}`);
          showToast('Banking partner deleted successfully.', 'success');
          loadSettingsData();
        } catch (err) {
          showToast('Failed to delete banking partner.', 'error');
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 rounded animate-shimmer"></div>
        <div className="h-40 rounded-lg animate-shimmer"></div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl uppercase font-bold tracking-tight text-slate-800">
            Settings
          </h1>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm text-center max-w-xl mx-auto space-y-4">
          <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto text-rose-500">
            <Icons.ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Access Denied</h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            Only the system's main <strong>Super Admin</strong> is permitted to access the Users, Roles, and Security settings.
          </p>
          <button
            onClick={() => navigate('/settings?tab=company')}
            style={{ backgroundColor: 'rgb(var(--color-primary))' }}
            className="text-white px-6 py-2.5 rounded-xl font-semibold text-sm inline-flex items-center gap-2 hover:brightness-105 transition-all shadow-md"
          >
            <Icons.ArrowLeft className="w-4 h-4" />
            Back to Company Settings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl uppercase font-bold tracking-tight text-slate-800">
          Settings
        </h1>
      </div>

      {/* Settings Tabs */}
      <div className="flex overflow-x-auto border-b border-slate-200 hide-scrollbar pb-px">
        <div className="flex gap-6 min-w-max px-1">
          {visibleTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => navigate(`/settings?tab=${tab.id}`)}
                className={`flex items-center gap-2 pb-3 text-sm font-bold border-b-2 transition-colors ${
                  isActive 
                    ? 'border-primary text-primary' 
                    : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* Company Settings */}
        <div className={`lg:col-span-12 card-premium p-0 overflow-hidden ${currentTab === 'company' ? 'block' : 'hidden'}`}>
          {/* Sub-tabs Header */}
          <div className="flex border-b border-slate-200">
            <button
              type="button"
              onClick={() => setCompanySubTab('details')}
              className={`px-6 py-3.5 font-bold text-sm transition-all relative ${
                companySubTab === 'details'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-800 border-r border-slate-200/60'
              }`}
            >
              Company Details
              {companySubTab === 'details' && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setCompanySubTab('address')}
              className={`px-6 py-3.5 font-bold text-sm transition-all relative ${
                companySubTab === 'address'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-800 border-r border-slate-200/60'
              }`}
            >
              Address
              {companySubTab === 'address' && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setCompanySubTab('admin')}
              className={`px-6 py-3.5 font-bold text-sm transition-all relative ${
                companySubTab === 'admin'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              Admin Details
              {companySubTab === 'admin' && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
              )}
            </button>
          </div>

          {/* Sub-tab Body */}
          <div className="p-6 space-y-6">
            
            {/* 1. Company Details Panel */}
            {companySubTab === 'details' && (
              <div className="flex flex-col lg:flex-row gap-8 items-start">
                {/* Logo Upload Box */}
                <div className="flex flex-col items-center gap-3 bg-slate-50/50 p-5 border border-slate-150 rounded-2xl w-full lg:w-48 text-center shrink-0">
                  <div className="w-24 h-24 rounded-2xl border border-slate-200 bg-white flex items-center justify-center p-2 shadow-sm overflow-hidden select-none">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                      <Icons.Building2 className="w-12 h-12 text-slate-350" />
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Logo Thumbnail</span>
                  <label className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors text-xs font-bold text-slate-650 cursor-pointer shadow-sm">
                    {uploading ? 'Uploading...' : 'Choose file'}
                    <input type="file" onChange={handleLogoUpload} className="hidden" disabled={uploading} />
                  </label>
                </div>

                {/* Form Fields Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 flex-grow w-full">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Company Code *</label>
                    <input type="text" value={companyCode} onChange={e => setCompanyCode(e.target.value)} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="e.g. COMP01" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Company Name *</label>
                    <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="e.g. New Frontline Bazaar" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Company Registration Id *</label>
                    <input type="text" value={registrationId} onChange={e => setRegistrationId(e.target.value)} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="e.g. 78658764873" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Company Start Date *</label>
                    <input type="text" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="2/20/2018 12:00:00 AM" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Company End Date *</label>
                    <input type="text" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="3/23/2018 12:00:00 AM" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Upload Company Doc</label>
                    <input type="file" onChange={async (e) => {
                      if (!e.target.files || e.target.files.length === 0) return;
                      const file = e.target.files[0];
                      const formData = new FormData();
                      formData.append('file', file);
                      try {
                        const res = await api.post('/documents/upload', formData, {
                          headers: { 'Content-Type': 'multipart/form-data' }
                        });
                        setCompanyDocUrl(`http://localhost:5000${res.data.filePath}`);
                        alert('Company document uploaded successfully.');
                      } catch {
                        alert('Failed to upload document.');
                      }
                    }} className="w-full text-xs text-slate-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer border border-slate-200 px-3 py-1 bg-white rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Phone Number *</label>
                    <input type="text" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="65327642" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Mobile *</label>
                    <input type="text" value={mobile} onChange={e => setMobile(e.target.value)} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="56326563649" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Email *</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="info@frontlinebazaar.com" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Upload Logo</label>
                    <input type="file" onChange={handleLogoUpload} className="w-full text-xs text-slate-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer border border-slate-200 px-3 py-1 bg-white rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Fax</label>
                    <input type="text" value={fax} onChange={e => setFax(e.target.value)} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="657676" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Website</label>
                    <input type="text" value={website} onChange={e => setWebsite(e.target.value)} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="https://frontlinebazaar.com/" />
                  </div>
                </div>
              </div>
            )}

            {/* 2. Address Panel */}
            {companySubTab === 'address' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Address</label>
                  <input type="text" value={address} onChange={e => setAddress(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="Gangavati Karnataka" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">City</label>
                    <input type="text" value={city} onChange={e => setCity(e.target.value)} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="Ganagavati" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">State</label>
                    <input type="text" value={companyState} onChange={e => setCompanyState(e.target.value)} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="Karnataka" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Country</label>
                    <select value={country} onChange={e => setCountry(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer">
                      <option value="">Select Country</option>
                      <option value="India">India</option>
                      <option value="United States">United States</option>
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="Canada">Canada</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Postal Code</label>
                    <input type="text" value={postalCode} onChange={e => setPostalCode(e.target.value)} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="583231" />
                  </div>
                </div>
              </div>
            )}

            {/* 3. Admin Details Panel */}
            {companySubTab === 'admin' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">First Name</label>
                    <input type="text" value={adminFirstName} onChange={e => setAdminFirstName(e.target.value)} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="First Name" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Last Name</label>
                    <input type="text" value={adminLastName} onChange={e => setAdminLastName(e.target.value)} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="Last Name" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">User Name</label>
                    <input type="text" value={adminUsername} onChange={e => setAdminUsername(e.target.value)} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="User Name" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Password</label>
                    <input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="******" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Confirm Password</label>
                    <input type="password" value={adminConfirmPassword} onChange={e => setAdminConfirmPassword(e.target.value)} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="Confirm Password" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Financial Year</label>
                    <select value={financialYear} onChange={e => setFinancialYear(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer">
                      <option value="">Select Financial Year</option>
                      <option value="2025-2026">2025-2026</option>
                      <option value="2026-2027">2026-2027</option>
                      <option value="2027-2028">2027-2028</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Role Type *</label>
                    <select value={roleType} onChange={e => setRoleType(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer">
                      <option value="">Select Role Type</option>
                      <option value="Super Admin">Super Admin</option>
                      <option value="Admin">Admin</option>
                      <option value="User">User</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Cancel & Update Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => loadSettingsData()}
                className="px-5 py-2 rounded-xl text-sm font-bold bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveBranding}
                disabled={saving}
                className="px-5 py-2 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-sm flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update'
                )}
              </button>
            </div>

          </div>
        </div>

        {/* Roles Management */}
        <div className={`lg:col-span-12 space-y-6 ${currentTab === 'role' ? 'block' : 'hidden'}`}>
          <div className="flex justify-between items-center">
            <h1 className="text-2xl uppercase font-bold text-slate-800 tracking-tight">Roles</h1>
          </div>

          {/* Form Card (Add/Edit) */}
          <div className="card-premium">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="flex flex-col md:flex-row gap-4 flex-grow max-w-2xl">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Role Type</label>
                  <input
                    type="text"
                    placeholder="Enter role type"
                    value={roleFormName}
                    onChange={(e) => setRoleFormName(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                  />
                </div>
                <div className="w-full md:w-36">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Status</label>
                  <select
                    value={roleFormActive ? 'active' : 'inactive'}
                    onChange={(e) => setRoleFormActive(e.target.value === 'active')}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-600 font-semibold"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleCancelRoleEdit}
                  className="btn-secondary-premium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveRole}
                  className="btn-primary-premium"
                >
                  {editingRoleId ? 'Update' : 'Save'}
                </button>
              </div>
            </div>
          </div>

          {/* Table Card (List) */}
          <div className="bg-white border-t-[3px] border-t-indigo-600 border border-slate-200 rounded-xl shadow-sm overflow-hidden p-1">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="table-header-premium">
                    <th className="py-2.5 px-4">Role Type</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-center w-36">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                  {(() => {
                    const itemsPerPage = 5;
                    const totalPages = Math.ceil(roles.length / itemsPerPage) || 1;
                    const activePage = Math.min(rolePage, totalPages);
                    const startIndex = (activePage - 1) * itemsPerPage;
                    const paginatedRoles = roles.slice(startIndex, startIndex + itemsPerPage);

                    if (paginatedRoles.length === 0) {
                      return (
                        <tr>
                          <td colSpan={3} className="py-8 text-center text-slate-400 font-medium">
                            No roles defined.
                          </td>
                        </tr>
                      );
                    }

                    return paginatedRoles.map((role) => (
                      <tr key={role._id} className="hover:bg-slate-50/50 transition-colors h-11">
                        <td className="px-4 py-2 font-semibold text-slate-700">{role.name}</td>
                        <td className="px-4 py-2">
                          <span className={role.isActive !== false ? 'status-active-premium' : 'status-inactive-premium'}>
                            <span className={`w-1.5 h-1.5 rounded-full ${role.isActive !== false ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                            {role.isActive !== false ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-center flex justify-center gap-3">
                          <button
                            onClick={() => {
                              setEditingRoleId(role._id);
                              setRoleFormName(role.name);
                              setRoleFormActive(role.isActive !== false);
                            }}
                            className="btn-edit-premium"
                            title="Edit Role"
                          >
                            <Icons.SquarePen className="w-4 h-4" />
                          </button>
                          {!role.isSystem && (
                            <button
                              onClick={() => handleDeleteRole(role._id)}
                              className="btn-delete-premium"
                              title="Delete Role"
                            >
                              <Icons.Trash className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {roles.length > 5 && (
              <div className="py-4 border-t border-slate-150 flex justify-center">
                <div className="flex gap-1">
                  {Array.from({ length: Math.ceil(roles.length / 5) }).map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setRolePage(idx + 1)}
                      className={`px-3 py-1.5 border rounded-lg text-xs font-semibold transition-all ${
                        rolePage === idx + 1
                          ? 'bg-[#0275d8] border-[#0275d8] text-white shadow-sm shadow-[#0275d8]/20'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>



        {/* Status Settings tab */}
        <div className={`lg:col-span-12 grid grid-cols-1 md:grid-cols-12 gap-5 ${currentTab === 'status' ? 'block' : 'hidden'}`}>
          {/* Form Card */}
          <div className="md:col-span-4 card-premium">
            <h3 className="text-lg font-bold text-slate-800">
              {statusEditing ? 'Edit Status' : 'Add New Status'}
            </h3>
            <form onSubmit={handleSaveStatus} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Status Name</label>
                <input required type="text" value={statusForm.name} onChange={e => setStatusForm({ ...statusForm, name: e.target.value })} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-600" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Color</label>
                  <input type="color" value={statusForm.color} onChange={e => setStatusForm({ ...statusForm, color: e.target.value })} className="w-full h-10 p-1 border border-slate-200 rounded-xl cursor-pointer" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Icon</label>
                  <select value={statusForm.icon} onChange={e => setStatusForm({ ...statusForm, icon: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-600">
                    {['Circle', 'Flame', 'Sun', 'Tag', 'CheckCircle', 'Clock', 'XOctagon', 'PhoneCall', 'ArrowDownCircle', 'Hourglass', 'FileWarning', 'FileText', 'Banknote'].map(ic => (
                      <option key={ic} value={ic}>{ic}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Pipeline Pos</label>
                  <input type="number" value={statusForm.pipelinePosition} onChange={e => setStatusForm({ ...statusForm, pipelinePosition: Number(e.target.value) })} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-600" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">List Order</label>
                  <input type="number" value={statusForm.order} onChange={e => setStatusForm({ ...statusForm, order: Number(e.target.value) })} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-600" />
                </div>
              </div>
              <div className="space-y-2 py-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 cursor-pointer">
                  <input type="checkbox" checked={statusForm.dashboardVisibility} onChange={e => setStatusForm({ ...statusForm, dashboardVisibility: e.target.checked })} className="rounded border-slate-200 bg-white text-indigo-600 focus:ring-0 w-4 h-4" />
                  Show on Dashboard Cards
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 cursor-pointer">
                  <input type="checkbox" checked={statusForm.isFinal} onChange={e => setStatusForm({ ...statusForm, isFinal: e.target.checked })} className="rounded border-slate-200 bg-white text-indigo-600 focus:ring-0 w-4 h-4" />
                  Is Closed/Final Stage
                </label>
                {statusForm.isFinal && (
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 cursor-pointer">
                    <input type="checkbox" checked={statusForm.isSuccess} onChange={e => setStatusForm({ ...statusForm, isSuccess: e.target.checked })} className="rounded border-slate-200 bg-white text-indigo-600 focus:ring-0 w-4 h-4" />
                    Is Success (Won)
                  </label>
                )}
              </div>
              <div className="flex gap-2">
                <button type="submit" className="btn-primary-premium flex-grow text-center">Save Status</button>
                {statusEditing && (
                  <button type="button" onClick={() => {
                    setStatusEditing(false);
                    setStatusForm({ id: '', name: '', color: '#4F46E5', icon: 'Circle', pipelinePosition: 0, dashboardVisibility: true, isFinal: false, isSuccess: false, order: 0 });
                  }} className="btn-secondary-premium">Cancel</button>
                )}
              </div>
            </form>
          </div>

          {/* Table Card */}
          <div className="md:col-span-8 bg-white border-t-[3px] border-t-indigo-600 border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Configured Statuses</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="table-header-premium">
                    <th className="py-2.5 px-4">Name</th>
                    <th className="py-2.5 px-4">Pipeline Pos</th>
                    <th className="py-2.5 px-4">Dashboard</th>
                    <th className="py-2.5 px-4">Closed Status</th>
                    <th className="py-2.5 px-4 text-center w-36">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                  {statuses.map(st => {
                    const Icon = (Icons as any)[st.icon] || Icons.Circle;
                    return (
                      <tr key={st._id} className="hover:bg-slate-50/50 transition-colors h-11">
                        <td className="px-4 py-2 font-semibold text-slate-700 flex items-center gap-2">
                          <span style={{ backgroundColor: st.color }} className="w-3 h-3 rounded-full inline-block border border-black/10"></span>
                          <Icon className="w-4 h-4 text-slate-500" />
                          {st.name}
                        </td>
                        <td className="px-4 py-2 text-slate-700 font-semibold">{st.pipelinePosition || 'None'}</td>
                        <td className="px-4 py-2 text-slate-700 font-semibold">{st.dashboardVisibility ? 'Visible' : 'Hidden'}</td>
                        <td className="px-4 py-2 text-slate-700 font-semibold">{st.isFinal ? (st.isSuccess ? 'Won' : 'Lost') : 'Open'}</td>
                        <td className="px-4 py-2 text-center flex justify-center gap-3">
                          <button onClick={() => handleEditStatus(st)} className="btn-edit-premium" title="Edit Status"><Icons.SquarePen className="w-4 h-4" /></button>
                          <button onClick={() => handleDeleteStatus(st._id)} className="btn-delete-premium" title="Delete Status"><Icons.Trash className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>


        {/* Generic Dynamic Custom Module tab */}
        {tabToApiPath[currentTab] && activeModuleDef && currentTab !== 'bankingpartner' && (
          <div className="lg:col-span-12 bg-white border-t-[3px] border-t-indigo-600 border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-800">{activeModuleDef.pluralLabel} Settings</h2>
              <button onClick={() => {
                setModuleForm({});
                setModuleEditingId('');
                setModuleModalOpen(true);
              }} className="btn-primary-premium flex items-center gap-2">
                <Icons.Plus className="w-4 h-4" /> Add Record
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="table-header-premium">
                    {activeModuleDef.fields.map(f => (
                      <th key={f.name} className="py-2.5 px-4">{f.label}</th>
                    ))}
                    <th className="py-2.5 px-4 text-center w-36">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                  {moduleRecords.map(rec => (
                    <tr key={rec._id} className="hover:bg-slate-50/50 transition-colors h-11">
                      {activeModuleDef.fields.map(f => (
                        <td key={f.name} className="px-4 py-2 text-slate-900 font-semibold">
                          {f.type === 'currency' ? '$' : ''}
                          {String(rec.data?.[f.name] ?? '')}
                        </td>
                      ))}
                      <td className="px-4 py-2 text-center flex justify-center gap-3">
                        <button onClick={() => handleEditModuleRecord(rec)} className="btn-edit-premium" title="Edit Record"><Icons.SquarePen className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteModuleRecord(rec._id)} className="btn-delete-premium" title="Delete Record"><Icons.Trash className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Dynamic Module Add/Edit Modal */}
            {moduleModalOpen && (
              <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50">
                <div className="bg-white rounded-2xl p-6 w-full max-w-md border border-slate-200 shadow-xl space-y-4">
                  <h3 className="text-lg font-bold text-slate-800">
                    {moduleEditingId ? 'Edit Record' : `Add New ${activeModuleDef.singularLabel}`}
                  </h3>
                  <form onSubmit={handleSaveModuleRecord} className="space-y-4">
                    {activeModuleDef.fields.map(f => (
                      <div key={f.name}>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">{f.label}</label>
                        {f.type === 'dropdown' ? (
                          <select required={f.required} value={moduleForm[f.name] || ''} onChange={e => setModuleForm({ ...moduleForm, [f.name]: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500">
                            <option value="">Select Option...</option>
                            {f.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        ) : f.type === 'number' || f.type === 'currency' ? (
                          <input required={f.required} type="number" step="any" value={moduleForm[f.name] || ''} onChange={e => setModuleForm({ ...moduleForm, [f.name]: Number(e.target.value) })} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                        ) : f.type === 'date' ? (
                          <input required={f.required} type="date" value={moduleForm[f.name] || ''} onChange={e => setModuleForm({ ...moduleForm, [f.name]: e.target.value })} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                        ) : (
                          <input required={f.required} type="text" value={moduleForm[f.name] || ''} onChange={e => setModuleForm({ ...moduleForm, [f.name]: e.target.value })} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                        )}
                      </div>
                    ))}
                    <div className="flex justify-end gap-3 pt-2">
                      <button type="button" onClick={() => setModuleModalOpen(false)} className="btn-secondary-premium">Cancel</button>
                      <button type="submit" className="btn-primary-premium">Save</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Custom Banking Partner Tab View */}
        {currentTab === 'bankingpartner' && (
          <div className="lg:col-span-12 space-y-6">
            
            {/* Top Form Card */}            {/* Top Form Card */}
            <div className="card-premium">
              <form onSubmit={handleSaveBankingPartner} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div className="md:col-span-3">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Banks <span className="text-red-500">*</span> (Select one or more)
                    </label>
                    <div className="bg-slate-50 border border-indigo-100 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                      {bankMastersList.map((bankName) => {
                        const isChecked = selectedBanks.includes(bankName);
                        return (
                          <label
                            key={bankName}
                            className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-all cursor-pointer select-none ${
                              isChecked
                                ? 'bg-indigo-50 border-indigo-400 text-indigo-700 shadow-sm shadow-indigo-100/50'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-indigo-200'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => handleBankCheckboxChange(bankName, e.target.checked)}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                            />
                            <span>{bankName}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Loan Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={bpForm.loanType}
                      onChange={(e) => setBpForm({ ...bpForm, loanType: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-850 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-600"
                    >
                      <option value="">-Select One-</option>
                      <option value="HOME LOAN">HOME LOAN</option>
                      <option value="LOAN AGAINST PROPERTY LOAN">LOAN AGAINST PROPERTY LOAN</option>
                      <option value="BUSINESS LOAN">BUSINESS LOAN</option>
                      <option value="PERSONAL LOAN">PERSONAL LOAN</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      PSM <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={bpForm.psm}
                      onChange={(e) => setBpForm({ ...bpForm, psm: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-850 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-600"
                    >
                      <option value="">-Select PSM-</option>
                      {users.length === 0 && (
                        <option disabled value="">No users found — check Users tab</option>
                      )}
                      {users.map((u) => {
                        const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ');
                        return (
                          <option key={u._id} value={fullName}>
                            {fullName} {u.roleId?.name ? `(${u.roleId.name})` : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div>
                    <button
                      type="submit"
                      className="btn-primary-premium w-full py-2.5"
                    >
                      Save Partner
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Banking Partner Edit Modal */}
            {bpEditModalOpen && (
              <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
                <div className="bg-white rounded-2xl p-6 w-full max-w-2xl border border-slate-200 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
                  <h3 className="text-lg font-bold text-slate-800">
                    Edit Banking Partner
                  </h3>
                  <form onSubmit={handleSaveEditedBankingPartner} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                        Banks <span className="text-red-500">*</span> (Select one or more)
                      </label>
                      <div className="bg-slate-50 border border-indigo-100 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                        {bankMastersList.map((bankName) => {
                          const isChecked = selectedEditBanks.includes(bankName);
                          return (
                            <label
                              key={bankName}
                              className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-all cursor-pointer select-none ${
                                isChecked
                                  ? 'bg-indigo-50 border-indigo-400 text-indigo-705 shadow-sm shadow-indigo-105/50'
                                  : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50 hover:border-indigo-200'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => handleEditBankCheckboxChange(bankName, e.target.checked)}
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                              />
                              <span>{bankName}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                          Loan Type <span className="text-red-500">*</span>
                        </label>
                        <select
                          required
                          value={bpEditForm.loanType}
                          onChange={(e) => setBpEditForm({ ...bpEditForm, loanType: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-850 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-600"
                        >
                          <option value="">-Select One-</option>
                          <option value="HOME LOAN">HOME LOAN</option>
                          <option value="LOAN AGAINST PROPERTY LOAN">LOAN AGAINST PROPERTY LOAN</option>
                          <option value="BUSINESS LOAN">BUSINESS LOAN</option>
                          <option value="PERSONAL LOAN">PERSONAL LOAN</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                          PSM <span className="text-red-500">*</span>
                        </label>
                        <select
                          required
                          value={bpEditForm.psm}
                          onChange={(e) => setBpEditForm({ ...bpEditForm, psm: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-850 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-600"
                        >
                          <option value="">-Select PSM-</option>
                          {users.length === 0 && (
                            <option disabled value="">No users found — check Users tab</option>
                          )}
                          {users.map((u) => {
                            const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ');
                            return (
                              <option key={u._id} value={fullName}>
                                {fullName} {u.roleId?.name ? `(${u.roleId.name})` : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={handleCancelEditBankingPartner}
                        className="btn-secondary-premium"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn-primary-premium"
                      >
                        Save Changes
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Middle Search Card */}
            <div className="card-premium">
              <h3 className="text-lg font-bold text-slate-800">Search Based on Banks</h3>
              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="w-full md:w-80">
                  <select
                    value={bpFilterBank}
                    onChange={(e) => setBpFilterBank(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-850 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-600"
                  >
                    <option value="">Select Here</option>
                    {bankMastersList.map((bankName) => (
                      <option key={bankName} value={bankName}>
                        {bankName}
                      </option>
                    ))}
                  </select>
                </div>
                 <div className="flex gap-2.5 w-full md:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAllBp(false);
                      setBpFilterBankShow(bpFilterBank);
                    }}
                    className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all shadow-sm flex-1 md:flex-initial text-center border ${
                      bpFilterBankShow && !showAllBp
                        ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-white hover:text-indigo-700 hover:border-indigo-600 active:bg-white active:text-indigo-850 shadow-md shadow-indigo-100/50'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 active:bg-slate-50 active:text-slate-950'
                    }`}
                  >
                    Show
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBpFilterBank('');
                      setBpFilterBankShow('');
                      setShowAllBp((prev) => !prev);
                    }}
                    className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all shadow-sm flex-1 md:flex-initial text-center border ${
                      showAllBp
                        ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-750 shadow-md shadow-indigo-100/50'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    All
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Table Card */}
            <div className="bg-white border-t-[3px] border-t-indigo-600 border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="table-header-premium">
                      <th className="py-2.5 px-4">Bank Name</th>
                      <th className="py-2.5 px-4">Loan Type</th>
                      <th className="py-2.5 px-4">PSM</th>
                      <th className="py-2.5 px-4 text-center w-24">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {(() => {
                      const filtered = moduleRecords.filter((rec) => {
                        if (showAllBp) return true;
                        if (!bpFilterBankShow) return false;
                        const recBanks = rec.data?.bank ? rec.data.bank.split(',').map((s: string) => s.trim()) : [];
                        return recBanks.includes(bpFilterBankShow);
                      });

                      if (filtered.length === 0) {
                        return (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-slate-400 font-medium">
                              {showAllBp 
                                ? "No banking partners registered."
                                : bpFilterBankShow 
                                  ? `No banking partners found for ${bpFilterBankShow}.`
                                  : "Please select a bank and click Show, or click All to view all partners."
                              }
                            </td>
                          </tr>
                        );
                      }

                      return filtered.map((rec) => (
                        <tr key={rec._id} className="hover:bg-slate-50/50 transition-colors h-11">
                          <td className="px-4 py-2 text-slate-900 font-semibold max-w-xs truncate" title={rec.data?.bank}>
                            {rec.data?.bank}
                          </td>
                          <td className="px-4 py-2 font-semibold text-slate-700">
                            {rec.data?.loanType}
                          </td>
                          <td className="px-4 py-2 text-slate-900 font-semibold">
                            {rec.data?.psm}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleEditBankingPartner({
                                  _id: rec._id,
                                  bank: rec.data?.bank,
                                  loanType: rec.data?.loanType,
                                  psm: rec.data?.psm
                                })}
                                className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-500 hover:text-indigo-600 transition-colors"
                                title="Edit Banking Partner"
                              >
                                <Icons.Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteBankingPartner(rec._id)}
                                className="btn-delete-premium"
                                title="Delete Banking Partner"
                              >
                                <Icons.Trash className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* Premium Conflict Modal for Banking Partner Settings */}
      {bpConflictModal && bpConflictModal.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div
            onClick={() => setBpConflictModal(null)}
            className="absolute inset-0 bg-[#0f1115]/50 backdrop-blur-sm animate-fade-in"
          />
          <div className="relative w-full max-w-md bg-white border border-slate-200/80 rounded-3xl shadow-2xl p-6 text-center z-10 transform transition-all duration-300 scale-100 animate-scale-up">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4 text-amber-600">
              <Icons.AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <h3 className="text-base font-black text-slate-800 uppercase tracking-wider mb-2">
              PSM Already Assigned
            </h3>
            <p className="text-xs font-bold text-slate-500 leading-relaxed mb-6">
              This Bank (<span className="text-slate-800 font-extrabold">{bpConflictModal.bankName}</span>) and Loan Type (<span className="text-slate-800 font-extrabold">{bpConflictModal.loanType}</span>) are already assigned to PSM '<span className="text-indigo-600 font-extrabold">{bpConflictModal.psmName}</span>'. Please select another Bank if you want a different assignment.
            </p>
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setBpConflictModal(null)}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all text-xs font-bold text-white shadow-md shadow-indigo-600/20"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
