/**
 * Settings screen – profile card, active store, role & permissions display,
 * app info, and sign-out.
 * Light mode theme: clean layout, slate-50 background, white cards,
 * clear typography, and vibrant green/orange status accents.
 */
import React from "react";
import { Alert, ScrollView, Text, View, TouchableOpacity } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "@/store/authStore";
import { Button, GlassCard } from "@/components/ui";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
let BLEPrinter = null;
try { BLEPrinter = require("react-native-thermal-receipt-printer").BLEPrinter; } catch (e) { console.warn("BLEPrinter module not available:", e.message); }

const PERMISSION_LABELS = {
  dashboard: { label: "View Dashboard", icon: "🏠" },
  pos: { label: "Point of Sale", icon: "🛒" },
  purchase: { label: "Create Purchases", icon: "🛍️" },
  stock: { label: "Manage Stock", icon: "📦" },
  settings: { label: "Settings", icon: "⚙️" },
};

export default function SettingsScreen() {
  const { user, logout, isLoading } = useAuthStore();
  const [printerDevices, setPrinterDevices] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Load paired/available Bluetooth devices
  async function loadDevices() {
    if (!BLEPrinter) return;
    try {
      const devices = await BLEPrinter.getDeviceList();
      setPrinterDevices(devices || []);
    } catch (e) {
      console.warn('Failed to fetch Bluetooth devices', e);
    }
  }

  useEffect(() => {
    loadDevices();
  }, []);

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
      {/* Orange header with back button */}
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
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'rgba(255,255,255,0.2)',
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 20,
            minWidth: 44,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginRight: 2 }}>‹</Text>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>Back</Text>
        </TouchableOpacity>

        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' }}>
            ⚙️ Settings
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginTop: 1 }}>
            Preferences & Account
          </Text>
        </View>

        <View style={{ minWidth: 44 }} />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 py-6 pb-12"
        showsVerticalScrollIndicator={false}
      >

        {/* ── Profile card ─────────────────────────────────────────────────── */}
        <GlassCard className="mb-4">
          <View className="flex-row items-center gap-4">
            <View className="h-14 w-14 rounded-2xl bg-primary-50 border border-primary-100 items-center justify-center">
              <Text className="text-3xl">👤</Text>
            </View>
            <View className="flex-1">
              <Text className="text-slate-800 font-black text-base">{user?.name ?? "—"}</Text>
              <Text className="text-slate-500 text-xs mt-0.5">{user?.email ?? "—"}</Text>
              {user?.role ? (
                <View className="mt-1.5 self-start bg-primary-100/50 px-2.5 py-0.5 rounded-full border border-primary-200">
                  <Text className="text-primary-700 text-[10px] font-black uppercase tracking-wider">
                    {user.role}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </GlassCard>



        {/* ── Business Reports ─────────────────────────────────────────────── */}
        <GlassCard className="mb-4">
          <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3">
            Business Reports
          </Text>
          <View className="flex-row items-center justify-between py-1">
            <View className="flex-row items-center gap-3">
              <Text className="text-base">📊</Text>
              <Text className="text-slate-600 text-sm font-medium">View Reports</Text>
            </View>
            <Button
              label="Open"
              variant="secondary"
              size="sm"
              onPress={() => router.push("/reports")}
            />
          </View>
        </GlassCard>



        {/* ── Bluetooth Printers ─────────────────────────────────────────────── */}
        <GlassCard className="mb-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
              Bluetooth Printers
            </Text>
            <Button label={refreshing ? "Refreshing…" : "Refresh"} variant="secondary" size="sm" onPress={async () => { setRefreshing(true); await loadDevices(); setRefreshing(false); }} />
          </View>
          {printerDevices.length === 0 ? (
            <Text className="text-slate-400 text-sm">No Bluetooth devices found.</Text>
          ) : (
            printerDevices.map((dev) => (
              <View key={dev.inner_mac_address || dev.address} className="flex-row items-center justify-between py-2 border-b border-slate-100">
                <View>
                  <Text className="text-slate-800">{dev.name || "Unnamed"}</Text>
                  <Text className="text-slate-500 text-xs">{dev.inner_mac_address || dev.address}</Text>
                </View>
                <Button
                  label={dev.isConnected ? "Disconnect" : "Connect"}
                  variant={dev.isConnected ? "danger" : "primary"}
                  size="sm"
                  onPress={async () => {
                    try {
                      if (dev.isConnected) {
                        await BLEPrinter.disconnectPrinter();
                      } else {
                        await BLEPrinter.connectPrinter(dev.inner_mac_address || dev.address);
                      }
                      await loadDevices();
                    } catch (e) {
                      Alert.alert("Printer Error", e.message);
                    }
                  }}
                />
              </View>
            ))
          )}
        </GlassCard>

        {/* ── Sign out ─────────────────────────────────────────────────────── */}
        <Button
          label="Sign Out"
          variant="danger"
          fullWidth
          loading={isLoading}
          onPress={handleLogout}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
