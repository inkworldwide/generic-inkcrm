import { create } from 'zustand';
import api from '../services/api';

export interface ThemeSettings {
  primaryColor: string; // RGB triplet e.g. "79 70 229"
  sidebarBg: string;
  headerBg: string;
  fontFamily: string;
  mode: 'light' | 'dark' | 'system';
}

interface TenantBranding {
  id: string;
  name: string;
  subdomain: string;
  logoUrl?: string;
  faviconUrl?: string;
  loginBgUrl?: string;
  themeSettings: ThemeSettings;
  enabledModules: string[];

  // Extended fields
  companyCode?: string;
  registrationId?: string;
  startDate?: string;
  endDate?: string;
  companyDocUrl?: string;
  phoneNumber?: string;
  mobile?: string;
  email?: string;
  fax?: string;
  website?: string;

  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;

  adminDetails?: {
    firstName?: string;
    lastName?: string;
    username?: string;
    password?: string;
    financialYear?: string;
    roleType?: string;
  };
}

interface ThemeState {
  branding: TenantBranding | null;
  loadingBranding: boolean;
  fetchBranding: (subdomain?: string, tenantId?: string) => Promise<TenantBranding | null>;
  applyTheme: (settings: ThemeSettings) => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  branding: null,
  loadingBranding: false,

  fetchBranding: async (subdomain, tenantId) => {
    set({ loadingBranding: true });
    try {
      const params: Record<string, string> = {};
      if (subdomain) params.subdomain = subdomain;
      
      const headers: Record<string, string> = {};
      if (tenantId) headers['x-tenant-id'] = tenantId;

      const res = await api.get('/tenants/branding', { params, headers });
      const branding = res.data;

      set({ branding, loadingBranding: false });
      
      // Save branding details
      localStorage.setItem('tenantId', branding.id);
      localStorage.setItem('tenantSubdomain', branding.subdomain);
      
      get().applyTheme(branding.themeSettings);
      return branding;
    } catch (err) {
      console.error('Failed to load branding:', err);
      set({ loadingBranding: false });
      return null;
    }
  },

  applyTheme: (settings) => {
    const root = document.documentElement;
    
    // Apply CSS Variables
    root.style.setProperty('--color-primary', settings.primaryColor || '79 70 229');
    root.style.setProperty('--sidebar-bg', settings.sidebarBg || '#0f172a');
    root.style.setProperty('--header-bg', settings.headerBg || '#ffffff');
    root.style.setProperty('--font-family', `${settings.fontFamily || 'Inter'}, sans-serif`);

    // Force light mode as requested by removing any dark class
    root.classList.remove('dark');
  }
}));
