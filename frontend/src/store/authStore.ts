import { create } from 'zustand';
import api from '../services/api';

export interface ModulePermission {
  moduleName: string;
  create: boolean;
  read: 'all' | 'own' | 'none';
  update: 'all' | 'own' | 'none';
  delete: 'all' | 'own' | 'none';
}

export interface UserRole {
  _id: string;
  name: string;
  description?: string;
  isSystem?: boolean;
  permissions?: {
    modules?: ModulePermission[];
    menus?: string[];
    fields?: any[];
  };
}

export interface OrganizationInfo {
  id: string;
  name: string;
  subdomain: string;
  verticalType?: string;
  enabledModules?: string[];
  themeSettings?: any;
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  roleId: string | UserRole;
  organizationId?: string;
  isPlatformSuperAdmin?: boolean;
  mustResetPassword?: boolean;
  subdomain?: string;
  isImpersonated?: boolean;
}

export interface ImpersonationState {
  isImpersonating: boolean;
  originalToken?: string;
  originalUser?: User;
  impersonationLogId?: string;
  tenantOrganization?: OrganizationInfo;
}

interface AuthState {
  user: User | null;
  role: UserRole | null;
  organization: OrganizationInfo | null;
  token: string | null;
  isPlatformSuperAdmin: boolean;
  impersonation: ImpersonationState;
  isAuthenticated: boolean;
  isInitializing: boolean;
  previewRole: UserRole | null;
  setPreviewRole: (role: UserRole | null) => void;
  setAuth: (user: User, token: string, refreshToken?: string, organization?: any) => void;
  setRole: (role: UserRole) => void;
  loginAsTenant: (tenantToken: string, tenantUser: any, tenantOrg: any, logId?: string) => void;
  returnToSuperAdmin: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => void;
  canAccessMenu: (menuKey: string) => boolean;
  canAccessModule: (moduleName: string, action?: 'create' | 'read' | 'update' | 'delete') => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  role: null,
  previewRole: null,
  organization: null,
  token: null,
  isPlatformSuperAdmin: false,
  impersonation: {
    isImpersonating: false
  },
  isAuthenticated: false,
  isInitializing: true,

  setPreviewRole: (previewRole: UserRole | null) => {
    set({ previewRole });
  },

  setAuth: (user, token, refreshToken, organization) => {
    localStorage.setItem('token', token);
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
    }
    if (user.organizationId) {
      localStorage.setItem('tenantId', user.organizationId);
    } else {
      localStorage.removeItem('tenantId');
    }
    localStorage.setItem('user', JSON.stringify(user));
    
    const isPlatformSuperAdmin = !!user.isPlatformSuperAdmin || user.email === 'superadmin@inkcrm.com';

    set({ 
      user, 
      token, 
      organization: organization || null,
      isPlatformSuperAdmin,
      isAuthenticated: true, 
      isInitializing: false 
    });

    if (user.organizationId) {
      get().fetchProfile();
    }
  },

  loginAsTenant: (tenantToken, tenantUser, tenantOrg, logId) => {
    const currentToken = get().token;
    const currentUser = get().user;

    localStorage.setItem('originalSuperAdminToken', currentToken || '');
    localStorage.setItem('originalSuperAdminUser', JSON.stringify(currentUser || {}));
    if (logId) localStorage.setItem('impersonationLogId', logId);

    localStorage.setItem('token', tenantToken);
    if (tenantUser.organizationId) {
      localStorage.setItem('tenantId', tenantUser.organizationId);
    }
    localStorage.setItem('user', JSON.stringify(tenantUser));

    set({
      token: tenantToken,
      user: { ...tenantUser, isImpersonated: true },
      organization: tenantOrg,
      isPlatformSuperAdmin: false,
      impersonation: {
        isImpersonating: true,
        originalToken: currentToken || undefined,
        originalUser: currentUser || undefined,
        impersonationLogId: logId,
        tenantOrganization: tenantOrg
      }
    });

    get().fetchProfile();
  },

  returnToSuperAdmin: async () => {
    const originalToken = localStorage.getItem('originalSuperAdminToken') || get().impersonation.originalToken;
    const originalUserStr = localStorage.getItem('originalSuperAdminUser');
    const logId = localStorage.getItem('impersonationLogId') || get().impersonation.impersonationLogId;

    // Call backend to record end of impersonation log
    if (logId) {
      try {
        await api.post('/super-admin/end-impersonation', { logId }, {
          headers: { Authorization: `Bearer ${originalToken}` }
        });
      } catch (e) {}
    }

    if (originalToken && originalUserStr) {
      try {
        const originalUser = JSON.parse(originalUserStr);
        localStorage.setItem('token', originalToken);
        localStorage.removeItem('tenantId');
        localStorage.setItem('user', JSON.stringify(originalUser));
        localStorage.removeItem('originalSuperAdminToken');
        localStorage.removeItem('originalSuperAdminUser');
        localStorage.removeItem('impersonationLogId');

        set({
          token: originalToken,
          user: originalUser,
          role: null,
          organization: null,
          isPlatformSuperAdmin: true,
          impersonation: { isImpersonating: false }
        });
      } catch (e) {
        console.error('Failed restoring superadmin session:', e);
      }
    }
  },

  setRole: (role) => {
    set({ role });
  },

  fetchProfile: async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await api.get('/auth/me');
      const isPlatformSuperAdmin = res.data?.isPlatformSuperAdmin || res.data?.user?.email === 'superadmin@inkcrm.com';
      if (res.data?.role) {
        set({ role: res.data.role });
      }
      if (res.data?.organization) {
        set({ organization: res.data.organization });
      }
      if (res.data?.user) {
        set({
          isPlatformSuperAdmin,
          user: {
            id: res.data.user._id || res.data.user.id,
            firstName: res.data.user.firstName,
            lastName: res.data.user.lastName,
            email: res.data.user.email,
            roleId: res.data.user.roleId,
            organizationId: res.data.user.organizationId,
            isPlatformSuperAdmin,
            mustResetPassword: res.data.user.mustResetPassword,
            subdomain: res.data.user.subdomain
          }
        });
      }
    } catch (err) {
      console.warn('Failed to load user profile & permissions:', err);
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      localStorage.removeItem('tenantId');
      localStorage.removeItem('originalSuperAdminToken');
      localStorage.removeItem('originalSuperAdminUser');
      localStorage.removeItem('impersonationLogId');
      set({ 
        user: null, 
        role: null, 
        organization: null, 
        token: null, 
        isPlatformSuperAdmin: false,
        impersonation: { isImpersonating: false },
        isAuthenticated: false 
      });
    }
  },

  initialize: async () => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    const origToken = localStorage.getItem('originalSuperAdminToken');
    const origUserStr = localStorage.getItem('originalSuperAdminUser');

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        const isPlatformSuperAdmin = !!user.isPlatformSuperAdmin || user.email === 'superadmin@inkcrm.com';
        
        let impersonationState: ImpersonationState = { isImpersonating: false };
        if (origToken && origUserStr) {
          impersonationState = {
            isImpersonating: true,
            originalToken: origToken,
            originalUser: JSON.parse(origUserStr),
            impersonationLogId: localStorage.getItem('impersonationLogId') || undefined
          };
        }

        set({ 
          user, 
          token, 
          isPlatformSuperAdmin: isPlatformSuperAdmin && !impersonationState.isImpersonating,
          impersonation: impersonationState,
          isAuthenticated: true, 
          isInitializing: false 
        });
        get().fetchProfile();
      } catch (e) {
        set({ isInitializing: false });
      }
    } else {
      set({ isInitializing: false });
    }
  },

  canAccessMenu: (menuKey: string) => {
    const state = get();
    const normalizedKey = (menuKey || '').toLowerCase().replace(/[-_\s]/g, '');

    // Core quick actions always accessible
    if (
      normalizedKey === 'createlead' ||
      normalizedKey === 'mycampaign' ||
      normalizedKey === 'create_lead' ||
      normalizedKey === 'my_campaign'
    ) {
      return true;
    }

    // Check organization-level enabled modules (Platform kill-switch)
    const org = state.organization;
    if (org && Array.isArray(org.enabledModules) && org.enabledModules.length > 0) {
      const isOrgAllowed = org.enabledModules.some((m: string) => {
        const norm = (m || '').toLowerCase().replace(/[-_\s]/g, '');
        return norm === normalizedKey ||
          (norm === 'reports' && (normalizedKey.includes('report') || normalizedKey.includes('telecaller'))) ||
          (norm === 'funnel' && normalizedKey.includes('funnel')) ||
          (norm === 'leads' && (normalizedKey.includes('lead') || normalizedKey.includes('leadsprocess')));
      });
      if (!isOrgAllowed && normalizedKey !== 'dashboard' && normalizedKey !== 'settings') {
        return false;
      }
    }

    // Active role (either from live preview or from session)
    const activeRole = state.previewRole || state.role;

    if (activeRole) {
      const allowedMenus = activeRole.permissions?.menus;
      if (Array.isArray(allowedMenus)) {
        return allowedMenus.some((m: string) => {
          const norm = (m || '').toLowerCase().replace(/[-_\s]/g, '');
          if (norm === normalizedKey) return true;
          if (norm === 'reports' && (normalizedKey.includes('report') || normalizedKey.includes('telecaller'))) return true;
          if (norm === 'funnel' && normalizedKey.includes('funnel')) return true;
          if (norm === 'security' && (normalizedKey.includes('accessprivilege') || normalizedKey.includes('leadtransfer'))) return true;
          if (norm === 'campaigns' && (normalizedKey.includes('campaign') || normalizedKey.includes('campaignassignment'))) return true;
          if (norm === 'leads' && (normalizedKey.includes('lead') || normalizedKey.includes('leadsprocess'))) return true;
          return false;
        });
      }
    }

    // If pure platform super admin not impersonating and has no role/preview restrictions, allow all
    if (state.isPlatformSuperAdmin && !state.impersonation.isImpersonating && !state.role && !state.previewRole) {
      return true;
    }

    return true;
  },

  canAccessModule: (moduleName: string, action: 'create' | 'read' | 'update' | 'delete' = 'read') => {
    const state = get();
    const activeRole = state.previewRole || state.role;

    if (!activeRole) {
      if (state.isPlatformSuperAdmin && !state.impersonation.isImpersonating) return true;
      return true;
    }

    const modules = activeRole.permissions?.modules;
    if (!Array.isArray(modules) || modules.length === 0) return true;

    const mod = modules.find(
      (m) => m.moduleName.toLowerCase() === moduleName.toLowerCase()
    );
    if (!mod) return true;

    if (action === 'create') return mod.create !== false;
    if (action === 'read') return mod.read !== 'none';
    if (action === 'update') return mod.update !== 'none';
    if (action === 'delete') return mod.delete !== 'none';

    return true;
  }
}));
