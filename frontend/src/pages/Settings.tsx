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

  const SETTINGS_TABS = [
    { id: 'company', label: 'Company Setting', icon: Icons.Building2 },
    { id: 'role', label: 'Role', icon: Icons.Shield },
    { id: 'department', label: 'Department', icon: Icons.Network },
    { id: 'product', label: 'Product', icon: Icons.Package },
    { id: 'bankmaster', label: 'Bank Master', icon: Icons.Landmark },
    { id: 'bankingpartner', label: 'Banking Partner', icon: Icons.Briefcase },
    { id: 'security', label: 'Security', icon: Icons.ShieldCheck },
    { id: 'users', label: 'Users', icon: Icons.Users },
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

  const handleRoleSelectChange = (roleId: string) => {
    setSelectedRoleId(roleId);
    const r = roles.find((role) => role._id === roleId);
    if (r) {
      setRolePermissions(r.permissions?.modules || []);
    }
  };

  const handleSavePermissions = async () => {
    try {
      await api.put(`/auth/roles/${selectedRoleId}`, { permissions: rolePermissions });
      alert('Role-Based Access Control privileges updated successfully.');
    } catch (e) {
      alert('Failed to update role permissions.');
    }
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
        <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white">Workspace Configuration</h1>
        <p className="text-sm text-slate-500 mt-1">Configure white-labeling theme skins and custom system configurations</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Company Settings */}
        <div className={`lg:col-span-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl p-6 shadow-sm space-y-6 ${currentTab === 'company' ? 'block' : 'hidden'}`}>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Company Identity</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Company Name</label>
              <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-primary focus:border-primary dark:bg-slate-900 dark:border-slate-600" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Logo URL</label>
              <input type="text" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-primary focus:border-primary dark:bg-slate-900 dark:border-slate-600" />
              <input type="file" onChange={handleLogoUpload} className="mt-2 text-sm text-slate-500" />
            </div>
          </div>
          <button onClick={handleSaveBranding} disabled={saving} className="bg-primary text-white px-4 py-2 rounded-md hover:brightness-110">
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>

        {/* Roles & Permissions */}
        <div className={`lg:col-span-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl p-6 shadow-sm space-y-6 ${currentTab === 'role' ? 'block' : 'hidden'}`}>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Role Management</h2>
          <select value={selectedRoleId} onChange={(e) => handleRoleSelectChange(e.target.value)} className="w-full p-2 border rounded-md dark:bg-slate-900 max-w-xs">
            {roles.map(role => <option key={role._id} value={role._id}>{role.name}</option>)}
          </select>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 border-b border-slate-100 dark:border-slate-800">
                <th className="text-left py-2 px-4">Module</th>
                <th className="py-2 px-4">Create</th>
                <th className="py-2 px-4">Read</th>
                <th className="py-2 px-4">Update</th>
              </tr>
            </thead>
            <tbody>
              {rolePermissions.map((perm, index) => {
                const mod = modules.find(m => m.name.toLowerCase() === perm.moduleName.toLowerCase()) || { _id: index, pluralLabel: perm.moduleName, name: perm.moduleName };
                return (
                  <tr key={mod._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20 border-b border-slate-50 dark:border-slate-800">
                    <td className="px-4 py-3 font-semibold text-slate-800 dark:text-white">{mod.pluralLabel}</td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={perm.create}
                        onChange={(e) => handlePermissionChange(mod.name, 'create', e.target.checked)}
                        className="rounded border-slate-200 bg-white text-primary focus:ring-0 w-3.5 h-3.5"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <select
                        value={perm.read}
                        onChange={(e) => handlePermissionChange(mod.name, 'read', e.target.value)}
                        className="bg-transparent border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs"
                      >
                        <option value="all">All Records</option>
                        <option value="own">Own Only</option>
                        <option value="none">No Access</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <select
                        value={perm.update || 'all'}
                        onChange={(e) => handlePermissionChange(mod.name, 'update', e.target.value)}
                        className="bg-transparent border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs"
                      >
                        <option value="all">All Records</option>
                        <option value="own">Own Only</option>
                        <option value="none">No Access</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button onClick={handleSavePermissions} className="bg-primary text-white px-4 py-2 rounded-md hover:brightness-110">
            Save Permissions
          </button>
        </div>

        {/* Security / Biometric configuration */}
        <div className={`lg:col-span-12 ${currentTab === 'security' ? 'block' : 'hidden'}`}>
          <FaceEnrollment />
        </div>

        {/* Status Settings tab */}
        <div className={`lg:col-span-12 grid grid-cols-1 md:grid-cols-12 gap-6 ${currentTab === 'status' ? 'block' : 'hidden'}`}>
          <div className="md:col-span-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-md font-bold text-slate-800 dark:text-white">
              {statusEditing ? 'Edit Status' : 'Add New Status'}
            </h3>
            <form onSubmit={handleSaveStatus} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Status Name</label>
                <input required type="text" value={statusForm.name} onChange={e => setStatusForm({ ...statusForm, name: e.target.value })} className="w-full px-3 py-2 border rounded-md dark:bg-slate-900 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Color (Hex)</label>
                  <input type="color" value={statusForm.color} onChange={e => setStatusForm({ ...statusForm, color: e.target.value })} className="w-full h-9 p-0.5 border rounded-md dark:bg-slate-900 cursor-pointer" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Icon</label>
                  <select value={statusForm.icon} onChange={e => setStatusForm({ ...statusForm, icon: e.target.value })} className="w-full px-3 py-2 border rounded-md dark:bg-slate-900 text-sm">
                    {['Circle', 'Flame', 'Sun', 'Tag', 'CheckCircle', 'Clock', 'XOctagon', 'PhoneCall', 'ArrowDownCircle', 'Hourglass', 'FileWarning', 'FileText', 'Banknote'].map(ic => (
                      <option key={ic} value={ic}>{ic}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Pipeline Pos</label>
                  <input type="number" value={statusForm.pipelinePosition} onChange={e => setStatusForm({ ...statusForm, pipelinePosition: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-md dark:bg-slate-900 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">List Order</label>
                  <input type="number" value={statusForm.order} onChange={e => setStatusForm({ ...statusForm, order: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-md dark:bg-slate-900 text-sm" />
                </div>
              </div>
              <div className="space-y-2 py-2">
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input type="checkbox" checked={statusForm.dashboardVisibility} onChange={e => setStatusForm({ ...statusForm, dashboardVisibility: e.target.checked })} className="rounded text-primary focus:ring-0" />
                  Show on Dashboard Cards
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input type="checkbox" checked={statusForm.isFinal} onChange={e => setStatusForm({ ...statusForm, isFinal: e.target.checked })} className="rounded text-primary focus:ring-0" />
                  Is Closed/Final Stage
                </label>
                {statusForm.isFinal && (
                  <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <input type="checkbox" checked={statusForm.isSuccess} onChange={e => setStatusForm({ ...statusForm, isSuccess: e.target.checked })} className="rounded text-primary focus:ring-0" />
                    Is Success (Won)
                  </label>
                )}
              </div>
              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-primary text-white py-2 rounded-md hover:brightness-110 text-sm font-semibold">Save Status</button>
                {statusEditing && (
                  <button type="button" onClick={() => {
                    setStatusEditing(false);
                    setStatusForm({ id: '', name: '', color: '#4F46E5', icon: 'Circle', pipelinePosition: 0, dashboardVisibility: true, isFinal: false, isSuccess: false, order: 0 });
                  }} className="px-3 border rounded-md text-sm">Cancel</button>
                )}
              </div>
            </form>
          </div>
          <div className="md:col-span-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
            <h3 className="text-md font-bold text-slate-800 dark:text-white mb-4">Configured Statuses</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b text-slate-400 uppercase text-xs">
                    <th className="py-2 px-3">Name</th>
                    <th className="py-2 px-3">Pipeline Pos</th>
                    <th className="py-2 px-3">Dashboard</th>
                    <th className="py-2 px-3">Closed Status</th>
                    <th className="py-2 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {statuses.map(st => {
                    const Icon = (Icons as any)[st.icon] || Icons.Circle;
                    return (
                      <tr key={st._id} className="border-b hover:bg-slate-50/50 dark:hover:bg-slate-700/20">
                        <td className="py-3 px-3 font-semibold flex items-center gap-2">
                          <span style={{ backgroundColor: st.color }} className="w-3 h-3 rounded-full inline-block"></span>
                          <Icon className="w-4 h-4 text-slate-400" />
                          {st.name}
                        </td>
                        <td className="py-3 px-3">{st.pipelinePosition || 'None'}</td>
                        <td className="py-3 px-3">{st.dashboardVisibility ? 'Visible' : 'Hidden'}</td>
                        <td className="py-3 px-3">{st.isFinal ? (st.isSuccess ? 'Won' : 'Lost') : 'Open'}</td>
                        <td className="py-3 px-3 text-right space-x-2">
                          <button onClick={() => handleEditStatus(st)} className="text-primary hover:underline text-xs">Edit</button>
                          <button onClick={() => handleDeleteStatus(st._id)} className="text-rose-500 hover:underline text-xs">Delete</button>
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
        <div className={`lg:col-span-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm ${currentTab === 'users' ? 'block' : 'hidden'}`}>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">Organization Users</h2>
            <button onClick={() => {
              setUserForm({ id: '', email: '', password: '', firstName: '', lastName: '', roleId: '' });
              setUserEditing(false);
              setUserModalOpen(true);
            }} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:brightness-110 flex items-center gap-2">
              <Icons.Plus className="w-4 h-4" /> Add User
            </button>
          </div>

          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b text-slate-400 uppercase text-xs">
                <th className="py-2 px-4">Name</th>
                <th className="py-2 px-4">Email</th>
                <th className="py-2 px-4">Role</th>
                <th className="py-2 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u._id} className="border-b hover:bg-slate-50/50 dark:hover:bg-slate-700/20">
                  <td className="py-3 px-4 font-semibold">{u.firstName} {u.lastName}</td>
                  <td className="py-3 px-4 text-slate-500">{u.email}</td>
                  <td className="py-3 px-4">
                    <span className="bg-slate-100 dark:bg-slate-800 text-xs px-2 py-1 rounded font-semibold text-slate-600 dark:text-slate-400">
                      {u.roleId?.name || 'No Role'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right space-x-3">
                    <button onClick={() => handleEditUser(u)} className="text-primary hover:underline text-xs">Edit Role</button>
                    <button onClick={() => handleDeleteUser(u._id)} className="text-rose-500 hover:underline text-xs">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* User Add/Edit Modal */}
          {userModalOpen && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-700 shadow-xl space-y-4">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                  {userEditing ? 'Edit User Role' : 'Add New User'}
                </h3>
                <form onSubmit={handleSaveUser} className="space-y-4">
                  {!userEditing && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">First Name</label>
                          <input required type="text" value={userForm.firstName} onChange={e => setUserForm({ ...userForm, firstName: e.target.value })} className="w-full px-3 py-2 border rounded-md dark:bg-slate-900 text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Last Name</label>
                          <input required type="text" value={userForm.lastName} onChange={e => setUserForm({ ...userForm, lastName: e.target.value })} className="w-full px-3 py-2 border rounded-md dark:bg-slate-900 text-sm" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Email Address</label>
                        <input required type="email" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} className="w-full px-3 py-2 border rounded-md dark:bg-slate-900 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Password</label>
                        <input required type="password" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} className="w-full px-3 py-2 border rounded-md dark:bg-slate-900 text-sm" />
                      </div>
                    </>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Assign Security Role</label>
                    <select required value={userForm.roleId} onChange={e => setUserForm({ ...userForm, roleId: e.target.value })} className="w-full px-3 py-2 border rounded-md dark:bg-slate-900 text-sm">
                      <option value="">Select Role...</option>
                      {roles.map(r => <option key={r._id} value={r._id}>{r.name}</option>)}
                    </select>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={() => setUserModalOpen(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                    <button type="submit" className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold">Save</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>

        {/* Generic Dynamic Custom Module tab */}
        {tabToApiPath[currentTab] && activeModuleDef && (
          <div className="lg:col-span-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">{activeModuleDef.pluralLabel} Settings</h2>
              <button onClick={() => {
                setModuleForm({});
                setModuleEditingId('');
                setModuleModalOpen(true);
              }} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:brightness-110 flex items-center gap-2">
                <Icons.Plus className="w-4 h-4" /> Add Record
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b text-slate-400 uppercase text-xs">
                    {activeModuleDef.fields.map(f => (
                      <th key={f.name} className="py-2 px-4">{f.label}</th>
                    ))}
                    <th className="py-2 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {moduleRecords.map(rec => (
                    <tr key={rec._id} className="border-b hover:bg-slate-50/50 dark:hover:bg-slate-700/20">
                      {activeModuleDef.fields.map(f => (
                        <td key={f.name} className="py-3 px-4">
                          {f.type === 'currency' ? '$' : ''}
                          {String(rec.data?.[f.name] ?? '')}
                        </td>
                      ))}
                      <td className="py-3 px-4 text-right space-x-3">
                        <button onClick={() => handleEditModuleRecord(rec)} className="text-primary hover:underline text-xs">Edit</button>
                        <button onClick={() => handleDeleteModuleRecord(rec._id)} className="text-rose-500 hover:underline text-xs">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Dynamic Module Add/Edit Modal */}
            {moduleModalOpen && (
              <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50">
                <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-700 shadow-xl space-y-4">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                    {moduleEditingId ? 'Edit Record' : `Add New ${activeModuleDef.singularLabel}`}
                  </h3>
                  <form onSubmit={handleSaveModuleRecord} className="space-y-4">
                    {activeModuleDef.fields.map(f => (
                      <div key={f.name}>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{f.label}</label>
                        {f.type === 'dropdown' ? (
                          <select required={f.required} value={moduleForm[f.name] || ''} onChange={e => setModuleForm({ ...moduleForm, [f.name]: e.target.value })} className="w-full px-3 py-2 border rounded-md dark:bg-slate-900 text-sm">
                            <option value="">Select Option...</option>
                            {f.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        ) : f.type === 'number' || f.type === 'currency' ? (
                          <input required={f.required} type="number" step="any" value={moduleForm[f.name] || ''} onChange={e => setModuleForm({ ...moduleForm, [f.name]: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-md dark:bg-slate-900 text-sm" />
                        ) : f.type === 'date' ? (
                          <input required={f.required} type="date" value={moduleForm[f.name] || ''} onChange={e => setModuleForm({ ...moduleForm, [f.name]: e.target.value })} className="w-full px-3 py-2 border rounded-md dark:bg-slate-900 text-sm" />
                        ) : (
                          <input required={f.required} type="text" value={moduleForm[f.name] || ''} onChange={e => setModuleForm({ ...moduleForm, [f.name]: e.target.value })} className="w-full px-3 py-2 border rounded-md dark:bg-slate-900 text-sm" />
                        )}
                      </div>
                    ))}
                    <div className="flex justify-end gap-2 pt-2">
                      <button type="button" onClick={() => setModuleModalOpen(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                      <button type="submit" className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold">Save</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
