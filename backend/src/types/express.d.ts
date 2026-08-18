import mongoose from 'mongoose';

declare global {
  namespace Express {
    interface Request {
      organizationId?: mongoose.Types.ObjectId;
      user?: {
        id: string;
        email: string;
        roleId?: string;
        organizationId?: string;
        isPlatformSuperAdmin?: boolean;
        isImpersonated?: boolean;
        impersonatedBy?: string;
        impersonationLogId?: string;
      };
    }
  }
}
