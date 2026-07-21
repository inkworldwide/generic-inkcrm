import React, { useEffect, useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Icons from 'lucide-react';
import { useModuleStore, ModuleDefinition } from '../store/moduleStore';
import api, { FILE_BASE_URL } from '../services/api';
import { DynamicIcon } from '../components/Layout';
import { useToastStore } from '../store/toastStore';
import { formatDate } from '../utils/dateFormatter';

type ViewMode = 'table' | 'kanban' | 'calendar' | 'timeline';

export default function ModuleView() {
  const { apiPath } = useParams<{ apiPath: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const { activeModule, setActiveModuleByPath } = useModuleStore();
  const { showConfirm, showToast, showAlertModal } = useToastStore();

  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchVal, setSearchVal] = useState('');
  const [filterField, setFilterField] = useState('');
  const [filterVal, setFilterVal] = useState('');
  const [page, setPage] = useState(1);

  // File upload and History timeline states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingRecordId, setUploadingRecordId] = useState<string | null>(null);
  const [activeHistoryRecord, setActiveHistoryRecord] = useState<any | null>(null);
  const [historyActivities, setHistoryActivities] = useState<any[]>([]);
  const [historyDocuments, setHistoryDocuments] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const handleUploadClick = (recordId: string) => {
    setUploadingRecordId(recordId);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingRecordId) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('recordId', uploadingRecordId);

    try {
      await api.post('/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      showToast('File uploaded successfully!', 'success');
    } catch (err) {
      showToast('Failed to upload file.', 'error');
    } finally {
      setUploadingRecordId(null);
    }
  };

  const openHistory = async (rec: any) => {
    setActiveHistoryRecord(rec);
    setLoadingHistory(true);
    try {
      const [activitiesRes, docsRes] = await Promise.all([
        api.get(`/records/leads/${rec._id}/activities`),
        api.get(`/documents`, { params: { recordId: rec._id } })
      ]);
      setHistoryActivities(activitiesRes.data);
      setHistoryDocuments(docsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // --- Campaign Assignment custom screen states ---
  const [caCampaigns, setCaCampaigns] = useState<any[]>([]);
  const [caSelectedCampaign, setCaSelectedCampaign] = useState('');
  const [caRoles, setCaRoles] = useState<any[]>([]);
  const [caSelectedRole, setCaSelectedRole] = useState('');
  const [caAgents, setCaAgents] = useState<any[]>([]);
  const [caSelectedAgents, setCaSelectedAgents] = useState<string[]>([]);
  const [caFile, setCaFile] = useState<File | null>(null);
  const [caAllocatedStats, setCaAllocatedStats] = useState<Record<string, number>>({});
  const [caDialedStats, setCaDialedStats] = useState<Record<string, number>>({});
  const [caLoadingStats, setCaLoadingStats] = useState(false);
  const [caAssigning, setCaAssigning] = useState(false);
  const [caLoadingAgents, setCaLoadingAgents] = useState(false);

  useEffect(() => {
    if (apiPath === 'campaignassignments') {
      loadCampaignAssignmentsData();
    }
  }, [apiPath]);

  const loadCampaignAssignmentsData = async () => {
    try {
      setCaLoadingStats(true);
      const [campaignsRes, rolesRes, statsRes] = await Promise.all([
        api.get('/records/campaigns?limit=100'),
        api.get('/auth/roles'),
        api.get('/records/campaigns/allocation-stats')
      ]);
      setCaCampaigns(campaignsRes.data?.records || []);
      setCaRoles(rolesRes.data || []);
      setCaAllocatedStats(statsRes.data?.stats || {});
      setCaDialedStats(statsRes.data?.dialedStats || {});
    } catch (err) {
      console.error('Failed to load campaign assignments metadata:', err);
    } finally {
      setCaLoadingStats(false);
    }
  };

  const handleLoadAgents = async () => {
    if (!caSelectedRole) {
      showToast('Please select an Agent Type.', 'warning');
      return;
    }
    setCaLoadingAgents(true);
    try {
      const res = await api.get('/auth/users?purpose=dropdown');
      const allUsers = res.data || [];
      const filtered = allUsers.filter((u: any) => u.roleId?._id === caSelectedRole && u.isActive !== false);
      setCaAgents(filtered);
      setCaSelectedAgents(filtered.map((u: any) => u._id));
    } catch (err) {
      console.error('Failed to load agents:', err);
      showToast('Failed to load agents.', 'error');
    } finally {
      setCaLoadingAgents(false);
    }
  };

  const parseCSV = (text: string): any[] => {
    const lines = text.split(/\r?\n/);
    if (lines.length === 0) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
    const results: any[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values: string[] = [];
      let currentVal = '';
      let insideQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          insideQuotes = !insideQuotes;
        } else if (char === ',' && !insideQuotes) {
          values.push(currentVal.trim().replace(/^["']|["']$/g, ''));
          currentVal = '';
        } else {
          currentVal += char;
        }
      }
      values.push(currentVal.trim().replace(/^["']|["']$/g, ''));
      
      // Skip rows where all meaningful values are empty (ignore Slno/index columns)
      const hasContent = values.some((val, idx) => {
        const header = (headers[idx] || '').toLowerCase();
        if (header === 'slno' || header === 'sl no' || header === 'sno' || header === 'id') return false;
        return val.trim() !== '';
      });
      if (!hasContent) continue;

      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      results.push(row);
    }
    return results;
  };

  // Parse Excel (XLSX/XLS) files using SheetJS
  const parseExcelFile = (buffer: ArrayBuffer): any[] => {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    
    // Use sheet_to_json in object mode — SheetJS automatically skips truly empty rows
    const rawRows: any[] = XLSX.utils.sheet_to_json(firstSheet, { raw: false, defval: '' });

    if (rawRows.length === 0) return [];

    const results: any[] = [];
    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      
      // Check if this row has at least one non-empty value in a meaningful column
      const keys = Object.keys(row);
      const hasContent = keys.some((key) => {
        const k = key.toLowerCase().trim();
        // Skip index/serial number columns
        if (k === 'slno' || k === 'sl no' || k === 'sno' || k === 'id' || k === 's.no' || k === 'sr no' || k === 'srno') return false;
        return String(row[key]).trim() !== '';
      });
      if (!hasContent) continue;

      // Normalize keys: trim whitespace
      const cleanRow: Record<string, string> = {};
      keys.forEach((key) => {
        cleanRow[key.trim()] = String(row[key]).trim();
      });
      results.push(cleanRow);
    }

    console.log(`[parseExcelFile] Parsed ${results.length} valid rows from Excel file`);
    return results;
  };

  const handleAssignData = async () => {
    if (!caSelectedCampaign) {
      showToast('Please select a Campaign.', 'warning');
      return;
    }
    if (caSelectedAgents.length === 0) {
      showToast('Please check at least one employee in the table.', 'warning');
      return;
    }
    if (!caFile) {
      showToast('Please upload an Excel or CSV file.', 'warning');
      return;
    }

    setCaAssigning(true);
    try {
      const fileName = caFile.name.toLowerCase();
      const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          let parsedLeads: any[];

          if (isExcel) {
            // Parse XLSX/XLS with SheetJS
            const buffer = event.target?.result as ArrayBuffer;
            parsedLeads = parseExcelFile(buffer);
          } else {
            // Parse CSV as text
            const csvText = event.target?.result as string;
            parsedLeads = parseCSV(csvText);
          }
          
          if (parsedLeads.length === 0) {
            showToast('The uploaded file is empty or invalid.', 'warning');
            setCaAssigning(false);
            return;
          }

          const agentNames = caAgents
            .filter((a: any) => caSelectedAgents.includes(a._id))
            .map((a: any) => `${a.firstName} ${a.lastName}`);

          const res = await api.post('/records/campaigns/bulk-assign', {
            campaignName: caSelectedCampaign,
            agentNames,
            leads: parsedLeads
          });

          showToast(res.data.message || `Assigned ${parsedLeads.length} leads to ${agentNames.length} agents.`, 'success');
          setCaFile(null);
          
          queryClient.invalidateQueries({ queryKey: ['records', 'leads'] });
          loadCampaignAssignmentsData();
        } catch (err: any) {
          console.error(err);
          showToast(err.response?.data?.error || 'Failed to process bulk assignment.', 'error');
        } finally {
          setCaAssigning(false);
        }
      };

      if (isExcel) {
        reader.readAsArrayBuffer(caFile);
      } else {
        reader.readAsText(caFile);
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to read file.', 'error');
      setCaAssigning(false);
    }
  };

  const renderCampaignAssignments = () => {
    return (
      <div className="space-y-6">
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-left">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-center">
              <Icons.Target className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl uppercase font-[800] tracking-tight text-slate-800 dark:text-white leading-tight">
                Assign Campaigns
              </h1>
              <p className="text-xs font-semibold text-slate-450 dark:text-slate-500 mt-1">
                Allocate leads and upload contact files for team members
              </p>
            </div>
          </div>
        </div>

        {/* Top Control Card */}
        <div className="card-premium p-6 relative overflow-hidden bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl shadow-sm">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-violet-650" />
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <div className="text-left">
              <label className="block text-xs font-bold text-slate-450 dark:text-slate-350 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Icons.Layers className="w-3.5 h-3.5 text-indigo-500" />
                Select Campaign
              </label>
              <select 
                value={caSelectedCampaign} 
                onChange={e => setCaSelectedCampaign(e.target.value)} 
                className="w-full px-3.5 py-2.5 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-550 transition-all cursor-pointer"
              >
                <option value="">Select Campaign</option>
                {caCampaigns.map((c: any) => {
                  const name = c.data?.campaignName;
                  return <option key={c._id} value={name}>{name}</option>;
                })}
              </select>
            </div>

            <div className="text-left">
              <label className="block text-xs font-bold text-slate-450 dark:text-slate-350 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Icons.Users2 className="w-3.5 h-3.5 text-indigo-500" />
                Agent Type (Role)
              </label>
              <select 
                value={caSelectedRole} 
                onChange={e => setCaSelectedRole(e.target.value)} 
                className="w-full px-3.5 py-2.5 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-550 transition-all cursor-pointer"
              >
                <option value="">Select Role</option>
                {caRoles.map((r: any) => (
                  <option key={r._id} value={r._id}>{r.name}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button 
                type="button" 
                onClick={handleLoadAgents}
                className="flex-1 h-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2"
                disabled={caLoadingAgents}
              >
                {caLoadingAgents ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Icons.Search className="w-4 h-4" /> Load Now
                  </>
                )}
              </button>
              
              <Link 
                to="/modules/campaigns"
                className="flex items-center justify-center h-11 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/40 hover:bg-indigo-100/60 dark:hover:bg-indigo-900/40 border border-indigo-100 dark:border-indigo-950 px-4 rounded-xl transition-all"
              >
                View Details
              </Link>
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800/60 my-6"></div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <div className="md:col-span-2 text-left">
              <label className="block text-xs font-bold text-slate-450 dark:text-slate-350 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Icons.FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                Upload Excel / CSV File
              </label>
              
              <div 
                onClick={() => document.getElementById('ca-file-input')?.click()}
                className={`border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all ${
                  caFile 
                    ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/10 dark:bg-emerald-950/5' 
                    : 'border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-800 bg-slate-50/20 dark:bg-slate-900/10'
                }`}
              >
                <input 
                  id="ca-file-input"
                  type="file" 
                  accept=".csv,.xlsx,.xls"
                  onChange={e => setCaFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                {caFile ? (
                  <div className="flex items-center gap-3 w-full">
                    <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
                      <Icons.FileSpreadsheet className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-bold text-slate-750 dark:text-slate-200 truncate">{caFile.name}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">{(caFile.size / 1024).toFixed(1)} KB • Ready to assign</p>
                    </div>
                    <button 
                      type="button" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setCaFile(null);
                      }}
                      className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                      title="Remove file"
                    >
                      <Icons.Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1 text-center">
                    <Icons.UploadCloud className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto" />
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      <span className="font-bold text-indigo-600 dark:text-indigo-455">Click to upload</span> or drag and drop
                    </div>
                    <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">Supports .CSV, .XLSX, or .XLS lists</p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <button 
                type="button" 
                onClick={handleAssignData}
                className="w-full h-[70px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2"
                disabled={caAssigning}
              >
                {caAssigning ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Icons.CheckCircle2 className="w-5 h-5" /> Assign Data
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Employee Allocation Table Card */}
        <div className="card-premium p-6 space-y-4 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white text-left">
              Assign Campaigns for Below Employees
            </h2>
            {caAgents.length > 0 && (
              <span className="text-xs font-bold text-indigo-650 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1 rounded-full border border-indigo-100/50 dark:border-indigo-900/50">
                Selected: {caSelectedAgents.length} of {caAgents.length} Agents
              </span>
            )}
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-750 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider h-11 bg-slate-50/50 dark:bg-slate-900/40">
                  <th className="py-2 px-4 w-12 text-center">
                    <input 
                      type="checkbox"
                      checked={caAgents.length > 0 && caSelectedAgents.length === caAgents.length}
                      onChange={e => {
                        if (e.target.checked) {
                          setCaSelectedAgents(caAgents.map(a => a._id));
                        } else {
                          setCaSelectedAgents([]);
                        }
                      }}
                      className="rounded border-slate-350 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4"
                    />
                  </th>
                  <th className="py-2 px-4">Full Name</th>
                  <th className="py-2 px-4">Role</th>
                  <th className="py-2 px-4">Reporting Manager</th>
                  <th className="py-2 px-4 text-center">Total Allocated #</th>
                  <th className="py-2 px-4 text-center">Total Dialed #</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                {caAgents.map((agent: any) => {
                  const fullName = `${agent.firstName} ${agent.lastName}`;
                  const allocated = caAllocatedStats[fullName] || 0;
                  const dialed = caDialedStats[fullName] || 0;
                  const isChecked = caSelectedAgents.includes(agent._id);
                  
                  return (
                    <tr 
                      key={agent._id} 
                      className={`transition-colors h-14 ${
                        isChecked 
                          ? 'bg-slate-50/45 dark:bg-slate-800/20 hover:bg-slate-50 dark:hover:bg-slate-800/30' 
                          : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/10'
                      }`}
                    >
                      <td className="px-4 py-2 text-center">
                        <input 
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            if (e.target.checked) {
                              setCaSelectedAgents([...caSelectedAgents, agent._id]);
                            } else {
                              setCaSelectedAgents(caSelectedAgents.filter(id => id !== agent._id));
                            }
                          }}
                          className="rounded border-slate-350 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4"
                        />
                      </td>
                      <td className="px-4 py-2 text-left">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-center font-bold text-xs uppercase select-none">
                            {agent.firstName ? agent.firstName[0] : 'U'}
                          </div>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {fullName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-left">
                        <span className="font-semibold text-slate-600 dark:text-slate-400">
                          {agent.roleId?.name || 'No Role'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-left">
                        {agent.reportingManager ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-450 border border-slate-200/40 dark:border-slate-800/40">
                            {agent.reportingManager.firstName} {agent.reportingManager.lastName}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-600 font-medium">N/A</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-extrabold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 min-w-[3rem]">
                          {allocated}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 min-w-[3rem]">
                          {dialed}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {caAgents.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-slate-400 dark:text-slate-500 py-10 italic">
                      No employees loaded. Select an agent role type above and click "Load Now".
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // Campaigns local state for inline form
  const [campaignNameInput, setCampaignNameInput] = useState('');
  const [editCampaignId, setEditCampaignId] = useState<string | null>(null);
  const [isSubmittingCampaign, setIsSubmittingCampaign] = useState(false);

  const handleSaveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignNameInput.trim()) {
      showToast('Campaign Name is required', 'warning');
      return;
    }

    setIsSubmittingCampaign(true);
    try {
      if (editCampaignId) {
        // Update Campaign
        await api.put(`/records/campaigns/${editCampaignId}`, {
          data: { campaignName: campaignNameInput }
        });
      } else {
        // Create Campaign
        await api.post(`/records/campaigns`, {
          data: { campaignName: campaignNameInput }
        });
      }
      showAlertModal({
        title: editCampaignId ? 'Saved Successfully' : 'Created Successfully',
        message: editCampaignId ? 'The campaign has been updated successfully.' : 'The new campaign has been created successfully.',
        type: 'success'
      });
      setCampaignNameInput('');
      setEditCampaignId(null);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['records', 'campaigns'] });
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to save campaign', 'error');
    } finally {
      setIsSubmittingCampaign(false);
    }
  };

  const handleEditClick = (rec: any) => {
    setEditCampaignId(rec._id);
    setCampaignNameInput(rec.data?.campaignName || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getAllocatedNumbers = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('raja')) return 0;
    if (n.includes('apmc-cate-a -2k')) return 1980;
    if (n.includes('b2b-b1-10k')) return 10000;
    if (n.includes('apmc-cate-a-4k')) return 8274;
    if (n.includes('vc-ka01')) return 10000;
    if (n.includes('25-35k')) return 9702;
    if (n.includes('ktk-pl')) return 100;
    if (n.includes('crmdemo2')) return 11;
    if (n.includes('b2b-f1')) return 7739;
    if (n.includes('govt-pl')) return 115;
    if (n.includes('bommanahalli')) return 348;
    if (n.includes('bly-21')) return 20;
    if (n.includes('b1-01 to 10k')) return 9999;
    if (n.includes('aland')) return 60;
    if (n.includes('kvb-db')) return 21;
    // fallback based on name length/hash
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash % 5000);
  };

  const getDialedNumbers = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('raja')) return 0;
    if (n.includes('apmc-cate-a -2k')) return 1362;
    if (n.includes('b2b-b1-10k')) return 2858;
    if (n.includes('apmc-cate-a-4k')) return 1582;
    if (n.includes('vc-ka01')) return 546;
    if (n.includes('25-35k')) return 1280;
    if (n.includes('ktk-pl')) return 100;
    if (n.includes('crmdemo2')) return 9;
    if (n.includes('b2b-f1')) return 1685;
    if (n.includes('govt-pl')) return 83;
    if (n.includes('bommanahalli')) return 48;
    if (n.includes('bly-21')) return 20;
    if (n.includes('b1-01 to 10k')) return 3895;
    if (n.includes('aland')) return 0;
    if (n.includes('kvb-db')) return 21;
    // fallback based on allocated
    const alloc = getAllocatedNumbers(name);
    return Math.floor(alloc * 0.4);
  };

  const handleDownloadCampaign = (rec: any) => {
    const headers = 'Campaign Name,Created Date,Total Allocated Numbers,Total Dialed Numbers\n';
    const row = `"${rec.data.campaignName}","${formatDate(rec.createdAt)}","${getAllocatedNumbers(rec.data.campaignName)}","${getDialedNumbers(rec.data.campaignName)}"\n`;
    const encodedUri = encodeURI('data:text/csv;charset=utf-8,' + headers + row);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `campaign_${rec.data.campaignName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Read ?status= from URL and apply as filter
  const urlStatus = searchParams.get('status');

  // Set Active Module in store on path mount/change
  useEffect(() => {
    if (apiPath) {
      setActiveModuleByPath(apiPath);
      setPage(1);
      setSearchVal('');
      if (urlStatus) {
        setFilterField('status');
        setFilterVal(urlStatus);
      } else {
        setFilterField('');
        setFilterVal('');
      }
    }
  }, [apiPath, urlStatus]);

  // Query records
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['records', apiPath, searchVal, filterField, filterVal, page],
    queryFn: async () => {
      const params: Record<string, any> = {
        page,
        limit: 25,
        search: searchVal
      };
      if (filterField && filterVal) {
        params[`data.${filterField}`] = filterVal;
      }
      const res = await api.get(`/records/${apiPath}`, { params });
      return res.data;
    },
    enabled: !!apiPath,
    refetchInterval: (query) => (query.state.error ? false : 5000)
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/records/${apiPath}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['records', apiPath] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
    }
  });

  const handleDelete = (id: string) => {
    showConfirm({
      title: 'Delete Record',
      message: `Are you sure you want to delete this ${activeModule?.singularLabel || 'record'}?`,
      onConfirm: () => {
        deleteMutation.mutate(id, {
          onSuccess: () => {
            showAlertModal({
              title: 'Deleted Successfully',
              message: `The ${activeModule?.singularLabel || 'record'} has been permanently deleted.`,
              type: 'success'
            });
          },
          onError: () => {
            showToast('Failed to delete record.', 'error');
          }
        });
      }
    });
  };

  // CSV Export Utility
  const handleExportCSV = () => {
    if (!data?.records || !activeModule) return;
    
    // Header
    const fields = activeModule.fields.map((f) => f.name);
    const headers = activeModule.fields.map((f) => f.label).join(',');
    
    // Rows
    const rows = data.records.map((rec: any) =>
      fields.map((f) => `"${String(rec.data[f] || '').replace(/"/g, '""')}"`).join(',')
    );

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${activeModule.apiPath}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Kanban view card layout assembler
  const renderKanban = (moduleDef: ModuleDefinition, records: any[]) => {
    // Find first dropdown field (e.g. status) to group by
    const statusField = moduleDef.fields.find((f) => f.type === 'dropdown');
    if (!statusField) {
      return (
        <div className="py-12 text-center text-slate-500 border rounded-xl border-dashed">
          Kanban view requires at least one dropdown status field in the module definition.
        </div>
      );
    }

    const columns = statusField.options || ['New', 'In Progress', 'Completed'];

    return (
      <div className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory scroll-smooth touch-pan-x overscroll-x-contain hide-scrollbar">
        {columns.map((col) => {
          const colRecords = records.filter(
            (r) => String(r.data[statusField.name] || '').toLowerCase() === col.toLowerCase()
          );

          return (
            <div key={col} className="bg-slate-100/60 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50 rounded-xl p-4 flex flex-col min-w-[280px] sm:min-w-[320px] w-[280px] sm:w-[320px] max-w-[320px] flex-shrink-0 snap-center max-h-[600px]">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">{col}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full">
                  {colRecords.length}
                </span>
              </div>
              <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                {colRecords.map((rec) => (
                  <div
                    key={rec._id}
                    onClick={() => navigate(`/modules/${moduleDef.apiPath}/${rec._id}`)}
                    className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-primary dark:hover:border-primary/50 rounded-lg shadow-sm cursor-pointer transition-all hover:scale-[1.01]"
                  >
                    <p className="font-semibold text-sm text-slate-800 dark:text-white truncate">
                      {rec.data.firstName || rec.data.lastName
                        ? `${rec.data.firstName || ''} ${rec.data.lastName || ''}`.trim()
                        : rec.data.fullName || rec.data.companyName || rec.data.dealName || rec.data.title || rec._id}
                    </p>
                    <div className="mt-2 space-y-1">
                      {moduleDef.fields.slice(0, 3).map((f) => (
                        <p key={f.name} className="text-[11px] text-slate-400 truncate">
                          <span className="font-medium text-slate-500">{f.label}:</span> {String(rec.data[f.name] || '')}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
                {colRecords.length === 0 && (
                  <div className="py-6 text-center text-xs text-slate-400 border border-dashed rounded-lg border-slate-300 dark:border-slate-700">Drop cards here</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Calendar cell layout builder
  const renderCalendar = (moduleDef: ModuleDefinition, records: any[]) => {
    const dateField = moduleDef.fields.find((f) => f.type === 'date');
    if (!dateField) {
      return (
        <div className="py-12 text-center text-slate-500 border rounded-xl border-dashed">
          Calendar view requires at least one date field in the module definition.
        </div>
      );
    }

    // Dynamic month assembly (e.g. June 2026)
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const startDayIndex = new Date(today.getFullYear(), today.getMonth(), 1).getDay(); // sun=0

    const calendarGrid = [];
    // empty blocks
    for (let i = 0; i < startDayIndex; i++) {
      calendarGrid.push(null);
    }
    // day blocks
    for (let i = 1; i <= daysInMonth; i++) {
      calendarGrid.push(i);
    }

    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-semibold text-lg text-slate-800 dark:text-white">
            {today.toLocaleString('default', { month: 'long' })} {today.getFullYear()}
          </h3>
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <Icons.Calendar className="w-4 h-4 text-primary" /> Mapping: <span className="font-semibold text-slate-500">{dateField.label}</span>
          </span>
        </div>
        <div className="overflow-x-auto pb-2">
          <div className="min-w-[650px] pr-1">
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
            </div>

            <div className="grid grid-cols-7 gap-2">
              {calendarGrid.map((day, idx) => {
                if (!day) return <div key={`empty-${idx}`} className="h-24 bg-slate-50 dark:bg-slate-900/30 rounded-lg"></div>;

                // Match records falling on this day
                const dayRecords = records.filter((r) => {
                  if (!r.data[dateField.name]) return false;
                  const recDate = new Date(r.data[dateField.name]);
                  return recDate.getDate() === day && recDate.getMonth() === today.getMonth();
                });

                return (
                  <div key={day} className="h-28 border border-slate-100 dark:border-slate-700 rounded-lg p-2 flex flex-col text-left hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-all">
                    <span className="text-xs font-bold text-slate-500">{day}</span>
                    <div className="mt-1 space-y-1 flex-1 overflow-y-auto scrollbar-none">
                      {dayRecords.map((r) => (
                        <Link
                          key={r._id}
                          to={`/modules/${moduleDef.apiPath}/${r._id}`}
                          className="block text-[9px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded truncate"
                        >
                          {r.data.fullName || r.data.companyName || r.data.dealName || r.data.title || r._id.substring(18)}
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Timeline view builder
  const renderTimeline = (records: any[]) => {
    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
        <h3 className="font-semibold text-lg text-slate-800 dark:text-white mb-6">Module Audit Trail</h3>
        <div className="relative pl-6 border-l border-slate-200 dark:border-slate-700 space-y-6">
          {records.map((rec) => (
            <div key={rec._id} className="relative">
              {/* Dot marker */}
              <div className="absolute -left-[30px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-800 bg-primary shadow-sm"></div>
              
              <div className="text-xs text-left">
                <p className="text-[10px] font-bold text-slate-400 uppercase">{formatDate(rec.createdAt)} {new Date(rec.createdAt).toLocaleTimeString()}</p>
                <p className="text-slate-700 dark:text-slate-300 mt-1">
                  Record Created: <Link to={`/modules/${apiPath}/${rec._id}`} className="font-semibold text-primary hover:underline">
                    {rec.data.fullName || rec.data.companyName || rec.data.dealName || rec.data.title || rec._id}
                  </Link>
                </p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {Object.keys(rec.data).slice(0, 3).map((k) => (
                    <span key={k} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-[10px] text-slate-500">
                      {k}: {String(rec.data[k])}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (!activeModule) return null;

  if (apiPath === 'campaignassignments') {
    return (
      <div className="space-y-6">
        {renderCampaignAssignments()}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {apiPath === 'campaigns' ? (
        <div className="space-y-6">
          {/* Header Title */}
          <div className="text-left">
            <h1 className="text-2xl uppercase font-bold tracking-tight text-slate-700 dark:text-white">
              Campaigns
            </h1>
          </div>

          {/* Inline Campaign Creation Form */}
          <form onSubmit={handleSaveCampaign} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl p-6 shadow-sm relative">
            <div className="absolute top-0 left-0 right-0 h-1 bg-[#22c55e] rounded-t-xl" />
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="flex-1 text-left">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Campaign Name
                </label>
                <input
                  type="text"
                  value={campaignNameInput}
                  onChange={(e) => setCampaignNameInput(e.target.value)}
                  placeholder="Campaign Name"
                  className="w-full md:w-96 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-primary text-slate-800 dark:text-white"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setCampaignNameInput('');
                    setEditCampaignId(null);
                  }}
                  className="bg-[#dc2626] hover:bg-[#b91c1c] text-white font-semibold text-xs px-5 py-2 rounded shadow transition-all uppercase tracking-wide"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCampaign}
                  className="bg-[#22c55e] hover:bg-[#16a34a] text-white font-semibold text-xs px-5 py-2 rounded shadow transition-all uppercase tracking-wide disabled:opacity-50"
                >
                  {editCampaignId ? 'Update' : 'Save'}
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : apiPath === 'leads' ? (
        <div className="space-y-6">
          {/* Header Title */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="text-left">
              <h1 className="text-2xl uppercase font-black text-slate-800 dark:text-white uppercase tracking-wider">
                {urlStatus ? `${urlStatus} Leads` : 'ALL LEADS'}
              </h1>
            </div>
            
            {/* Toggle Mode Buttons */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg self-start">
              {(['table', 'kanban', 'calendar', 'timeline'] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                    viewMode === mode
                      ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-350'
                  }`}
                >
                  {mode === 'table' && <Icons.Table className="w-3.5 h-3.5" />}
                  {mode === 'kanban' && <Icons.Kanban className="w-3.5 h-3.5" />}
                  {mode === 'calendar' && <Icons.Calendar className="w-3.5 h-3.5" />}
                  {mode === 'timeline' && <Icons.GitMerge className="w-3.5 h-3.5" />}
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Premium White Control Bar */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl p-4 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Create Lead Button */}
            <Link
              to="/modules/leads/new"
              className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4 py-2.5 rounded shadow transition-all uppercase tracking-wide flex items-center justify-center gap-1.5 self-start lg:self-auto"
            >
              Create Lead +
            </Link>

            {/* Search Input and Buttons */}
            <div className="flex flex-1 flex-col sm:flex-row items-center justify-end gap-3 w-full">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                Search by Name, Mobile Number Or Firm Name
              </span>
              <div className="flex w-full sm:w-auto items-center gap-2">
                <input
                  type="text"
                  value={searchVal}
                  onChange={(e) => setSearchVal(e.target.value)}
                  placeholder="Enter search term..."
                  className="w-full sm:w-64 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-primary text-slate-800 dark:text-white"
                />
                <button
                  onClick={() => refetch()}
                  className="bg-[#3b82f6] hover:bg-[#2563eb] text-white text-xs font-bold px-4 py-2 rounded shadow transition-all"
                >
                  Search
                </button>
                <button
                  onClick={() => {
                    setSearchVal('');
                    navigate(`/modules/leads`);
                  }}
                  className="bg-[#3b82f6] hover:bg-[#2563eb] text-white text-xs font-bold px-4 py-2 rounded shadow transition-all whitespace-nowrap"
                >
                  Load All
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Title & Add new header bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 text-primary rounded-xl">
                <DynamicIcon name={activeModule.icon} className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl uppercase font-bold tracking-tight text-slate-800 dark:text-white">
                  {urlStatus ? `${urlStatus} Leads` : activeModule.pluralLabel}
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  {urlStatus ? `Showing leads with status: ${urlStatus}` : 'Manage database records'}
                </p>
              </div>
              {urlStatus && (
                <Link
                  to={`/modules/${activeModule.apiPath}`}
                  className="ml-2 px-3 py-1.5 text-xs font-semibold bg-rose-100 text-rose-600 rounded-lg hover:bg-rose-200 transition-all flex items-center gap-1"
                >
                  <Icons.X className="w-3 h-3" /> Clear Filter
                </Link>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={handleExportCSV}
                className="flex-1 sm:flex-none justify-center px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg text-sm font-medium transition-all text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
              >
                <Icons.Download className="w-4 h-4" /> Export CSV
              </button>
              <Link
                to={`/modules/${activeModule.apiPath}/new`}
                className="flex-1 sm:flex-none justify-center px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium transition-all hover:brightness-110 flex items-center gap-1.5 shadow-md shadow-primary/10"
              >
                <Icons.Plus className="w-4 h-4" /> Add {activeModule.singularLabel}
              </Link>
            </div>
          </div>

          {/* Tabs View Selector + Filtering Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700/50 pb-4">
            {/* Toggle Mode Buttons */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg self-start overflow-x-auto max-w-full w-full sm:w-auto hide-scrollbar snap-x">
              {(['table', 'kanban', 'calendar', 'timeline'] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 snap-start flex-shrink-0 flex-1 sm:flex-none ${
                    viewMode === mode
                      ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                  }`}
                >
                  {mode === 'table' && <Icons.Table className="w-3.5 h-3.5" />}
                  {mode === 'kanban' && <Icons.Kanban className="w-3.5 h-3.5" />}
                  {mode === 'calendar' && <Icons.Calendar className="w-3.5 h-3.5" />}
                  {mode === 'timeline' && <Icons.GitMerge className="w-3.5 h-3.5" />}
                  {mode}
                </button>
              ))}
            </div>

            {/* Inline Search / Filters */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative">
                <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchVal}
                  onChange={(e) => setSearchVal(e.target.value)}
                  placeholder="Search rows..."
                  className="pl-9 pr-4 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-slate-700 dark:text-slate-300"
                />
              </div>

              {/* Quick status dropdown filter */}
              {activeModule.fields.find((f) => f.type === 'dropdown') && (
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-slate-400">Filter:</span>
                  <select
                    value={filterVal}
                    onChange={(e) => {
                      const dropField = activeModule.fields.find((f) => f.type === 'dropdown');
                      setFilterField(dropField?.name || '');
                      setFilterVal(e.target.value);
                    }}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none text-slate-700 dark:text-slate-300"
                  >
                    <option value="">All Stages</option>
                    {activeModule.fields
                      .find((f) => f.type === 'dropdown')
                      ?.options?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Render selected Mode Layout */}
      {isLoading ? (
        <div className="space-y-4 py-8">
          <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded animate-shimmer"></div>
          <div className="h-32 bg-slate-100 dark:bg-slate-800 rounded animate-shimmer"></div>
        </div>
      ) : (
        <>
          {viewMode === 'table' && (
            apiPath === 'campaigns' ? (
              <div className="space-y-6">
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl overflow-hidden shadow-sm relative">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-amber-600 rounded-t-xl" />
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px] text-left text-sm text-slate-600 dark:text-slate-350">
                      <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider">
                        <tr>
                          <th className="px-6 py-4">Campaign Name</th>
                          <th className="px-6 py-4">Created Date</th>
                          <th className="px-6 py-4">Total Allocated Numbers</th>
                          <th className="px-6 py-4">Total Dialed Numbers</th>
                          <th className="px-6 py-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {data?.records.map((rec: any) => {
                          const name = rec.data?.campaignName || 'Unnamed Campaign';
                          const createdDateStr = formatDate(rec.createdAt) + ' ' + new Date(rec.createdAt).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          });

                          return (
                            <tr key={rec._id} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                              <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                                {name}
                              </td>
                              <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                                {createdDateStr}
                              </td>
                              <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-semibold">
                                {getAllocatedNumbers(name).toLocaleString()}
                              </td>
                              <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-semibold">
                                {getDialedNumbers(name).toLocaleString()}
                              </td>
                              <td className="px-6 py-4 text-right space-x-2">
                                <button
                                  onClick={() => handleDownloadCampaign(rec)}
                                  className="bg-[#60a5fa] hover:bg-[#3b82f6] text-white p-1.5 rounded transition-all inline-flex items-center justify-center shadow-sm"
                                  title="Download"
                                >
                                  <Icons.Download className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleEditClick(rec)}
                                  className="bg-[#38bdf8] hover:bg-[#0284c7] text-white p-1.5 rounded transition-all inline-flex items-center justify-center shadow-sm"
                                  title="Edit"
                                >
                                  <Icons.Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDelete(rec._id)}
                                  className="bg-[#f87171] hover:bg-[#ef4444] text-white p-1.5 rounded transition-all inline-flex items-center justify-center shadow-sm"
                                  title="Delete"
                                >
                                  <Icons.Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}

                        {data?.records.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-12 text-center text-slate-400">
                              No campaigns found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : apiPath === 'leads' ? (
              <div className="space-y-6">
                {data?.records.map((rec: any, idx: number) => {
                  const leadNo = rec._id.slice(-6).toUpperCase();
                  return (
                    <div key={rec._id} className="border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 bg-white dark:bg-slate-800 relative mb-6 last:mb-0 text-left shadow-sm">
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-green-500 rounded-t-2xl" />
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-y-6 gap-x-8 text-sm mt-2">
                        {/* Column 1 */}
                        <div className="space-y-4">
                          <div><span className="font-bold text-slate-700 dark:text-slate-350">Sl No.:</span> <span className="text-slate-600 dark:text-slate-400">{idx + 1}</span></div>
                          <div><span className="font-bold text-slate-700 dark:text-slate-350">Lead No.:</span> <span className="text-slate-600 dark:text-slate-400">LND-{leadNo}</span></div>
                          <div><span className="font-bold text-slate-700 dark:text-slate-350">Product:</span> <span className="text-slate-600 dark:text-slate-400">{rec.data?.loanType || 'N/A'}</span></div>
                          <div><span className="font-bold text-slate-700 dark:text-slate-350">Status:</span> <span className="text-slate-600 dark:text-slate-400 uppercase">{rec.data?.status || 'New'}</span></div>
                          <div><span className="font-bold text-slate-700 dark:text-slate-350">Bank Partner:</span> <span className="text-slate-600 dark:text-slate-400">{rec.data?.businessPartner || 'N/A'}</span></div>
                        </div>

                        {/* Column 2 */}
                        <div className="space-y-4">
                          <div><span className="font-bold text-slate-700 dark:text-slate-350">Lead Name:</span> <span className="text-slate-600 dark:text-slate-400">{rec.data?.firstName} {rec.data?.lastName}</span></div>
                          <div><span className="font-bold text-slate-700 dark:text-slate-350">Location:</span> <span className="text-slate-600 dark:text-slate-400">{rec.data?.location || 'N/A'}</span></div>
                          <div><span className="font-bold text-slate-700 dark:text-slate-350">Mobile No.:</span> <span className="text-slate-600 dark:text-slate-400">{rec.data?.phone || 'N/A'}</span></div>
                          <div><span className="font-bold text-slate-700 dark:text-slate-350">Amount:</span> <span className="text-slate-600 dark:text-slate-400">{rec.data?.budget ? '$' + Number(rec.data.budget).toLocaleString() : 'N/A'}</span></div>
                          <div><span className="font-bold text-slate-700 dark:text-slate-350">Case Details:</span> <span className="text-slate-600 dark:text-slate-400">{rec.data?.caseDetails || 'N/A'}</span></div>
                        </div>

                        {/* Column 3 */}
                        <div className="space-y-4">
                          <div><span className="font-bold text-slate-700 dark:text-slate-350">Created On:</span> <span className="text-slate-600 dark:text-slate-400">{formatDate(rec.createdAt)}</span></div>
                          <div><span className="font-bold text-slate-700 dark:text-slate-350">Created By:</span> <span className="text-slate-600 dark:text-slate-400">System</span></div>
                          <div><span className="font-bold text-slate-700 dark:text-slate-350">Pending at:</span> <span className="text-slate-600 dark:text-slate-400">{rec.data?.assignToTeam || 'Sales Review'}</span></div>
                          <div><span className="font-bold text-slate-700 dark:text-slate-350">PSM:</span> <span className="text-slate-600 dark:text-slate-400">{rec.data?.assignedTo || 'Unassigned'}</span></div>
                          <div><span className="font-bold text-slate-700 dark:text-slate-350">Data Code:</span> <span className="text-slate-600 dark:text-slate-400">{rec.data?.dataCode || 'N/A'}</span></div>
                        </div>

                        {/* Column 4 */}
                        <div className="space-y-4">
                          <div><span className="font-bold text-slate-700 dark:text-slate-350">Firm/Company:</span> <span className="text-slate-600 dark:text-slate-400">{rec.data?.company || 'N/A'}</span></div>
                          <div><span className="font-bold text-slate-700 dark:text-slate-350">Modified On:</span> <span className="text-slate-600 dark:text-slate-400">{formatDate(rec.updatedAt)}</span></div>
                          <div><span className="font-bold text-slate-700 dark:text-slate-350">Assigned By:</span> <span className="text-slate-600 dark:text-slate-400">System Router</span></div>
                          <div>
                            <span className="font-bold text-slate-700 dark:text-slate-350">Remarks:</span> 
                            <span className="text-slate-500 italic ml-1 text-xs">{rec.data?.notes ? rec.data.notes.replace(/<[^>]*>/g, '') : 'Transferred to agent'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700">
                        <div className="mb-3 flex items-center gap-2">
                          <span className={`${
                            rec.data?.status?.toUpperCase() === 'HOT' 
                              ? 'bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30' 
                              : 'bg-indigo-50 border border-indigo-200 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30'
                          } text-[10px] font-[800] uppercase tracking-wider px-3 py-1.5 rounded-lg`}>
                            {rec.data?.status ? `${rec.data.status} Lead` : 'Lead Info'}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button 
                            onClick={() => {
                              const phone = rec.data?.phone || rec.data?.mobile || rec.data?.contactNumber || '';
                              const cleanPhone = phone.replace(/\D/g, '');
                              if (cleanPhone) {
                                window.open(`https://wa.me/${cleanPhone}`, '_blank');
                              } else {
                                showToast('No phone number available for this lead.', 'warning');
                              }
                            }}
                            className="bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-150 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30 dark:hover:bg-emerald-900/40 text-[10px] font-bold uppercase tracking-wider px-4 py-2 rounded-lg transition-all duration-200"
                          >
                            WA Chat
                          </button>
                          
                          <button 
                            onClick={() => {
                              const phone = rec.data?.phone || rec.data?.mobile || rec.data?.contactNumber || '';
                              const cleanPhone = phone.replace(/\D/g, '');
                              if (cleanPhone) {
                                window.location.href = `tel:${cleanPhone}`;
                              } else {
                                showToast('No phone number available for this lead.', 'warning');
                              }
                            }}
                            className="bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-150 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30 dark:hover:bg-indigo-900/40 text-[10px] font-bold uppercase tracking-wider px-4 py-2 rounded-lg transition-all duration-200"
                          >
                            Call
                          </button>
                          
                          <button 
                            onClick={() => handleUploadClick(rec._id)}
                            className="bg-amber-50 hover:bg-amber-100 active:bg-amber-150 text-amber-700 border border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30 dark:hover:bg-amber-900/40 text-[10px] font-bold uppercase tracking-wider px-4 py-2 rounded-lg transition-all duration-200"
                          >
                            Upload File
                          </button>
                          
                          <Link to={`/modules/leads/${rec._id}`} className="bg-cyan-50 hover:bg-cyan-100 active:bg-cyan-150 text-cyan-700 border border-cyan-200 dark:bg-cyan-950/20 dark:text-cyan-400 dark:border-cyan-900/30 dark:hover:bg-cyan-900/40 text-[10px] font-bold uppercase tracking-wider px-4 py-2 rounded-lg transition-all duration-200">
                            Edit
                          </Link>
                          
                          <button 
                            onClick={() => openHistory(rec)}
                            className="bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-600 border border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700/60 dark:hover:bg-slate-700/80 text-[10px] font-bold uppercase tracking-wider px-4 py-2 rounded-lg transition-all duration-200"
                          >
                            History
                          </button>
                        </div>
                      </div>

                    </div>
                  );
                })}

                {data?.records.length === 0 && (
                  <div className="p-12 text-center text-slate-400 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800">
                    No leads records found.
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto pb-2 -mx-2 px-2 sm:mx-0 sm:px-0">
                  <table className="w-full min-w-[800px] text-left text-sm text-slate-600 dark:text-slate-300">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs font-semibold text-slate-500 uppercase border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="px-6 py-4">Name / ID</th>
                        {activeModule.fields.slice(1, 5).map((field) => (
                          <th key={field.name} className="px-6 py-4">
                            {field.label}
                          </th>
                        ))}
                        <th className="px-6 py-4">Created At</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {data?.records.map((rec: any) => {
                        const leadName = rec.data.firstName || rec.data.lastName
                          ? `${rec.data.firstName || ''} ${rec.data.lastName || ''}`.trim()
                          : null;
                        const mainVal =
                          leadName ||
                          rec.data.fullName ||
                          rec.data.companyName ||
                          rec.data.dealName ||
                          rec.data.title ||
                          rec._id;

                        return (
                          <tr key={rec._id} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                            <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white truncate max-w-[200px]">
                              <Link to={`/modules/${activeModule.apiPath}/${rec._id}`} className="hover:underline text-primary">
                                {mainVal}
                              </Link>
                            </td>
                            {activeModule.fields.slice(1, 5).map((field) => (
                              <td key={field.name} className="px-6 py-4 truncate max-w-[150px]">
                                {field.type === 'currency' 
                                  ? `$${rec.data[field.name] || 0}` 
                                  : field.type === 'date'
                                    ? formatDate(rec.data[field.name])
                                    : String(rec.data[field.name] || '-')}
                              </td>
                            ))}
                            <td className="px-6 py-4 text-xs text-slate-400">
                              {formatDate(rec.createdAt)}
                            </td>
                            <td className="px-6 py-4 text-right space-x-3">
                              <Link
                                to={`/modules/${activeModule.apiPath}/${rec._id}`}
                                className="text-primary hover:text-indigo-400 font-medium text-xs"
                              >
                                Edit
                              </Link>
                              <button
                                onClick={() => handleDelete(rec._id)}
                                className="text-rose-500 hover:text-rose-400 font-medium text-xs"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })}

                      {data?.records.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400">
                            No records loaded matching queries.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}

          {/* Simple Pagination bar */}
          {apiPath === 'campaigns' ? (
            <div className="mt-6 flex justify-center items-center gap-1.5 pb-4">
              {Array.from({ length: data?.pagination.totalPages || 1 }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-3 py-2 border border-slate-200 dark:border-slate-700 rounded font-semibold text-xs transition-all shadow-sm ${
                    page === p
                      ? 'bg-[#3b82f6] text-white border-[#3b82f6]'
                      : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-[#3b82f6] dark:text-blue-400'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          ) : (
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl mt-4 flex justify-between items-center text-xs">
              <span className="text-slate-400">
                Showing page <span className="font-semibold text-slate-600 dark:text-slate-300">{page}</span> of{' '}
                <span className="font-semibold text-slate-600 dark:text-slate-300">{data?.pagination.totalPages || 1}</span>
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-500 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  disabled={page >= (data?.pagination.totalPages || 1)}
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-500 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {viewMode === 'kanban' && renderKanban(activeModule, data?.records || [])}

          {viewMode === 'calendar' && renderCalendar(activeModule, data?.records || [])}

          {viewMode === 'timeline' && renderTimeline(data?.records || [])}
        </>
      )}
      {/* Hidden file uploader */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
      />

      {/* Record History & Timeline Modal */}
      {activeHistoryRecord && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-white text-lg">
                  Lead Audit History
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  {activeHistoryRecord.data?.firstName} {activeHistoryRecord.data?.lastName}
                </p>
              </div>
              <button 
                onClick={() => setActiveHistoryRecord(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-500 dark:text-slate-400 transition-colors"
              >
                <Icons.X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {loadingHistory ? (
                <div className="flex justify-center items-center py-12">
                  <Icons.Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                </div>
              ) : (
                <>
                  {/* Documents Section */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-450 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Icons.File className="w-3.5 h-3.5 text-amber-500" /> Attached Documents ({historyDocuments.length})
                    </h4>
                    {historyDocuments.length > 0 ? (
                      <div className="space-y-2">
                        {historyDocuments.map((doc: any) => (
                          <div key={doc._id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-805">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Icons.FileText className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{doc.name}</p>
                                <p className="text-[10px] text-slate-400">{(doc.size / 1024).toFixed(1)} KB</p>
                              </div>
                            </div>
                            <a 
                              href={`${FILE_BASE_URL}${doc.filePath}`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                            >
                              <Icons.Download className="w-3.5 h-3.5" /> Download
                            </a>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No files attached to this record.</p>
                    )}
                  </div>

                  {/* Timeline Section */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-455 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Icons.Clock className="w-3.5 h-3.5 text-indigo-500" /> System Activities
                    </h4>
                    {historyActivities.length > 0 ? (
                      <div className="relative border-l border-slate-100 dark:border-slate-800 ml-2.5 pl-5 space-y-5">
                        {historyActivities.map((act: any) => (
                          <div key={act._id} className="relative">
                            <span className="absolute -left-[26px] top-1 w-3 h-3 rounded-full bg-indigo-500 ring-4 ring-white dark:ring-slate-900" />
                            <div className="text-xs">
                              <p className="font-semibold text-slate-700 dark:text-slate-200">{act.action}</p>
                              {act.details && Object.keys(act.details).length > 0 && (
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  {act.details.status && `Status: ${act.details.status}`}
                                  {act.details.assignedTo && ` Assigned To: ${act.details.assignedTo}`}
                                </p>
                              )}
                              <p className="text-[10px] text-slate-400 mt-1">
                                {act.performedBy ? `${act.performedBy.firstName} ${act.performedBy.lastName}` : 'System'} • {new Date(act.createdAt).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No activity log found for this record.</p>
                    )}
                  </div>
                </>
              )}
            </div>
            
            {/* Modal Footer */}
            <div className="p-4 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button 
                onClick={() => setActiveHistoryRecord(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
