/**
 * Tabs layout – protected. Unauthenticated users are redirected to login.
 */
import React from "react";
import { Redirect, withLayoutContext } from "expo-router";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { useAuthStore } from "@/store/authStore";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import Feather from '@expo/vector-icons/Feather';
import AntDesign from '@expo/vector-icons/AntDesign';

const { Navigator } = createMaterialTopTabNavigator();
const MaterialTopTabs = withLayoutContext(Navigator);

function TabIcon({ emoji, focused }) {
  return (
    <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.6 }}>
      {emoji}
    </Text>
  );
}

export default function TabsLayout() {
  const { isAuthenticated, logout } = useAuthStore();
  const insets = useSafeAreaInsets();

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#f2a02cff" }}>
      {/* Custom Header */}
      <View style={{



        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,

      }}>

      </View>

      <MaterialTopTabs
        tabBarPosition="bottom"
        screenOptions={{
          swipeEnabled: true,
          tabBarShowIcon: true,
          tabBarShowLabel: true,
          tabBarActiveTintColor: "#2563eb",
          tabBarInactiveTintColor: "#64748b",
          tabBarIndicatorStyle: { display: 'none' },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "600",
            textTransform: 'none',
            marginTop: 4,
          },
          tabBarStyle: {
            backgroundColor: "#ffffff",
            borderTopColor: "#f1f5f9",
            borderTopWidth: 1,
            height: 62 + Math.max(insets.bottom, 10),
            paddingBottom: Math.max(insets.bottom, 10),
            elevation: 0,
            shadowOpacity: 0,
          },
        }}
      >
        <MaterialTopTabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ focused }) => (
              <View style={{ opacity: focused ? 1 : 0.6 }}>
                <AntDesign name="home" size={22} color="#f97316" />
              </View>
            ),
          }}
        />

        <MaterialTopTabs.Screen
          name="pos"
          options={{
            title: "Sell",
            tabBarIcon: ({ focused }) => (
              <View style={{ opacity: focused ? 1 : 0.6 }}>
                <MaterialIcons name="sell" size={22} color="#f97316" />
              </View>
            ),
          }}
        />
        <MaterialTopTabs.Screen
          name="purchase"
          options={{
            title: "Purchase",
            tabBarIcon: ({ focused }) => (
              <View style={{ opacity: focused ? 1 : 0.6 }}>
                <Feather name="shopping-cart" size={22} color="#f97316" />
              </View>
            ),
          }}
        />

        <MaterialTopTabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ focused }) => (
              <View style={{ opacity: focused ? 1 : 0.6 }}>
                <AntDesign name="setting" size={22} color="#bd5002ff" />
              </View>
            ),
          }}
        />
      </MaterialTopTabs>
    </View>
  );
}
