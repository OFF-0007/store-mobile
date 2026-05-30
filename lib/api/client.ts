/**
 * Axios client with Sanctum Bearer-token interceptor.
 * The token is read from the auth store (Zustand) at request time,
 * so it is always fresh even after a token refresh.
 */
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import * as SecureStore from "expo-secure-store";

// ─── Base URL ────────────────────────────────────────────────────────────────
// Override via environment variable or update directly here.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://10.148.107.202:8000/api";

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

// ─── Request interceptor – attach Bearer token ───────────────────────────────
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// ─── Response interceptor – normalise errors ─────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Surface a human-readable message from Laravel validation errors
    const data = error.response?.data as Record<string, unknown> | undefined;
    const message =
      (data?.message as string) ??
      error.message ??
      "An unexpected error occurred.";
    return Promise.reject(new Error(message));
  }
);

export default apiClient;
