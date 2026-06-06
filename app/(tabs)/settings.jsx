/**
 * Accounts Screen (formerly Settings)
 * Renders user profile summary, permissions, and grouped links to sub-settings screens.
 */
import React, { useEffect, useState } from "react";
import { Alert, ScrollView, Text, View, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "@/store/authStore";
import { useIsFocused } from "@react-navigation/native";
import apiClient from "@/lib/api/client";
import { GlassCard } from "@/components/ui";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

function AccountListItem({ icon, iconBg, title, subtitle, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="flex-row items-center py-4 px-4 border-b border-slate-100 last:border-b-0"
    >
      <View className={`w-9 h-9 rounded-xl items-center justify-center mr-3.5 ${iconBg}`}>
        <Ionicons name={icon} size={18} color="#fff" />
      </View>
      <View className="flex-1">
        <Text className="text-slate-800 text-xs font-black uppercase tracking-wider">{title}</Text>
        <Text className="text-slate-500 text-[10px] font-bold mt-0.5 uppercase tracking-tight">{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const { user, logout, isLoading } = useAuthStore();
  const [storeDetails, setStoreDetails] = useState(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  async function loadStoreData() {
    try {
      const res = await apiClient.get('/store');
      setStoreDetails(res.data);
    } catch (e) {
      console.warn("Failed to load store data", e.message);
    }
  }

  useEffect(() => {
    if (isFocused) {
      loadStoreData();
    }
  }, [isFocused]);

  function handleLogout() {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Sign Out", style: "destructive", onPress: () => logout() },
      ]
    );
  }


  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={[]}>
      {/* Header */}
      <View style={{
        backgroundColor: '#f97316',
        paddingTop: insets.top + 8,
        paddingBottom: 10,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        elevation: 4,
        shadowColor: '#f97316',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      }}>
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255,255,255,0.2)',
            width: 36,
            height: 36,
            borderRadius: 18,
          }}
        >
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </TouchableOpacity>

        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' }}>
            Accounts
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginTop: 1 }}>
            Profile & Business Settings
          </Text>
        </View>

        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4 pb-12 gap-4"
        showsVerticalScrollIndicator={false}
      >
        {/* User Card */}
        <GlassCard className="p-4">
          <View className="flex-row items-center">
            <View className="h-14 w-14 rounded-2xl bg-orange-500 items-center justify-center mr-4 shadow-sm shadow-orange-500/30">
              <Text className="text-white text-lg font-black uppercase">
                {user?.name ? user.name.substring(0, 2) : "UN"}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-slate-800 font-black text-base uppercase tracking-tight">{user?.name ?? "—"}</Text>
              <Text className="text-slate-500 text-xs font-bold mt-0.5">{user?.email ?? "—"}</Text>
              {user?.role && (
                <View className="mt-2 self-start bg-orange-100 px-2.5 py-0.5 rounded-full border border-orange-200">
                  <Text className="text-orange-700 text-[10px] font-black uppercase tracking-wider">
                    {user.role}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </GlassCard>

        {/* Business Outlet Info Banner */}
        {storeDetails && (
          <View className="bg-orange-50 border border-orange-100 rounded-2xl p-4 flex-row items-center">
            <View className="w-10 h-10 rounded-xl bg-orange-500 items-center justify-center mr-3.5 shadow-sm shadow-orange-500/20">
              <Ionicons name="business" size={18} color="#fff" />
            </View>
            <View className="flex-1">
              <Text className="text-orange-600 text-[10px] font-black uppercase tracking-wider">Active Outlet</Text>
              <Text className="text-slate-800 text-sm font-black uppercase tracking-tight">{storeDetails.name}</Text>
              {storeDetails.gst_number ? (
                <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-tight mt-0.5 font-mono">GSTIN: {storeDetails.gst_number}</Text>
              ) : null}
            </View>
          </View>
        )}

        {/* Group 1: Profile & Business */}
        <View>
          <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2.5 ml-1">Profile & Business</Text>
          <GlassCard className="p-0 overflow-hidden">
            <AccountListItem
              icon="business-outline"
              iconBg="bg-indigo-500"
              title="Store Settings"
              subtitle="Configure address, contact & GST details"
              onPress={() => router.push("/settings/store")}
            />
            <AccountListItem
              icon="person-outline"
              iconBg="bg-blue-500"
              title="User Profile"
              subtitle="Update password, email & credentials"
              onPress={() => router.push("/settings/profile")}
            />
          </GlassCard>
        </View>

        {/* Group 2: Hardware & Preferences */}
        <View>
          <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2.5 ml-1">Hardware & Preferences</Text>
          <GlassCard className="p-0 overflow-hidden">
            <AccountListItem
              icon="bluetooth-outline"
              iconBg="bg-teal-500"
              title="Bluetooth Printer"
              subtitle="Pair wireless thermal printers"
              onPress={() => router.push("/settings/bluetooth")}
            />
            <AccountListItem
              icon="print-outline"
              iconBg="bg-emerald-500"
              title="Printer Settings"
              subtitle="Configure layout & print diagnostics"
              onPress={() => router.push("/settings/printer")}
            />
            <AccountListItem
              icon="settings-outline"
              iconBg="bg-orange-500"
              title="System Settings"
              subtitle="Invoice prefixes & base currency symbol"
              onPress={() => router.push("/settings/system")}
            />
          </GlassCard>
        </View>

        {/* Group 3: Analytics */}
        <View>
          <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2.5 ml-1">Reports & Analytics</Text>
          <GlassCard className="p-0 overflow-hidden">
            <AccountListItem
              icon="bar-chart-outline"
              iconBg="bg-violet-500"
              title="Business Reports"
              subtitle="View customer, supplier & order summaries"
              onPress={() => router.push("/reports")}
            />
          </GlassCard>
        </View>


        {/* Sign Out Action */}
        <TouchableOpacity
          onPress={handleLogout}
          disabled={isLoading}
          activeOpacity={0.8}
          className="bg-rose-500 rounded-2xl py-4 shadow-lg flex-row items-center justify-center mt-4 mb-8"
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text className="text-white text-center text-sm font-black uppercase tracking-wider">
              Log Out Account
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
