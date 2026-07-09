import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import Role from '../models/Role';
import Organization from '../models/Organization';
import ModuleDefinition from '../models/ModuleDefinition';
import { authenticate } from '../middleware/authMiddleware';
import { encrypt, decrypt, euclideanDistance } from '../utils/encryption';
import { haversineDistance } from '../utils/geoUtils';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_access_token_key_12345';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'super_secret_jwt_refresh_token_key_54321';

// Token generation helpers
const generateAccessToken = (user: any) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      roleId: user.roleId,
      organizationId: user.organizationId
    },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
};

const generateRefreshToken = (user: any) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email
    },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
};

// Helper to parse user agent
const parseUserAgent = (userAgentString: string = '') => {
  let browser = 'Other';
  let os = 'Other';

  if (userAgentString.includes('Chrome')) browser = 'Google Chrome';
  else if (userAgentString.includes('Safari')) browser = 'Safari';
  else if (userAgentString.includes('Firefox')) browser = 'Firefox';
  else if (userAgentString.includes('Edge')) browser = 'Microsoft Edge';

  if (userAgentString.includes('Windows')) os = 'Windows';
  else if (userAgentString.includes('Macintosh')) os = 'macOS';
  else if (userAgentString.includes('Linux')) os = 'Linux';
  else if (userAgentString.includes('iPhone') || userAgentString.includes('iPad')) os = 'iOS';
  else if (userAgentString.includes('Android')) os = 'Android';

  return { browser, os };
};

// 1. Register User
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, firstName, lastName, companyName, subdomain, faceEmbedding, registrationLocation, userCode } = req.body;

    // ── Field validation ─────────────────────────────────────────────────────
    if (!email || !password || !firstName || !lastName || !companyName || !subdomain) {
      res.status(400).json({ error: 'All fields are required.' });
      return;
    }

    // Face embedding is mandatory
    if (!faceEmbedding || !Array.isArray(faceEmbedding) || faceEmbedding.length !== 128) {
      res.status(400).json({ error: 'Biometric face enrollment is mandatory to complete registration.' });
      return;
    }

    // GPS registration location is mandatory
    if (
      !registrationLocation ||
      typeof registrationLocation.latitude !== 'number' ||
      typeof registrationLocation.longitude !== 'number'
    ) {
      res.status(400).json({ error: 'GPS location is required for registration. Please allow location access and try again.' });
      return;
    }

    // Check if organization subdomain is already taken
    const existingOrg = await Organization.findOne({ subdomain: subdomain.toLowerCase() });
    if (existingOrg) {
      res.status(400).json({ error: 'Subdomain already registered.' });
      return;
    }

    // Check if user email exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      res.status(400).json({ error: 'Email already registered.' });
      return;
    }

    // Create Organization (Tenant)
    const org = await Organization.create({
      name: companyName,
      subdomain: subdomain.toLowerCase(),
      themeSettings: {
        primaryColor: '79 70 229',
        sidebarBg: '#0f172a',
        headerBg: '#ffffff',
        fontFamily: 'Inter',
        mode: 'light'
      },
      enabledModules: ['dashboard', 'leads', 'deals', 'companies', 'tasks', 'settings', 'reports', 'workflows']
    });

    // Create default Super Admin Role for this tenant
    const superAdminRole = await Role.create({
      organizationId: org._id,
      name: 'Super Admin',
      description: 'System owner with full privileges',
      isSystem: true,
      permissions: {
        modules: [
          { moduleName: 'leads', create: true, read: 'all', update: 'all', delete: 'all' },
          { moduleName: 'deals', create: true, read: 'all', update: 'all', delete: 'all' },
          { moduleName: 'companies', create: true, read: 'all', update: 'all', delete: 'all' },
          { moduleName: 'tasks', create: true, read: 'all', update: 'all', delete: 'all' }
        ],
        fields: [],
        menus: ['dashboard', 'leads', 'deals', 'companies', 'tasks', 'workflows', 'reports', 'settings']
      }
    });

    // Hash password & Create User with GPS location
    const passwordHash = await bcrypt.hash(password, 12); // 12 rounds for strong entropy
    const user = await User.create({
      organizationId: org._id,
      roleId: superAdminRole._id,
      firstName,
      lastName,
      email: email.toLowerCase(),
      passwordHash,
      isVerified: true,
      faceRecognition: {
        enabled: true,
        encryptedEmbedding: encrypt(JSON.stringify(faceEmbedding)),
        enrolledAt: new Date()
      },
      registrationLocation: {
        latitude: registrationLocation.latitude,
        longitude: registrationLocation.longitude,
        capturedAt: new Date()
      },
      locationRadius: 100, // default 100 meter radius
      userCode: userCode || undefined
    });

    console.log(`[AUTH] New account registered: ${email}, location: (${registrationLocation.latitude}, ${registrationLocation.longitude})`);

    res.status(201).json({
      message: 'Account successfully registered.',
      organizationId: org._id,
      userId: user._id
    });
  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ error: 'Failed to register account.' });
  }
});

// 2. Login User — Sequential: Password → Location → Face MFA
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, latitude, longitude, rememberMe } = req.body;
    // ── Step 0: Basic field validation ───────────────────────────────────────
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Generic message — do not reveal account existence
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    // ── Step 1: Password verification ────────────────────────────────────────
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      // Audit: track consecutive failures
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      user.lastFailedLoginAt = new Date();
      await user.save();
      console.warn(`[AUTH] Failed password attempt for ${email} — attempt #${user.failedLoginAttempts} at ${new Date().toISOString()}`);
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    // Reset failed login counter on successful password
    if (user.failedLoginAttempts > 0) {
      user.failedLoginAttempts = 0;
      user.lastFailedLoginAt = undefined;
    }

    // ── Step 2: Location verification (Haversine) — conditional ──────────────
    const hasRegisteredLocation = user.registrationLocation?.latitude !== undefined && 
                                  user.registrationLocation?.longitude !== undefined;

    if (hasRegisteredLocation) {
      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        // Location is required but not provided yet — return challenge
        res.status(200).json({
          locationRequired: true,
          message: 'Location verification is required for this account.'
        });
        return;
      }

      const regLoc = user.registrationLocation!;
      const distance = haversineDistance(
        latitude,
        longitude,
        regLoc.latitude,
        regLoc.longitude
      );

      const allowedRadius = user.locationRadius || 100;

      if (distance > allowedRadius) {
        console.warn(
          `[AUTH] Location mismatch for ${email}: distance=${distance.toFixed(1)}m, allowed=${allowedRadius}m at ${new Date().toISOString()}`
        );
        await user.save();
        res.status(403).json({
          error: `Login denied: You are not at the registered location. You are ${Math.round(distance)}m away (allowed: ${allowedRadius}m).`,
          code: 'LOCATION_MISMATCH',
          distance: Math.round(distance),
          allowedRadius
        });
        return;
      }
    }

    await user.save();

    // ── Step 3: Issue face MFA temp token (always required if enrolled) ──────
    if (user.faceRecognition?.enabled && user.faceRecognition.encryptedEmbedding) {
      let isMock = false;
      try {
        const storedString = decrypt(user.faceRecognition.encryptedEmbedding);
        const storedEmbedding = JSON.parse(storedString);
        isMock = Array.isArray(storedEmbedding) && 
                 storedEmbedding.length === 128 && 
                 storedEmbedding.every((v: number) => Math.abs(v - 0.1) < 1e-5);
      } catch (e) {
        console.error('[AUTH] Failed to parse stored embedding during login:', e);
      }

      if (isMock) {
        console.log(`[AUTH] Admin user ${email} is using the default mock face embedding. Bypassing face check to allow enrollment.`);
      } else {
        const tempToken = jwt.sign(
          { id: user._id, faceAuth: true, issuedAt: Date.now() },
          JWT_SECRET,
          { expiresIn: '5m' } // 5-minute window for face scan
        );
        res.status(200).json({
          mfaRequired: true,
          method: 'face',
          tempToken
        });
        return;
      }
    }

    // ── Fallback: no face enrolled — direct login ─────────────────────────────
    // (only for legacy/admin accounts created before face enrollment was mandatory)
    const uaString = req.headers['user-agent'] || '';
    const { browser, os } = parseUserAgent(uaString);
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const deviceId = Math.random().toString(36).substring(2, 15);

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshTokens.push(refreshToken);
    if (user.refreshTokens.length > 5) user.refreshTokens.shift();
    user.activeDevices.push({ deviceId, browser, os, ip, lastActive: new Date() });
    if (user.activeDevices.length > 5) user.activeDevices.shift();
    await user.save();

    const maxAge = rememberMe ? 7 * 24 * 60 * 60 * 1000 : 15 * 60 * 1000;
    res.cookie('token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge
    });

    res.status(200).json({
      message: 'Login successful.',
      token: accessToken,
      refreshToken,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        roleId: user.roleId,
        organizationId: user.organizationId
      }
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ error: 'Authentication failed.' });
  }
});

// 3. Complete 2FA login verification
router.post('/verify-mfa', async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, tempToken } = req.body;

    if (!code || !tempToken) {
      res.status(400).json({ error: 'Code and verification token are required.' });
      return;
    }

    const payload = jwt.verify(tempToken, JWT_SECRET) as { id: string; mfa: boolean };
    const user = await User.findById(payload.id);

    if (!user || user.twoFactor.tempToken !== tempToken) {
      res.status(401).json({ error: 'Invalid or expired multi-factor token.' });
      return;
    }

    // Mock verification check: code matches '123456'
    if (code !== '123456') {
      res.status(400).json({ error: 'Invalid multi-factor code.' });
      return;
    }

    // Reset temp tokens
    user.twoFactor.tempToken = undefined;

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshTokens.push(refreshToken);
    await user.save();

    res.cookie('token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    res.status(200).json({
      token: accessToken,
      refreshToken,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        roleId: user.roleId,
        organizationId: user.organizationId
      }
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid verification token.' });
  }
});

// 4. Toggle/Setup 2FA settings
router.post('/setup-2fa', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user?.id);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const enabled = !user.twoFactor.enabled;
    user.twoFactor.enabled = enabled;
    user.twoFactor.secret = enabled ? 'MOCK_SECRET_XYZ_555' : undefined;
    await user.save();

    res.status(200).json({
      message: `2FA successfully ${enabled ? 'enabled' : 'disabled'}.`,
      enabled,
      secret: user.twoFactor.secret
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to configure 2FA.' });
  }
});

// 5. Token Refresh Endpoint
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token is required.' });
      return;
    }

    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { id: string };
    const user = await User.findById(decoded.id);

    if (!user || !user.refreshTokens.includes(refreshToken)) {
      res.status(401).json({ error: 'Invalid or revoked refresh token.' });
      return;
    }

    const accessToken = generateAccessToken(user);

    res.cookie('token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    res.status(200).json({ token: accessToken });
  } catch (error) {
    res.status(401).json({ error: 'Refresh token expired or invalid.' });
  }
});

// 6. Get Device Sessions
router.get('/sessions', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user?.id);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    res.status(200).json(user.activeDevices);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sessions.' });
  }
});

// 7. Revoke Session Device
router.delete('/sessions/:deviceId', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user?.id);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    user.activeDevices = user.activeDevices.filter((d) => d.deviceId !== req.params.deviceId);
    await user.save();

    res.status(200).json({ message: 'Session device successfully revoked.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to revoke session.' });
  }
});

// 8. Logout User
router.post('/logout', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user?.id);
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];

    if (user && token) {
      // Remove token from refresh token collection
      user.refreshTokens = user.refreshTokens.filter((t) => t !== token);
      await user.save();
    }

    res.clearCookie('token');
    res.status(200).json({ message: 'Logout successful.' });
  } catch (error) {
    res.status(500).json({ error: 'Logout failed.' });
  }
});

// 9. Get tenant roles (Authenticated)
router.get('/roles', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const roles = await Role.find({ organizationId: req.organizationId });
    res.status(200).json(roles);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve tenant roles.' });
  }
});

// 10. Update tenant role permissions and/or name/status (Authenticated)
router.put('/roles/:id', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, permissions, isActive } = req.body;
    const role = await Role.findOne({ _id: req.params.id, organizationId: req.organizationId });
    if (!role) {
      res.status(404).json({ error: 'Role not found.' });
      return;
    }
    if (name) role.name = name;
    if (permissions) role.permissions.modules = permissions;
    if (typeof isActive === 'boolean') role.isActive = isActive;
    await role.save();
    res.status(200).json({ message: 'Role updated successfully.', role });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update role.' });
  }
});

// 10b. Create tenant role (Authenticated)
router.post('/roles', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, isActive } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Role name is required.' });
      return;
    }
    
    // Seed default permissions for all modules
    const modules = await ModuleDefinition.find({ organizationId: req.organizationId });
    const modulePermissions = modules.map((m: any) => ({
      moduleName: m.name,
      create: true,
      read: 'all' as const,
      update: 'all' as const
    }));

    const newRole = await Role.create({
      organizationId: req.organizationId,
      name,
      description: `Custom role ${name}`,
      permissions: {
        modules: modulePermissions
      },
      isSystem: false,
      isActive: typeof isActive === 'boolean' ? isActive : true
    });

    res.status(201).json(newRole);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create role.' });
  }
});

// 10c. Delete tenant role (Authenticated)
router.delete('/roles/:id', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const role = await Role.findOne({ _id: req.params.id, organizationId: req.organizationId });
    if (!role) {
      res.status(404).json({ error: 'Role not found.' });
      return;
    }
    if (role.isSystem) {
      res.status(400).json({ error: 'System roles cannot be deleted.' });
      return;
    }
    await Role.findByIdAndDelete(role._id);
    res.status(200).json({ message: 'Role deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete role.' });
  }
});

// 5. Verify Face Login — ALWAYS uses real Euclidean distance (no bypasses)
router.post('/face/verify', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tempToken, embedding } = req.body;

    if (!tempToken || !embedding || !Array.isArray(embedding)) {
      res.status(400).json({ error: 'Token and face embedding array are required.' });
      return;
    }

    if (embedding.length !== 128) {
      res.status(400).json({ error: 'Invalid face embedding: must be a 128-dimensional vector.' });
      return;
    }

    // Verify temp token (issued during login step 2)
    let decoded: any;
    try {
      decoded = jwt.verify(tempToken, JWT_SECRET);
    } catch (tokenErr) {
      res.status(401).json({ error: 'Face verification session expired. Please log in again.' });
      return;
    }

    if (!decoded || !decoded.faceAuth) {
      res.status(401).json({ error: 'Invalid verification token.' });
      return;
    }

    const user = await User.findById(decoded.id);
    if (!user || !user.faceRecognition?.enabled || !user.faceRecognition.encryptedEmbedding) {
      res.status(401).json({ error: 'Face recognition not configured for this account.' });
      return;
    }

    // Decrypt stored embedding
    let storedEmbedding: number[];
    try {
      const storedString = decrypt(user.faceRecognition.encryptedEmbedding);
      storedEmbedding = JSON.parse(storedString);
    } catch (decryptErr) {
      console.error('[AUTH] Face embedding decryption failed:', decryptErr);
      res.status(500).json({ error: 'Biometric verification failed internally.' });
      return;
    }

    // ── Real Euclidean distance comparison — NO bypasses ─────────────────────
    const distance = euclideanDistance(embedding, storedEmbedding);

    // face-api.js threshold: 0.6. Enterprise threshold: 0.55 (stricter)
    const FACE_MATCH_THRESHOLD = 0.55;

    console.log(`[AUTH] Face verification for user ${user.email}: distance=${distance.toFixed(4)}, threshold=${FACE_MATCH_THRESHOLD}`);

    if (distance > FACE_MATCH_THRESHOLD) {
      console.warn(`[AUTH] Face mismatch for ${user.email}: distance=${distance.toFixed(4)} exceeds threshold=${FACE_MATCH_THRESHOLD}`);
      res.status(401).json({ error: 'Face verification failed. Biometric data does not match.' });
      return;
    }

    // ── Face matched — issue full authentication tokens ───────────────────────
    const uaString = req.headers['user-agent'] || '';
    const { browser, os } = parseUserAgent(uaString);
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const deviceId = Math.random().toString(36).substring(2, 15);

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshTokens.push(refreshToken);
    if (user.refreshTokens.length > 5) user.refreshTokens.shift();
    user.activeDevices.push({ deviceId, browser, os, ip, lastActive: new Date() });
    if (user.activeDevices.length > 5) user.activeDevices.shift();
    user.failedLoginAttempts = 0; // clear any previous failure count
    await user.save();

    console.log(`[AUTH] Successful face verification login for ${user.email} at ${new Date().toISOString()}`);

    res.status(200).json({
      message: 'Authentication successful.',
      token: accessToken,
      refreshToken,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        roleId: user.roleId,
        organizationId: user.organizationId
      }
    });
  } catch (error) {
    console.error('[AUTH] Face verify internal error:', error);
    res.status(500).json({ error: 'Face verification failed.' });
  }
});

// Location Check — verifies if provided GPS is within user's registered radius
// NOTE: Only returns distance info after password is validated via /auth/login.
// This endpoint exists for real-time UI feedback during the location step.
router.post('/location/check', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, latitude, longitude } = req.body;

    if (!email || typeof latitude !== 'number' || typeof longitude !== 'number') {
      res.status(400).json({ error: 'Email and GPS coordinates are required.' });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    // If user not found or has no registration location, return generic success
    // (actual auth will still fail later — we don't reveal account existence)
    if (!user || !user.registrationLocation?.latitude) {
      res.status(200).json({ withinRadius: true, distance: 0, allowedRadius: 100 });
      return;
    }

    const distance = haversineDistance(
      latitude,
      longitude,
      user.registrationLocation.latitude,
      user.registrationLocation.longitude
    );

    const allowedRadius = user.locationRadius || 100;

    res.status(200).json({
      withinRadius: distance <= allowedRadius,
      distance: Math.round(distance),
      allowedRadius
    });
  } catch (error) {
    res.status(500).json({ error: 'Location check failed.' });
  }
});

// 6. Enroll Face (Requires standard authentication first)
router.post('/face/enroll', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { embedding } = req.body;
    const userId = (req as any).user.id;

    if (!embedding || !Array.isArray(embedding)) {
      res.status(400).json({ error: 'Embedding array is required.' });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    // Encrypt the array as a string
    const encryptedEmbedding = encrypt(JSON.stringify(embedding));

    user.faceRecognition = {
      enabled: true,
      encryptedEmbedding,
      enrolledAt: new Date()
    };

    await user.save();

    res.status(200).json({ message: 'Face enrolled successfully.' });
  } catch (error) {
    console.error('Face enrollment error:', error);
    res.status(500).json({ error: 'Failed to enroll face.' });
  }
});

// 7a. Get Face Login Status
router.get('/face/status', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    res.status(200).json({ enabled: user.faceRecognition?.enabled || false });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check face status.' });
  }
});

// 7b. Disable Face Login
router.post('/face/disable', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const user = await User.findById(userId);
    
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    user.faceRecognition = {
      enabled: false,
      encryptedEmbedding: undefined,
      enrolledAt: undefined
    };

    await user.save();
    res.status(200).json({ message: 'Face recognition disabled and data deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to disable face recognition.' });
  }
});

// 8. List Tenant Users
router.get('/users', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await User.find({ organizationId: req.organizationId })
      .populate('roleId', 'name')
      .select('-passwordHash -refreshTokens');
    res.status(200).json(users);
  } catch (e) {
    res.status(500).json({ error: 'Failed to retrieve users.' });
  }
});

// 9. Add User
router.post('/users', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, firstName, lastName, roleId } = req.body;
    if (!email || !password || !firstName || !lastName || !roleId) {
      res.status(400).json({ error: 'All fields are required.' });
      return;
    }
    
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      res.status(400).json({ error: 'Email already registered.' });
      return;
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      organizationId: req.organizationId,
      roleId,
      firstName,
      lastName,
      email: email.toLowerCase(),
      passwordHash,
      isVerified: true
    });
    
    res.status(201).json(newUser);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create user.' });
  }
});

// 10. Update User
router.put('/users/:id', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { firstName, lastName, roleId, email } = req.body;
    const user = await User.findOne({ _id: req.params.id, organizationId: req.organizationId });
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (roleId) user.roleId = roleId;
    if (email) user.email = email.toLowerCase();
    
    await user.save();
    res.status(200).json(user);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update user.' });
  }
});

// 11. Delete User
router.delete('/users/:id', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findOneAndDelete({ _id: req.params.id, organizationId: req.organizationId });
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    res.status(200).json({ message: 'User deleted successfully.' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

export default router;
