/**
 * Root layout – bootstraps React Query, restores auth session, and
 * redirects to the correct layout group ((auth) or (tabs)).
 *
 * IMPORTANT: The <Stack> navigator must ALWAYS render so that
 * expo-router's NavigationContainer is mounted. Returning a plain
 * component (e.g. LoadingScreen) before the Stack causes the
 * "Couldn't find a navigation context" crash.
 */
import "../global.css";

import React, { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuthStore } from "@/store/authStore";

// Keep the splash screen visible while we restore the session
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { restoreSession, isLoading } = useAuthStore();

  useEffect(() => {
    restoreSession();
  }, []);

  // Hide the native splash screen once auth state is resolved
  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="inventory" options={{ headerShown: false }} />
        <Stack.Screen name="reports" options={{ headerShown: false }} />
        <Stack.Screen name="purchase-return" options={{ headerShown: false }} />
        <Stack.Screen name="sales-return" options={{ headerShown: false }} />
      </Stack>

    </QueryClientProvider>
  );
}
