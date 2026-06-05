/**
 * Auth API calls – login / logout.
 */
import apiClient from "./client";

export const authApi = {
  login: (payload) =>
    apiClient.post("/login", {
      ...payload,
      device_name: payload.device_name ?? "StoreManage Mobile",
    }),

  logout: () => apiClient.post("/logout"),

  me: () => apiClient.get("/user"),
};
