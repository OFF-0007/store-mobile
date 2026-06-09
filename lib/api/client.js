/**
 * Axios client with Sanctum Bearer-token interceptor.
 * The token is read from the auth store (Zustand) at request time,
 * so it is always fresh even after a token refresh.
 */
import axios from "axios";
import * as SecureStore from "expo-secure-store";

// ─── Base URL ────────────────────────────────────────────────────────────────
// Override via environment variable or update directly here.
// For Android Emulator: use 10.0.2.2
// For iOS Simulator: use localhost or 127.0.0.1
// For Physical Device: use your machine's LAN IP
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:8001/api";

export const TOKEN_KEY = "sanctum_token";

// ─── Axios instance ──────────────────────────────────────────────────────────
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// ─── Request interceptor – attach Bearer token & X-Store-Id ───────────────
apiClient.interceptors.request.use(
  async (config) => {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Always inject the currently active store_id
    const userSession = await SecureStore.getItemAsync("user_session");
    if (userSession) {
      try {
        const user = JSON.parse(userSession);
        if (user?.store_id) {
          config.headers["X-Store-Id"] = user.store_id;
        }
      } catch (e) {
        // ignore parse errors
      }
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response interceptor – normalise errors ─────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Surface a human-readable message from Laravel validation errors
    const data = error.response?.data;
    const message =
      data?.message ??
      error.message ??
      "An unexpected error occurred.";
    return Promise.reject(new Error(message));
  }
);

export default apiClient;
