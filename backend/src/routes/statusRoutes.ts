import { Router, Request, Response } from 'express';
import Status from '../models/Status';
import { authenticate } from '../middleware/authMiddleware';
import { requireTenant } from '../middleware/tenantMiddleware';

const router = Router();

router.use(authenticate);
router.use(requireTenant);

// 1. Get all statuses
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const statuses = await Status.find({ organizationId: req.organizationId }).sort({ order: 1 });
    res.status(200).json(statuses);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve statuses.' });
  }
});

// 2. Create new status
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, color, icon, pipelinePosition, dashboardVisibility, isFinal, isSuccess, order } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Name is required.' });
      return;
    }

    // Auto-calculate order if not provided
    let calculatedOrder = order;
    if (order === undefined) {
      const count = await Status.countDocuments({ organizationId: req.organizationId });
      calculatedOrder = count;
    }

    const status = await Status.create({
      organizationId: req.organizationId,
      name,
      color: color || '#4F46E5',
      icon: icon || 'Circle',
      pipelinePosition: pipelinePosition || 0,
      dashboardVisibility: dashboardVisibility !== undefined ? dashboardVisibility : true,
      isFinal: isFinal !== undefined ? isFinal : false,
      isSuccess: isSuccess !== undefined ? isSuccess : false,
      order: calculatedOrder
    });

    res.status(201).json(status);
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({ error: 'Status name must be unique.' });
    } else {
      res.status(500).json({ error: 'Failed to create status.' });
    }
  }
});

// 3. Update status
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, color, icon, pipelinePosition, dashboardVisibility, isFinal, isSuccess, order } = req.body;

    const status = await Status.findOne({ _id: req.params.id, organizationId: req.organizationId });
    if (!status) {
      res.status(404).json({ error: 'Status not found.' });
      return;
    }

    if (name) status.name = name;
    if (color) status.color = color;
    if (icon) status.icon = icon;
    if (pipelinePosition !== undefined) status.pipelinePosition = pipelinePosition;
    if (dashboardVisibility !== undefined) status.dashboardVisibility = dashboardVisibility;
    if (isFinal !== undefined) status.isFinal = isFinal;
    if (isSuccess !== undefined) status.isSuccess = isSuccess;
    if (order !== undefined) status.order = order;

    await status.save();
    res.status(200).json(status);
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({ error: 'Status name must be unique.' });
    } else {
      res.status(500).json({ error: 'Failed to update status.' });
    }
  }
});

// 4. Delete status
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const status = await Status.findOneAndDelete({ _id: req.params.id, organizationId: req.organizationId });
    if (!status) {
      res.status(404).json({ error: 'Status not found.' });
      return;
    }
    res.status(200).json({ message: 'Status deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete status.' });
  }
});

export default router;
