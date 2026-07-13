import React, { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import api from '../services/api';
import { useThemeStore } from '../store/themeStore';
import { useToastStore } from '../store/toastStore';

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  roleId: string;
}

interface Lead {
  _id: string;
  data: {
    assignedTo?: string;
    [key: string]: any;
  };
}

export default function LeadTransfer() {
  const { branding } = useThemeStore();
  const [users, setUsers] = useState<User[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDestinations, setSelectedDestinations] = useState<Record<string, string>>({});
  const [checkedMoves, setCheckedMoves] = useState<Record<string, boolean>>({});
  const [transferring, setTransferring] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const usersRes = await api.get('/auth/users');
      setUsers(usersRes.data);
      const leadsRes = await api.get('/records/leads?limit=10000');
      setLeads(leadsRes.data.records || leadsRes.data || []);
    } catch (err) {
      console.error('Failed to fetch data for lead transfer:', err);
    } finally {
      setLoading(false);
    }
  };

  const getLeadCount = (user: User) => {
    const fullName = `${user.firstName} ${user.lastName}`.trim().toLowerCase();
    return leads.filter((lead) => {
      const assigned = String(lead.data?.assignedTo || '').trim().toLowerCase();
      return assigned === fullName || assigned === user._id;
    }).length;
  };

  const { showConfirm, showToast } = useToastStore();

  const handleTransfer = async (fromUser: User) => {
    const toUserId = selectedDestinations[fromUser._id];
    if (!toUserId) {
      showToast('Please select a destination agent in the "Move To" dropdown.', 'warning');
      return;
    }
    const toUser = users.find((u) => u._id === toUserId);
    if (!toUser) return;

    const fromName = `${fromUser.firstName} ${fromUser.lastName}`.trim();
    const toName = `${toUser.firstName} ${toUser.lastName}`.trim();
    const count = getLeadCount(fromUser);

    if (count === 0) {
      showToast(`Agent ${fromName} has no assigned leads to transfer.`, 'warning');
      return;
    }

    showConfirm({
      title: 'Transfer Leads',
      message: `Are you sure you want to transfer ${count} lead(s) from ${fromName} to ${toName}?`,
      onConfirm: async () => {
        try {
          setTransferring(fromUser._id);
          await api.post('/records/transfer/leads', {
            fromAgentId: fromUser._id,
            fromAgentName: fromName,
            toAgentId: toUser._id,
            toAgentName: toName,
          });
          showToast(`Successfully transferred ${count} lead(s) to ${toName}!`, 'success');
          setCheckedMoves(prev => ({ ...prev, [fromUser._id]: false }));
          setSelectedDestinations((prev) => {
            const copy = { ...prev };
            delete copy[fromUser._id];
            return copy;
          });
          await fetchData();
        } catch (err) {
          console.error('Transfer failed:', err);
          showToast('Failed to transfer leads. Please try again.', 'error');
        } finally {
          setTransferring(null);
        }
      }
    });
  };

  const handleClearLeads = async (fromUser: User) => {
    const fromName = `${fromUser.firstName} ${fromUser.lastName}`.trim();
    const count = getLeadCount(fromUser);
    if (count === 0) {
      showToast(`Agent ${fromName} has no assigned leads.`, 'warning');
      return;
    }

    showConfirm({
      title: 'Unassign Leads',
      message: `Are you sure you want to unassign all ${count} lead(s) from ${fromName}?`,
      onConfirm: async () => {
        try {
          setTransferring(fromUser._id);
          await api.post('/records/transfer/leads', {
            fromAgentId: fromUser._id,
            fromAgentName: fromName,
            toAgentId: 'unassigned',
            toAgentName: 'Unassigned',
          });
          showToast(`Successfully unassigned leads from ${fromName}.`, 'success');
          await fetchData();
        } catch (err) {
          console.error('Clear failed:', err);
          showToast('Failed to unassign leads.', 'error');
        } finally {
          setTransferring(null);
        }
      }
    });
  };

  const filteredUsers = users.filter((user) => {
    const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl uppercase font-bold tracking-tight text-slate-800">Lead Transfer</h1>
          <p className="text-sm text-slate-500 mt-0.5">Transfer or unassign leads between agents</p>
        </div>
      </div>

      {/* Main Card — matches card-premium style */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Indigo top accent bar */}
        <div className="h-[3px] bg-indigo-600 w-full" />

        {/* Card Header with Search */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Icons.ArrowLeftRight className="w-4 h-4 text-indigo-600" />
            Agent Lead Overview
          </h2>
          <div className="relative">
            <Icons.Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search agent..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 w-56 transition"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {loading && leads.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400">
              <div className="w-8 h-8 border-[3px] border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
              <span className="text-sm font-medium">Loading agent data...</span>
            </div>
          ) : (
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="py-3 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Agent Name</th>
                  <th className="py-3 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Lead Count</th>
                  <th className="py-3 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Move To</th>
                  <th className="py-3 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Select</th>
                  <th className="py-3 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 font-medium text-sm">
                      No agents found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                    const fullName = `${user.firstName} ${user.lastName}`.trim();
                    const count = getLeadCount(user);
                    const destinationOptions = users.filter((u) => u._id !== user._id);
                    const isTransferring = transferring === user._id;

                    return (
                      <tr
                        key={user._id}
                        className="hover:bg-indigo-50/30 transition-colors"
                      >
                        {/* Agent Name */}
                        <td className="py-3 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">
                              {fullName.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-semibold text-slate-800 text-sm">{fullName}</span>
                          </div>
                        </td>

                        {/* Lead Count Badge */}
                        <td className="py-3 px-6 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            count > 0
                              ? 'bg-indigo-100 text-indigo-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}>
                            {count}
                          </span>
                        </td>

                        {/* Move To Dropdown */}
                        <td className="py-3 px-6">
                          <select
                            value={selectedDestinations[user._id] || ''}
                            onChange={(e) =>
                              setSelectedDestinations((prev) => ({
                                ...prev,
                                [user._id]: e.target.value,
                              }))
                            }
                            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 font-medium w-48 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition"
                          >
                            <option value="">-- Select Agent --</option>
                            {destinationOptions.map((opt) => (
                              <option key={opt._id} value={opt._id}>
                                {opt.firstName} {opt.lastName}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Checkbox */}
                        <td className="py-3 px-6 text-center">
                          <input
                            type="checkbox"
                            checked={!!checkedMoves[user._id]}
                            onChange={(e) =>
                              setCheckedMoves((prev) => ({
                                ...prev,
                                [user._id]: e.target.checked,
                              }))
                            }
                            className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                          />
                        </td>

                        {/* Action Buttons */}
                        <td className="py-3 px-6">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleTransfer(user)}
                              disabled={isTransferring || !selectedDestinations[user._id] || count === 0}
                              title="Transfer Leads"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                            >
                              {isTransferring ? (
                                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Icons.ArrowLeftRight className="w-3.5 h-3.5" />
                              )}
                              Transfer
                            </button>
                            <button
                              onClick={() => handleClearLeads(user)}
                              disabled={isTransferring || count === 0}
                              title="Unassign All Leads"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                            >
                              <Icons.Trash2 className="w-3.5 h-3.5" />
                              Clear
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer summary */}
        {!loading && filteredUsers.length > 0 && (
          <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">
              Showing <span className="font-bold text-slate-700">{filteredUsers.length}</span> agent{filteredUsers.length !== 1 ? 's' : ''}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Total leads: <span className="font-bold text-indigo-600">{leads.length}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
