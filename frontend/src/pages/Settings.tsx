import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useThemeStore, ThemeSettings } from '../store/themeStore';
import { useModuleStore, FieldDefinition } from '../store/moduleStore';
import api from '../services/api';
import * as Icons from 'lucide-react';
import FaceEnrollment from '../components/FaceEnrollment';

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
  const navigate = useNavigate();
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
  const [bpFilterBank, setBpFilterBank] = useState('');
  const [bpFilterBankShow, setBpFilterBankShow] = useState('');

  const handleBankCheckboxChange = (bankName: string, checked: boolean) => {
    if (checked) {
      setSelectedBanks([...selectedBanks, bankName]);
    } else {
      setSelectedBanks(selectedBanks.filter((b) => b !== bankName));
    }
  };

  const SETTINGS_TABS = [
    { id: 'company', label: 'Company Setting', icon: Icons.Building2 },
    { id: 'role', label: 'Role', icon: Icons.Shield },
    { id: 'department', label: 'Department', icon: Icons.Network },
    { id: 'product', label: 'Product', icon: Icons.Package },
    { id: 'bankmaster', label: 'Bank Master', icon: Icons.Landmark },
    { id: 'users', label: 'Users', icon: Icons.Users },
    { id: 'bankingpartner', label: 'Banking Partner', icon: Icons.Briefcase },
    { id: 'security', label: 'Security', icon: Icons.ShieldCheck },
    { id: 'status', label: 'Status', icon: Icons.Tag },
  ];

  const tabToApiPath: Record<string, string> = {
    department: 'departments',
    product: 'products',
    bankmaster: 'bankmasters',
    bankingpartner: 'bankingpartners'
  };

  useEffect(() => {
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
        themeSettings
      });

      await fetchBranding();
      alert('Workspace settings saved successfully.');
    } catch (err) {
      alert('Failed to save branding customizations.');
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

  const handleDeleteRole = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this role?')) return;
    if (!window.confirm('Please confirm once again: Are you absolutely sure you want to delete this role?')) return;
    try {
      await api.delete(`/auth/roles/${id}`);
      alert('Role deleted successfully.');
      // Reload roles list
      const res = await api.get('/auth/roles');
      setRoles(res.data || []);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete role.');
    }
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

  const handleDeleteStatus = async (id: string) => {
    if (!window.confirm('Delete this status?')) return;
    try {
      await api.delete(`/statuses/${id}`);
      loadSettingsData();
    } catch (err) {
      alert('Failed to delete status.');
    }
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

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm('Remove this user?')) return;
    try {
      await api.delete(`/auth/users/${id}`);
      loadSettingsData();
    } catch (err) {
      alert('Failed to delete user.');
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

  const handleDeleteModuleRecord = async (id: string) => {
    if (!window.confirm('Delete this record?')) return;
    if (!activeModuleDef) return;
    try {
      await api.delete(`/records/${activeModuleDef.apiPath}/${id}`);
      loadSettingsData();
    } catch (err) {
      alert('Failed to delete record.');
    }
  };

  // Banking Partner Handlers
  const handleSaveBankingPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    const banksStr = selectedBanks.join(', ');
    if (!banksStr || !bpForm.loanType || !bpForm.psm) {
      alert('Please select all required fields (including at least one bank).');
      return;
    }
    try {
      await api.post('/records/bankingpartners', {
        bank: banksStr,
        loanType: bpForm.loanType,
        psm: bpForm.psm
      });
      alert('Banking Partner saved successfully.');
      setBpForm({ bank: '', loanType: '', psm: '' });
      setSelectedBanks([]);
      loadSettingsData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save banking partner.');
    }
  };

  const handleCancelBankingPartner = () => {
    setBpForm({ bank: '', loanType: '', psm: '' });
    setSelectedBanks([]);
  };

  const handleDeleteBankingPartner = async (id: string) => {
    if (!window.confirm('Delete this banking partner?')) return;
    try {
      await api.delete(`/records/bankingpartners/${id}`);
      loadSettingsData();
    } catch (err) {
      alert('Failed to delete banking partner.');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 rounded animate-shimmer"></div>
        <div className="h-40 rounded-lg animate-shimmer"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">
          Settings
        </h1>
      </div>

      {/* Settings Tabs */}
      <div className="flex overflow-x-auto border-b border-slate-200 hide-scrollbar pb-px">
        <div className="flex gap-6 min-w-max px-1">
          {SETTINGS_TABS.map(tab => {
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
        <div className={`lg:col-span-6 card-premium ${currentTab === 'company' ? 'block' : 'hidden'}`}>
          <h2 className="text-lg font-bold text-slate-800">Company Identity</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Company Name</label>
              <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-600" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Logo URL</label>
              <input type="text" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-600 mb-2" />
              <input type="file" onChange={handleLogoUpload} className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer" />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button onClick={handleSaveBranding} disabled={saving} className="btn-primary-premium">
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>

        {/* Roles Management */}
        <div className={`lg:col-span-12 space-y-6 ${currentTab === 'role' ? 'block' : 'hidden'}`}>
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Roles</h1>
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

        {/* Security / Biometric configuration */}
        <div className={`lg:col-span-12 ${currentTab === 'security' ? 'block' : 'hidden'}`}>
          <FaceEnrollment />
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

        {/* Users Management tab */}
        <div className={`lg:col-span-12 bg-white border-t-[3px] border-t-indigo-600 border border-slate-200 rounded-xl p-4 shadow-sm ${currentTab === 'users' ? 'block' : 'hidden'}`}>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-slate-800">Organization Users</h2>
            <button onClick={() => {
              setUserForm({ id: '', email: '', password: '', firstName: '', lastName: '', roleId: '' });
              setUserEditing(false);
              setUserModalOpen(true);
            }} className="btn-primary-premium flex items-center gap-2">
              <Icons.Plus className="w-4 h-4" /> Add User
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="table-header-premium">
                  <th className="py-2.5 px-4">Name</th>
                  <th className="py-2.5 px-4">Email</th>
                  <th className="py-2.5 px-4">Role</th>
                  <th className="py-2.5 px-4 text-center w-36">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {users.map(u => (
                  <tr key={u._id} className="hover:bg-slate-50/50 transition-colors h-11">
                    <td className="px-4 py-2 font-semibold text-slate-700">{u.firstName} {u.lastName}</td>
                    <td className="px-4 py-2 text-slate-900 font-semibold">{u.email}</td>
                    <td className="px-4 py-2">
                      <span className="bg-slate-100 text-xs px-2 py-1 rounded-xl font-bold text-slate-800 border border-slate-200">
                        {u.roleId?.name || 'No Role'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center flex justify-center gap-3">
                      <button onClick={() => handleEditUser(u)} className="btn-edit-premium" title="Edit User"><Icons.SquarePen className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteUser(u._id)} className="btn-delete-premium" title="Remove User"><Icons.Trash className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* User Add/Edit Modal */}
          {userModalOpen && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl p-6 w-full max-w-md border border-slate-200 shadow-xl space-y-4">
                <h3 className="text-lg font-bold text-slate-800">
                  {userEditing ? 'Edit User Role' : 'Add New User'}
                </h3>
                <form onSubmit={handleSaveUser} className="space-y-4">
                  {!userEditing && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">First Name</label>
                          <input required type="text" value={userForm.firstName} onChange={e => setUserForm({ ...userForm, firstName: e.target.value })} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Last Name</label>
                          <input required type="text" value={userForm.lastName} onChange={e => setUserForm({ ...userForm, lastName: e.target.value })} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Email Address</label>
                        <input required type="email" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Password</label>
                        <input required type="password" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                      </div>
                    </>
                  )}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Assign Security Role</label>
                    <select required value={userForm.roleId} onChange={e => setUserForm({ ...userForm, roleId: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500">
                      <option value="">Select Role...</option>
                      {roles.map(r => <option key={r._id} value={r._id}>{r.name}</option>)}
                    </select>
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button type="button" onClick={() => setUserModalOpen(false)} className="px-5 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition-all">Cancel</button>
                    <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm shadow-indigo-600/10">Save</button>
                  </div>
                </form>
              </div>
            </div>
          )}
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
            
            {/* Top Form Card */}
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
                  <div className="flex gap-3 justify-end md:justify-start">
                    <button
                      type="button"
                      onClick={handleCancelBankingPartner}
                      className="btn-secondary-premium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-primary-premium"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </form>
            </div>

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
                <button
                  type="button"
                  onClick={() => setBpFilterBankShow(bpFilterBank)}
                  className="px-6 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg transition-all shadow-sm"
                >
                  Show
                </button>
              </div>
            </div>

            {/* Bottom Table Card */}
            <div className="bg-white border-t-[3px] border-t-indigo-600 border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="table-header-premium">
                      <th className="py-2.5 px-4">Loan Type</th>
                      <th className="py-2.5 px-4">PSM</th>
                      <th className="py-2.5 px-4 text-center w-24">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {(() => {
                      const filtered = moduleRecords.filter((rec) => {
                        if (!bpFilterBankShow) return true;
                        const recBanks = rec.data?.bank ? rec.data.bank.split(',').map((s: string) => s.trim()) : [];
                        return recBanks.includes(bpFilterBankShow);
                      });

                      if (filtered.length === 0) {
                        return (
                          <tr>
                            <td colSpan={3} className="py-8 text-center text-slate-400 font-medium">
                              {bpFilterBankShow 
                                ? `No banking partners found for ${bpFilterBankShow}.`
                                : "Please select a bank and click Show to view partners."
                              }
                            </td>
                          </tr>
                        );
                      }

                      return filtered.map((rec) => (
                        <tr key={rec._id} className="hover:bg-slate-50/50 transition-colors h-11">
                          <td className="px-4 py-2 font-semibold text-slate-700">
                            {rec.data?.loanType}
                          </td>
                          <td className="px-4 py-2 text-slate-900 font-semibold">
                            {rec.data?.psm}
                          </td>
                          <td className="px-4 py-2 text-center flex justify-center">
                            <button
                              onClick={() => handleDeleteBankingPartner(rec._id)}
                              className="btn-delete-premium"
                              title="Delete Banking Partner"
                            >
                              <Icons.Trash className="w-4 h-4" />
                            </button>
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
    </div>
  );
}
