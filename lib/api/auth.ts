/**
 * Auth API calls – login / logout.
 */
import apiClient from "./client";
import type { User } from "@/types/models";

export interface LoginPayload {
  email: string;
  password: string;
  device_name?: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export const authApi = {
  login: (payload: LoginPayload) =>
    apiClient.post<LoginResponse>("/login", {
      ...payload,
      device_name: payload.device_name ?? "StoreManage Mobile",
    }),

  logout: () => apiClient.post("/logout"),

  me: () => apiClient.get<User>("/user"),
};
