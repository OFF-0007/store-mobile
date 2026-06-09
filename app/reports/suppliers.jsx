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
    if (visible) {
      // Clear amount field—user enters what they want to pay, not the full due
      setAmount("");
      setPaymentMethod("Cash");
      setNotes("");
    }
  }, [visible, config]);

  const handleSubmit = async () => {
    const numericAmount = parseFloat(amount);
    if (!amount || Number.isNaN(numericAmount) || numericAmount <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }

    const maxAmount = Number(config?.maxAmount ?? 0);
    if (maxAmount > 0 && numericAmount > maxAmount) {
      const errorMsg = config?.isRefund 
        ? `Refund cannot exceed available credit of ${fmt(maxAmount)}`
        : `Amount cannot exceed due amount of ${fmt(maxAmount)}`;
      Alert.alert("Error", errorMsg);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(numericAmount, paymentMethod, notes);
      onClose();
      setAmount("");
      setPaymentMethod("Cash");
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
            {config.isRefund ? "Receive Refund" : "Pay Supplier"}
          </Text>
          <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-6">
            {config.name}
          </Text>

          {config.isRefund && config.maxAmount > 0 && (
            <View className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 mb-4">
              <Text className="text-emerald-700 text-[10px] font-black uppercase tracking-wider">
                Available Credit
              </Text>
              <Text className="text-emerald-600 text-lg font-black mt-1">
                {fmt(config.maxAmount)}
              </Text>
            </View>
          )}

          {!config.isRefund && config.maxAmount > 0 && (
            <View className="bg-rose-50 border border-rose-100 rounded-2xl p-4 mb-4">
              <Text className="text-rose-700 text-[10px] font-black uppercase tracking-wider">
                Outstanding Due
              </Text>
              <Text className="text-rose-600 text-lg font-black mt-1">
                {fmt(config.maxAmount)}
              </Text>
            </View>
          )}

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

export default function SupplierReportScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pagination, setPagination] = useState({ offset: 0, limit: 10, total: 0, has_more: false });
  const [isExpanded, setIsExpanded] = useState(false);

  // Detail Modal States
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [fetchingDetails, setFetchingDetails] = useState(false);

  // Payment State
  const [paymentConfig, setPaymentConfig] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleShowDetails = async (supplierId) => {
    setFetchingDetails(true);
    setShowDetailModal(true);
    try {
      const res = await apiClient.get(`/suppliers/${supplierId}`);
      // Ensure the supplier details have the correct credit/due values from the API
      const supplierData = res.data;
      // The API should return current_due and current_credit properly
      setSelectedSupplier(supplierData);
    } catch (e) {
      Alert.alert("Error", "Failed to fetch supplier details");
      setShowDetailModal(false);
    } finally {
      setFetchingDetails(false);
    }
  };

  const handlePaymentSubmit = async (amount, method, notes) => {
    try {
      const endpoint = paymentConfig.isRefund 
        ? `/suppliers/${paymentConfig.id}/receive-refund` 
        : `/suppliers/${paymentConfig.id}/pay-balance`;
        
      await apiClient.post(endpoint, {
        amount,
        payment_method: method,
        notes,
      });
      Alert.alert("Success", "Transaction recorded successfully");
      fetchReport();
      if (selectedSupplier) handleShowDetails(selectedSupplier.id);
    } catch (e) {
      throw e;
    }
  };

  const onPayBalance = (supplier) => {
    const dueAmount = Math.max(0, Number(supplier.current_due ?? supplier.balance ?? 0));
    setPaymentConfig({
      id: supplier.id,
      name: supplier.name,
      maxAmount: dueAmount,
      isRefund: false,
    });
    setShowPaymentModal(true);
  };

  const onReceiveRefund = (supplier) => {
    const creditAmount = Math.max(0, Number(supplier.current_credit ?? 0));
    setPaymentConfig({
      id: supplier.id,
      name: supplier.name,
      maxAmount: creditAmount,
      isRefund: true,
    });
    setShowPaymentModal(true);
  };

  const fetchReport = useCallback(async (loadMore = false) => {
    try {
      const offset = loadMore ? pagination.offset + pagination.limit : 0;
      if (loadMore) setLoadingMore(true);
      else { setLoading(true); setError(null); }

      const res = await apiClient.get("/reports/suppliers", {
        params: { limit: 10, offset },
      });

      if (loadMore) {
        setData((prev) => ({ ...res.data, suppliers: [...(prev?.suppliers || []), ...(res.data.suppliers || [])] }));
      } else {
        setData(res.data);
      }
      setPagination(res.data.pagination);
    } catch (e) { setError(e.message || "Failed to load supplier report"); }
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
        <View className="flex-1 items-center">
          <Text className="text-white font-black text-base uppercase tracking-wider">Supplier Report</Text>
        </View>
        <TouchableOpacity 
          onPress={() => setIsExpanded(!isExpanded)}
          className="p-2 bg-white/20 rounded-xl flex-row items-center gap-1 border border-white/30"
        >
          <Text className="text-[8px] font-black text-white uppercase">{isExpanded ? 'Collapse' : 'Stats'}</Text>
          <Ionicons name={isExpanded ? "chevron-up" : "stats-chart"} size={14} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" onScroll={handleScroll} scrollEventThrottle={16} refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchReport} tintColor="#f97316" />}>
        {isExpanded && data?.summary && (
          <View className="flex-row flex-wrap gap-2 mb-4">
            <SummaryCard 
              label="Net Billed" 
              value={fmt(data.summary.total_net_bill || data.summary.total_purchased)} 
              icon={<Ionicons name="cart-outline" size={16} color="#f97316" />} 
              accent="bg-orange-50/50" 
            />
            <SummaryCard 
              label="Net Paid" 
              value={fmt(data.summary.total_net_paid || data.summary.total_paid)} 
              icon={<Ionicons name="wallet-outline" size={16} color="#6366f1" />} 
              accent="bg-indigo-50/50" 
            />
            <SummaryCard 
              label="Supplier Due" 
              value={fmt(data.summary.total_balance_due)} 
              icon={<Ionicons name="alert-circle-outline" size={16} color="#f43f5e" />} 
              accent="bg-rose-50/50" 
            />
            <SummaryCard
              label="Supplier Credit"
              value={fmt(data.summary.total_credit || 0)}
              icon={<Ionicons name="gift-outline" size={16} color="#10b981" />}
              accent="bg-emerald-50/50"
            />
          </View>
        )}

        <GlassCard className="p-3 mb-10">
          <View className="flex-row pb-2 mb-1.5 border-b border-slate-100">
            <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider flex-1">Supplier Info</Text>
            <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider w-24 text-right">Net Bill / Paid</Text>
            <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider w-20 text-right">Due / Credit</Text>
          </View>

          {loading && !data ? <CardSkeleton /> : error ? <Text className="text-rose-500 text-center py-10 font-bold">{error}</Text> : data?.suppliers?.length === 0 ? <Text className="text-slate-400 text-center py-10 font-bold">No records found</Text> : (
            data?.suppliers?.map((s, i) => (
              <TouchableOpacity 
                key={s.id} 
                onPress={() => handleShowDetails(s.id)}
                activeOpacity={0.7}
                className={`py-3.5 flex-row items-center ${i < data.suppliers.length - 1 ? "border-b border-slate-100" : ""}`}
              >
                <View className="flex-1 pr-2">
                  <Text className="text-slate-900 text-xs font-black" numberOfLines={1}>{s.name}</Text>
                  <Text className="text-slate-400 text-[9px] font-bold mt-0.5">{s.phone || "No Phone"} • {s.purchases_count || 0} Orders</Text>
                </View>
                
                <View className="w-24 items-end">
                  <Text className="text-slate-800 text-xs font-black">{fmt(s.total_net_bill || s.total_purchased)}</Text>
                  <Text className="text-emerald-700 text-[9px] font-bold mt-0.5">{fmt(s.total_net_paid || s.total_paid)}</Text>
                </View>

                <View className="w-20 items-end">
                  {s.current_due > 0 ? (
                    <Text className="text-rose-600 text-xs font-black">{fmt(s.current_due)}</Text>
                  ) : s.current_credit > 0 ? (
                    <Text className="text-emerald-600 text-xs font-black">{fmt(s.current_credit)}</Text>
                  ) : (
                    <Text className="text-slate-300 text-xs font-bold">—</Text>
                  )}
                  <Text className="text-slate-400 text-[8px] font-black uppercase tracking-tighter mt-0.5">
                    {s.current_due > 0 ? "Due" : s.current_credit > 0 ? "Credit" : "Settle"}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
          {loadingMore && <ActivityIndicator size="small" color="#f97316" className="py-4" />}
        </GlassCard>
      </ScrollView>

      {/* Supplier Detail Modal */}
      <Modal visible={showDetailModal} animationType="slide" transparent={true} onRequestClose={() => setShowDetailModal(false)}>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-[32px] p-6 h-[85%] shadow-2xl">
            <View className="flex-row justify-between items-center mb-6">
              <View>
                <Text className="text-slate-400 text-[10px] font-black uppercase tracking-[2px]">Supplier Details</Text>
                <Text className="text-slate-900 text-xl font-black uppercase tracking-tight">
                  {selectedSupplier?.name || "Loading..."}
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
                <Text className="text-slate-400 text-xs font-bold mt-4 uppercase">Fetching Details...</Text>
              </View>
            ) : selectedSupplier ? (
              <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
                {/* Header Summary */}
                <View className="bg-slate-50 border border-slate-100 rounded-3xl p-5 mb-6 flex-row justify-between items-center">
                  <View>
                    <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider">Current Balance</Text>
                    {selectedSupplier.current_due > 0 ? (
                      <Text className="text-rose-600 text-xl font-black mt-1">Due: {fmt(selectedSupplier.current_due)}</Text>
                    ) : selectedSupplier.current_credit > 0 ? (
                      <Text className="text-emerald-600 text-xl font-black mt-1">Credit: {fmt(selectedSupplier.current_credit)}</Text>
                    ) : (
                      <Text className="text-slate-900 text-xl font-black mt-1">Settled</Text>
                    )}
                  </View>
                  <View className="items-end">
                    <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider">Contact</Text>
                    <Text className="text-slate-900 text-xs font-black mt-1">{selectedSupplier.phone || "No Phone"}</Text>
                  </View>
                </View>

                {/* Info Grid */}
                <View className="flex-row flex-wrap gap-4 mb-6">
                  <View className="w-[47%] bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
                    <Ionicons name="cart-outline" size={16} color="#f97316" />
                    <Text className="text-slate-400 text-[9px] font-black uppercase mt-2">Total Billed</Text>
                    <Text className="text-slate-800 text-xs font-bold mt-0.5">{fmt(selectedSupplier.total_purchased)}</Text>
                  </View>
                  <View className="w-[47%] bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
                    <Ionicons name="wallet-outline" size={16} color="#6366f1" />
                    <Text className="text-slate-400 text-[9px] font-black uppercase mt-2">Total Paid</Text>
                    <Text className="text-slate-800 text-xs font-bold mt-0.5">{fmt(selectedSupplier.total_paid)}</Text>
                  </View>
                  <View className="w-[47%] bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
                    <Ionicons name="refresh-outline" size={16} color="#ef4444" />
                    <Text className="text-slate-400 text-[9px] font-black uppercase mt-2">Returns</Text>
                    <Text className="text-slate-800 text-xs font-bold mt-0.5">{fmt(selectedSupplier.total_returns || 0)}</Text>
                  </View>
                  <View className="w-[47%] bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
                    <Ionicons name="list-outline" size={16} color="#f59e0b" />
                    <Text className="text-slate-400 text-[9px] font-black uppercase mt-2">Total Orders</Text>
                    <Text className="text-slate-800 text-xs font-bold mt-0.5">{selectedSupplier.purchases_count || 0}</Text>
                  </View>
                </View>

                {/* Recent Purchases */}
                <Text className="text-slate-400 text-[10px] font-black uppercase tracking-[2px] mb-4 ml-1">Recent Purchases</Text>
                <View className="bg-white border border-slate-100 rounded-3xl overflow-hidden mb-6 shadow-sm">
                  <View className="bg-slate-50 px-4 py-3 flex-row border-b border-slate-100">
                    <Text className="text-slate-400 text-[9px] font-black uppercase flex-1">Order / Date</Text>
                    <Text className="text-slate-400 text-[9px] font-black uppercase w-24 text-right">Amount / Due</Text>
                  </View>
                  {selectedSupplier.purchases?.slice(0, 5).map((p, idx) => (
                    <View key={idx} className={`px-4 py-4 flex-row items-center ${idx < 4 ? "border-b border-slate-50" : ""}`}>
                      <View className="flex-1 pr-2">
                        <View className="flex-row items-center gap-2">
                          <Text className="text-slate-800 text-xs font-black uppercase">{p.reference || `PRCH-${p.id}`}</Text>
                          <View className={`px-1.5 py-0.5 rounded-md ${p.status === 'Paid' ? 'bg-emerald-100' : p.status === 'Partial' ? 'bg-orange-100' : 'bg-rose-100'}`}>
                            <Text className={`text-[8px] font-black uppercase ${p.status === 'Paid' ? 'text-emerald-700' : p.status === 'Partial' ? 'text-orange-700' : 'text-rose-700'}`}>
                              {p.status}
                            </Text>
                          </View>
                        </View>
                        <Text className="text-slate-400 text-[9px] font-bold mt-0.5">{p.purchase_date}</Text>
                      </View>
                      <View className="w-24 items-end">
                        <Text className="text-slate-800 text-xs font-black">{fmt(p.grand_total)}</Text>
                        <Text className={`text-[9px] font-bold mt-0.5 ${p.due_amount > 0 ? "text-rose-600" : "text-emerald-700"}`}>
                          Due: {fmt(p.due_amount)}
                        </Text>
                      </View>
                    </View>
                  ))}
                  {(!selectedSupplier.purchases || selectedSupplier.purchases.length === 0) && (
                    <View className="p-10 items-center">
                      <Text className="text-slate-400 text-[10px] font-bold uppercase">No recent purchases</Text>
                    </View>
                  )}
                </View>

                {/* Actions */}
                <View className="flex-row gap-3 mb-6">
                  {selectedSupplier.current_due > 0 ? (
                    <TouchableOpacity
                      onPress={() => onPayBalance(selectedSupplier)}
                      className="flex-1 bg-slate-900 py-4 rounded-3xl flex-row items-center justify-center gap-2 shadow-lg"
                    >
                      <Ionicons name="card-outline" size={18} color="#fff" />
                      <Text className="text-white font-black uppercase text-[10px] tracking-widest">Pay Balance</Text>
                    </TouchableOpacity>
                  ) : selectedSupplier.current_credit > 0 ? (
                    <TouchableOpacity
                      onPress={() => onReceiveRefund(selectedSupplier)}
                      className="flex-1 bg-emerald-600 py-4 rounded-3xl flex-row items-center justify-center gap-2 shadow-lg"
                    >
                      <Ionicons name="download-outline" size={18} color="#fff" />
                      <Text className="text-white font-black uppercase text-[10px] tracking-widest">Receive Refund</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Contact Info Section */}
                <View className="bg-orange-50 border border-orange-100 rounded-3xl p-5 mb-10">
                   <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider mb-2">Supplier Address</Text>
                   <Text className="text-slate-700 text-xs font-bold leading-5">
                     {selectedSupplier.address || "No address provided for this supplier."}
                   </Text>
                   {selectedSupplier.email && (
                     <View className="flex-row items-center gap-2 mt-4">
                       <Ionicons name="mail-outline" size={14} color="#f97316" />
                       <Text className="text-slate-600 text-xs font-bold">{selectedSupplier.email}</Text>
                     </View>
                   )}
                </View>
              </ScrollView>
            ) : null}
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
