/**
 * Auth store – connects to actual Laravel API via apiClient.
 */
import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import apiClient, { TOKEN_KEY } from "@/lib/api/client";

const USER_SESSION_KEY = "user_session";

export const useAuthStore = create((set) => ({
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
      await apiClient.post("/logout").catch(() => { });
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

  // ── Switch Store ───────────────────────────────────────────────────────────
  switchStore: async (storeId) => {
    try {
      set({ isLoading: true });
      const userStr = await SecureStore.getItemAsync(USER_SESSION_KEY);
      if (userStr) {
        let user = JSON.parse(userStr);
        user.store_id = storeId;
        await SecureStore.setItemAsync(USER_SESSION_KEY, JSON.stringify(user));
        
        apiClient.defaults.headers.common["X-Store-Id"] = storeId;
        
        set({ user, isLoading: false });
      }
    } catch (e) {
      set({ isLoading: false });
      throw e;
    }
  },

  // ── Restore session ────────────────────────────────────────────────────────
  restoreSession: async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      const userStr = await SecureStore.getItemAsync(USER_SESSION_KEY);

      if (token && userStr) {
        let user = JSON.parse(userStr);

        if (token) {
          apiClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;
        }

        if (user?.store_id) {
          apiClient.defaults.headers.common["X-Store-Id"] = user.store_id;
        }

        set({
          token,
          user,
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

// End of auth store

