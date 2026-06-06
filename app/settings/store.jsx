import React, { useState, useEffect } from "react";
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View, ActivityIndicator } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import apiClient from "@/lib/api/client";
import { Ionicons } from "@expo/vector-icons";
import { GlassCard } from "@/components/ui";

export default function StoreProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [storeForm, setStoreForm] = useState({
    name: '',
    mobile: '',
    address: '',
    gst_number: ''
  });

  async function loadStoreData() {
    setLoading(true);
    try {
      const res = await apiClient.get('/store');
      setStoreForm({
        name: res.data.name || '',
        mobile: res.data.mobile || '',
        address: res.data.address || '',
        gst_number: res.data.gst_number || ''
      });
    } catch (e) {
      console.warn("Failed to load store data", e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStoreData();
  }, []);

  async function handleStoreSave() {
    if (!storeForm.name.trim()) {
      Alert.alert("Validation Error", "Store Name is required");
      return;
    }

    try {
      setIsSaving(true);
      await apiClient.post('/store', storeForm);
      Alert.alert("Success", "Store details updated successfully", [
        { text: "OK", onPress: () => router.back() }
      ]);
    } catch (e) {
      Alert.alert("Error", e.response?.data?.message || e.message || "Failed to update store details");
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
            Store Settings
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginTop: 1 }}>
            Configure active outlet details
          </Text>
        </View>

        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#f97316" />
        </View>
      ) : (
        <ScrollView className="flex-1 p-4" keyboardShouldPersistTaps="handled">
          <GlassCard className="p-4 gap-4">
            <View>
              <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Store Name *</Text>
              <TextInput
                value={storeForm.name}
                onChangeText={(text) => setStoreForm({ ...storeForm, name: text })}
                className="bg-white border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm font-bold focus:border-orange-400"
                placeholder="Enter store name"
              />
            </View>

            <View>
              <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Mobile Number</Text>
              <TextInput
                value={storeForm.mobile}
                onChangeText={(text) => setStoreForm({ ...storeForm, mobile: text })}
                keyboardType="phone-pad"
                className="bg-white border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm font-bold focus:border-orange-400"
                placeholder="Enter mobile number"
              />
            </View>

            <View>
              <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">GST Identification Number</Text>
              <TextInput
                value={storeForm.gst_number}
                onChangeText={(text) => setStoreForm({ ...storeForm, gst_number: text })}
                autoCapitalize="characters"
                className="bg-white border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm font-bold focus:border-orange-400"
                placeholder="Enter GST number"
              />
            </View>

            <View>
              <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Store Address</Text>
              <TextInput
                value={storeForm.address}
                onChangeText={(text) => setStoreForm({ ...storeForm, address: text })}
                className="bg-white border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm font-bold focus:border-orange-400 h-24"
                placeholder="Enter address"
                multiline
                textAlignVertical="top"
              />
            </View>
          </GlassCard>

          <TouchableOpacity
            onPress={handleStoreSave}
            disabled={isSaving}
            activeOpacity={0.8}
            className="bg-orange-500 rounded-2xl py-4 shadow-lg flex-row items-center justify-center mt-6"
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text className="text-white text-center text-sm font-black uppercase tracking-wider">
                Save Store Changes
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
