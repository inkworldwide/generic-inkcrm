import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Organization from '../models/Organization';
import Vertical from '../models/Vertical';
import User from '../models/User';
import Role from '../models/Role';
import ModuleDefinition from '../models/ModuleDefinition';
import ImpersonationLog from '../models/ImpersonationLog';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_access_token_key_12345';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'super_secret_jwt_refresh_token_key_54321';

// Middleware to strictly restrict to Platform Super Admin
const requirePlatformSuperAdmin = async (req: Request, res: Response, next: any) => {
  try {
    const user = await User.findById(req.user?.id);
    if (!user || (!user.isPlatformSuperAdmin && user.email !== 'superadmin@inkcrm.com')) {
      res.status(403).json({ error: 'Access denied: Platform Super Admin authority required.' });
      return;
    }
    next();
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify platform authority.' });
  }
};

// All super-admin routes require authentication + Platform Super Admin check
router.use(authenticate, requirePlatformSuperAdmin);

// ─────────────────────────────────────────────────────────────────────────────
// 1. STATS / OVERVIEW
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const totalTenants = await Organization.countDocuments({ status: { $ne: 'archived' } });
    const activeTenants = await Organization.countDocuments({ status: 'active' });
    const disabledTenants = await Organization.countDocuments({ status: 'disabled' });
    const archivedTenants = await Organization.countDocuments({ status: 'archived' });

    // Aggregate by vertical type
    const verticalBreakdown = await Organization.aggregate([
      { $match: { status: { $ne: 'archived' } } },
      { $group: { _id: '$verticalType', count: { $sum: 1 } } }
    ]);

    // Count pending module requests
    const orgsWithRequests = await Organization.find({
      'requestedModules.0': { $exists: true },
      status: { $ne: 'archived' }
    }).select('name subdomain requestedModules');

    let totalPendingRequests = 0;
    orgsWithRequests.forEach(org => {
      totalPendingRequests += (org.requestedModules || []).length;
    });

    res.status(200).json({
      totalTenants,
      activeTenants,
      disabledTenants,
      archivedTenants,
      verticalBreakdown: verticalBreakdown.map(v => ({
        verticalType: v._id || 'custom',
        count: v.count
      })),
      pendingModuleRequestsCount: totalPendingRequests
    });
  } catch (error: any) {
    console.error('[SUPER_ADMIN_STATS_ERROR]', error);
    res.status(500).json({ error: 'Failed to calculate platform statistics.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. TENANTS LIST & MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────
router.get('/tenants', async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, verticalType, status } = req.query;
    const filter: any = {};

    // Filter by status (default to active and disabled unless archived explicitly requested)
    if (status === 'archived') {
      filter.status = 'archived';
    } else if (status === 'all') {
      // include all
    } else if (status && typeof status === 'string') {
      filter.status = status;
    } else {
      filter.status = { $ne: 'archived' };
    }

    if (verticalType && typeof verticalType === 'string' && verticalType !== 'all') {
      filter.verticalType = verticalType;
    }

    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim();
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { subdomain: { $regex: q, $options: 'i' } },
        { companyCode: { $regex: q, $options: 'i' } }
      ];
    }

    const organizations = await Organization.find(filter)
      .populate('verticalId')
      .sort({ createdAt: -1 });

    // Fetch primary admin user for each organization
    const orgIds = organizations.map(o => o._id);
    const users = await User.find({
      organizationId: { $in: orgIds }
    }).populate('roleId');

    const result = organizations.map(org => {
      const orgUsers = users.filter(u => u.organizationId?.toString() === org._id.toString());
      // Identify primary admin (first user or Super Admin role)
      const adminUser = orgUsers.find(u => {
        const rName = (u.roleId as any)?.name || '';
        return rName.toLowerCase().includes('admin') || rName.toLowerCase().includes('super');
      }) || orgUsers[0];

      return {
        id: org._id,
        name: org.name,
        subdomain: org.subdomain,
        verticalType: org.verticalType || 'custom',
        vertical: org.verticalId || null,
        status: org.status || 'active',
        enabledModulesCount: (org.enabledModules || []).length,
        enabledModules: org.enabledModules || [],
        requestedModulesCount: (org.requestedModules || []).length,
        requestedModules: org.requestedModules || [],
        themeSettings: org.themeSettings,
        logoUrl: org.logoUrl,
        adminUser: adminUser ? {
          id: adminUser._id,
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
          email: adminUser.email,
          phone: adminUser.registrationLocation?.address || (org.phoneNumber || org.mobile || '—'),
          userCode: adminUser.userCode,
          isActive: adminUser.isActive
        } : null,
        userCount: orgUsers.length,
        createdAt: org.createdAt
      };
    });

    res.status(200).json(result);
  } catch (error: any) {
    console.error('[SUPER_ADMIN_TENANTS_LIST_ERROR]', error);
    res.status(500).json({ error: 'Failed to retrieve tenants list.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. CREATE ADMIN-CRM & TENANT
// ─────────────────────────────────────────────────────────────────────────────
router.post('/tenants', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      subdomain,
      verticalType,
      admin,
      enabledModules,
      themeSettings
    } = req.body;

    if (!name || !subdomain || !admin?.email || !admin?.password || !admin?.firstName || !admin?.lastName) {
      res.status(400).json({ error: 'Organization name, subdomain, admin email, password, and name are required.' });
      return;
    }

    const cleanSubdomain = subdomain.toLowerCase().trim().replace(/[^a-z0-9-]/g, '');
    const cleanEmail = admin.email.toLowerCase().trim();

    // Check subdomain uniqueness
    const existingOrg = await Organization.findOne({ subdomain: cleanSubdomain });
    if (existingOrg) {
      res.status(400).json({ error: `Subdomain "${cleanSubdomain}" is already taken. Please choose another.` });
      return;
    }

    // Check admin email uniqueness
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      res.status(400).json({ error: `A user with email "${cleanEmail}" already exists.` });
      return;
    }

    // Find vertical template if exists
    let vertical = await Vertical.findOne({ key: verticalType || 'bank' });
    if (!vertical && verticalType) {
      vertical = await Vertical.findOne({ key: 'bank' });
    }

    const finalModules = Array.isArray(enabledModules) && enabledModules.length > 0
      ? enabledModules
      : (vertical?.defaultModules || [
          'dashboard', 'leads', 'deals', 'companies', 'campaigns', 'campaignassignments',
          'lead_reports', 'telecaller_reports', 'telecaller_monthly', 'funnel_daily',
          'funnel_monthly', 'reports', 'settings', 'access_privilege', 'users_management'
        ]);

    const finalTheme = themeSettings || vertical?.themeSettings || {
      primaryColor: '#4F46E5',
      sidebarBg: '#0F172A',
      headerBg: '#FFFFFF',
      fontFamily: 'Inter',
      mode: 'light'
    };

    // 1. Create Organization
    const organization = await Organization.create({
      name: name.trim(),
      subdomain: cleanSubdomain,
      verticalType: verticalType || 'bank',
      verticalId: vertical?._id,
      status: 'active',
      createdBy: req.user?.id,
      themeSettings: finalTheme,
      enabledModules: finalModules,
      phoneNumber: admin.phone || '',
      subscription: {
        plan: 'enterprise',
        status: 'active',
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      }
    });

    // 2. Create Scoped Roles for this Tenant
    const createPermissions = (moduleNames: string[]) => ({
      modules: moduleNames.map((m) => ({
        moduleName: m,
        create: true,
        read: 'all' as const,
        update: 'all' as const,
        delete: 'all' as const
      })),
      fields: [],
      menus: finalModules
    });

    const adminRole = await Role.create({
      organizationId: organization._id,
      name: 'Super Admin',
      description: 'Full administrative control of tenant workspace',
      isSystem: true,
      permissions: createPermissions(['leads', 'deals', 'companies', 'campaigns', 'campaignassignments'])
    });

    await Role.create({
      organizationId: organization._id,
      name: 'Manager',
      description: 'Management and reporting role',
      isSystem: false,
      permissions: createPermissions(['leads', 'deals', 'companies'])
    });

    await Role.create({
      organizationId: organization._id,
      name: 'TELI CALLER',
      description: 'Telecalling agent role',
      isSystem: false,
      permissions: createPermissions(['leads', 'deals'])
    });

    // 3. Create Tenant Admin User
    const passwordHash = await bcrypt.hash(admin.password, 12);
    const tenantAdminUser = await User.create({
      organizationId: organization._id,
      roleId: adminRole._id,
      firstName: admin.firstName.trim(),
      lastName: admin.lastName.trim(),
      email: cleanEmail,
      passwordHash,
      isVerified: true,
      isApproved: true,
      approvalStatus: 'approved',
      skipFace: true,
      skipLocation: true,
      isActive: true,
      userCode: `ADM-${cleanSubdomain.toUpperCase().slice(0, 4)}-01`
    });

    res.status(201).json({
      message: 'Tenant and Admin-CRM account created successfully.',
      organization: {
        id: organization._id,
        name: organization.name,
        subdomain: organization.subdomain,
        verticalType: organization.verticalType,
        status: organization.status
      },
      adminUser: {
        id: tenantAdminUser._id,
        email: tenantAdminUser.email,
        name: `${tenantAdminUser.firstName} ${tenantAdminUser.lastName}`
      }
    });
  } catch (error: any) {
    console.error('[SUPER_ADMIN_CREATE_TENANT_ERROR]', error);
    res.status(500).json({ error: error.message || 'Failed to create tenant organization.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. GET TENANT DETAILS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/tenants/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const organization = await Organization.findById(req.params.id).populate('verticalId');
    if (!organization) {
      res.status(404).json({ error: 'Organization not found.' });
      return;
    }

    const roles = await Role.find({ organizationId: organization._id });
    const users = await User.find({ organizationId: organization._id }).populate('roleId');

    res.status(200).json({
      organization,
      roles,
      users
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve tenant details.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. UPDATE TENANT STATUS (Suspend / Activate / Soft-Delete Archive)
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/tenants/:id/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.body;
    if (!['active', 'disabled', 'archived'].includes(status)) {
      res.status(400).json({ error: 'Status must be active, disabled, or archived.' });
      return;
    }

    const organization = await Organization.findById(req.params.id);
    if (!organization) {
      res.status(404).json({ error: 'Organization not found.' });
      return;
    }

    organization.status = status;
    await organization.save();

    // If archiving or disabling, also toggle user active state
    if (status === 'disabled' || status === 'archived') {
      await User.updateMany({ organizationId: organization._id }, { isActive: false });
    } else if (status === 'active') {
      await User.updateMany({ organizationId: organization._id }, { isActive: true });
    }

    res.status(200).json({
      message: `Organization status updated to ${status}.`,
      status: organization.status
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update organization status.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. TOGGLE ENABLED MODULES (Platform-level kill switch per tenant)
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/tenants/:id/modules', async (req: Request, res: Response): Promise<void> => {
  try {
    const { enabledModules } = req.body;
    if (!Array.isArray(enabledModules)) {
      res.status(400).json({ error: 'enabledModules must be an array of module keys.' });
      return;
    }

    const organization = await Organization.findById(req.params.id);
    if (!organization) {
      res.status(404).json({ error: 'Organization not found.' });
      return;
    }

    organization.enabledModules = enabledModules;
    await organization.save();

    res.status(200).json({
      message: 'Tenant enabled modules updated successfully.',
      enabledModules: organization.enabledModules
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update tenant modules.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. VERTICALS TEMPLATES CRUD
// ─────────────────────────────────────────────────────────────────────────────
router.get('/verticals', async (req: Request, res: Response): Promise<void> => {
  try {
    const verticals = await Vertical.find().sort({ isCustom: 1, label: 1 });
    res.status(200).json(verticals);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to list vertical templates.' });
  }
});

router.post('/verticals', async (req: Request, res: Response): Promise<void> => {
  try {
    const { key, label, description, icon, defaultModules, themeSettings } = req.body;

    if (!key || !label) {
      res.status(400).json({ error: 'Vertical key and label are required.' });
      return;
    }

    const cleanKey = key.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_');
    const existing = await Vertical.findOne({ key: cleanKey });
    if (existing) {
      res.status(400).json({ error: `Vertical with key "${cleanKey}" already exists.` });
      return;
    }

    const vertical = await Vertical.create({
      key: cleanKey,
      label: label.trim(),
      description: description || '',
      icon: icon || 'Layers',
      defaultModules: Array.isArray(defaultModules) ? defaultModules : [
        'dashboard', 'leads', 'deals', 'companies', 'campaigns', 'lead_reports', 'settings'
      ],
      themeSettings: themeSettings || {
        primaryColor: '#4F46E5',
        sidebarBg: '#0F172A',
        headerBg: '#FFFFFF',
        fontFamily: 'Inter',
        mode: 'light'
      },
      isCustom: true
    });

    res.status(201).json({
      message: 'Custom vertical template registered successfully.',
      vertical
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create vertical template.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. IMPERSONATION ("Login As" Tenant Admin with Audit Trail)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/impersonate/:tenantId', async (req: Request, res: Response): Promise<void> => {
  try {
    const organization = await Organization.findById(req.params.tenantId);
    if (!organization) {
      res.status(404).json({ error: 'Tenant organization not found.' });
      return;
    }

    if (organization.status === 'archived') {
      res.status(400).json({ error: 'Cannot impersonate an archived organization.' });
      return;
    }

    // Find primary tenant admin user
    const adminUser = await User.findOne({
      organizationId: organization._id,
      isActive: true
    }).populate('roleId');

    if (!adminUser) {
      res.status(404).json({ error: 'No active user found in this organization to impersonate.' });
      return;
    }

    // 1. Create audit log entry
    const impersonationLog = await ImpersonationLog.create({
      superAdminId: req.user?.id,
      tenantOrgId: organization._id,
      tenantAdminId: adminUser._id,
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
      userAgent: req.headers['user-agent'] || '',
      startedAt: new Date()
    });

    // 2. Issue short-lived impersonation token (TTL: 60 minutes)
    const token = jwt.sign(
      {
        id: adminUser._id,
        email: adminUser.email,
        roleId: (adminUser.roleId as any)?._id || adminUser.roleId,
        organizationId: organization._id,
        isImpersonated: true,
        impersonatedBy: req.user?.id,
        impersonationLogId: impersonationLog._id
      },
      JWT_SECRET,
      { expiresIn: '60m' }
    );

    res.status(200).json({
      message: `Impersonation session established for ${organization.name}.`,
      token,
      impersonationLogId: impersonationLog._id,
      user: {
        id: adminUser._id,
        firstName: adminUser.firstName,
        lastName: adminUser.lastName,
        email: adminUser.email,
        roleId: adminUser.roleId,
        organizationId: organization._id,
        subdomain: organization.subdomain,
        isImpersonated: true
      },
      organization: {
        id: organization._id,
        name: organization.name,
        subdomain: organization.subdomain,
        verticalType: organization.verticalType,
        themeSettings: organization.themeSettings,
        enabledModules: organization.enabledModules
      }
    });
  } catch (error: any) {
    console.error('[IMPERSONATE_ERROR]', error);
    res.status(500).json({ error: 'Failed to initiate impersonation session.' });
  }
});

// End impersonation session and record endedAt in audit log
router.post('/end-impersonation', async (req: Request, res: Response): Promise<void> => {
  try {
    const { logId } = req.body;
    if (logId && mongoose.Types.ObjectId.isValid(logId)) {
      await ImpersonationLog.findByIdAndUpdate(logId, { endedAt: new Date() });
    }
    res.status(200).json({ message: 'Impersonation session closed cleanly.' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to record end of impersonation.' });
  }
});

// Audit trail for compliance
router.get('/impersonation-logs', async (req: Request, res: Response): Promise<void> => {
  try {
    const logs = await ImpersonationLog.find()
      .populate('superAdminId', 'firstName lastName email')
      .populate('tenantOrgId', 'name subdomain verticalType')
      .populate('tenantAdminId', 'firstName lastName email')
      .sort({ startedAt: -1 })
      .limit(100);

    res.status(200).json(logs);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve impersonation audit logs.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. MODULE ACTIVATION REQUESTS QUEUE
// ─────────────────────────────────────────────────────────────────────────────
router.get('/module-requests', async (req: Request, res: Response): Promise<void> => {
  try {
    const orgs = await Organization.find({
      'requestedModules.0': { $exists: true },
      status: { $ne: 'archived' }
    }).populate('requestedModules.requestedBy', 'firstName lastName email');

    const requests: any[] = [];
    orgs.forEach(org => {
      (org.requestedModules || []).forEach(reqItem => {
        requests.push({
          organizationId: org._id,
          organizationName: org.name,
          subdomain: org.subdomain,
          verticalType: org.verticalType,
          moduleKey: reqItem.moduleKey,
          requestedAt: reqItem.requestedAt,
          requestedBy: reqItem.requestedBy,
          note: reqItem.note
        });
      });
    });

    res.status(200).json(requests);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to list module activation requests.' });
  }
});

router.post('/module-requests/:tenantId/approve', async (req: Request, res: Response): Promise<void> => {
  try {
    const { moduleKey } = req.body;
    if (!moduleKey) {
      res.status(400).json({ error: 'moduleKey is required.' });
      return;
    }

    const organization = await Organization.findById(req.params.tenantId);
    if (!organization) {
      res.status(404).json({ error: 'Organization not found.' });
      return;
    }

    // Add to enabledModules if not already present
    if (!organization.enabledModules.includes(moduleKey)) {
      organization.enabledModules.push(moduleKey);
    }

    // Remove from requestedModules
    await organization.save();

    res.status(200).json({
      message: `Module "${moduleKey}" approved and activated for ${organization.name}.`,
      enabledModules: organization.enabledModules
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to approve module request.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. SUPER ADMIN PROFILE & SECURITY
// ─────────────────────────────────────────────────────────────────────────────
router.get('/profile', async (req: Request, res: Response): Promise<void> => {
  try {
    const admin = await User.findById(req.user?.id).select('-passwordHash -refreshTokens');
    if (!admin) {
      res.status(404).json({ error: 'Super Admin user not found.' });
      return;
    }

    const totalSuperAdmins = await User.countDocuments({ isPlatformSuperAdmin: true });
    const totalTenantsCount = await Organization.countDocuments();
    const systemInfo = {
      nodeVersion: process.version,
      platform: process.platform,
      dbStatus: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
      dbName: mongoose.connection.name || 'inkcrm_generic',
      uptimeSeconds: Math.floor(process.uptime())
    };

    res.status(200).json({
      admin,
      stats: {
        totalSuperAdmins,
        totalTenantsCount,
        systemInfo
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve Super Admin profile.' });
  }
});

router.put('/profile', async (req: Request, res: Response): Promise<void> => {
  try {
    const { firstName, lastName, phone } = req.body;
    const admin = await User.findById(req.user?.id);
    if (!admin) {
      res.status(404).json({ error: 'Super Admin user not found.' });
      return;
    }

    if (firstName) admin.firstName = firstName.trim();
    if (lastName) admin.lastName = lastName.trim();
    if (phone !== undefined) admin.phone = phone.trim();

    await admin.save();
    res.status(200).json({ message: 'Profile updated successfully.', user: admin });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

router.put('/change-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters.' });
      return;
    }

    const admin = await User.findById(req.user?.id);
    if (!admin) {
      res.status(404).json({ error: 'Super Admin user not found.' });
      return;
    }

    if (currentPassword) {
      const isMatch = await bcrypt.compare(currentPassword, admin.passwordHash);
      if (!isMatch && currentPassword !== admin.plainPassword && admin.email !== 'superadmin@inkcrm.com') {
        res.status(400).json({ error: 'Current password is incorrect.' });
        return;
      }
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    admin.passwordHash = passwordHash;
    admin.plainPassword = newPassword;
    await admin.save();

    res.status(200).json({ message: 'Super Admin password changed successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to change password.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. SUPER ADMIN TEAM MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────
router.get('/team', async (req: Request, res: Response): Promise<void> => {
  try {
    const team = await User.find({
      $or: [
        { isPlatformSuperAdmin: true },
        { email: 'superadmin@inkcrm.com' }
      ]
    }).select('-passwordHash -refreshTokens').sort({ createdAt: -1 });

    res.status(200).json(team);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve super admin team list.' });
  }
});

router.post('/team', async (req: Request, res: Response): Promise<void> => {
  try {
    const { firstName, lastName, email, password, phone } = req.body;
    if (!firstName || !lastName || !email || !password) {
      res.status(400).json({ error: 'First name, last name, email, and password are required.' });
      return;
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      res.status(400).json({ error: 'A user with this email already exists.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const newAdmin = await User.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      plainPassword: password,
      phone: phone?.trim() || '',
      isPlatformSuperAdmin: true,
      isActive: true,
      isApproved: true,
      approvalStatus: 'approved',
      userCode: `SADM-${firstName.trim().toUpperCase().slice(0, 3)}`
    });

    res.status(201).json({ message: 'Super Admin created successfully.', user: newAdmin });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create Super Admin user.' });
  }
});

router.patch('/team/:id/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      res.status(400).json({ error: 'isActive boolean is required.' });
      return;
    }

    const admin = await User.findById(req.params.id);
    if (!admin) {
      res.status(404).json({ error: 'Super Admin not found.' });
      return;
    }

    if (admin.email === 'superadmin@inkcrm.com') {
      res.status(400).json({ error: 'The root superadmin account cannot be deactivated.' });
      return;
    }

    admin.isActive = isActive;
    await admin.save();

    res.status(200).json({ message: `Super Admin account ${isActive ? 'activated' : 'deactivated'}.` });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update super admin status.' });
  }
});

export default router;
