import { Router, Request, Response } from 'express';
import ReportDefinition from '../models/ReportDefinition';
import { ReportBuilderService } from '../services/reportBuilder';
import { authenticate } from '../middleware/authMiddleware';
import { requireTenant } from '../middleware/tenantMiddleware';

const router = Router();

router.use(authenticate);
router.use(requireTenant);

// 1. Get all report definitions
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const reports = await ReportDefinition.find({ organizationId: req.organizationId })
      .populate('moduleId', 'pluralLabel name');
    res.status(200).json(reports);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve reports.' });
  }
});

// 2. Create/Save a report definition
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, moduleId, chartType, groupByField, metricField, aggregation, filters, columns } = req.body;

    if (!name || !moduleId || !chartType) {
      res.status(400).json({ error: 'Name, moduleId, and chartType are required.' });
      return;
    }

    const report = await ReportDefinition.create({
      organizationId: req.organizationId,
      moduleId,
      name,
      description,
      chartType,
      groupByField,
      metricField,
      aggregation,
      filters: filters || [],
      columns: columns || [],
      createdBy: req.user?.id
    });

    res.status(201).json(report);
  } catch (error) {
    res.status(500).json({ error: 'Failed to save report definition.' });
  }
});

// 3. Execute/Run a report (aggregating metrics & generating details)
router.get('/:id/run', async (req: Request, res: Response): Promise<void> => {
  try {
    const report = await ReportDefinition.findOne({
      _id: req.params.id,
      organizationId: req.organizationId
    });

    if (!report) {
      res.status(404).json({ error: 'Report definition not found.' });
      return;
    }

    // Generate chart aggregation data
    const chartData = await ReportBuilderService.generateReport(report);
    // Generate detailed table rows
    const details = await ReportBuilderService.getReportDetails(report);

    res.status(200).json({
      report,
      chartData,
      details
    });
  } catch (error) {
    console.error('Run Report Error:', error);
    res.status(500).json({ error: 'Failed to execute report aggregations.' });
  }
});

// 4. Delete report definition
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const report = await ReportDefinition.findOneAndDelete({
      _id: req.params.id,
      organizationId: req.organizationId
    });

    if (!report) {
      res.status(404).json({ error: 'Report not found.' });
      return;
    }

    res.status(200).json({ message: 'Report definition deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete report.' });
  }
});

export default router;
