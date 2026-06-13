import React, { useState } from "react";
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View, ActivityIndicator } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import apiClient from "@/lib/api/client";
import { Ionicons } from "@expo/vector-icons";
import { GlassCard } from "@/components/ui";

export default function AddSupplierScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    company_name: '',
    gstin: '',
    address: ''
  });

  async function handleSave() {
    if (!form.name.trim()) {
      Alert.alert("Validation Error", "Supplier Name is required");
      return;
    }

    try {
      setIsSaving(true);
      await apiClient.post('/suppliers', form);
      
      Alert.alert("Success", "Supplier added successfully", [
        { text: "OK", onPress: () => router.back() }
      ]);
    } catch (e) {
      Alert.alert("Error", e.response?.data?.message || e.message || "Failed to add supplier");
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
            Add Supplier
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginTop: 1 }}>
            Create new supplier profile
          </Text>
        </View>

        <View style={{ width: 36 }} />
      </View>

      <ScrollView className="flex-1 p-4" keyboardShouldPersistTaps="handled">
        <GlassCard className="p-4 gap-4">
          <View>
            <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Supplier Name *</Text>
            <TextInput
              value={form.name}
              onChangeText={(text) => setForm({ ...form, name: text })}
              className="bg-white border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm font-bold focus:border-orange-400"
              placeholder="Enter full name"
            />
          </View>

          <View>
            <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Phone Number</Text>
            <TextInput
              value={form.phone}
              onChangeText={(text) => setForm({ ...form, phone: text })}
              keyboardType="phone-pad"
              className="bg-white border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm font-bold focus:border-orange-400"
              placeholder="Enter phone number"
            />
          </View>

          <View>
            <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Company Name</Text>
            <TextInput
              value={form.company_name}
              onChangeText={(text) => setForm({ ...form, company_name: text })}
              className="bg-white border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm font-bold focus:border-orange-400"
              placeholder="Enter company name"
            />
          </View>

          <View>
            <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">GST Number</Text>
            <TextInput
              value={form.gstin}
              onChangeText={(text) => setForm({ ...form, gstin: text })}
              autoCapitalize="characters"
              className="bg-white border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm font-bold focus:border-orange-400"
              placeholder="Enter GST number"
            />
          </View>

          <View>
            <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Email Address</Text>
            <TextInput
              value={form.email}
              onChangeText={(text) => setForm({ ...form, email: text })}
              keyboardType="email-address"
              autoCapitalize="none"
              className="bg-white border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm font-bold focus:border-orange-400"
              placeholder="Enter email address"
            />
          </View>

          <View>
            <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Address</Text>
            <TextInput
              value={form.address}
              onChangeText={(text) => setForm({ ...form, address: text })}
              className="bg-white border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm font-bold focus:border-orange-400 h-24"
              placeholder="Enter address"
              multiline
              textAlignVertical="top"
            />
          </View>
        </GlassCard>

        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving}
          activeOpacity={0.8}
          className="bg-orange-500 rounded-2xl py-4 shadow-lg flex-row items-center justify-center mt-6 mb-12"
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text className="text-white text-center text-sm font-black uppercase tracking-wider">
              Create Supplier
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
