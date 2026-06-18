import React, { useState, useEffect } from "react";
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View, ActivityIndicator } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import apiClient from "@/lib/api/client";
import { Ionicons } from "@expo/vector-icons";
import { GlassCard } from "@/components/ui";

export default function SystemSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    currency_symbol: '₹',
    printer_width: '80mm',
    sales_prefix: 'SL-',
    purchase_prefix: 'PR-',
    purchase_return_prefix: 'PRR-',
    receipt_header: '',
    receipt_footer: '',
    store_name: '',
    store_address: '',
    gst_no: '',
  });

  async function loadSystemSettings() {
    setLoading(true);
    try {
      const res = await apiClient.get('/settings');
      if (res.data) {
        setSettingsForm({
          currency_symbol: res.data.currency_symbol || '₹',
          printer_width: res.data.printer_width || '80mm',
          sales_prefix: res.data.sales_prefix || 'SL-',
          purchase_prefix: res.data.purchase_prefix || 'PR-',
          sales_return_prefix: res.data.sales_return_prefix || 'SR-',
          purchase_return_prefix: res.data.purchase_return_prefix || 'PRR-',
          receipt_header: res.data.receipt_header || '',
          receipt_footer: res.data.receipt_footer || '',
          store_name: res.data.store_name || '',
          store_address: res.data.store_address || '',
          gst_no: res.data.gst_no || '',
        });
      }
    } catch (e) {
      console.warn("Failed to load system settings", e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSystemSettings();
  }, []);

  async function handleSettingsSave() {
    try {
      setIsSaving(true);
      await apiClient.post('/settings', settingsForm);
      Alert.alert("Success", "System settings updated successfully", [
        { text: "OK", onPress: () => router.back() }
      ]);
    } catch (e) {
      Alert.alert("Error", e.response?.data?.message || e.message || "Failed to save settings");
    } finally {
      setIsSaving(false);
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
            System Settings
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginTop: 1 }}>
            Configure global business rules
          </Text>
        </View>

        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#f97316" />
        </View>
      ) : (
        <ScrollView className="flex-1 p-4 pb-10" keyboardShouldPersistTaps="handled">
          <GlassCard className="p-4 gap-4 mb-4">
            <Text className="text-slate-800 text-xs font-black uppercase tracking-wider mb-1">General Preferences</Text>

            <View>
              <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Currency Symbol *</Text>
              <TextInput
                value={settingsForm.currency_symbol}
                onChangeText={(text) => setSettingsForm({ ...settingsForm, currency_symbol: text })}
                className="bg-white border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm font-bold focus:border-orange-400"
                placeholder="e.g. ₹ or $"
              />
            </View>

            <View>
              <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Printer Receipt Width</Text>
              <View className="flex-row gap-2">
                {['58mm', '80mm'].map((size) => (
                  <TouchableOpacity
                    key={size}
                    onPress={() => setSettingsForm({ ...settingsForm, printer_width: size })}
                    activeOpacity={0.8}
                    className={`flex-1 py-3 rounded-xl border items-center justify-center ${
                      settingsForm.printer_width === size ? 'bg-orange-500 border-orange-500 shadow-sm' : 'bg-white border-slate-200'
                    }`}
                  >
                    <Text className={`text-xs font-black uppercase tracking-wider ${
                      settingsForm.printer_width === size ? 'text-white' : 'text-slate-500'
                    }`}>
                      {size}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </GlassCard>

          <GlassCard className="p-4 gap-4 mb-4">
            <Text className="text-slate-800 text-xs font-black uppercase tracking-wider mb-1">Invoice Prefixes</Text>

            <View className="flex-row gap-2">
              <View className="flex-1">
                <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Sales</Text>
                <TextInput
                  value={settingsForm.sales_prefix}
                  onChangeText={(text) => setSettingsForm({ ...settingsForm, sales_prefix: text })}
                  className="bg-white border-2 border-slate-200 rounded-2xl px-4 py-3 text-slate-800 text-xs font-bold focus:border-orange-400"
                />
              </View>
              <View className="flex-1">
                <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Purchase</Text>
                <TextInput
                  value={settingsForm.purchase_prefix}
                  onChangeText={(text) => setSettingsForm({ ...settingsForm, purchase_prefix: text })}
                  className="bg-white border-2 border-slate-200 rounded-2xl px-4 py-3 text-slate-800 text-xs font-bold focus:border-orange-400"
                />
              </View>
            </View>

            <View className="flex-row gap-2">
              <View className="flex-1">
                <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Sales Return</Text>
                <TextInput
                  value={settingsForm.sales_return_prefix}
                  onChangeText={(text) => setSettingsForm({ ...settingsForm, sales_return_prefix: text })}
                  className="bg-white border-2 border-slate-200 rounded-2xl px-4 py-3 text-slate-800 text-xs font-bold focus:border-orange-400"
                />
              </View>
              <View className="flex-1">
                <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Purchase Return</Text>
                <TextInput
                  value={settingsForm.purchase_return_prefix}
                  onChangeText={(text) => setSettingsForm({ ...settingsForm, purchase_return_prefix: text })}
                  className="bg-white border-2 border-slate-200 rounded-2xl px-4 py-3 text-slate-800 text-xs font-bold focus:border-orange-400"
                />
              </View>
            </View>
          </GlassCard>

          <GlassCard className="p-4 gap-4 mb-6">
            <Text className="text-slate-800 text-xs font-black uppercase tracking-wider mb-1">Store Identity (Receipts)</Text>

            <View>
              <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Store Name</Text>
              <TextInput
                value={settingsForm.store_name}
                onChangeText={(text) => setSettingsForm({ ...settingsForm, store_name: text })}
                className="bg-white border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm font-bold focus:border-orange-400"
                placeholder="Business Name for Print"
              />
            </View>

            <View>
              <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Store Address</Text>
              <TextInput
                value={settingsForm.store_address}
                onChangeText={(text) => setSettingsForm({ ...settingsForm, store_address: text })}
                className="bg-white border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm font-bold focus:border-orange-400 h-16"
                placeholder="Store Address"
                multiline
                textAlignVertical="top"
              />
            </View>

            <View>
              <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">GST Number</Text>
              <TextInput
                value={settingsForm.gst_no}
                onChangeText={(text) => setSettingsForm({ ...settingsForm, gst_no: text })}
                className="bg-white border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm font-bold focus:border-orange-400"
                placeholder="GSTIN"
                autoCapitalize="characters"
              />
            </View>
          </GlassCard>

          <GlassCard className="p-4 gap-4 mb-6">
            <Text className="text-slate-800 text-xs font-black uppercase tracking-wider mb-1">Receipt Custom Text</Text>

            <View>
              <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Header Terms / Greetings</Text>
              <TextInput
                value={settingsForm.receipt_header}
                onChangeText={(text) => setSettingsForm({ ...settingsForm, receipt_header: text })}
                className="bg-white border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm font-bold focus:border-orange-400 h-16"
                placeholder="Welcome to our store"
                multiline
                textAlignVertical="top"
              />
            </View>

            <View>
              <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Footer Terms / Note</Text>
              <TextInput
                value={settingsForm.receipt_footer}
                onChangeText={(text) => setSettingsForm({ ...settingsForm, receipt_footer: text })}
                className="bg-white border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm font-bold focus:border-orange-400 h-16"
                placeholder="Thank you for shopping"
                multiline
                textAlignVertical="top"
              />
            </View>
          </GlassCard>

          <TouchableOpacity
            onPress={handleSettingsSave}
            disabled={isSaving}
            activeOpacity={0.8}
            className="bg-orange-500 rounded-2xl py-4 shadow-lg flex-row items-center justify-center mb-12"
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text className="text-white text-center text-sm font-black uppercase tracking-wider">
                Save System Settings
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
