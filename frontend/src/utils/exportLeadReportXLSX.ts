import * as XLSX from 'xlsx';

export const exportLeadReportXLSX = (leads: any[], fileNamePrefix: string = 'Lead_Report') => {
  const headers = [
    'Sl.No.',
    'Createddate',
    'Customer Name',
    'Mobile No',
    'Firm / Company',
    'Turnover / Salary',
    'Loan Amount',
    'present address',
    'City',
    'Loan Product',
    'Bank Names',
    'PSM',
    'Status',
    'Remarks',
    'Source',
    'Assigned To',
    'FollowUp Date',
    'Modified Date'
  ];

  const formatDateShort = (dateStr?: any) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = String(d.getDate()).padStart(2, '0');
    const month = months[d.getMonth()];
    const year = String(d.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
  };

  const formatDateTimeFull = (dateStr?: any) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).replace(',', '');
  };

  const dataRows = (leads || []).map((lead: any, idx: number) => {
    const data = lead.data || lead;
    const slNo = idx + 1;
    const createdDate = formatDateShort(lead.createdAt || data.createdAt || data.createddate);

    const customerName = String(
      `${data.firstName || ''} ${data.lastName || ''}`.trim() ||
      data.customerName ||
      data.fullName ||
      data.customer ||
      data.costomer ||
      data.name ||
      'N/A'
    ).trim();

    const mobileNo = String(data.phone || data.mobile || data.contactNum || data.contact_num || data.mobileNo || 'N/A').trim();
    const firmCompany = String(data.company || data.firmName || data.firm_name || data.firm || data.firmCompany || '').trim();
    const turnoverSalary = String(data.turnover || data.salary || data.income || data.turnoverSalary || '').trim();
    const loanAmount = String(data.loanAmount || data.amount || data.requiredLoan || '').trim();
    const presentAddress = String(data.presentAddress || data.address || data.locationAddress || data.present_address || '').trim();
    const city = String(data.city || data.location || '').trim();
    const loanProduct = String(data.loanProduct || data.loanType || data.product || data.serviceType || '').trim();
    const bankNames = String(data.bankNames || data.bank || data.preferredBank || '').trim();
    const psm = String(data.psm || data.psmName || data.psm_name || '').trim();
    const status = String(data.status || 'New').trim();
    const remarks = String(data.remarks || data.notes || '').trim();
    const source = String(data.source || data.campaign || data.campaignName || data.campaign_name || '').trim();

    let assignedTo = 'Unassigned';
    if (data.assignedTo) {
      if (typeof data.assignedTo === 'object') {
        assignedTo = `${data.assignedTo.firstName || ''} ${data.assignedTo.lastName || ''}`.trim() || data.assignedTo.name || data.assignedTo.email || 'Assigned';
      } else {
        assignedTo = String(data.assignedTo);
      }
    } else if (lead.assignedToUser) {
      assignedTo = `${lead.assignedToUser.firstName || ''} ${lead.assignedToUser.lastName || ''}`.trim();
    } else if (lead.assignedToName) {
      assignedTo = String(lead.assignedToName);
    }

    const followUpDate = formatDateTimeFull(data.followUpDate || data.nextFollowup || data.dialedAt || data.lastCallDate);
    const modifiedDate = formatDateTimeFull(lead.updatedAt || data.updatedAt);

    return {
      'Sl.No.': slNo,
      'Createddate': createdDate,
      'Customer Name': customerName,
      'Mobile No': mobileNo,
      'Firm / Company': firmCompany,
      'Turnover / Salary': turnoverSalary,
      'Loan Amount': loanAmount,
      'present address': presentAddress,
      'City': city,
      'Loan Product': loanProduct,
      'Bank Names': bankNames,
      'PSM': psm,
      'Status': status,
      'Remarks': remarks,
      'Source': source,
      'Assigned To': assignedTo,
      'FollowUp Date': followUpDate,
      'Modified Date': modifiedDate
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(dataRows, { header: headers });

  // Dynamic column widths calculation
  const colWidths = headers.map(header => {
    let maxLen = header.length;
    dataRows.forEach(row => {
      const val = row[header as keyof typeof row];
      if (val !== undefined && val !== null) {
        maxLen = Math.max(maxLen, String(val).length);
      }
    });
    return { wch: Math.max(maxLen + 4, 14) };
  });

  // Explicit string formatting for Mobile No to prevent scientific notation (9.6E+09)
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  const mobileColIdx = headers.indexOf('Mobile No');

  if (mobileColIdx !== -1) {
    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: mobileColIdx });
      const cell = worksheet[cellAddress];
      if (cell) {
        cell.t = 's'; // Force STRING cell type
        cell.z = '@'; // Force Text format
      }
    }
  }

  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Lead Report');

  const cleanPrefix = (fileNamePrefix || 'Lead_Report').replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
  const fileName = `${cleanPrefix}.xlsx`;

  XLSX.writeFile(workbook, fileName);
};
