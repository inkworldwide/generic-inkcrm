import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import DashboardLayout from '../models/DashboardLayout';
import ModuleDefinition from '../models/ModuleDefinition';
import CustomRecord from '../models/CustomRecord';
import Activity from '../models/Activity';
import User from '../models/User';
import { authenticate } from '../middleware/authMiddleware';
import { requireTenant } from '../middleware/tenantMiddleware';
import { HierarchyService } from '../utils/hierarchy';

const router = Router();

router.use(authenticate);
router.use(requireTenant);

// 1. Get Dashboard Layout for User
router.get('/layout', async (req: Request, res: Response): Promise<void> => {
  try {
    // Attempt to locate a user-specific dashboard layout
    let layout = await DashboardLayout.findOne({
      organizationId: req.organizationId,
      userId: req.user?.id
    });

    // Fallback: locate the organization's default dashboard layout
    if (!layout) {
      layout = await DashboardLayout.findOne({
        organizationId: req.organizationId,
        isDefault: true
      });
    }

    res.status(200).json(layout || { widgets: [] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve dashboard configuration.' });
  }
});

// 2. Save/Update Dashboard Layout
router.put('/layout', async (req: Request, res: Response): Promise<void> => {
  try {
    const { widgets } = req.body;

    let layout = await DashboardLayout.findOne({
      organizationId: req.organizationId,
      userId: req.user?.id
    });

    if (layout) {
      layout.widgets = widgets;
      await layout.save();
    } else {
      layout = await DashboardLayout.create({
        organizationId: req.organizationId,
        userId: req.user?.id,
        name: 'My Dashboard',
        widgets
      });
    }

    res.status(200).json(layout);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update dashboard widgets.' });
  }
});

// 3. Fetch Real-time Metadata KPI Counts
router.get('/metrics', async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organizationId;
    
    // Find Lead and Deal Module Definitions
    const leadModule = await ModuleDefinition.findOne({ organizationId: orgId, apiPath: 'leads' });
    const dealModule = await ModuleDefinition.findOne({ organizationId: orgId, apiPath: 'deals' });

    const leadQuery: Record<string, any> = {
      organizationId: orgId
    };
    if (leadModule) {
      leadQuery.moduleId = leadModule._id;
    }
    const dealQuery: Record<string, any> = {
      organizationId: orgId
    };
    if (dealModule) {
      dealQuery.moduleId = dealModule._id;
    }

    // Apply Dynamic Reporting Manager Hierarchy filtering
    await HierarchyService.modifyRecordQuery(leadQuery, req.user as any, orgId!);
    await HierarchyService.modifyRecordQuery(dealQuery, req.user as any, orgId!);

    const statusCounts: Record<string, number> = {};
    const pipelineData: Record<string, number> = {
      'Prospecting': 0,
      'Qualification': 0,
      'Proposal': 0,
      'Negotiation': 0,
      'Closed Won': 0,
      'Closed Lost': 0
    };

    let dealStatus = { open: 0, won: 0, lost: 0, pending: 0 };
    let todayFollowupsCount = 0;
    let todayFollowupsList: any[] = [];

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    if (leadModule) {
      // 1. Group leads count by status
      const matchStage = {
        ...leadQuery,
        'data.status': { 
          $nin: [
            'Yet To Call', 'Not Reachable', 'Not Intested', 'Call Rejected', 
            'Not Connected', 'Cool Lead', 'No Answer', 'Wrong Number', 
            'Not Exists', 'Repeated Number', 'No Business', 'Hot Lead', 'Warm Lead'
          ] 
        }
      };

      const leadAgg = await CustomRecord.aggregate([
        { $match: matchStage },
        { $group: { _id: '$data.status', count: { $sum: 1 } } }
      ]);
      
      leadAgg.forEach(item => {
        if (item._id) {
          statusCounts[item._id.toString().toUpperCase()] = item.count;
        }
      });

      // 2. Count today's followups
      const followUpQuery: any = {
        ...leadQuery
      };
      const timeFilter = {
        $or: [
          { 'data.followUpDate': { $gte: startOfToday, $lte: endOfToday } },
          { 'data.followUpDate': { $regex: '^' + startOfToday.toISOString().split('T')[0] } }
        ]
      };
      if (followUpQuery.$or) {
        const existingOr = followUpQuery.$or;
        delete followUpQuery.$or;
        followUpQuery.$and = [
          { $or: existingOr },
          timeFilter
        ];
      } else if (followUpQuery.$and) {
        followUpQuery.$and.push(timeFilter);
      } else {
        Object.assign(followUpQuery, timeFilter);
      }
      
      todayFollowupsCount = await CustomRecord.countDocuments(followUpQuery);
      todayFollowupsList = await CustomRecord.find(followUpQuery).limit(5);

      if (todayFollowupsList.length === 0) {
        const upcomingQuery: any = {
          ...leadQuery
        };
        const futureFilter = {
          $or: [
            { 'data.followUpDate': { $gt: endOfToday } },
            { 'data.followUpDate': { $gt: endOfToday.toISOString().split('T')[0] } }
          ]
        };
        if (upcomingQuery.$or) {
          const existingOr = upcomingQuery.$or;
          delete upcomingQuery.$or;
          upcomingQuery.$and = [
            { $or: existingOr },
            futureFilter
          ];
        } else if (upcomingQuery.$and) {
          upcomingQuery.$and.push(futureFilter);
        } else {
          Object.assign(upcomingQuery, futureFilter);
        }

        // Find upcoming followups sorted by date ascending (closest first)
        todayFollowupsList = await CustomRecord.find(upcomingQuery)
          .sort({ 'data.followUpDate': 1 })
          .limit(5);
        
        if (todayFollowupsList.length > 0) {
          (req as any).isUpcomingFollowups = true;
        }
      }
    }

    if (dealModule) {
      // 3. sum amount grouped by stage for Pipeline
      const dealAgg = await CustomRecord.aggregate([
        { $match: dealQuery },
        { $group: { _id: '$data.stage', total: { $sum: { $toDouble: '$data.amount' } } } }
      ]);

      dealAgg.forEach(item => {
        if (item._id && pipelineData[item._id] !== undefined) {
          pipelineData[item._id] = item.total;
        }
      });

      // 4. Count Deal Statuses
      const deals = await CustomRecord.find(dealQuery);
      deals.forEach(deal => {
        const stage = deal.data?.get ? deal.data.get('stage') : deal.data?.stage;
        if (stage === 'Closed Won') {
          dealStatus.won++;
        } else if (stage === 'Closed Lost') {
          dealStatus.lost++;
        } else if (stage === 'Negotiation' || stage === 'Proposal') {
          dealStatus.pending++;
          dealStatus.open++;
        } else {
          dealStatus.open++;
        }
      });
    }

    // 5. Total leads count
    let totalLeads = 0;
    if (leadModule) {
      const totalLeadsQuery = {
        ...leadQuery,
        'data.status': { 
          $nin: [
            'Yet To Call', 'Not Reachable', 'Not Intested', 'Call Rejected', 
            'Not Connected', 'Cool Lead', 'No Answer', 'Wrong Number', 
            'Not Exists', 'Repeated Number', 'No Business', 'Hot Lead', 'Warm Lead'
          ] 
        }
      };
      totalLeads = await CustomRecord.countDocuments(totalLeadsQuery);
    }

    // 6. Fetch recent activity logs across all records within hierarchy
    const activityQuery: Record<string, any> = { organizationId: orgId };
    const isSuper = await HierarchyService.isSuperAdmin(req.user?.roleId);
    if (!isSuper) {
      const descendants = await HierarchyService.getSubordinateUserIds(req.user?.id as string, orgId!);
      const allowedUserIds = [new mongoose.Types.ObjectId(req.user?.id), ...descendants];
      activityQuery.userId = { $in: allowedUserIds };
    }

    const recentActivities = await Activity.find(activityQuery)
      .populate('userId', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(10);

    res.status(200).json({
      statusCounts,
      pipelineData,
      dealStatus,
      todayFollowupsCount,
      todayFollowupsList,
      isUpcoming: (req as any).isUpcomingFollowups || false,
      totalLeads,
      recentActivities
    });
  } catch (error) {
    console.error('Metrics Error:', error);
    res.status(500).json({ error: 'Failed to retrieve dashboard KPI metrics.' });
  }
});

export default router;
