import { create } from 'zustand';
import api from '../services/api';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  roleId: string;
  organizationId: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  setAuth: (user: User, token: string, refreshToken?: string) => void;
  logout: () => Promise<void>;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isInitializing: true,

  setAuth: (user, token, refreshToken) => {
    localStorage.setItem('token', token);
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
    }
    localStorage.setItem('tenantId', user.organizationId);
    set({ user, token, isAuthenticated: true, isInitializing: false });
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      // Keep tenantId in localStorage so that branding stays during logouts!
      set({ user: null, token: null, isAuthenticated: false });
    }
  },

  initialize: () => {
    const token = localStorage.getItem('token');
    const tenantId = localStorage.getItem('tenantId');
    const userStr = localStorage.getItem('user');

    if (token && tenantId && userStr) {
      try {
        const user = JSON.parse(userStr);
        set({ user, token, isAuthenticated: true, isInitializing: false });
      } catch (e) {
        set({ isInitializing: false });
      }
    } else {
      set({ isInitializing: false });
    }
  }
}));
