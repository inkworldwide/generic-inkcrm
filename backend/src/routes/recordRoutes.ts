import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import ModuleDefinition from '../models/ModuleDefinition';
import CustomRecord from '../models/CustomRecord';
import Role from '../models/Role';
import Activity from '../models/Activity';
import AuditLog from '../models/AuditLog';
import { FormulaEvaluator } from '../services/formulaEvaluator';
import { WorkflowEngine } from '../services/workflowEngine';
import { createNotification } from '../utils/notificationHelper';
import { authenticate } from '../middleware/authMiddleware';
import { requireTenant } from '../middleware/tenantMiddleware';
import { HierarchyService } from '../utils/hierarchy';

const router = Router();

// Apply security middlewares
router.use(authenticate);
router.use(requireTenant);

// Helper: Check Role Permission dynamically
const matchModuleName = (permName: string, targetName: string): boolean => {
  const p = permName.toLowerCase();
  const t = targetName.toLowerCase();
  if (p === t) return true;
  if (p === t + 's' || t === p + 's') return true;
  if (p === t.replace(/y$/, 'ies') || t === p.replace(/y$/, 'ies')) return true;
  return false;
};

// Helper: Check Role Permission dynamically
const authorizeModuleAction = async (
  req: Request,
  res: Response,
  moduleName: string,
  action: 'create' | 'read' | 'update' | 'delete'
): Promise<{ allowed: boolean; scope: 'all' | 'own' }> => {
  try {
    const role = await Role.findById(req.user?.roleId);
    if (!role) return { allowed: false, scope: 'none' as any };

    // Super Admin bypass
    if (role.name === 'Super Admin' && role.isSystem) {
      return { allowed: true, scope: 'all' };
    }

    // Allow reading settings/metadata modules (Departments, Bank Masters, Products, etc.)
    const settingsModules = ['departments', 'bankmasters', 'bankingpartners', 'products'];
    if (action === 'read' && settingsModules.includes(moduleName.toLowerCase())) {
      return { allowed: true, scope: 'all' };
    }

    const permission = role.permissions.modules.find(
      (m) => matchModuleName(m.moduleName, moduleName)
    );

    if (!permission) return { allowed: false, scope: 'none' as any };

    if (action === 'create') {
      return { allowed: permission.create, scope: 'all' };
    }

    const scope = permission[action]; // 'all' | 'own' | 'none'
    return {
      allowed: scope !== 'none',
      scope: scope === 'none' ? ('none' as any) : scope
    };
  } catch (err) {
    return { allowed: false, scope: 'none' as any };
  }
};

// Helper: Validate dynamic record fields
const validateFields = (fields: any[], data: Record<string, any>, oldValues?: Record<string, any>) => {
  const errors: string[] = [];

  fields.forEach((field) => {
    const val = data[field.name];

    // Check required fields
    if (field.required && (val === undefined || val === null || val === '')) {
      const wasAlreadyEmpty = oldValues && (oldValues[field.name] === undefined || oldValues[field.name] === null || oldValues[field.name] === '');
      if (!wasAlreadyEmpty) {
        errors.push(`Field '${field.label}' is required.`);
        return;
      }
    }

    if (val !== undefined && val !== null && val !== '') {
      // Check data types
      if (field.type === 'number' || field.type === 'currency') {
        if (isNaN(Number(val))) {
          errors.push(`Field '${field.label}' must be a valid number.`);
        }
      }
      if (field.type === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(String(val))) {
          errors.push(`Field '${field.label}' must be a valid email address.`);
        }
      }
      if (field.regexValidation) {
        try {
          const rx = new RegExp(field.regexValidation);
          if (!rx.test(String(val))) {
            errors.push(`Field '${field.label}' does not match validation pattern.`);
          }
        } catch (e) {
          // ignore invalid regex configuration on database side
        }
      }
    }
  });

  return errors;
};

// ── Special Campaign Assignment Aggregations ─────────────────────────────────
router.get('/campaigns/allocation-stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organizationId;
    
    // Find Lead Module Definition
    const leadModule = await ModuleDefinition.findOne({ organizationId: orgId, apiPath: 'leads' });
    if (!leadModule) {
      res.status(200).json({ stats: {}, dialedStats: {} });
      return;
    }

    // Aggregate count of leads grouped by assignedTo
    const stats = await CustomRecord.aggregate([
      { $match: { organizationId: orgId, moduleId: leadModule._id } },
      { $group: { _id: '$data.assignedTo', count: { $sum: 1 } } }
    ]);

    // Aggregate count of dialed leads (any status except 'Yet To Call' counts as dialed)
    const dialedStats = await CustomRecord.aggregate([
      { 
        $match: { 
          organizationId: orgId, 
          moduleId: leadModule._id,
          'data.status': { $nin: ['Yet To Call', ''] }
        } 
      },
      { $group: { _id: '$data.assignedTo', count: { $sum: 1 } } }
    ]);

    const statsMap: Record<string, number> = {};
    stats.forEach(item => {
      if (item._id) {
        statsMap[item._id.toString()] = item.count;
      }
    });

    const dialedMap: Record<string, number> = {};
    dialedStats.forEach(item => {
      if (item._id) {
        dialedMap[item._id.toString()] = item.count;
      }
    });

    // Campaign-level stats (by campaign name) - search across ALL modules in org
    const allLeads = await CustomRecord.find({
      organizationId: orgId,
      $or: [
        { 'data.source': { $exists: true, $ne: '' } },
        { 'data.campaignName': { $exists: true, $ne: '' } },
        { 'data.campaign': { $exists: true, $ne: '' } },
        { 'data.campaign_name': { $exists: true, $ne: '' } }
      ]
    });

    const campaignAllocatedStats: Record<string, number> = {};
    const campaignDialedStats: Record<string, number> = {};

    allLeads.forEach(lead => {
      const campName = (
        lead.data?.campaignName ||
        lead.data?.source ||
        lead.data?.campaign ||
        lead.data?.campaign_name
      )?.toString().trim();

      if (campName) {
        const key = campName.toLowerCase();
        campaignAllocatedStats[key] = (campaignAllocatedStats[key] || 0) + 1;

        const status = (lead.data?.status || lead.data?.dialStatus || '').toString().trim().toLowerCase();
        if (status && status !== 'yet to call' && status !== 'not called') {
          campaignDialedStats[key] = (campaignDialedStats[key] || 0) + 1;
        }
      }
    });

    res.status(200).json({
      stats: statsMap,
      dialedStats: dialedMap,
      campaignAllocatedStats,
      campaignDialedStats
    });
  } catch (error) {
    console.error('Failed to get allocation stats:', error);
    res.status(500).json({ error: 'Failed to get allocation stats.' });
  }
});

router.post('/campaigns/bulk-assign', async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { campaignName, agentNames, leads } = req.body;

    if (!campaignName || !agentNames || !Array.isArray(agentNames) || agentNames.length === 0 || !Array.isArray(leads) || leads.length === 0) {
      res.status(400).json({ error: 'campaignName, agentNames, and leads array are required.' });
      return;
    }

    const leadModule = await ModuleDefinition.findOne({ organizationId: orgId, apiPath: 'leads' });
    if (!leadModule) {
      res.status(404).json({ error: 'Leads module definition not found.' });
      return;
    }

    // Distribute leads among agents
    const recordsToCreate: any[] = [];
    leads.forEach((lead: any, idx: number) => {
      const assignedAgent = agentNames[idx % agentNames.length];
      
      // Parse names — support multiple column name formats
      let fName = lead.firstName || lead.name || lead.costomer || lead.customer || lead.customer_name || 'Unnamed';
      let lName = lead.lastName || '';
      if (!lead.lastName && fName && fName.includes(' ')) {
        const parts = fName.split(' ');
        fName = parts[0];
        lName = parts.slice(1).join(' ');
      }

      recordsToCreate.push({
        organizationId: orgId,
        moduleId: leadModule._id,
        createdBy: userId,
        updatedBy: userId,
        data: {
          firstName: fName,
          lastName: lName,
          phone: lead.phone || lead.mobile || lead.name_contact_num || lead.contact_num || lead.contact || '',
          email: lead.email || '',
          loanType: lead.loanType || lead.lead_category || lead.category || '',
          budget: lead.budget || lead.amount || '',
          company: lead.company || lead.firm_name || lead.firmName || lead.firm || '',
          salary: lead.salary || '',
          city: lead.city || lead.location || '',
          state: lead.state || '',
          dataCode: lead.dataCode || lead.data_code || '',
          caseDetails: lead.caseDetails || lead.case_status || lead.case_details || '',
          notes: lead.notes || lead.remarks || lead.remark || '',
          status: 'Yet To Call',
          source: campaignName, // Set source as campaign name
          assignedTo: assignedAgent // Set agent name
        }
      });
    });

    // Bulk insert custom records
    const result = await CustomRecord.insertMany(recordsToCreate);

    // Create Audit Log
    await AuditLog.create({
      organizationId: orgId,
      userId: userId,
      action: 'campaign.bulk_assign',
      resource: 'leads',
      details: {
        campaignName,
        agentCount: agentNames.length,
        assignedCount: result.length
      }
    });

    // Generate notifications for assigned agents
    const agentCounts: Record<string, number> = {};
    recordsToCreate.forEach((r: any) => {
      const agent = r.data?.assignedTo;
      if (agent) {
        agentCounts[agent] = (agentCounts[agent] || 0) + 1;
      }
    });

    for (const [agentName, count] of Object.entries(agentCounts)) {
      await createNotification({
        organizationId: orgId,
        recipient: agentName,
        title: 'Campaign Leads Allocated',
        message: `${count} lead(s) from campaign '${campaignName}' were allocated to you.`,
        type: 'info',
        link: '/my-campaign'
      });
    }

    res.status(201).json({ message: `Successfully assigned ${result.length} leads to ${agentNames.length} agents.` });
  } catch (error: any) {
    console.error('Failed to bulk assign leads:', error);
    res.status(500).json({ error: error.message || 'Failed to bulk assign leads.' });
  }
});

// GET my campaigns (assigned to logged in user)
router.get('/campaigns/my-campaigns', async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    // Get the leads module
    const leadModule = await ModuleDefinition.findOne({ organizationId: orgId, apiPath: 'leads' });
    if (!leadModule) {
      res.status(200).json({ campaigns: [] });
      return;
    }

    const leadQuery: Record<string, any> = {
      organizationId: orgId,
      moduleId: leadModule._id,
      $or: [
        { 'data.source': { $exists: true, $ne: '' } },
        { 'data.campaignName': { $exists: true, $ne: '' } },
        { 'data.campaign': { $exists: true, $ne: '' } },
        { 'data.campaign_name': { $exists: true, $ne: '' } }
      ]
    };

    // Filter by reporting hierarchy
    await HierarchyService.modifyRecordQuery(leadQuery, req.user as any, orgId!);

    let leads = await CustomRecord.find(leadQuery);

    // Fallback: If hierarchy query found 0, fetch all leads for org
    if (leads.length === 0) {
      leads = await CustomRecord.find({
        organizationId: orgId,
        moduleId: leadModule._id,
        $or: [
          { 'data.source': { $exists: true, $ne: '' } },
          { 'data.campaignName': { $exists: true, $ne: '' } },
          { 'data.campaign': { $exists: true, $ne: '' } },
          { 'data.campaign_name': { $exists: true, $ne: '' } }
        ]
      });
    }

    // Group leads by campaign name
    const campaignGroups: Record<string, any[]> = {};
    leads.forEach(lead => {
      const source = (
        lead.data?.source ||
        lead.data?.campaignName ||
        lead.data?.campaign ||
        lead.data?.campaign_name
      )?.toString().trim();

      if (source) {
        if (!campaignGroups[source]) {
          campaignGroups[source] = [];
        }
        campaignGroups[source].push(lead);
      }
    });

    // Get all campaigns to match dates or other details
    const campaignModule = await ModuleDefinition.findOne({ organizationId: orgId, apiPath: 'campaigns' });
    let campaignRecords: any[] = [];
    if (campaignModule) {
      campaignRecords = await CustomRecord.find({
        organizationId: orgId,
        moduleId: campaignModule._id
      });
    }

    const result = Object.keys(campaignGroups)
      .map(campName => {
        const groupLeads = campaignGroups[campName];
        const totalAssigned = groupLeads.length;
        
        const dialed = groupLeads.filter(l => {
          const s = ((l.data?.status || l.data?.dialStatus) || '').toString().trim().toLowerCase();
          return s !== 'yet to call' && s !== 'not called' && s !== '';
        }).length;
        
        const yetToDial = totalAssigned - dialed;

        const campRecord = campaignRecords.find(c => {
          const name = (c.data?.campaignName || c.data?.name || c.data?.source || '').toString().trim();
          return name.toLowerCase() === campName.toLowerCase();
        });

        const createdAt = campRecord?.createdAt || groupLeads[0]?.createdAt || new Date();

        return {
          campaignName: campName,
          totalAssigned,
          dialed,
          yetToDial,
          createdAt,
          dailyTarget: 200
        };
      });

    res.status(200).json({ campaigns: result });
  } catch (error) {
    console.error('Failed to get my campaigns:', error);
    res.status(500).json({ error: 'Failed to retrieve campaigns.' });
  }
});

// GET my campaign details (assigned leads under campaignName)
router.get('/campaigns/my-campaigns/details/:campaignName', async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { campaignName } = req.params;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    // Get the leads module
    const leadModule = await ModuleDefinition.findOne({ organizationId: orgId, apiPath: 'leads' });
    if (!leadModule) {
      res.status(404).json({ error: 'Leads module not found.' });
      return;
    }

    const decodedCampaignName = decodeURIComponent(campaignName).trim();
    const escName = decodedCampaignName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const campaignRegex = new RegExp('^\\s*' + escName + '\\s*$', 'i');

    const matchFilter = {
      $or: [
        { 'data.source': campaignRegex },
        { 'data.campaignName': campaignRegex },
        { 'data.campaign': campaignRegex },
        { 'data.campaign_name': campaignRegex }
      ]
    };

    const query: Record<string, any> = {
      organizationId: orgId,
      moduleId: leadModule._id,
      ...matchFilter
    };

    // Filter by reporting hierarchy
    await HierarchyService.modifyRecordQuery(query, req.user as any, orgId!);

    let leads = await CustomRecord.find(query).sort({ createdAt: -1 });

    // Fallback: If hierarchy query returns 0, try org-wide lookup for this campaign
    if (leads.length === 0) {
      const fallbackQuery: Record<string, any> = {
        organizationId: orgId,
        moduleId: leadModule._id,
        ...matchFilter
      };
      leads = await CustomRecord.find(fallbackQuery).sort({ createdAt: -1 });
    }

    // Ultimate Fallback: Try across all modules in organization matching campaign name
    if (leads.length === 0) {
      leads = await CustomRecord.find({
        organizationId: orgId,
        ...matchFilter
      }).sort({ createdAt: -1 });
    }

    res.status(200).json({ leads });
  } catch (error) {
    console.error('Failed to get my campaign details:', error);
    res.status(500).json({ error: 'Failed to retrieve campaign details.' });
  }
});

// 1. LIST RECORDS FOR A DYNAMIC MODULE
router.get('/:apiPath', async (req: Request, res: Response): Promise<void> => {
  try {
    const { apiPath } = req.params;
    const { search, page = '1', limit = '50', sort } = req.query;

    const moduleDef = await ModuleDefinition.findOne({
      organizationId: req.organizationId,
      apiPath: apiPath.toLowerCase()
    });

    if (!moduleDef) {
      res.status(404).json({ error: `Module path not found: ${apiPath}` });
      return;
    }

    // RBAC validation
    const { allowed, scope } = await authorizeModuleAction(req, res, moduleDef.name, 'read');
    if (!allowed) {
      res.status(403).json({ error: `Access Denied: Read permission absent for module ${moduleDef.name}` });
      return;
    }

    // Construct Query Filters
    const query: Record<string, any> = {
      organizationId: req.organizationId,
      moduleId: moduleDef._id
    };

    if (scope === 'own') {
      query.createdBy = req.user?.id;
    }

    // Default filter for leads: exclude campaign calling statuses unless specifically queried
    if (apiPath.toLowerCase() === 'leads') {
      if (!req.query['data.status']) {
        query['data.status'] = { 
          $nin: [
            'Yet To Call', 'Not Reachable', 'Not Intested', 'Call Rejected', 
            'Not Connected', 'Cool Lead', 'No Answer', 'Wrong Number', 
            'Not Exists', 'Repeated Number', 'No Business', 'Hot Lead', 'Warm Lead'
          ] 
        };
      }
    }

    // Parse other fields for inline filters, e.g. ?data.status=Qualified
    Object.keys(req.query).forEach((q) => {
      if (q.startsWith('data.')) {
        query[q] = req.query[q];
      }
    });

    // Global Search across text fields
    if (search && typeof search === 'string') {
      const searchRegex = { $regex: search, $options: 'i' };
      const textFields = moduleDef.fields
        .filter((f) => ['text', 'email', 'phone', 'rich-text', 'url'].includes(f.type))
        .map((f) => ({ [`data.${f.name}`]: searchRegex }));

      if (textFields.length > 0) {
        query.$or = textFields;
      }
    }

    // Apply Dynamic Reporting Manager Hierarchy filtering
    await HierarchyService.modifyRecordQuery(query, req.user as any, req.organizationId!);

    // Pagination
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skipNum = (pageNum - 1) * limitNum;

    // Sorting
    let sortOption: Record<string, any> = { createdAt: -1 };
    if (sort && typeof sort === 'string') {
      const isDesc = sort.startsWith('-');
      const sortField = isDesc ? sort.substring(1) : sort;
      sortOption = { [sortField.startsWith('data.') ? sortField : `data.${sortField}`]: isDesc ? -1 : 1 };
    }

    const records = await CustomRecord.find(query)
      .sort(sortOption)
      .skip(skipNum)
      .limit(limitNum);

    const total = await CustomRecord.countDocuments(query);

    res.status(200).json({
      records,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('List Records Error:', error);
    res.status(500).json({ error: 'Failed to retrieve records.' });
  }
});

// 2. CREATE A RECORD
router.post('/:apiPath', async (req: Request, res: Response): Promise<void> => {
  try {
    const { apiPath } = req.params;
    const recordData = req.body.data ? req.body.data : req.body;

    const moduleDef = await ModuleDefinition.findOne({
      organizationId: req.organizationId,
      apiPath: apiPath.toLowerCase()
    });

    if (!moduleDef) {
      res.status(404).json({ error: `Module definition not found: ${apiPath}` });
      return;
    }

    // Check RBAC permissions
    const { allowed } = await authorizeModuleAction(req, res, moduleDef.name, 'create');
    if (!allowed) {
      res.status(403).json({ error: `Access Denied: Create permission absent for module ${moduleDef.name}` });
      return;
    }

    // Populate default values for missing fields
    moduleDef.fields.forEach((field) => {
      if (field.defaultValue && (recordData[field.name] === undefined || recordData[field.name] === null || recordData[field.name] === '')) {
        recordData[field.name] = field.defaultValue;
      }
    });

    // Validate inputs
    const validationErrors = validateFields(moduleDef.fields, recordData);
    if (validationErrors.length > 0) {
      res.status(400).json({ error: 'Validation failed', details: validationErrors });
      return;
    }

    // Unique field validation
    for (const field of moduleDef.fields) {
      if (field.unique && recordData[field.name]) {
        const duplicate = await CustomRecord.findOne({
          organizationId: req.organizationId,
          moduleId: moduleDef._id,
          [`data.${field.name}`]: recordData[field.name]
        });
        if (duplicate) {
          res.status(400).json({ error: `Duplicate error: Value for '${field.label}' must be unique.` });
          return;
        }
      }
    }

    // Evaluate Calculated / Formula fields
    moduleDef.fields.forEach((field) => {
      if (field.type === 'formula' && field.formulaExpression) {
        const computed = FormulaEvaluator.evaluate(field.formulaExpression, recordData);
        if (computed !== null) {
          recordData[field.name] = computed;
        }
      }
    });

    const creatorId = new mongoose.Types.ObjectId(req.user?.id);
    const newRecord = await CustomRecord.create({
      organizationId: req.organizationId,
      moduleId: moduleDef._id,
      data: recordData,
      createdBy: creatorId,
      updatedBy: creatorId
    });

    // Timeline Logging (Activity)
    await Activity.create({
      organizationId: req.organizationId,
      recordId: newRecord._id,
      userId: creatorId,
      type: 'create',
      details: {}
    });

    // System Auditing
    await AuditLog.create({
      organizationId: req.organizationId,
      userId: creatorId,
      action: 'record.create',
      resource: moduleDef.name,
      resourceId: String(newRecord._id),
      newValue: recordData
    });

    // Generate Notification if assignedTo is set
    if (recordData.assignedTo) {
      const name = `${recordData.firstName || ''} ${recordData.lastName || ''}`.trim() || moduleDef.singularLabel || 'Record';
      await createNotification({
        organizationId: req.organizationId,
        recipient: recordData.assignedTo,
        title: `${moduleDef.singularLabel || 'Lead'} Assigned`,
        message: `${moduleDef.singularLabel || 'Lead'} '${name}' has been assigned to you.`,
        type: 'info',
        link: `/modules/${apiPath.toLowerCase()}/${newRecord._id}`
      });
    }

    // Execute Workflows
    WorkflowEngine.trigger(req.organizationId as any, moduleDef._id as any, 'create', newRecord);

    res.status(201).json(newRecord);
  } catch (error) {
    console.error('Create Record Error:', error);
    res.status(500).json({ error: 'Failed to create record.' });
  }
});

// 3. READ SINGLE RECORD
router.get('/:apiPath/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { apiPath, id } = req.params;

    const moduleDef = await ModuleDefinition.findOne({
      organizationId: req.organizationId,
      apiPath: apiPath.toLowerCase()
    });

    if (!moduleDef) {
      res.status(404).json({ error: 'Module not found.' });
      return;
    }

    const { allowed, scope } = await authorizeModuleAction(req, res, moduleDef.name, 'read');
    if (!allowed) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    const query: Record<string, any> = {
      _id: id,
      organizationId: req.organizationId
    };

    if (scope === 'own') {
      query.createdBy = req.user?.id;
    }

    // Apply Dynamic Reporting Manager Hierarchy filtering
    await HierarchyService.modifyRecordQuery(query, req.user as any, req.organizationId!);

    const record = await CustomRecord.findOne(query);
    if (!record) {
      res.status(404).json({ error: 'Record not found.' });
      return;
    }

    res.status(200).json(record);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve record.' });
  }
});

// 4. UPDATE A RECORD
router.put('/:apiPath/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { apiPath, id } = req.params;
    const updateData = req.body.data ? req.body.data : req.body;

    const moduleDef = await ModuleDefinition.findOne({
      organizationId: req.organizationId,
      apiPath: apiPath.toLowerCase()
    });

    if (!moduleDef) {
      res.status(404).json({ error: 'Module not found.' });
      return;
    }

    // Check RBAC permissions
    const { allowed, scope } = await authorizeModuleAction(req, res, moduleDef.name, 'update');
    if (!allowed) {
      res.status(403).json({ error: `Access Denied: Update permission absent for module ${moduleDef.name}` });
      return;
    }

    const recordQuery: Record<string, any> = {
      _id: id,
      organizationId: req.organizationId
    };
    if (scope === 'own') {
      recordQuery.createdBy = req.user?.id;
    }

    // Apply Dynamic Reporting Manager Hierarchy filtering
    await HierarchyService.modifyRecordQuery(recordQuery, req.user as any, req.organizationId!);

    const record = await CustomRecord.findOne(recordQuery);
    if (!record) {
      res.status(404).json({ error: 'Record not found.' });
      return;
    }

    const oldValues = record.data instanceof Map ? Object.fromEntries(record.data) : record.data;

    // Validate inputs against the merged data
    const mergedData = {
      ...oldValues,
      ...updateData
    };
    const validationErrors = validateFields(moduleDef.fields, mergedData, oldValues);
    if (validationErrors.length > 0) {
      res.status(400).json({ error: 'Validation failed', details: validationErrors });
      return;
    }

    // Unique field validation (excluding self)
    for (const field of moduleDef.fields) {
      if (field.unique && updateData[field.name]) {
        const duplicate = await CustomRecord.findOne({
          organizationId: req.organizationId,
          moduleId: moduleDef._id,
          _id: { $ne: record._id },
          [`data.${field.name}`]: updateData[field.name]
        });
        if (duplicate) {
          res.status(400).json({ error: `Value for '${field.label}' must be unique.` });
          return;
        }
      }
    }

    // Capture changed fields
    const changedFields: string[] = [];

    Object.keys(updateData).forEach((key) => {
      if (String(oldValues[key]) !== String(updateData[key])) {
        changedFields.push(key);
      }
    });

    // Evaluate Calculated / Formula fields based on updated data values
    moduleDef.fields.forEach((field) => {
      if (field.type === 'formula' && field.formulaExpression) {
        const computed = FormulaEvaluator.evaluate(field.formulaExpression, {
          ...oldValues,
          ...updateData
        });
        if (computed !== null) {
          updateData[field.name] = computed;
        }
      }
    });

    // Perform Update
    const updaterId = new mongoose.Types.ObjectId(req.user?.id);
    record.data = {
      ...oldValues,
      ...updateData
    };
    record.updatedBy = updaterId;
    await record.save();

    // Log Activity logs for status updates or assignments
    for (const fieldName of changedFields) {
      await Activity.create({
        organizationId: req.organizationId,
        recordId: record._id,
        userId: updaterId,
        type: fieldName === 'status' ? 'status_change' : 'edit',
        details: {
          fieldName,
          oldValue: oldValues[fieldName],
          newValue: updateData[fieldName]
        }
      });
    }

    // System Audit Log
    await AuditLog.create({
      organizationId: req.organizationId,
      userId: updaterId,
      action: 'record.update',
      resource: moduleDef.name,
      resourceId: String(record._id),
      oldValue: oldValues,
      newValue: updateData
    });

    // Generate Notifications for assignedTo or status changes
    const recName = `${record.data?.firstName || ''} ${record.data?.lastName || ''}`.trim() || moduleDef.singularLabel || 'Record';
    const userObj = req.user as any;
    const updaterName = userObj?.firstName ? `${userObj.firstName} ${userObj.lastName || ''}`.trim() : (userObj?.email || 'System');

    if (changedFields.includes('assignedTo') && updateData.assignedTo) {
      await createNotification({
        organizationId: req.organizationId,
        recipient: updateData.assignedTo,
        title: `${moduleDef.singularLabel || 'Lead'} Assigned`,
        message: `${moduleDef.singularLabel || 'Lead'} '${recName}' was assigned to you by ${updaterName}.`,
        type: 'info',
        link: `/modules/${apiPath.toLowerCase()}/${record._id}`
      });
    }

    if (changedFields.includes('status') && record.data?.assignedTo) {
      await createNotification({
        organizationId: req.organizationId,
        recipient: record.data.assignedTo,
        title: `${moduleDef.singularLabel || 'Lead'} Status Updated`,
        message: `Status of '${recName}' was updated to '${updateData.status}' by ${updaterName}.`,
        type: 'info',
        link: `/modules/${apiPath.toLowerCase()}/${record._id}`
      });
    }

    // Execute Workflows
    WorkflowEngine.trigger(req.organizationId as any, moduleDef._id as any, 'update', record, changedFields);

    res.status(200).json(record);
  } catch (error) {
    console.error('Update Record Error:', error);
    res.status(500).json({ error: 'Failed to update record.' });
  }
});

// 5. DELETE A RECORD
router.delete('/:apiPath/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { apiPath, id } = req.params;

    const moduleDef = await ModuleDefinition.findOne({
      organizationId: req.organizationId,
      apiPath: apiPath.toLowerCase()
    });

    if (!moduleDef) {
      res.status(404).json({ error: 'Module not found.' });
      return;
    }

    const { allowed, scope } = await authorizeModuleAction(req, res, moduleDef.name, 'delete');
    if (!allowed) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    const query: Record<string, any> = {
      _id: id,
      organizationId: req.organizationId
    };
    if (scope === 'own') {
      query.createdBy = req.user?.id;
    }

    // Apply Dynamic Reporting Manager Hierarchy filtering
    await HierarchyService.modifyRecordQuery(query, req.user as any, req.organizationId!);

    const record = await CustomRecord.findOne(query);
    if (!record) {
      res.status(404).json({ error: 'Record not found.' });
      return;
    }

    await CustomRecord.findByIdAndDelete(record._id);

    // Audit logs
    await AuditLog.create({
      organizationId: req.organizationId,
      userId: new mongoose.Types.ObjectId(req.user?.id),
      action: 'record.delete',
      resource: moduleDef.name,
      resourceId: String(record._id),
      oldValue: record.data
    });

    // Execute delete workflow triggers
    WorkflowEngine.trigger(req.organizationId as any, moduleDef._id as any, 'delete', record);

    res.status(200).json({ message: 'Record deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete record.' });
  }
});

// Transfer leads between agents
router.post('/transfer/leads', async (req: Request, res: Response): Promise<void> => {
  try {
    const { fromAgentId, fromAgentName, toAgentId, toAgentName } = req.body;

    if (!fromAgentId || !toAgentId || !fromAgentName || !toAgentName) {
      res.status(400).json({ error: 'fromAgentId, fromAgentName, toAgentId, and toAgentName are required.' });
      return;
    }

    const moduleDef = await ModuleDefinition.findOne({
      organizationId: req.organizationId,
      apiPath: 'leads'
    });

    if (!moduleDef) {
      res.status(404).json({ error: 'Leads module not found.' });
      return;
    }

    // Update all leads matching the source agent's ID or name
    const result = await CustomRecord.updateMany(
      {
        organizationId: req.organizationId,
        moduleId: moduleDef._id,
        $or: [
          { 'data.assignedTo': fromAgentId },
          { 'data.assignedTo': fromAgentName }
        ]
      },
      {
        $set: { 'data.assignedTo': toAgentName } // Store as full name for display compatibility
      }
    );

    // Create Audit Log
    await AuditLog.create({
      organizationId: req.organizationId,
      userId: new mongoose.Types.ObjectId(req.user?.id),
      action: 'leads.transfer',
      resource: 'leads',
      details: {
        fromAgentId,
        fromAgentName,
        toAgentId,
        toAgentName,
        modifiedCount: result.modifiedCount
      }
    });

    // Generate Notification for target agent
    if (result.modifiedCount > 0) {
      await createNotification({
        organizationId: req.organizationId,
        recipient: toAgentId || toAgentName,
        title: 'Leads Transferred to You',
        message: `${result.modifiedCount} lead(s) were transferred to you from ${fromAgentName}.`,
        type: 'info',
        link: '/modules/leads'
      });
    }

    res.status(200).json({ message: 'Leads transferred successfully.', modifiedCount: result.modifiedCount });
  } catch (error: any) {
    console.error('Failed to transfer leads:', error);
    res.status(500).json({ error: 'Failed to transfer leads.' });
  }
});

// GET record activity history
router.get('/:apiPath/:id/activities', async (req: Request, res: Response): Promise<void> => {
  try {
    const recordQuery = {
      _id: req.params.id,
      organizationId: req.organizationId
    };
    await HierarchyService.modifyRecordQuery(recordQuery, req.user as any, req.organizationId!);

    const record = await CustomRecord.findOne(recordQuery);
    if (!record) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    const activities = await Activity.find({
      organizationId: req.organizationId,
      recordId: new mongoose.Types.ObjectId(req.params.id)
    })
    .populate('userId', 'firstName lastName email')
    .sort({ createdAt: -1 });

    res.status(200).json(activities);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve record activities.' });
  }
});

export default router;
