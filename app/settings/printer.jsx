import React, { useState, useEffect } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View, ActivityIndicator } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import apiClient from "@/lib/api/client";
import { Ionicons } from "@expo/vector-icons";
import { GlassCard } from "@/components/ui";

let BLEPrinter = null;

export default function PrinterSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [printerWidth, setPrinterWidth] = useState('80mm');

  async function loadPrinterSettings() {
    setLoading(true);
    try {
      const res = await apiClient.get('/settings');
      if (res.data && res.data.printer_width) {
        setPrinterWidth(res.data.printer_width);
      }
    } catch (e) {
      console.warn("Failed to load printer settings", e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPrinterSettings();
  }, []);

  async function handleWidthSave(width) {
    try {
      setIsSaving(true);
      setPrinterWidth(width);
      // Retrieve existing settings first
      const current = await apiClient.get('/settings');
      const payload = {
        ...current.data,
        printer_width: width
      };
      await apiClient.post('/settings', payload);
      Alert.alert("Success", `Receipt width updated to ${width}`);
    } catch (e) {
      Alert.alert("Error", e.message || "Failed to update printer width");
    } finally {
      setIsSaving(false);
    }
  }

  async function printTestReceipt() {
    if (!BLEPrinter) {
      Alert.alert("Warning", "BLE Printer driver not available on this platform.");
      return;
    }
    try {
      setLoading(true);
      // Basic thermal receipt test command sequence
      await BLEPrinter.printText("--------------------------------\n");
      await BLEPrinter.printText("       STOREMAN MOBILE POS      \n");
      await BLEPrinter.printText("        PRINTER TEST OK         \n");
      await BLEPrinter.printText("--------------------------------\n");
      await BLEPrinter.printText("If you see this, your Bluetooth\n");
      await BLEPrinter.printText("thermal printer is successfully\n");
      await BLEPrinter.printText("connected and fully working!\n");
      await BLEPrinter.printText("--------------------------------\n\n\n");
      Alert.alert("Success", "Test receipt print signal sent!");
    } catch (e) {
      Alert.alert("Print Failed", e.message || "Ensure a bluetooth device is active & connected");
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
            Printer Settings
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginTop: 1 }}>
            Configure thermal receipt format
          </Text>
        </View>

        <View style={{ width: 36 }} />
      </View>

      {loading && !isSaving ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#f97316" />
        </View>
      ) : (
        <ScrollView className="flex-1 p-4" keyboardShouldPersistTaps="handled">
          <GlassCard className="p-4 gap-4 mb-6">
            <Text className="text-slate-800 text-xs font-black uppercase tracking-wider mb-1">Receipt Width</Text>

            <View className="flex-row gap-3">
              {['58mm', '80mm'].map((size) => (
                <TouchableOpacity
                  key={size}
                  onPress={() => handleWidthSave(size)}
                  disabled={isSaving}
                  className={`flex-1 py-4 border rounded-2xl items-center justify-center ${
                    printerWidth === size ? 'bg-orange-500 border-orange-500 shadow-sm' : 'bg-white border-slate-200'
                  }`}
                >
                  <Text className={`font-black text-xs uppercase tracking-wider ${
                    printerWidth === size ? 'text-white' : 'text-slate-500'
                  }`}>
                    {size}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </GlassCard>

          <GlassCard className="p-4 gap-2 items-center justify-center mb-6">
            <Text className="text-slate-800 text-xs font-black uppercase tracking-wider text-center mb-1">
              Printer Diagnostics
            </Text>
            <Text className="text-slate-400 text-[10px] font-bold text-center uppercase tracking-wider mb-3 px-4">
              Send a test layout signal to your connected Bluetooth device to check paper alignment and print head functionality.
            </Text>

            <TouchableOpacity
              onPress={printTestReceipt}
              disabled={loading}
              activeOpacity={0.8}
              className="bg-orange-500/10 border border-orange-200 px-6 py-3.5 rounded-2xl w-full flex-row items-center justify-center gap-2"
            >
              <Ionicons name="print-outline" size={16} color="#f97316" />
              <Text className="text-orange-600 text-xs font-black uppercase tracking-wider">
                Print Test Receipt
              </Text>
            </TouchableOpacity>
          </GlassCard>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
