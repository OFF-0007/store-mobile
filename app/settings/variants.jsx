import React, { useEffect, useState } from "react";
import { Alert, FlatList, Text, TextInput, TouchableOpacity, View, ActivityIndicator } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import apiClient from "@/lib/api/client";
import { Ionicons } from "@expo/vector-icons";
import { GlassCard } from "@/components/ui";

export default function VariantsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '' });
  const [editId, setEditId] = useState(null);

  async function loadData() {
    try {
      const res = await apiClient.get('/variants');
      setData(res.data?.data || res.data || []);
    } catch (e) {
      console.warn(e);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSave() {
    if (!form.name.trim()) {
      Alert.alert("Validation Error", "Name is required");
      return;
    }
    try {
      setIsSaving(true);
      if (editId) {
        await apiClient.put(`/variants/${editId}`, form);
      } else {
        await apiClient.post('/variants', form);
      }
      setIsModalOpen(false);
      setForm({ name: '' });
      setEditId(null);
      loadData();
    } catch (e) {
      Alert.alert("Error", e.response?.data?.message || e.message);
    } finally {
      setIsSaving(false);
    }
  }

  function handleEdit(item) {
    setForm({ name: item.name });
    setEditId(item.id);
    setIsModalOpen(true);
  }

  function handleDeleteConfirm(id) {
    Alert.alert("Confirm Delete", "Are you sure you want to delete this variant?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => handleDelete(id) }
    ]);
  }

  async function handleDelete(id) {
    try {
      await apiClient.delete(`/variants/${id}`);
      loadData();
    } catch (e) {
      Alert.alert("Error", e.response?.data?.message || e.message);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={[]}>
      <View style={{
        backgroundColor: '#06b6d4', // cyan-500
        paddingTop: insets.top + 8,
        paddingBottom: 10,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        elevation: 4,
        shadowColor: '#06b6d4',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      }}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.2)', width: 36, height: 36, borderRadius: 18 }}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' }}>Variants</Text>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginTop: 1 }}>Manage product variants</Text>
        </View>
        <TouchableOpacity onPress={() => { setEditId(null); setForm({ name: '' }); setIsModalOpen(true); }} activeOpacity={0.7} style={{ alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.2)', width: 36, height: 36, borderRadius: 18 }}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View className="flex-1 justify-center items-center"><ActivityIndicator size="large" color="#06b6d4" /></View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => (
            <GlassCard className="p-4 flex-row items-center justify-between">
              <View>
                <Text className="text-slate-800 text-sm font-black uppercase tracking-wider">{item.name}</Text>
              </View>
              <View className="flex-row items-center gap-3">
                <TouchableOpacity onPress={() => handleEdit(item)} className="p-2 bg-blue-50 rounded-full">
                  <Ionicons name="pencil" size={16} color="#3b82f6" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteConfirm(item.id)} className="p-2 bg-rose-50 rounded-full">
                  <Ionicons name="trash" size={16} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </GlassCard>
          )}
          ListEmptyComponent={<Text className="text-center text-slate-400 font-bold mt-10">No variants found. Click + to add one.</Text>}
        />
      )}

      {isModalOpen && (
        <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
          <View className="bg-white rounded-3xl p-6 shadow-2xl">
            <Text className="text-lg font-black text-slate-800 uppercase mb-4">{editId ? "Edit Variant" : "Add Variant"}</Text>
            <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Variant Name *</Text>
            <TextInput
              value={form.name}
              onChangeText={(text) => setForm({ name: text })}
              className="bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm font-bold focus:border-cyan-400 mb-6"
              placeholder="e.g., XL, Red, 500g"
            />
            <View className="flex-row gap-4">
              <TouchableOpacity onPress={() => setIsModalOpen(false)} className="flex-1 py-4 bg-slate-100 rounded-2xl items-center">
                <Text className="text-slate-600 font-black uppercase tracking-wider">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} disabled={isSaving} className="flex-1 py-4 bg-cyan-500 rounded-2xl items-center flex-row justify-center">
                {isSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text className="text-white font-black uppercase tracking-wider">Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
