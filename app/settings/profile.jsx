import React, { useState } from "react";
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View, ActivityIndicator } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/store/authStore";
import apiClient from "@/lib/api/client";
import { Ionicons } from "@expo/vector-icons";
import { GlassCard } from "@/components/ui";

export default function UserProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [isSaving, setIsSaving] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    password: ''
  });

  async function handleProfileSave() {
    if (!profileForm.name.trim()) {
      Alert.alert("Validation Error", "Name is required");
      return;
    }
    if (!profileForm.email.trim()) {
      Alert.alert("Validation Error", "Email is required");
      return;
    }

    try {
      setIsSaving(true);
      const res = await apiClient.post('/profile', profileForm);
      useAuthStore.setState({ user: res.data.user });
      Alert.alert("Success", "Profile updated successfully", [
        { text: "OK", onPress: () => router.back() }
      ]);
    } catch (e) {
      Alert.alert("Error", e.response?.data?.message || e.message || "Failed to update profile");
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
            User Profile
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginTop: 1 }}>
            Update account credentials
          </Text>
        </View>

        <View style={{ width: 36 }} />
      </View>

      <ScrollView className="flex-1 p-4" keyboardShouldPersistTaps="handled">
        <GlassCard className="p-4 gap-4">
          <View>
            <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Full Name *</Text>
            <TextInput
              value={profileForm.name}
              onChangeText={(text) => setProfileForm({ ...profileForm, name: text })}
              className="bg-white border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm font-bold focus:border-orange-400"
              placeholder="Enter name"
            />
          </View>

          <View>
            <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Email Address *</Text>
            <TextInput
              value={profileForm.email}
              onChangeText={(text) => setProfileForm({ ...profileForm, email: text })}
              keyboardType="email-address"
              autoCapitalize="none"
              className="bg-white border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm font-bold focus:border-orange-400"
              placeholder="Enter email"
            />
          </View>

          <View>
            <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">New Password (Leave blank to keep current)</Text>
            <TextInput
              value={profileForm.password}
              onChangeText={(text) => setProfileForm({ ...profileForm, password: text })}
              secureTextEntry
              autoCapitalize="none"
              className="bg-white border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm font-bold focus:border-orange-400"
              placeholder="Enter new password"
            />
          </View>
        </GlassCard>

        <TouchableOpacity
          onPress={handleProfileSave}
          disabled={isSaving}
          activeOpacity={0.8}
          className="bg-orange-500 rounded-2xl py-4 shadow-lg flex-row items-center justify-center mt-6"
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text className="text-white text-center text-sm font-black uppercase tracking-wider">
              Save Profile Changes
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
