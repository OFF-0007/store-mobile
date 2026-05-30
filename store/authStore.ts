/**
 * Auth store – connects to actual Laravel API via apiClient.
 */
import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import apiClient, { TOKEN_KEY } from "@/lib/api/client";
import type { User } from "@/types/models";

const USER_SESSION_KEY = "user_session";

export interface MobileUser extends User {
  permissions: string[];
}

interface AuthState {
  user: MobileUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true, // start in loading state to restore session cleanly
  isAuthenticated: false,

  // ── Login ──────────────────────────────────────────────────────────────────
  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const response = await apiClient.post("/login", { email, password });
      const { token, user } = response.data;

      // Save credentials in secure storage
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      await SecureStore.setItemAsync(USER_SESSION_KEY, JSON.stringify(user));

      set({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  // ── Logout ─────────────────────────────────────────────────────────────────
  logout: async () => {
    set({ isLoading: true });
    try {
      await apiClient.post("/logout").catch(() => {});
    } finally {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_SESSION_KEY);
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  // ── Restore session ────────────────────────────────────────────────────────
  restoreSession: async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      const userStr = await SecureStore.getItemAsync(USER_SESSION_KEY);

      if (token && userStr) {
        set({
          token,
          user: JSON.parse(userStr),
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({
          token: null,
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    } catch (err) {
      set({
        token: null,
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },
}));
