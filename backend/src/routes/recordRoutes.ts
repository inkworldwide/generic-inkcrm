import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import ModuleDefinition from '../models/ModuleDefinition';
import CustomRecord from '../models/CustomRecord';
import Role from '../models/Role';
import Activity from '../models/Activity';
import AuditLog from '../models/AuditLog';
import { FormulaEvaluator } from '../services/formulaEvaluator';
import { WorkflowEngine } from '../services/workflowEngine';
import { authenticate } from '../middleware/authMiddleware';
import { requireTenant } from '../middleware/tenantMiddleware';

const router = Router();

// Apply security middlewares
router.use(authenticate);
router.use(requireTenant);

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

    const permission = role.permissions.modules.find(
      (m) => m.moduleName.toLowerCase() === moduleName.toLowerCase()
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
const validateFields = (fields: any[], data: Record<string, any>) => {
  const errors: string[] = [];

  fields.forEach((field) => {
    const val = data[field.name];

    // Check required fields
    if (field.required && (val === undefined || val === null || val === '')) {
      errors.push(`Field '${field.label}' is required.`);
      return;
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
    const recordData = req.body;

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
    const updateData = req.body;

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

    const record = await CustomRecord.findOne(recordQuery);
    if (!record) {
      res.status(404).json({ error: 'Record not found.' });
      return;
    }

    // Validate inputs
    const validationErrors = validateFields(moduleDef.fields, updateData);
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
    const oldValues = record.data instanceof Map ? Object.fromEntries(record.data) : record.data;

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

export default router;
