import React, { useEffect, useState } from "react";
import { Alert, FlatList, Text, TextInput, TouchableOpacity, View, ActivityIndicator, Switch, ScrollView } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import apiClient from "@/lib/api/client";
import { Ionicons } from "@expo/vector-icons";
import { GlassCard } from "@/components/ui";

export default function BanksScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState([]);
  const [activeBankId, setActiveBankId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ 
      name: '', 
      bank_name: '', 
      account_number: '', 
      upi_id: '', 
      balance: '', 
      status: 'active',
      make_active: false
  });
  const [editId, setEditId] = useState(null);

  async function loadData() {
    try {
      const res = await apiClient.get('/banks');
      setData(res.data?.banks || []);
      setActiveBankId(res.data?.active_bank_id || null);
    } catch (e) {
      console.warn(e);
      Alert.alert("Error", "Could not load bank details. Ensure you have permission.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSave() {
    if (!form.name.trim() || !form.balance.trim()) {
      Alert.alert("Validation Error", "Account Name and Balance are required");
      return;
    }
    try {
      setIsSaving(true);
      if (editId) {
        await apiClient.put(`/banks/${editId}`, form);
      } else {
        await apiClient.post('/banks', form);
      }
      setIsModalOpen(false);
      resetForm();
      loadData();
    } catch (e) {
      Alert.alert("Error", e.response?.data?.message || e.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleActivate(id) {
    try {
      await apiClient.post(`/banks/${id}/activate`);
      loadData();
    } catch (e) {
      Alert.alert("Error", e.response?.data?.message || e.message);
    }
  }

  function handleEdit(item) {
    setForm({ 
        name: item.name, 
        bank_name: item.bank_name || '', 
        account_number: item.account_number || '', 
        upi_id: item.upi_id || '', 
        balance: String(item.balance), 
        status: item.status,
        make_active: item.id === activeBankId
    });
    setEditId(item.id);
    setIsModalOpen(true);
  }

  function handleDeleteConfirm(id) {
    Alert.alert("Confirm Delete", "Are you sure you want to delete this bank account?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => handleDelete(id) }
    ]);
  }

  async function handleDelete(id) {
    try {
      await apiClient.delete(`/banks/${id}`);
      loadData();
    } catch (e) {
      Alert.alert("Error", e.response?.data?.message || e.message);
    }
  }

  function resetForm() {
      setForm({ 
        name: '', 
        bank_name: '', 
        account_number: '', 
        upi_id: '', 
        balance: '', 
        status: 'active',
        make_active: false
    });
    setEditId(null);
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={[]}>
      <View style={{
        backgroundColor: '#3b82f6', // blue-500
        paddingTop: insets.top + 8,
        paddingBottom: 10,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        elevation: 4,
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      }}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.2)', width: 36, height: 36, borderRadius: 18 }}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' }}>Bank Accounts</Text>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginTop: 1 }}>Manage banking & balances</Text>
        </View>
        <TouchableOpacity onPress={() => { resetForm(); setIsModalOpen(true); }} activeOpacity={0.7} style={{ alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.2)', width: 36, height: 36, borderRadius: 18 }}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View className="flex-1 justify-center items-center"><ActivityIndicator size="large" color="#3b82f6" /></View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => {
              const isActive = item.id === activeBankId;
              return (
                <GlassCard className={`p-4 ${isActive ? 'border-2 border-blue-400' : ''}`}>
                <View className="flex-row justify-between items-start mb-3">
                    <View className="flex-1">
                        <View className="flex-row items-center gap-2 mb-1">
                            <Text className="text-slate-800 text-sm font-black uppercase tracking-wider">{item.name}</Text>
                            {isActive && (
                                <View className="bg-blue-100 px-2 py-0.5 rounded text-[10px]">
                                    <Text className="text-blue-600 text-[9px] font-black uppercase">Active</Text>
                                </View>
                            )}
                            {item.status === 'inactive' && !isActive && (
                                <View className="bg-rose-100 px-2 py-0.5 rounded text-[10px]">
                                    <Text className="text-rose-600 text-[9px] font-black uppercase">Inactive</Text>
                                </View>
                            )}
                        </View>
                        <Text className="text-slate-500 text-[10px] font-bold uppercase">{item.bank_name || 'N/A'}</Text>
                    </View>
                    <Text className="text-blue-600 text-lg font-black">₹{Number(item.balance).toFixed(2)}</Text>
                </View>
                
                <View className="bg-slate-50 p-2 rounded-xl mb-3 flex-row justify-between items-center border border-slate-100">
                    <View>
                        <Text className="text-slate-400 text-[9px] uppercase tracking-widest font-black">Account No</Text>
                        <Text className="text-slate-700 text-xs font-bold">{item.account_number || 'N/A'}</Text>
                    </View>
                    <View className="items-end">
                        <Text className="text-slate-400 text-[9px] uppercase tracking-widest font-black">UPI ID</Text>
                        <Text className="text-slate-700 text-xs font-bold">{item.upi_id || 'N/A'}</Text>
                    </View>
                </View>

                <View className="flex-row items-center gap-3 justify-end pt-1">
                    {!isActive && item.status === 'active' && (
                        <TouchableOpacity onPress={() => handleActivate(item.id)} className="px-3 py-1.5 bg-slate-100 rounded-full mr-auto">
                            <Text className="text-slate-600 text-[10px] font-black uppercase">Set Active</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => handleEdit(item)} className="p-2 bg-blue-50 rounded-full">
                    <Ionicons name="pencil" size={16} color="#3b82f6" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteConfirm(item.id)} className="p-2 bg-rose-50 rounded-full">
                    <Ionicons name="trash" size={16} color="#ef4444" />
                    </TouchableOpacity>
                </View>
                </GlassCard>
              )
          }}
          ListEmptyComponent={<Text className="text-center text-slate-400 font-bold mt-10">No bank accounts found. Click + to add one.</Text>}
        />
      )}

      {isModalOpen && (
        <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View className="bg-white rounded-t-3xl p-6 shadow-2xl max-h-[85%]">
            <Text className="text-lg font-black text-slate-800 uppercase mb-4">{editId ? "Edit Bank Account" : "Add Bank Account"}</Text>
            
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Account Name *</Text>
                <TextInput
                value={form.name}
                onChangeText={(text) => setForm({ ...form, name: text })}
                className="bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm font-bold focus:border-blue-400 mb-4"
                placeholder="e.g., HDFC Main Account"
                />

                <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Bank Name</Text>
                <TextInput
                value={form.bank_name}
                onChangeText={(text) => setForm({ ...form, bank_name: text })}
                className="bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm font-bold focus:border-blue-400 mb-4"
                placeholder="e.g., HDFC Bank"
                />

                <View className="flex-row gap-4 mb-4">
                    <View className="flex-1">
                        <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Account Number</Text>
                        <TextInput
                        value={form.account_number}
                        onChangeText={(text) => setForm({ ...form, account_number: text })}
                        keyboardType="numeric"
                        className="bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm font-bold focus:border-blue-400"
                        placeholder="Optional"
                        />
                    </View>
                    <View className="flex-1">
                        <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">UPI ID</Text>
                        <TextInput
                        value={form.upi_id}
                        onChangeText={(text) => setForm({ ...form, upi_id: text })}
                        className="bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm font-bold focus:border-blue-400"
                        placeholder="Optional"
                        autoCapitalize="none"
                        />
                    </View>
                </View>

                <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Opening / Current Balance (₹) *</Text>
                <TextInput
                value={form.balance}
                onChangeText={(text) => setForm({ ...form, balance: text })}
                keyboardType="numeric"
                className="bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm font-bold focus:border-blue-400 mb-4"
                placeholder="0.00"
                />

                <View className="flex-row items-center justify-between bg-slate-50 p-4 rounded-2xl border-2 border-slate-200 mb-4">
                    <Text className="text-slate-800 font-bold uppercase text-xs tracking-wider">Account is Active</Text>
                    <Switch
                        value={form.status === 'active'}
                        onValueChange={(val) => setForm({ ...form, status: val ? 'active' : 'inactive' })}
                        trackColor={{ false: "#cbd5e1", true: "#60a5fa" }}
                        thumbColor={form.status === 'active' ? "#3b82f6" : "#f8fafc"}
                    />
                </View>

                <View className="flex-row items-center justify-between bg-slate-50 p-4 rounded-2xl border-2 border-slate-200 mb-6">
                    <Text className="text-slate-800 font-bold uppercase text-xs tracking-wider">Set as Active Bank for Sales</Text>
                    <Switch
                        value={form.make_active}
                        onValueChange={(val) => setForm({ ...form, make_active: val })}
                        trackColor={{ false: "#cbd5e1", true: "#34d399" }}
                        thumbColor={form.make_active ? "#10b981" : "#f8fafc"}
                    />
                </View>

                <View className="flex-row gap-4 mb-8">
                <TouchableOpacity onPress={() => setIsModalOpen(false)} className="flex-1 py-4 bg-slate-100 rounded-2xl items-center">
                    <Text className="text-slate-600 font-black uppercase tracking-wider">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSave} disabled={isSaving} className="flex-1 py-4 bg-blue-500 rounded-2xl items-center flex-row justify-center">
                    {isSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text className="text-white font-black uppercase tracking-wider">Save Account</Text>}
                </TouchableOpacity>
                </View>
            </ScrollView>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
