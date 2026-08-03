import { exportLeadReportXLSX } from './exportLeadReportXLSX';

export interface CampaignExportLead {
  _id?: string;
  data?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
  assignedToName?: string;
}

export const exportCampaignCSV = (campaignName: string, leads: any[]) => {
  exportLeadReportXLSX(leads, campaignName);
};
