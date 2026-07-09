import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import * as Icons from 'lucide-react';
import FaceEnrollment from '../components/FaceEnrollment';
import { useAuthStore } from '../store/authStore';

export default function UsersManagement() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [userForm, setUserForm] = useState({
    id: '', email: '', password: '', firstName: '', lastName: '', roleId: ''
  });
  const [userEditing, setUserEditing] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [resUsers, resRoles] = await Promise.all([
        api.get('/auth/users'),
        api.get('/auth/roles')
      ]);
      setUsers(resUsers.data || []);
      setRoles(resRoles.data || []);
    } catch (err) {
      console.error('Failed to load users management data:', err);
    } finally {
      setLoading(false);
    }
  };

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
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save user.');
    }
  };

  const handleEditUser = (u: any) => {
    setUserForm({
      id: u._id,
      email: u.email,
      password: '',
      firstName: u.firstName,
      lastName: u.lastName,
      roleId: u.roleId?._id || ''
    });
    setUserEditing(true);
    setUserModalOpen(true);
  };

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm('Remove this user?')) return;
    try {
      await api.delete(`/auth/users/${id}`);
      loadData();
    } catch (err) {
      alert('Failed to delete user.');
    }
  };

  const handleToggleUserSetting = async (userId: string, field: 'skipFace' | 'skipLocation' | 'isActive', currentValue: boolean) => {
    try {
      await api.put(`/auth/users/${userId}`, { [field]: !currentValue });
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update user setting.');
    }
  };

  const handleUserRoleChange = async (userId: string, newRoleId: string) => {
    try {
      await api.put(`/auth/users/${userId}`, { roleId: newRoleId });
      alert('Role updated successfully.');
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update user role.');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="h-8 w-64 rounded animate-shimmer"></div>
        <div className="h-40 rounded-lg animate-shimmer"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">
          Users Management
        </h1>
        <button
          type="button"
          onClick={() => {
            setUserEditing(false);
            setUserForm({ id: '', email: '', password: '', firstName: '', lastName: '', roleId: '' });
            setUserModalOpen(true);
          }}
          className="btn-primary-premium flex items-center gap-2"
        >
          <Icons.Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      <div className="card-premium">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider h-10">
                <th className="py-2 px-4">Employee</th>
                <th className="py-2 px-4">ID</th>
                <th className="py-2 px-4 text-center">Skip Face</th>
                <th className="py-2 px-4 text-center">Skip Location</th>
                <th className="py-2 px-4 text-center">Account Status</th>
                <th className="py-2 px-4">Role</th>
                <th className="py-2 px-4 text-center w-40">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(u => (
                <tr key={u._id} className="hover:bg-slate-50/50 transition-colors h-14">
                  {/* Employee Profile Card */}
                  <td className="px-4 py-2 font-semibold text-slate-700">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-600 uppercase text-sm select-none">
                        {u.firstName ? u.firstName[0] : (u.email ? u.email[0] : 'U')}
                      </div>
                      <div className="text-left">
                        <div className="font-bold text-slate-800 text-sm leading-tight">{u.firstName} {u.lastName}</div>
                        <div className="text-xs text-slate-400 font-normal mt-0.5">{u.email} • {u.roleId?.name || 'No Role'}</div>
                      </div>
                    </div>
                  </td>

                  {/* Unique ID / Code */}
                  <td className="px-4 py-2">
                    <span className="font-mono text-xs font-semibold bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg text-slate-600">
                      {u.userCode || 'N/A'}
                    </span>
                  </td>

                  {/* Skip Face Toggle */}
                  <td className="px-4 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleToggleUserSetting(u._id, 'skipFace', u.skipFace || false)}
                      className={`relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        u.skipFace ? 'bg-emerald-500' : 'bg-slate-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          u.skipFace ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </td>

                  {/* Skip Location Toggle */}
                  <td className="px-4 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleToggleUserSetting(u._id, 'skipLocation', u.skipLocation || false)}
                      className={`relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        u.skipLocation ? 'bg-emerald-500' : 'bg-slate-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          u.skipLocation ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </td>

                  {/* Account Status Enable/Disable Toggle */}
                  <td className="px-4 py-2 text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => handleToggleUserSetting(u._id, 'isActive', u.isActive !== false)}
                        className={`relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          u.isActive !== false ? 'bg-indigo-600' : 'bg-slate-200'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            u.isActive !== false ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                      <span className={`text-[8px] font-bold ${u.isActive !== false ? 'text-indigo-600' : 'text-slate-400'}`}>
                        {u.isActive !== false ? 'ENABLED' : 'DISABLED'}
                      </span>
                    </div>
                  </td>

                  {/* Dropdown Role Selector */}
                  <td className="px-4 py-2">
                    <select
                      value={u.roleId?._id || ''}
                      onChange={(e) => handleUserRoleChange(u._id, e.target.value)}
                      className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                    >
                      {roles.map((r) => (
                        <option key={r._id} value={r._id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Action Buttons */}
                  <td className="px-4 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleEditUser(u)}
                        className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-indigo-600 transition-colors"
                        title="Edit User"
                      >
                        <Icons.Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        className="p-1 rounded hover:bg-slate-100 text-slate-400 transition-colors"
                        title="Schedule"
                      >
                        <Icons.Calendar className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        className="p-1 rounded hover:bg-slate-100 text-slate-400 transition-colors"
                        title="Settings"
                      >
                        <Icons.Settings className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        className="p-1 rounded hover:bg-slate-100 text-slate-400 transition-colors"
                        title="Keys"
                      >
                        <Icons.Key className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteUser(u._id)}
                        className="p-1 rounded hover:bg-rose-50 text-slate-450 hover:text-rose-600 transition-colors"
                        title="Remove User"
                      >
                        <Icons.Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Role Type</label>
                <select required value={userForm.roleId} onChange={e => setUserForm({ ...userForm, roleId: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer">
                  <option value="">Select Role</option>
                  {roles.map(r => (
                    <option key={r._id} value={r._id}>{r.name}</option>
                  ))}
                </select>
              </div>

              {/* Face Enrollment Box for Face Auth */}
              {userEditing && (
                <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/50 space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Biometric Credentials</span>
                  <FaceEnrollment onSuccess={() => alert('Face enrolled successfully.')} />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setUserModalOpen(false)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 shadow-sm">
                  {userEditing ? 'Save' : 'Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
