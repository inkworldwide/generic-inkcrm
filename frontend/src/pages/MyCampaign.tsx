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
          <div className="flex items-center justify-between">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white uppercase">
              View Campaign Details
            </h1>
          </div>

          {campaigns.length === 0 ? (
            <div className="bg-white dark:bg-[#1a1f2c] rounded-3xl border border-slate-100 dark:border-slate-800 p-12 text-center text-slate-500 dark:text-slate-400">
              <Icons.Megaphone className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 mb-3 animate-pulse" />
              <p className="font-bold">No campaigns assigned to you yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {campaigns.map((campaign) => (
                <div 
                  key={campaign.campaignName}
                  className="bg-white dark:bg-[#1a1f2c] rounded-3xl border border-slate-150 dark:border-slate-800/80 p-5 shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-all duration-300"
                >
                  <div className="flex items-stretch rounded-xl overflow-hidden bg-sky-600 text-white mb-4 shadow-sm">
                    <div className="flex-1 px-4 py-3 font-bold text-sm tracking-wide border-r border-sky-500/30 flex items-center min-w-0">
                      <span className="truncate uppercase">{campaign.campaignName}</span>
                    </div>
                    <div className="px-4 py-2 bg-sky-700 flex flex-col items-center justify-center min-w-[110px]">
                      <span className="text-lg font-black leading-none">{campaign.totalAssigned}</span>
                      <span className="text-[9px] font-bold tracking-wider text-sky-200 uppercase mt-1">TOTAL ASSIGNED</span>
                    </div>
                  </div>

                  <div className="text-red-500 text-xs font-bold mb-4 tracking-wide uppercase">
                    CREATED ON : {new Date(campaign.createdAt).toLocaleDateString('en-GB')}
                  </div>

                  <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300 font-semibold mb-6">
                    <div>Daily Target : <span className="font-bold text-slate-850 dark:text-white">{campaign.dailyTarget}</span></div>
                    <div>Dailed : <span className="font-bold text-slate-850 dark:text-white">{campaign.dialed}</span></div>
                    <div>Yet To Dial : <span className="font-bold text-slate-850 dark:text-white">{campaign.yetToDial}</span></div>
                  </div>

                  <div className="flex justify-end mt-auto">
                    <button 
                      onClick={() => handleViewDetails(campaign)}
                      className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-extrabold rounded-xl shadow-sm hover:shadow transition-all duration-200 uppercase tracking-wider"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        // DETAILS VIEW
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <button 
              onClick={handleBack} 
              className="p-2.5 rounded-2xl bg-white dark:bg-[#1a1f2c] border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-600 dark:text-slate-300 transition-colors shadow-sm"
            >
              <Icons.ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white uppercase">
              Call Campaign Details
            </h2>
          </div>

          {/* ACTIVE CAMPAIGN STATISTICS */}
          <div className="bg-slate-100 dark:bg-slate-850/80 p-5 rounded-3xl border border-slate-200/50 dark:border-slate-800/50">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6 text-sm text-slate-700 dark:text-slate-250 font-bold uppercase">
              <div><span className="font-black text-slate-900 dark:text-white">Call Campaign Name:</span> {activeCampaign.campaignName}</div>
              <div><span className="font-black text-slate-900 dark:text-white">Campaign Date:</span> {new Date(activeCampaign.createdAt).toLocaleDateString('en-GB')}</div>
              <div><span className="font-black text-slate-900 dark:text-white">Total Allocated Numbers:</span> {activeCampaign.totalAssigned}</div>
              <div><span className="font-black text-slate-900 dark:text-white">TotalDialedNumbers:</span> {activeCampaign.dialed}</div>
              <div><span className="font-black text-slate-900 dark:text-white">TotalYetDialed:</span> {activeCampaign.yetToDial}</div>
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
            <div className="space-y-6">
              {leads.map((lead) => (
                <div 
                  key={lead._id}
                  className="bg-white dark:bg-[#1a1f2c] rounded-3xl border-l-[6px] border-l-emerald-500 border border-slate-150 dark:border-slate-800/80 p-6 shadow-sm space-y-5 hover:shadow-md transition-all duration-355"
                >
                  {/* Lead Row 1 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-center">
                    <div>
                      <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Allocated No.</span>
                      <span className="text-sm font-bold text-slate-800 dark:text-white">**********</span>
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Lead Name</span>
                      <span className="text-sm font-bold text-slate-800 dark:text-white">
                        {`${lead.data?.firstName || ''} ${lead.data?.lastName || ''}`.trim() || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">FirmName</span>
                      <span className="text-sm font-bold text-slate-800 dark:text-white truncate block">
                        {lead.data?.company || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Status</span>
                      <select 
                        value={leadStates[lead._id]?.status || 'Yet To Call'}
                        onChange={(e) => handleStatusSelect(lead, e.target.value)}
                        className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700 dark:text-white shadow-sm"
                      >
                        {CAMPAIGN_STATUSES.map(statusOpt => (
                          <option key={statusOpt} value={statusOpt}>{statusOpt}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Lead Row 2 */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                    <div className="md:col-span-1">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Remarks:</label>
                      <textarea 
                        value={leadStates[lead._id]?.remarks ?? ''}
                        onChange={(e) => handleFieldChange(lead._id, 'remarks', e.target.value)}
                        rows={2}
                        className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-850 dark:text-white resize-none shadow-sm"
                      />
                    </div>
                    
                    <div className="md:col-span-1">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Case Details:</label>
                      <textarea 
                        placeholder="case Details"
                        value={leadStates[lead._id]?.caseDetails ?? ''}
                        onChange={(e) => handleFieldChange(lead._id, 'caseDetails', e.target.value)}
                        rows={2}
                        className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-850 dark:text-white resize-none shadow-sm"
                      />
                    </div>

                    <div className="md:col-span-1 flex flex-col justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Location </span>
                        <span className="text-xs font-bold text-slate-800 dark:text-white uppercase ml-1">
                          {lead.data?.city || lead.data?.location || 'N/A'}
                        </span>
                      </div>
                      
                      <div className="flex gap-2 mt-2">
                        <button 
                          onClick={() => handleWhatsAppChat(lead)}
                          className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-extrabold rounded-xl shadow-sm transition-colors duration-150 uppercase"
                        >
                          WA Chat
                        </button>
                        <button 
                          onClick={() => handleInitiateCall(lead)}
                          className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl shadow-sm transition-colors duration-150 uppercase"
                        >
                          Call
                        </button>
                        <button 
                          onClick={() => handleSaveLead(lead._id)}
                          className="flex-1 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold rounded-xl shadow-sm transition-colors duration-150 uppercase"
                        >
                          Save
                        </button>
                      </div>
                    </div>

                    <div className="md:col-span-1 flex items-start">
                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Data Code </span>
                        <span className="text-xs font-bold text-slate-800 dark:text-white ml-1">
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
