import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useToastStore } from '../store/toastStore';
import * as Icons from 'lucide-react';

interface CampaignStats {
  campaignName: string;
  totalAssigned: number;
  dialed: number;
  yetToDial: number;
  createdAt: string;
  dailyTarget: number;
}

interface LeadRecord {
  _id: string;
  data: Record<string, any>;
  createdAt: string;
}

interface LeadState {
  status?: string;
  remarks?: string;
  caseDetails?: string;
}

const CAMPAIGN_STATUSES = [
  'Yet To Call',
  'Hot Lead',
  'Warm Lead',
  'Not Intested',
  'Call Rejected',
  'Not Connected',
  'Cool Lead',
  'No Answer',
  'Wrong Number',
  'Not Exists',
  'Repeated Number',
  'No Business',
  'Not Reachable'
];

export default function MyCampaign() {
  const navigate = useNavigate();
  const { showToast } = useToastStore();
  const [campaigns, setCampaigns] = useState<CampaignStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCampaign, setActiveCampaign] = useState<CampaignStats | null>(null);
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [statuses, setStatuses] = useState<string[]>([]);
  
  // Track inputs for each lead ID
  const [leadStates, setLeadStates] = useState<Record<string, LeadState>>({});

  // Fetch campaigns
  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const res = await api.get('/records/campaigns/my-campaigns');
      setCampaigns(res.data.campaigns || []);
    } catch (err: any) {
      console.error(err);
      showToast('Failed to load campaigns.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch lead details for active campaign
  const fetchLeadDetails = async (campaignName: string) => {
    try {
      setLoadingLeads(true);
      const res = await api.get(`/records/campaigns/my-campaigns/details/${encodeURIComponent(campaignName)}`);
      setLeads(res.data.leads || []);
      
      // Initialize states
      const initialStates: Record<string, LeadState> = {};
      (res.data.leads || []).forEach((lead: LeadRecord) => {
        initialStates[lead._id] = {
          status: lead.data?.status || 'Yet To Call',
          remarks: lead.data?.notes || '',
          caseDetails: lead.data?.caseDetails || ''
        };
      });
      setLeadStates(initialStates);
    } catch (err: any) {
      console.error(err);
      showToast('Failed to load campaign leads.', 'error');
    } finally {
      setLoadingLeads(false);
    }
  };

  // Fetch status dropdown options
  useEffect(() => {
    fetchCampaigns();
    api.get('/statuses')
      .then(res => setStatuses(res.data.map((s: any) => s.name)))
      .catch(err => console.error('Failed to load statuses', err));
  }, []);

  const handleViewDetails = (campaign: CampaignStats) => {
    setActiveCampaign(campaign);
    fetchLeadDetails(campaign.campaignName);
  };

  const handleBack = () => {
    setActiveCampaign(null);
    setLeads([]);
    fetchCampaigns();
  };

  const handleFieldChange = (leadId: string, field: keyof LeadState, value: string) => {
    setLeadStates(prev => ({
      ...prev,
      [leadId]: {
        ...prev[leadId],
        [field]: value
      }
    }));
  };

  const handleStatusSelect = async (lead: LeadRecord, newStatus: string) => {
    // 1. Update state first
    setLeadStates(prev => ({
      ...prev,
      [lead._id]: {
        ...prev[lead._id],
        status: newStatus
      }
    }));

    // 2. Prepare payload for saving
    const currentRemarks = leadStates[lead._id]?.remarks || '';
    const currentCaseDetails = leadStates[lead._id]?.caseDetails || '';

    try {
      const payload = {
        status: newStatus,
        notes: currentRemarks,
        caseDetails: currentCaseDetails
      };

      // 3. Save to database immediately
      await api.put(`/records/leads/${lead._id}`, payload);
      showToast('Status updated successfully!', 'success');

      // 4. Refresh stats in background
      const res = await api.get('/records/campaigns/my-campaigns');
      const updatedCampaigns: CampaignStats[] = res.data.campaigns || [];
      setCampaigns(updatedCampaigns);
      if (activeCampaign) {
        const found = updatedCampaigns.find(c => c.campaignName === activeCampaign.campaignName);
        if (found) {
          setActiveCampaign(found);
        }
      }

      // 5. If "Hot Lead" or "Warm Lead" selected, navigate to Create Lead page with pre-populated data
      if (newStatus === 'Hot Lead' || newStatus === 'Warm Lead') {
        const passedStatus = newStatus === 'Hot Lead' ? 'Hot' : 'Warm';
        const phoneVal = lead.data?.phone || lead.data?.mobile || lead.data?.name_contact_num || '';
        
        navigate('/modules/leads/new', {
          state: {
            ...lead.data,
            firstName: lead.data?.firstName || lead.data?.costomer || lead.data?.customer || '',
            lastName: lead.data?.lastName || '',
            phone: phoneVal,
            company: lead.data?.company || lead.data?.firm_name || '',
            city: lead.data?.city || lead.data?.location || '',
            dataCode: lead.data?.dataCode || lead.data?.data_code || '',
            status: passedStatus,
            notes: currentRemarks,
            caseDetails: currentCaseDetails,
            source: activeCampaign?.campaignName || lead.data?.source || ''
          }
        });
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.error || 'Failed to update status.', 'error');
    }
  };

  const handleWhatsAppChat = (lead: LeadRecord) => {
    const phone = lead.data?.phone || lead.data?.mobile;
    if (!phone) {
      showToast('No phone number available for this lead.', 'warning');
      return;
    }
    const cleanPhone = String(phone).replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  };

  const handleInitiateCall = (lead: LeadRecord) => {
    const phone = lead.data?.phone || lead.data?.mobile;
    if (!phone) {
      showToast('No phone number available for this lead.', 'warning');
      return;
    }
    const leadName = `${lead.data?.firstName || ''} ${lead.data?.lastName || ''}`.trim() || 'Lead';
    showToast(`Initiating call to ${leadName}...`, 'info');
  };

  const handleSaveLead = async (leadId: string) => {
    try {
      const state = leadStates[leadId];
      if (!state) {
        showToast('No changes to save.', 'warning');
        return;
      }

      const payload: Record<string, any> = {
        status: state.status,
        notes: state.remarks,
        caseDetails: state.caseDetails
      };

      await api.put(`/records/leads/${leadId}`, payload);
      showToast('Lead details updated successfully!', 'success');

      // Refresh list in background to maintain sync
      const res = await api.get('/records/campaigns/my-campaigns');
      const updatedCampaigns: CampaignStats[] = res.data.campaigns || [];
      setCampaigns(updatedCampaigns);
      
      if (activeCampaign) {
        const found = updatedCampaigns.find(c => c.campaignName === activeCampaign.campaignName);
        if (found) {
          setActiveCampaign(found);
        }
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.error || 'Failed to save lead details.', 'error');
    }
  };

  if (loading && campaigns.length === 0) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto text-left p-4 sm:p-6">
      
      {!activeCampaign ? (
        // CAMPAIGNS CARDS VIEW
        <div className="space-y-6">
          {/* Main Page Header */}
          <div className="bg-white border border-slate-200/80 p-6 sm:p-7 rounded-2xl shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
              <div className="flex items-center gap-4">
                <div className="p-3.5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl flex-shrink-0">
                  <Icons.Megaphone className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 mb-1">
                    <span className="text-[10px] font-extrabold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      Telecalling Drive
                    </span>
                    <span className="text-[11px] font-bold text-slate-400">
                      {campaigns.length} Active {campaigns.length === 1 ? 'Campaign' : 'Campaigns'}
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    My Call Campaigns
                  </h1>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Select a campaign below to initiate calling, log remarks, update lead status, or WhatsApp clients.
                  </p>
                </div>
              </div>

              {/* Stats pill */}
              {campaigns.length > 0 && (
                <div className="flex items-center gap-4 bg-slate-50 border border-slate-200/80 rounded-2xl px-5 py-3 flex-shrink-0">
                  <div className="text-center">
                    <span className="text-2xl font-black text-[#17223B] leading-none block">{campaigns.length}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Campaigns</span>
                  </div>
                  <div className="w-px h-8 bg-slate-200" />
                  <div className="text-center">
                    <span className="text-2xl font-black text-emerald-600 leading-none block">{campaigns.reduce((sum, c) => sum + c.totalAssigned, 0)}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Leads</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {campaigns.length === 0 ? (
            <div className="bg-white dark:bg-[#1a1f2c] rounded-3xl border border-slate-100 dark:border-slate-800 p-12 text-center text-slate-500 dark:text-slate-400">
              <Icons.Megaphone className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 mb-3 animate-pulse" />
              <p className="font-bold">No campaigns assigned to you yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {campaigns.map((campaign) => {
                const pct = campaign.totalAssigned > 0 
                  ? Math.round((campaign.dialed / campaign.totalAssigned) * 100)
                  : 0;

                return (
                  <div 
                    key={campaign.campaignName}
                    className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between group hover:shadow-md transition-all duration-200 space-y-4"
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 dark:text-indigo-400 px-2 py-0.5 rounded-md uppercase tracking-wider">
                          Campaign
                        </span>
                        <h3 className="text-base font-extrabold text-slate-900 dark:text-white truncate uppercase mt-1">
                          {campaign.campaignName}
                        </h3>
                      </div>
                      <div className="px-3 py-1.5 bg-[#17223B] text-white rounded-xl text-center flex-shrink-0">
                        <span className="text-base font-black leading-none block">{campaign.totalAssigned}</span>
                        <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wider">Assigned</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between text-xs font-semibold text-slate-500">
                        <span>Created:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{new Date(campaign.createdAt).toLocaleDateString('en-GB')}</span>
                      </div>

                      {/* Stats row */}
                      <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-900 p-2.5 rounded-xl text-center text-xs font-semibold">
                        <div>
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-bold">Dialed</p>
                          <p className="font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">{campaign.dialed}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-amber-600 dark:text-amber-400 uppercase font-bold">Yet To Dial</p>
                          <p className="font-extrabold text-amber-600 dark:text-amber-400 mt-0.5">{campaign.yetToDial}</p>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-bold">
                          <span className="text-slate-400 uppercase">Progress</span>
                          <span className="text-indigo-600 dark:text-indigo-400">{pct}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button 
                        onClick={() => handleViewDetails(campaign)}
                        className="w-full py-2 px-4 bg-[#17223B] hover:bg-[#223050] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider active:scale-95"
                      >
                        <Icons.Eye className="w-3.5 h-3.5" />
                        View Details
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        // DETAILS VIEW
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#111827] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div className="flex items-center gap-3.5">
              <button 
                onClick={handleBack} 
                className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all shadow-xs cursor-pointer"
                title="Back to Campaigns"
              >
                <Icons.ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 dark:text-indigo-400 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    Call Campaign
                  </span>
                  <span className="text-xs font-semibold text-slate-400">
                    Created {new Date(activeCampaign.createdAt).toLocaleDateString('en-GB')}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight mt-0.5">
                  {activeCampaign.campaignName}
                </h2>
              </div>
            </div>

            {/* Campaign Overall Progress */}
            {(() => {
              const pct = activeCampaign.totalAssigned > 0 
                ? Math.round((activeCampaign.dialed / activeCampaign.totalAssigned) * 100)
                : 0;
              return (
                <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl min-w-[200px]">
                  <div className="flex-1">
                    <div className="flex justify-between text-[11px] font-bold mb-1">
                      <span className="text-slate-500 uppercase tracking-wider">Progress</span>
                      <span className="text-indigo-600 dark:text-indigo-400">{pct}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-600 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* ACTIVE CAMPAIGN METRICS GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-[#111827] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <Icons.Layers className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Allocated</p>
                <p className="text-xl font-black text-slate-900 dark:text-white">{activeCampaign.totalAssigned}</p>
              </div>
            </div>

            <div className="bg-white dark:bg-[#111827] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <Icons.PhoneCall className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Dialed</p>
                <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{activeCampaign.dialed}</p>
              </div>
            </div>

            <div className="bg-white dark:bg-[#111827] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl">
                <Icons.Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Yet To Dial</p>
                <p className="text-xl font-black text-amber-600 dark:text-amber-400">{activeCampaign.yetToDial}</p>
              </div>
            </div>
          </div>

          {loadingLeads ? (
            <div className="flex items-center justify-center h-[40vh]">
              <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : leads.length === 0 ? (
            <div className="bg-white dark:bg-[#1a1f2c] rounded-3xl border border-slate-100 dark:border-slate-800 p-12 text-center text-slate-500 dark:text-slate-400">
              <p className="font-bold">No leads found in this campaign.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {leads.map((lead) => (
                <div 
                  key={lead._id}
                  className="bg-white dark:bg-[#111827] rounded-2xl border-l-[4px] border-l-[#17223B] dark:border-l-indigo-500 border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs hover:shadow-md transition-all duration-200 space-y-4"
                >
                  {/* Lead Row 1 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-center">
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Allocated No.</span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">**********</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Lead Name</span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {`${lead.data?.firstName || ''} ${lead.data?.lastName || ''}`.trim() || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">FirmName</span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate block">
                        {lead.data?.company || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status</span>
                      <select 
                        value={leadStates[lead._id]?.status || 'Yet To Call'}
                        onChange={(e) => handleStatusSelect(lead, e.target.value)}
                        className="w-full text-xs font-bold bg-slate-50/80 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 dark:focus:border-indigo-400 text-slate-800 dark:text-white shadow-xs transition-all cursor-pointer"
                      >
                        {CAMPAIGN_STATUSES.map(statusOpt => (
                          <option key={statusOpt} value={statusOpt}>{statusOpt}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Lead Row 2 */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="md:col-span-1">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Remarks:</label>
                      <textarea 
                        value={leadStates[lead._id]?.remarks ?? ''}
                        onChange={(e) => handleFieldChange(lead._id, 'remarks', e.target.value)}
                        rows={2}
                        className="w-full text-xs bg-slate-50/80 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 dark:focus:border-indigo-400 text-slate-850 dark:text-white resize-none shadow-xs transition-all"
                      />
                    </div>
                    
                    <div className="md:col-span-1">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Case Details:</label>
                      <textarea 
                        placeholder="case Details"
                        value={leadStates[lead._id]?.caseDetails ?? ''}
                        onChange={(e) => handleFieldChange(lead._id, 'caseDetails', e.target.value)}
                        rows={2}
                        className="w-full text-xs bg-slate-50/80 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 dark:focus:border-indigo-400 text-slate-850 dark:text-white resize-none shadow-xs transition-all"
                      />
                    </div>

                    <div className="md:col-span-1 flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Location </span>
                        <span className="text-xs font-bold text-slate-900 dark:text-white uppercase ml-1">
                          {lead.data?.city || lead.data?.location || 'N/A'}
                        </span>
                      </div>
                      
                      <div className="flex gap-1.5 mt-2 flex-wrap sm:flex-nowrap">
                        <button 
                          onClick={() => handleWhatsAppChat(lead)}
                          className="flex-1 py-2 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 dark:text-emerald-300 dark:border-emerald-800 text-[11px] font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                          title="Open WhatsApp Chat"
                        >
                          <Icons.MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          WA Chat
                        </button>
                        <button 
                          onClick={() => handleInitiateCall(lead)}
                          className="flex-1 py-2 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/80 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 dark:text-blue-300 dark:border-blue-800 text-[11px] font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                          title="Initiate Call"
                        >
                          <Icons.PhoneCall className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          Call
                        </button>
                        <button 
                          onClick={() => handleSaveLead(lead._id)}
                          className="flex-1 py-2 px-2 bg-[#17223B] hover:bg-[#223050] text-white text-[11px] font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                          title="Save Lead Update"
                        >
                          <Icons.Save className="w-3.5 h-3.5 text-white" />
                          Save
                        </button>
                        <button 
                          onClick={() => navigate(`/modules/leads/${lead._id}`)}
                          className="flex-1 py-2 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700 text-[11px] font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                          title="Edit Lead Details"
                        >
                          <Icons.Edit className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                          Edit
                        </button>
                      </div>
                    </div>

                    <div className="md:col-span-1 flex items-start">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Data Code </span>
                        <span className="text-xs font-bold text-slate-900 dark:text-white ml-1">
                          {lead.data?.dataCode || lead.data?.source || 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
