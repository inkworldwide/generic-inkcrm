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
    <div className="space-y-6 max-w-6xl mx-auto text-left">
      {/* Page Header */}
      <div className="flex justify-between items-center pb-2">
        <div>
          <h1 className="text-2xl uppercase font-[800] tracking-tight text-slate-800 flex items-center gap-2">
            <Icons.ShieldCheck className="w-6 h-6 text-indigo-650" />
            Access Privilege
          </h1>
        </div>
        <button
          onClick={fetchRoles}
          className="btn-secondary-premium h-10 px-4 text-xs font-bold"
        >
          <Icons.RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Main Card */}
      <div className="card-premium">
        <div className="space-y-6">
        <div>
          <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block mb-2">
            Select Role to Edit Privileges
          </label>
          {loading ? (
            <div className="h-11 w-48 bg-slate-100 rounded-xl animate-pulse"></div>
          ) : (
            <select
              value={selectedRoleId}
              onChange={(e) => handleRoleSelectChange(e.target.value)}
              className="w-full h-11 px-4 text-xs font-semibold bg-white border border-[#E8ECF4] rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 max-w-xs cursor-pointer"
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
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] font-bold text-slate-500 uppercase border-b border-slate-100 h-12">
                  <th className="py-2 px-6">Module</th>
                  <th className="py-2 px-6 text-center">Create</th>
                  <th className="py-2 px-6 text-center">Read</th>
                  <th className="py-2 px-6 text-center">Update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rolePermissions.map((perm, index) => {
                  const mod = modules.find(
                    (m) => m.name.toLowerCase() === perm.moduleName.toLowerCase()
                  ) || { _id: index, pluralLabel: perm.moduleName, name: perm.moduleName };

                  return (
                    <tr key={mod._id} className="hover:bg-slate-50/30 transition-colors h-14">
                      <td className="px-6 py-3 font-semibold text-slate-700">{mod.pluralLabel}</td>
                      <td className="px-6 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={perm.create}
                          onChange={(e) =>
                            handlePermissionChange(mod.name, 'create', e.target.checked)
                          }
                          className="w-4 h-4 rounded text-indigo-650 focus:ring-0 border-[#E8ECF4] bg-white cursor-pointer transition-all"
                        />
                      </td>
                      <td className="px-6 py-3 text-center">
                        <select
                          value={perm.read}
                          onChange={(e) =>
                            handlePermissionChange(mod.name, 'read', e.target.value)
                          }
                          className="h-9 px-3 text-xs font-semibold bg-white border border-[#E8ECF4] rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 cursor-pointer w-max mx-auto"
                        >
                          <option value="all">All Records</option>
                          <option value="own">Own Only</option>
                          <option value="none">No Access</option>
                        </select>
                      </td>
                      <td className="px-6 py-3 text-center">
                        <select
                          value={perm.update || 'all'}
                          onChange={(e) =>
                            handlePermissionChange(mod.name, 'update', e.target.value)
                          }
                          className="h-9 px-3 text-xs font-semibold bg-white border border-[#E8ECF4] rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 cursor-pointer w-max mx-auto"
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
            className="btn-primary-premium h-11 px-6 text-xs font-bold"
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
