import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

export interface DecodedToken {
  id: string;
  email: string;
  roleId?: string;
  organizationId?: string;
  isPlatformSuperAdmin?: boolean;
  isImpersonated?: boolean;
  impersonatedBy?: string;
  impersonationLogId?: string;
}

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  try {
    let token = '';

    // Check auth header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    // Check cookies if not in header
    if (!token && req.headers.cookie) {
      const cookies = Object.fromEntries(
        req.headers.cookie.split('; ').map((c) => {
          const parts = c.split('=');
          return [parts[0], parts.slice(1).join('=')];
        })
      );
      token = cookies.token;
    }

    if (!token) {
      res.status(401).json({ error: 'Authentication required. No token provided.' });
      return;
    }

    const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_access_token_key_12345';
    const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;

    req.user = decoded;
    
    // Platform Super Admin bypasses cross-tenant restrictions
    if (!decoded.isPlatformSuperAdmin) {
      // Enforce that the user's tenant matches the request tenant context if specified
      if (req.organizationId && decoded.organizationId && req.organizationId.toString() !== decoded.organizationId) {
        res.status(403).json({ error: 'Cross-tenant access forbidden. Access denied.' });
        return;
      }
    }

    // Automatically bind organizationId from user if not resolved yet and present in token
    if (!req.organizationId && decoded.organizationId && mongoose.Types.ObjectId.isValid(decoded.organizationId)) {
      req.organizationId = new mongoose.Types.ObjectId(decoded.organizationId);
    }

    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
};
