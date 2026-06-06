import React, { useState, useCallback, useEffect } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  RefreshControl,
  TextInput,
  Alert,
  Modal,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { GlassCard, CardSkeleton } from "@/components/ui";
import apiClient from "@/lib/api/client";
import { useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

const fmt = (val) => `₹${Number(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// --- Payment Modal Component ---
function PaymentModal({ visible, config, onClose, onSubmit }) {
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible && config?.maxAmount) {
      setAmount(String(Math.abs(config.maxAmount)));
    }
  }, [visible, config]);

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit(amount, paymentMethod, notes);
      onClose();
      setAmount("");
      setNotes("");
    } catch (e) {
      Alert.alert("Error", e.message || "Payment failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!config) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-center p-6">
        <View className="bg-white rounded-[32px] p-6 shadow-2xl">
          <Text className="text-slate-900 text-lg font-black uppercase tracking-tight mb-1">
            Pay Balance
          </Text>
          <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-6">
            {config.name}
          </Text>

          <View className="mb-4">
            <Text className="text-slate-500 text-[10px] font-black uppercase mb-2 ml-1">Amount</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="0.00"
              className="bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3.5 text-slate-900 font-black text-lg"
            />
          </View>

          <View className="mb-4">
            <Text className="text-slate-500 text-[10px] font-black uppercase mb-2 ml-1">Payment Method</Text>
            <View className="flex-row gap-2">
              {["Cash", "Card", "UPI"].map((m) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setPaymentMethod(m)}
                  className={`flex-1 py-3 rounded-xl border-2 items-center ${
                    paymentMethod === m ? "bg-orange-500 border-orange-500" : "bg-white border-slate-100"
                  }`}
                >
                  <Text className={`text-[10px] font-black uppercase ${paymentMethod === m ? "text-white" : "text-slate-400"}`}>
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View className="mb-6">
            <Text className="text-slate-500 text-[10px] font-black uppercase mb-2 ml-1">Notes (Optional)</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Add payment notes..."
              className="bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-slate-900 font-bold text-xs"
            />
          </View>

          <View className="flex-row gap-3">
            <TouchableOpacity onPress={onClose} className="flex-1 py-4 items-center">
              <Text className="text-slate-400 font-black uppercase text-xs">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSubmitting}
              className="flex-[2] bg-slate-900 py-4 rounded-2xl items-center shadow-lg"
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text className="text-white font-black uppercase text-xs tracking-widest">Confirm</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function SummaryCard({ label, value, accent, icon }) {
  return (
    <View className={`flex-1 rounded-2xl p-3.5 ${accent} border border-slate-100 items-center justify-center shadow-sm`}>
      <View style={{ marginBottom: 6 }}>{icon}</View>
      <Text className="text-slate-800 text-sm font-black text-center" numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text className="text-slate-400 text-[8px] font-black uppercase tracking-widest text-center mt-1">{label}</Text>
    </View>
  );
}

export default function CustomerReportScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pagination, setPagination] = useState({ offset: 0, limit: 10, total: 0, has_more: false });

  // Detail Modal States
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [fetchingDetails, setFetchingDetails] = useState(false);

  // Payment State
  const [paymentConfig, setPaymentConfig] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleShowDetails = async (customerId) => {
    setFetchingDetails(true);
    setShowDetailModal(true);
    try {
      const res = await apiClient.get(`/customers/${customerId}`);
      setSelectedCustomer(res.data);
    } catch (e) {
      Alert.alert("Error", "Failed to fetch customer details");
      setShowDetailModal(false);
    } finally {
      setFetchingDetails(false);
    }
  };

  const handlePaymentSubmit = async (amount, method, notes) => {
    try {
      await apiClient.post(`/customers/${paymentConfig.id}/pay-balance`, {
        amount,
        payment_method: method,
        notes,
      });
      Alert.alert("Success", "Payment recorded successfully");
      fetchReport();
      if (selectedCustomer) handleShowDetails(selectedCustomer.id);
    } catch (e) {
      throw e;
    }
  };

  const onPayBalance = (customer) => {
    setPaymentConfig({
      id: customer.id,
      name: customer.name,
      maxAmount: customer.current_due || customer.balance,
    });
    setShowPaymentModal(true);
  };

  const fetchReport = useCallback(async (loadMore = false) => {
    try {
      const offset = loadMore ? pagination.offset + pagination.limit : 0;
      if (loadMore) setLoadingMore(true);
      else { setLoading(true); setError(null); }

      const res = await apiClient.get("/reports/customers", {
        params: { limit: 10, offset },
      });

      if (loadMore) {
        setData((prev) => ({ ...res.data, customers: [...(prev?.customers || []), ...(res.data.customers || [])] }));
      } else {
        setData(res.data);
      }
      setPagination(res.data.pagination);
    } catch (e) { setError(e.message || "Failed to load customer report"); }
    finally { setLoading(false); setLoadingMore(false); }
  }, [pagination.offset, pagination.limit]);

  useEffect(() => { if (isFocused) fetchReport(); }, [isFocused]);

  const handleScroll = (event) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 40 && !loadingMore && pagination.has_more) {
      fetchReport(true);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={[]}>
      <View style={{ backgroundColor: '#f97316', paddingTop: insets.top + 8, paddingBottom: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => router.back()} className="p-2">
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View className="flex-1 items-center mr-8">
          <Text className="text-white font-black text-base uppercase tracking-wider">Customer Report</Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" onScroll={handleScroll} scrollEventThrottle={16} refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchReport} tintColor="#f97316" />}>
        {data?.summary && (
          <View className="flex-row gap-2 mb-4">
            <SummaryCard label="Total Billed" value={fmt(data.summary.total_billed || 0)} icon={<Ionicons name="document-text-outline" size={16} color="#3b82f6" />} accent="bg-blue-50/50" />
            <SummaryCard label="Outstanding" value={fmt(data.summary.total_outstanding || 0)} icon={<Ionicons name="time-outline" size={16} color="#f43f5e" />} accent="bg-rose-50/50" />
          </View>
        )}

        <GlassCard className="p-3 mb-10">
          <View className="flex-row pb-2 mb-1.5 border-b border-slate-100">
            <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider flex-1">Customer</Text>
            <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider w-20 text-right">Billed</Text>
            <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider w-20 text-right">Due</Text>
          </View>

          {loading && !data ? <CardSkeleton /> : error ? <Text className="text-rose-500 text-center py-10 font-bold">{error}</Text> : data?.customers?.length === 0 ? <Text className="text-slate-400 text-center py-10 font-bold">No records found</Text> : (
            data?.customers?.map((c, i) => (
              <TouchableOpacity 
                key={c.id} 
                onPress={() => handleShowDetails(c.id)}
                className={`py-3 flex-row items-center ${i < data.customers.length - 1 ? "border-b border-slate-100" : ""}`}
              >
                <View className="flex-1">
                  <Text className="text-slate-800 text-xs font-black">{c.name}</Text>
                  <Text className="text-slate-400 text-[10px]">{c.phone || "—"} · {c.sales_count || 0} sales</Text>
                </View>
                <Text className="text-slate-600 text-xs font-mono w-20 text-right">{fmt(c.total_billed || c.sales_sum_grand_total)}</Text>
                <Text className={`text-xs font-mono w-20 text-right font-black ${ (c.outstanding || c.current_due) > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                  {fmt(c.outstanding || c.current_due)}
                </Text>
              </TouchableOpacity>
            ))
          )}
          {loadingMore && <ActivityIndicator size="small" color="#f97316" className="py-4" />}
        </GlassCard>
      </ScrollView>

      {/* Detail Modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-slate-50 h-[85%] rounded-t-[40px] overflow-hidden">
            {/* Modal Header */}
            <View className="bg-white px-6 py-5 flex-row items-center justify-between border-b border-slate-100">
              <View>
                <Text className="text-slate-400 text-[10px] font-black uppercase tracking-[2px]">Customer Details</Text>
                <Text className="text-slate-900 text-lg font-black mt-1">
                  {fetchingDetails ? "Loading..." : selectedCustomer?.name}
                </Text>
              </View>
              <TouchableOpacity 
                onPress={() => setShowDetailModal(false)}
                className="w-10 h-10 bg-slate-100 rounded-full items-center justify-center"
              >
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {fetchingDetails ? (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator size="large" color="#f97316" />
                <Text className="text-slate-400 font-bold mt-4 uppercase text-[10px] tracking-widest">Fetching details...</Text>
              </View>
            ) : selectedCustomer && (
              <ScrollView className="flex-1 px-6 pt-6 pb-10">
                {/* Balance Card */}
                <View className="bg-orange-500 p-6 rounded-[32px] mb-6 shadow-lg shadow-orange-200">
                  <View className="flex-row justify-between items-start">
                    <View>
                      <Text className="text-white/70 text-[10px] font-black uppercase tracking-wider">Current Outstanding</Text>
                      <Text className="text-white text-3xl font-black mt-1">{fmt(selectedCustomer.current_due)}</Text>
                    </View>
                    <View className="bg-white/20 p-3 rounded-2xl">
                      <Ionicons name="wallet" size={24} color="#fff" />
                    </View>
                  </View>
                </View>

                {/* Info Grid */}
                <View className="flex-row flex-wrap gap-3 mb-6">
                  <View className="w-[47%] bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
                    <Ionicons name="receipt-outline" size={16} color="#f97316" />
                    <Text className="text-slate-400 text-[9px] font-black uppercase mt-2">Total Billed</Text>
                    <Text className="text-slate-800 text-xs font-bold mt-0.5">{fmt(selectedCustomer.total_billed)}</Text>
                  </View>
                  <View className="w-[47%] bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
                    <Ionicons name="checkmark-circle-outline" size={16} color="#10b981" />
                    <Text className="text-slate-400 text-[9px] font-black uppercase mt-2">Total Received</Text>
                    <Text className="text-slate-800 text-xs font-bold mt-0.5">{fmt(selectedCustomer.total_received)}</Text>
                  </View>
                  <View className="w-[47%] bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
                    <Ionicons name="return-up-back-outline" size={16} color="#ef4444" />
                    <Text className="text-slate-400 text-[9px] font-black uppercase mt-2">Returns</Text>
                    <Text className="text-slate-800 text-xs font-bold mt-0.5">{fmt(selectedCustomer.total_returns || 0)}</Text>
                  </View>
                  <View className="w-[47%] bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
                    <Ionicons name="cart-outline" size={16} color="#3b82f6" />
                    <Text className="text-slate-400 text-[9px] font-black uppercase mt-2">Sales Count</Text>
                    <Text className="text-slate-800 text-xs font-bold mt-0.5">{selectedCustomer.sales_count || 0}</Text>
                  </View>
                </View>

                {/* Contact Info */}
                <View className="bg-white border border-slate-100 rounded-3xl p-5 mb-6 shadow-sm">
                  <Text className="text-slate-400 text-[10px] font-black uppercase tracking-wider mb-4">Contact Information</Text>
                  <View className="flex-row items-center mb-3">
                    <View className="w-8 h-8 bg-blue-50 rounded-lg items-center justify-center mr-3">
                      <Ionicons name="call-outline" size={14} color="#3b82f6" />
                    </View>
                    <Text className="text-slate-700 text-xs font-bold">{selectedCustomer.phone || "No Phone"}</Text>
                  </View>
                  <View className="flex-row items-center">
                    <View className="w-8 h-8 bg-purple-50 rounded-lg items-center justify-center mr-3">
                      <Ionicons name="mail-outline" size={14} color="#8b5cf6" />
                    </View>
                    <Text className="text-slate-700 text-xs font-bold">{selectedCustomer.email || "No Email"}</Text>
                  </View>
                </View>

                {/* Recent Transactions */}
                <Text className="text-slate-400 text-[10px] font-black uppercase tracking-[2px] mb-4 ml-1">Recent Sales</Text>
                <View className="bg-white border border-slate-100 rounded-3xl overflow-hidden mb-10 shadow-sm">
                  <View className="bg-slate-50 px-4 py-3 flex-row border-b border-slate-100">
                    <Text className="text-slate-400 text-[9px] font-black uppercase flex-1">Order / Date</Text>
                    <Text className="text-slate-400 text-[9px] font-black uppercase w-24 text-right">Amount / Due</Text>
                  </View>
                  {selectedCustomer.sales?.slice(0, 5).map((s, idx) => (
                    <View key={idx} className={`px-4 py-4 flex-row items-center ${idx < 4 ? "border-b border-slate-50" : ""}`}>
                      <View className="flex-1 pr-2">
                        <View className="flex-row items-center gap-2">
                          <Text className="text-slate-800 text-xs font-black uppercase">{s.reference || `SALE-${s.id}`}</Text>
                          <View className={`px-1.5 py-0.5 rounded-md ${s.status === 'Paid' ? 'bg-emerald-100' : s.status === 'Partial' ? 'bg-orange-100' : 'bg-rose-100'}`}>
                            <Text className={`text-[8px] font-black uppercase ${s.status === 'Paid' ? 'text-emerald-700' : s.status === 'Partial' ? 'text-orange-700' : 'text-rose-700'}`}>
                              {s.status}
                            </Text>
                          </View>
                        </View>
                        <Text className="text-slate-400 text-[9px] font-bold mt-0.5">{s.sale_date}</Text>
                      </View>
                      <View className="w-24 items-end">
                        <Text className="text-slate-800 text-xs font-black">{fmt(s.grand_total)}</Text>
                        <Text className={`text-[9px] font-bold mt-0.5 ${s.due_amount > 0 ? "text-rose-600" : "text-emerald-700"}`}>
                          Due: {fmt(s.due_amount)}
                        </Text>
                      </View>
                    </View>
                  ))}
                  {(!selectedCustomer.sales || selectedCustomer.sales.length === 0) && (
                    <View className="p-10 items-center">
                      <Text className="text-slate-400 text-[10px] font-bold uppercase">No recent sales</Text>
                    </View>
                  )}
                </View>

                {/* Actions */}
                {selectedCustomer.current_due > 0 && selectedCustomer.id !== 'walk-in' && (
                  <View className="flex-row gap-3 mb-10">
                    <TouchableOpacity
                      onPress={() => onPayBalance(selectedCustomer)}
                      className="flex-1 bg-slate-900 py-4 rounded-3xl flex-row items-center justify-center gap-2 shadow-lg"
                    >
                      <Ionicons name="card-outline" size={18} color="#fff" />
                      <Text className="text-white font-black uppercase text-[10px] tracking-widest">Pay Balance</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <PaymentModal
        visible={showPaymentModal}
        config={paymentConfig}
        onClose={() => setShowPaymentModal(false)}
        onSubmit={handlePaymentSubmit}
      />
    </SafeAreaView>
  );
}
