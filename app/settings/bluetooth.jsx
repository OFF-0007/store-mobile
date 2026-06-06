import React, { useState, useEffect } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View, ActivityIndicator } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { GlassCard } from "@/components/ui";

let BLEPrinter = null;
try {
  BLEPrinter = require("react-native-thermal-receipt-printer").BLEPrinter;
} catch (e) {
  console.warn("BLEPrinter module not available:", e.message);
}

export default function BluetoothSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [devices, setDevices] = useState([]);
  const [connectedDevice, setConnectedDevice] = useState(null);

  async function scanDevices() {
    if (!BLEPrinter) {
      Alert.alert("Warning", "Bluetooth thermal printer driver is not configured for this device platform.");
      return;
    }
    setLoading(true);
    try {
      const list = await BLEPrinter.getDeviceList();
      setDevices(list || []);
    } catch (e) {
      Alert.alert("Error", "Failed to scan Bluetooth devices: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    scanDevices();
  }, []);

  async function connectDevice(device) {
    if (!BLEPrinter) return;
    setLoading(true);
    try {
      await BLEPrinter.connectPrinter(device.inner_mac_address);
      setConnectedDevice(device);
      Alert.alert("Connected", `Successfully connected to ${device.device_name || "Printer"}`);
    } catch (e) {
      Alert.alert("Connection Failed", e.message || "Could not connect to device");
    } finally {
      setLoading(false);
    }
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
            Bluetooth Printer
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginTop: 1 }}>
            Scan & connect receipt printers
          </Text>
        </View>

        <View style={{ width: 36 }} />
      </View>

      <ScrollView className="flex-1 p-4" keyboardShouldPersistTaps="handled">
        {/* Connected Device Info */}
        {connectedDevice ? (
          <GlassCard className="mb-4 bg-emerald-50/30 border-emerald-200 p-4">
            <View className="flex-row items-center">
              <View className="bg-emerald-500 rounded-xl p-2.5 mr-3">
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
              </View>
              <View className="flex-1">
                <Text className="text-emerald-800 text-[10px] font-black uppercase tracking-wider">Active Connection</Text>
                <Text className="text-slate-900 text-sm font-black uppercase tracking-tight">
                  {connectedDevice.device_name || "Thermal Printer"}
                </Text>
                <Text className="text-slate-500 text-xs font-bold mt-0.5">
                  MAC: {connectedDevice.inner_mac_address}
                </Text>
              </View>
            </View>
          </GlassCard>
        ) : (
          <GlassCard className="mb-4 bg-amber-50/30 border-amber-200 p-4">
            <View className="flex-row items-center">
              <View className="bg-amber-500 rounded-xl p-2.5 mr-3">
                <Ionicons name="warning-outline" size={18} color="#fff" />
              </View>
              <View className="flex-1">
                <Text className="text-amber-800 text-[10px] font-black uppercase tracking-wider">Printer Status</Text>
                <Text className="text-slate-800 text-sm font-bold">
                  No printer connected
                </Text>
              </View>
            </View>
          </GlassCard>
        )}

        <View className="flex-row justify-between items-center mb-4 mt-2">
          <Text className="text-slate-800 font-black text-sm uppercase tracking-wider">Available Devices</Text>
          <TouchableOpacity
            onPress={scanDevices}
            disabled={loading}
            activeOpacity={0.8}
            className="bg-orange-500/10 border border-orange-200 px-3.5 py-1.5 rounded-lg flex-row items-center gap-1.5"
          >
            {loading ? (
              <ActivityIndicator color="#f97316" size="small" />
            ) : (
              <>
                <Ionicons name="refresh" size={14} color="#f97316" />
                <Text className="text-orange-600 text-[10px] font-black uppercase tracking-wider">Scan</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {devices.length === 0 ? (
          <GlassCard className="p-8 items-center justify-center">
            <Ionicons name="bluetooth-outline" size={36} color="#94a3b8" />
            <Text className="text-slate-400 text-xs font-bold mt-3 text-center uppercase tracking-wider">
              No devices found. Tap scan to refresh.
            </Text>
          </GlassCard>
        ) : (
          <GlassCard className="p-2 gap-1">
            {devices.map((device, index) => {
              const isConnected = connectedDevice?.inner_mac_address === device.inner_mac_address;
              return (
                <TouchableOpacity
                  key={index}
                  onPress={() => connectDevice(device)}
                  disabled={loading}
                  activeOpacity={0.8}
                  className={`flex-row items-center p-3 rounded-xl ${
                    isConnected ? 'bg-emerald-500/5' : 'bg-transparent'
                  }`}
                >
                  <View className="bg-slate-100 rounded-xl p-2.5 mr-3">
                    <Ionicons name="print-outline" size={18} color="#64748b" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-slate-800 text-sm font-bold">{device.device_name || "Unknown Device"}</Text>
                    <Text className="text-slate-400 text-[10px]">{device.inner_mac_address}</Text>
                  </View>
                  {isConnected ? (
                    <View className="bg-emerald-100 px-3 py-1 rounded-full">
                      <Text className="text-emerald-700 text-[9px] font-black uppercase tracking-wider">Active</Text>
                    </View>
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
                  )}
                </TouchableOpacity>
              );
            })}
          </GlassCard>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
