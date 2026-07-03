import { Router, Request, Response } from 'express';
import Organization from '../models/Organization';
import { authenticate } from '../middleware/authMiddleware';
import { requireTenant } from '../middleware/tenantMiddleware';
import { seedDatabase } from '../utils/seeder';

const router = Router();

// 1. Get branding settings (Public - called on application load)
router.get('/branding', async (req: Request, res: Response): Promise<void> => {
  try {
    const subdomain = req.query.subdomain as string;
    let tenantId = req.headers['x-tenant-id'] as string;
    let organization = null;

    if (tenantId) {
      organization = await Organization.findById(tenantId);
    } 
    
    if (!organization && subdomain) {
      organization = await Organization.findOne({ subdomain: subdomain.toLowerCase() });
    }

    if (!organization) {
      res.status(404).json({ error: 'Tenant profile not found.' });
      return;
    }

    res.status(200).json({
      id: organization._id,
      name: organization.name,
      subdomain: organization.subdomain,
      logoUrl: organization.logoUrl,
      faviconUrl: organization.faviconUrl,
      loginBgUrl: organization.loginBgUrl,
      themeSettings: organization.themeSettings,
      enabledModules: organization.enabledModules
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve branding profile.' });
  }
});

// 2. Update branding settings (Authenticated - Admin Only)
router.put('/branding', authenticate, requireTenant, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, themeSettings, logoUrl, faviconUrl, loginBgUrl } = req.body;

    const organization = await Organization.findById(req.organizationId);
    if (!organization) {
      res.status(404).json({ error: 'Organization not found.' });
      return;
    }

    if (name) organization.name = name;
    if (logoUrl) organization.logoUrl = logoUrl;
    if (faviconUrl) organization.faviconUrl = faviconUrl;
    if (loginBgUrl) organization.loginBgUrl = loginBgUrl;

    if (themeSettings) {
      organization.themeSettings = {
        ...organization.themeSettings,
        ...themeSettings
      };
    }

    await organization.save();

    res.status(200).json({
      message: 'Branding specifications updated successfully.',
      branding: {
        id: organization._id,
        name: organization.name,
        logoUrl: organization.logoUrl,
        faviconUrl: organization.faviconUrl,
        loginBgUrl: organization.loginBgUrl,
        themeSettings: organization.themeSettings
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update branding settings.' });
  }
});

// 3. Re-seed database (Public - for easy testing/resetting in demo)
router.post('/seed-demo', async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('User requested manual database re-seeding...');
    await seedDatabase(false);
    res.status(200).json({ message: 'Database successfully seeded with demo organizations, modules, and records.' });
  } catch (error: any) {
    console.error('Failed to seed database:', error);
    res.status(500).json({ error: 'Failed to seed database: ' + error.message });
  }
});

export default router;
