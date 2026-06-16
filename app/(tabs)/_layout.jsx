import React from "react";
import { Redirect, Tabs } from "expo-router";
import { useAuthStore } from "@/store/authStore";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import Feather from '@expo/vector-icons/Feather';
import AntDesign from '@expo/vector-icons/AntDesign';
import { StatusBar } from "expo-status-bar";

export default function TabsLayout() {
  const { isAuthenticated, user } = useAuthStore();
  const insets = useSafeAreaInsets();

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <>
      <StatusBar style="light" backgroundColor="#f97316" />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: "#f97316",
          tabBarInactiveTintColor: "#64748b",
          tabBarShowLabel: true,
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "600",
            paddingBottom: 6,
          },
          tabBarStyle: {
            backgroundColor: "#ffffff",
            borderTopWidth: 1,
            borderTopColor: "#e2e8f0",
            height: 65 + insets.bottom,
            paddingBottom: insets.bottom,
            paddingTop: 8,
            elevation: 10,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.05,
            shadowRadius: 10,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color, size }) => (
              <AntDesign name="home" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="pos"
          options={{
            title: "Sell",
            href: user?.permissions?.includes('sale.create') ? '/pos' : null,
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="sell" size={size + 2} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="purchase"
          options={{
            title: "Purchase",
            href: (user?.permissions?.includes('purchase.create') || user?.permissions?.includes('purchase.view')) ? '/purchase' : null,
            tabBarIcon: ({ color, size }) => (
              <Feather name="shopping-cart" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Accounts",
            tabBarIcon: ({ color, size }) => (
              <AntDesign name="user" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="reports"
          options={{
            href: null, // Hide from tab bar
          }}
        />
      </Tabs>
    </>
  );
}
