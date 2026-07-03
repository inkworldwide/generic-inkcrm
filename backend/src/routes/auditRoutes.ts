import { Router, Request, Response } from 'express';
import AuditLog from '../models/AuditLog';
import { authenticate } from '../middleware/authMiddleware';
import { requireTenant } from '../middleware/tenantMiddleware';

const router = Router();

router.use(authenticate);
router.use(requireTenant);

// List audit logs for tenant
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const logs = await AuditLog.find({ organizationId: req.organizationId })
      .populate('userId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve system audit logs.' });
  }
});

export default router;
