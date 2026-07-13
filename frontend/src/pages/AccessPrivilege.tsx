import React, { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import api from '../services/api';
import { useModuleStore } from '../store/moduleStore';
import { useToastStore } from '../store/toastStore';

interface RolePermission {
  moduleName: string;
  create: boolean;
  read: 'all' | 'own' | 'none';
  update: 'all' | 'own' | 'none';
}

interface Role {
  _id: string;
  name: string;
  description: string;
  permissions?: {
    modules: RolePermission[];
  };
}

export default function AccessPrivilege() {
  const { modules } = useModuleStore();
  const { showToast } = useToastStore();
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const res = await api.get('/auth/roles');
      const fetchedRoles = res.data || [];
      setRoles(fetchedRoles);
      if (fetchedRoles.length > 0) {
        setSelectedRoleId(fetchedRoles[0]._id);
        setRolePermissions(fetchedRoles[0].permissions?.modules || []);
      }
    } catch (err) {
      console.error('Failed to load roles:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleSelectChange = (roleId: string) => {
    setSelectedRoleId(roleId);
    const r = roles.find((role) => role._id === roleId);
    if (r) {
      setRolePermissions(r.permissions?.modules || []);
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

  const handleSavePermissions = async () => {
    try {
      setSaving(true);
      await api.put(`/auth/roles/${selectedRoleId}`, { permissions: rolePermissions });
      showToast('Role-Based Access Control privileges updated successfully.', 'success');
      // Refresh local copy
      const updatedRoles = roles.map((r) => {
        if (r._id === selectedRoleId) {
          return {
            ...r,
            permissions: {
              ...r.permissions,
              modules: rolePermissions,
            },
          };
        }
        return r;
      });
      setRoles(updatedRoles);
    } catch (e) {
      console.error('Failed to save permissions:', e);
      showToast('Failed to update role permissions.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl uppercase font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <Icons.ShieldCheck className="w-6 h-6 text-indigo-600" />
            Access Privilege
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage role-based access control for each module</p>
        </div>
        <button
          onClick={fetchRoles}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all"
        >
          <Icons.RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Indigo top accent bar */}
        <div className="h-[3px] bg-indigo-600 w-full" />
        <div className="p-6 space-y-6">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Select Role to Edit Privileges:
          </label>
          {loading ? (
            <div className="h-10 w-48 bg-slate-100 rounded-md animate-pulse"></div>
          ) : (
            <select
              value={selectedRoleId}
              onChange={(e) => handleRoleSelectChange(e.target.value)}
              className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 max-w-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              {roles.map((role) => (
                <option key={role._id} value={role._id}>
                  {role.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400">
              <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3"></div>
              <span className="text-sm font-medium">Loading permissions data...</span>
            </div>
          ) : (
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Module</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Create</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Read</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {rolePermissions.map((perm, index) => {
                  const mod = modules.find(
                    (m) => m.name.toLowerCase() === perm.moduleName.toLowerCase()
                  ) || { _id: index, pluralLabel: perm.moduleName, name: perm.moduleName };

                  return (
                    <tr key={mod._id} className="hover:bg-slate-50/50 transition-colors h-12">
                      <td className="px-4 py-3 font-semibold text-slate-700">{mod.pluralLabel}</td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={perm.create}
                          onChange={(e) =>
                            handlePermissionChange(mod.name, 'create', e.target.checked)
                          }
                          className="rounded border-slate-350 bg-white text-indigo-600 focus:ring-0 w-4 h-4"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <select
                          value={perm.read}
                          onChange={(e) =>
                            handlePermissionChange(mod.name, 'read', e.target.value)
                          }
                          className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-600 focus:outline-none"
                        >
                          <option value="all">All Records</option>
                          <option value="own">Own Only</option>
                          <option value="none">No Access</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <select
                          value={perm.update || 'all'}
                          onChange={(e) =>
                            handlePermissionChange(mod.name, 'update', e.target.value)
                          }
                          className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-600 focus:outline-none"
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
          )}
        </div>

        <div className="pt-4 flex justify-end">
          <button
            onClick={handleSavePermissions}
            disabled={saving || loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 text-white rounded-xl font-semibold transition-all shadow-sm shadow-indigo-600/10 text-sm"
          >
            {saving && <Icons.Loader2 className="w-4 h-4 animate-spin" />}
            Save Permissions
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
