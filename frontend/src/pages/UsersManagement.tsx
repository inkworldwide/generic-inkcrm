import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import * as Icons from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';

export default function UsersManagement() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { showConfirm, showToast, showAlertModal } = useToastStore();

  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [userForm, setUserForm] = useState({
    id: '',
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    roleId: '',
    department: '',
    skipFace: false,
    skipLocation: false,
    isActive: true
  });
  const [userEditing, setUserEditing] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [managerModalOpen, setManagerModalOpen] = useState(false);
  const [selectedUserForManager, setSelectedUserForManager] = useState<any>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [resUsers, resRoles, resDepts] = await Promise.all([
        api.get('/auth/users'),
        api.get('/auth/roles'),
        api.get('/records/departments')
      ]);
      setUsers(resUsers.data || []);
      setRoles(resRoles.data || []);
      setDepartments(resDepts.data?.records || resDepts.data || []);
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
        showToast('User updated successfully.', 'success');
      } else {
        await api.post('/auth/users', userForm);
        showToast('User created successfully.', 'success');
      }
      setUserModalOpen(false);
      setUserEditing(false);
      setUserForm({
        id: '',
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        roleId: '',
        department: '',
        skipFace: false,
        skipLocation: false,
        isActive: true
      });
      loadData();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to save user.', 'error');
    }
  };

  const handleEditUser = (u: any) => {
    setUserForm({
      id: u._id,
      email: u.email,
      password: '',
      firstName: u.firstName,
      lastName: u.lastName,
      roleId: u.roleId?._id || '',
      department: u.department || '',
      skipFace: !!u.skipFace,
      skipLocation: !!u.skipLocation,
      isActive: u.isActive !== false
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
          showAlertModal({
            title: 'Deleted Successfully',
            message: 'The user account has been permanently removed.',
            type: 'success'
          });
          loadData();
        } catch (err) {
          showToast('Failed to delete user.', 'error');
        }
      }
    });
  };

  const handleToggleUserSetting = async (userId: string, field: 'skipFace' | 'skipLocation' | 'isActive', currentValue: boolean) => {
    try {
      await api.put(`/auth/users/${userId}`, { [field]: !currentValue });
      loadData();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to update user setting.', 'error');
    }
  };

  const handleUserRoleChange = async (userId: string, newRoleId: string) => {
    try {
      await api.put(`/auth/users/${userId}`, { roleId: newRoleId });
      showToast('Role updated successfully.', 'success');
      loadData();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to update user role.', 'error');
    }
  };

  const handleAssignManager = async (managerId: string) => {
    try {
      if (!selectedUserForManager) return;
      await api.put(`/auth/users/${selectedUserForManager._id}`, { reportingManager: managerId });
      showToast('Reporting manager assigned successfully.', 'success');
      setManagerModalOpen(false);
      setSelectedUserForManager(null);
      loadData();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to assign reporting manager.', 'error');
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
        <h1 className="text-2xl uppercase font-bold tracking-tight text-slate-800">
          Users Management
        </h1>
        <button
          type="button"
          onClick={() => {
            setUserEditing(false);
            setUserForm({
              id: '',
              email: '',
              password: '',
              firstName: '',
              lastName: '',
              roleId: '',
              department: '',
              skipFace: false,
              skipLocation: false,
              isActive: true
            });
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
                <th className="py-2 px-4">EMPLOYEE</th>
                <th className="py-2 px-4">ID</th>
                <th className="py-2 px-4 text-center">SKIP FACE</th>
                <th className="py-2 px-4 text-center">SKIP LOCATION</th>
                <th className="py-2 px-4 text-center">ACCOUNT STATUS</th>
                <th className="py-2 px-4">ROLE</th>
                <th className="py-2 px-4">DEPARTMENT</th>
                <th className="py-2 px-4">REPORTING MANAGER</th>
                <th className="py-2 px-4 text-center w-40">ACTION</th>
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

                  {/* Role (Read Only) */}
                  <td className="px-4 py-2 text-xs font-semibold text-slate-700">
                    {u.roleId?.name || 'No Role'}
                  </td>

                  {/* Department */}
                  <td className="px-4 py-2 text-xs font-semibold text-slate-750">
                    {u.department || 'N/A'}
                  </td>

                  {/* Reporting Manager */}
                  <td className="px-4 py-2 cursor-pointer" onClick={() => {
                    setSelectedUserForManager(u);
                    setManagerModalOpen(true);
                  }}>
                    <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors w-max">
                      <Icons.UserPlus className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-xs font-semibold text-slate-700">
                        {u.reportingManager ? `${u.reportingManager.firstName} ${u.reportingManager.lastName}` : 'Assign Manager'}
                      </span>
                    </div>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Role Type <span className="text-red-500">*</span></label>
                  <select required value={userForm.roleId} onChange={e => setUserForm({ ...userForm, roleId: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer">
                    <option value="">Select Role</option>
                    {roles.map(r => (
                      <option key={r._id} value={r._id}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Department</label>
                  <select value={userForm.department} onChange={e => setUserForm({ ...userForm, department: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer">
                    <option value="">Select Department</option>
                    {departments.map(d => {
                      const deptName = d.data?.name || d.name || '';
                      return <option key={d._id} value={deptName}>{deptName}</option>;
                    })}
                  </select>
                </div>
              </div>

              {/* Security & Access Controls */}
              <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50 space-y-4">
                <span className="text-[10px] font-[800] text-slate-405 uppercase tracking-wider block">Access Permissions & Controls</span>
                
                {/* Approve Status Toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-2.5">
                    <Icons.CheckCircle2 className="w-4 h-4 text-slate-400 mt-0.5" />
                    <div>
                      <div className="text-xs font-bold text-slate-700">Approve Account</div>
                      <div className="text-[10px] text-slate-400">Approve/activate user account status</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUserForm({ ...userForm, isActive: !userForm.isActive })}
                    className={`relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      userForm.isActive ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        userForm.isActive ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>



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

      {/* Manager Assignment Modal */}
      {managerModalOpen && selectedUserForManager && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md border border-slate-200 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-800">
              Assign Reporting Manager
            </h3>
            <p className="text-xs text-slate-500">
              Select a manager for {selectedUserForManager.firstName} {selectedUserForManager.lastName}.
            </p>
            <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
              {users.filter(user => user._id !== selectedUserForManager._id).map(manager => (
                <button
                  key={manager._id}
                  type="button"
                  onClick={() => handleAssignManager(manager._id)}
                  className="w-full text-left px-4 py-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 uppercase">
                    {manager.firstName ? manager.firstName[0] : 'U'}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-800">{manager.firstName} {manager.lastName}</div>
                    <div className="text-xs text-slate-500">{manager.roleId?.name || 'No Role'}</div>
                  </div>
                </button>
              ))}
              {users.filter(user => user._id !== selectedUserForManager._id).length === 0 && (
                <div className="text-center text-slate-500 text-xs py-4">No other users available.</div>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setManagerModalOpen(false);
                  setSelectedUserForManager(null);
                }}
                className="px-5 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
