import { Router, Request, Response } from 'express';
import AuditLog from '../models/AuditLog';
import { authenticate } from '../middleware/authMiddleware';
import { requireTenant } from '../middleware/tenantMiddleware';
import { HierarchyService } from '../utils/hierarchy';

const router = Router();

router.use(authenticate);
router.use(requireTenant);

// List audit logs for tenant
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const query: Record<string, any> = { organizationId: req.organizationId };
    await HierarchyService.modifyAuditLogQuery(query, req.user as any, req.organizationId!);

    const logs = await AuditLog.find(query)
      .populate('userId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve system audit logs.' });
  }
});

export default router;
