import DateTimePicker from '@react-native-community/datetimepicker';
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
import { useMockStore } from "@/store/mockStore";
import { useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

const fmt = (val) => `₹${Number(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function SummaryCard({ label, value, accent, icon }) {
  return (
    <View style={{ width: '31%' }} className={`rounded-2xl p-3.5 ${accent} border border-slate-100 items-center justify-center shadow-sm`}>
      <View style={{ marginBottom: 6 }}>{icon}</View>
      <Text className="text-slate-800 text-sm font-black text-center" numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text className="text-slate-400 text-[8px] font-black uppercase tracking-widest text-center mt-1">{label}</Text>
    </View>
  );
}

function Badge({ status }) {
  const s = (status ?? "").toLowerCase();
  const isPaid = s === "paid" || s === "completed";
  const isPartial = s === "partial";
  return (
    <View className={`px-2.5 py-0.5 rounded-full ${isPaid ? "bg-emerald-50 border border-emerald-100" : isPartial ? "bg-amber-50 border border-amber-100" : "bg-rose-50 border border-rose-100"}`}>
      <Text className={`text-[8px] font-black uppercase tracking-wider ${isPaid ? "text-emerald-700" : isPartial ? "text-amber-700" : "text-rose-700"}`}>{status || "PAID"}</Text>
    </View>
  );
}

export default function PurchaseReportScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pagination, setPagination] = useState({ offset: 0, limit: 10, total: 0, has_more: false });
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  const onFromDateChange = (event, selectedDate) => {
    setShowFromPicker(false);
    if (selectedDate && event.type !== 'dismissed') {
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      setFromDate(`${year}-${month}-${day}`);
    }
  };

  const onToDateChange = (event, selectedDate) => {
    setShowToPicker(false);
    if (selectedDate && event.type !== 'dismissed') {
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      setToDate(`${year}-${month}-${day}`);
    }
  };

  const [paymentMethod, setPaymentMethod] = useState("all");
  const [showPaymentDropdown, setShowPaymentDropdown] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Detail Modal States
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [fetchingDetails, setFetchingDetails] = useState(false);

  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleShowDetails = async (purchaseId) => {
    setFetchingDetails(true);
    setShowDetailModal(true);
    try {
      const res = await apiClient.get(`/purchases/${purchaseId}`);
      setSelectedPurchase(res.data);
    } catch (e) {
      Alert.alert("Error", "Failed to fetch purchase details");
      setShowDetailModal(false);
    } finally {
      setFetchingDetails(false);
    }
  };

  const handleReceiveRefund = () => {
    const availableRefund = Number(selectedPurchase?.summary?.refundable_amount || 0);
    setRefundAmount(availableRefund > 0 ? availableRefund.toString() : '0');
    setShowRefundModal(true);
  };

  const fetchDashboardMetrics = useMockStore((s) => s.fetchDashboardMetrics);
  const confirmReceiveRefund = async () => {
    const supplierId = selectedPurchase?.supplier?.id;
    const amount = Number(refundAmount) || 0;
    if (!supplierId || amount <= 0) {
      Alert.alert('Invalid', 'Please enter a valid refund amount');
      return;
    }

    setRefundSubmitting(true);
    try {
      await apiClient.post(`/suppliers/${supplierId}/receive-refund`, {
        amount,
        payment_method: 'Cash',
        notes: `Refund for ${selectedPurchase?.formatted_id || selectedPurchase?.ref_no || `#${selectedPurchase?.id}`}`,
        reference: selectedPurchase?.formatted_id || selectedPurchase?.ref_no || null,
      });

      setShowRefundModal(false);
      // Optimistically zero-out the supplier credit balance so the button disappears.
      // The exact remaining amount will be reloaded from the server via fetchReport().
      setSelectedPurchase((prev) => {
        if (!prev) return prev;
        const prevSummary = prev.summary || {};
        const newRefundable = Math.max(0, Number(prevSummary.refundable_amount || 0) - amount);
        return {
          ...prev,
          summary: {
            ...prevSummary,
            refundable_amount: newRefundable,
          },
        };
      });

      // Also update list item if present
      setData((prev) => {
        if (!prev) return prev;
        const purchases = (prev.purchases || []).map((p) => {
          if (p.id === selectedPurchase?.id) {
            return { ...p, paid_amount: (Number(p.paid_amount || p.paid || 0)) };
          }
          return p;
        });
        return { ...prev, purchases };
      });

      setShowDetailModal(false);
      Alert.alert('Success', 'Refund recorded successfully');

      // Refresh report list and dashboard metrics
      fetchReport();
      fetchDashboardMetrics();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to record refund');
    } finally {
      setRefundSubmitting(false);
    }
  };

  const fetchReport = useCallback(async (loadMore = false) => {
    try {
      const offset = loadMore ? pagination.offset + pagination.limit : 0;
      if (loadMore) setLoadingMore(true);
      else { setLoading(true); setError(null); }

      const res = await apiClient.get("/reports/purchases", {
        params: { limit: 10, offset, from: fromDate || undefined, to: toDate || undefined, payment_method: paymentMethod !== 'all' ? paymentMethod : undefined },
      });

      if (loadMore) {
        setData((prev) => ({ ...res.data, purchases: [...(prev?.purchases || []), ...(res.data.purchases || [])] }));
      } else {
        setData(res.data);
      }
      setPagination(res.data.pagination);
    } catch (e) { setError(e.message || "Failed to load purchase report"); }
    finally { setLoading(false); setLoadingMore(false); }
  }, [fromDate, toDate, pagination.offset, pagination.limit, paymentMethod]);

  useEffect(() => { if (isFocused) fetchReport(); }, [isFocused, fromDate, toDate, paymentMethod]);

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
          <Text className="text-white font-black text-base uppercase tracking-wider">Purchase Report</Text>
        </View>
        <TouchableOpacity
          onPress={() => setIsExpanded(!isExpanded)}
          className="p-2 bg-white/20 rounded-xl flex-row items-center gap-1 border border-white/30"
        >
          <Text className="text-[8px] font-black text-white uppercase">{isExpanded ? 'Collapse' : 'Stats'}</Text>
          <Ionicons name={isExpanded ? "chevron-up" : "stats-chart"} size={14} color="#fff" />
        </TouchableOpacity>
      </View>

      <View className="bg-white border-b border-slate-100 p-4 z-50">
        <View className="flex-row gap-2 mb-3">
          <TouchableOpacity onPress={() => setShowFromPicker(true)} className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex-row justify-between items-center">
              <Text className="text-xs font-bold text-slate-800">{fromDate || "Start Date"}</Text>
              <Ionicons name="calendar-outline" size={14} color="#94a3b8" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowToPicker(true)} className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex-row justify-between items-center">
              <Text className="text-xs font-bold text-slate-800">{toDate || "End Date"}</Text>
              <Ionicons name="calendar-outline" size={14} color="#94a3b8" />
            </TouchableOpacity>
            {showFromPicker && (
              <DateTimePicker value={fromDate ? new Date(fromDate) : new Date()} mode="date" display="default" onChange={onFromDateChange} />
            )}
            {showToPicker && (
              <DateTimePicker value={toDate ? new Date(toDate) : new Date()} mode="date" display="default" onChange={onToDateChange} />
            )}
        </View>
        <View className="relative z-50">
          <TouchableOpacity
            onPress={() => setShowPaymentDropdown(!showPaymentDropdown)}
            className="flex-row items-center justify-between bg-slate-50 border border-slate-200 p-3 rounded-xl"
          >
            <Text className="text-xs font-black text-slate-700 uppercase tracking-widest">
              {paymentMethod === 'all' ? 'All Methods' : paymentMethod}
            </Text>
            <Ionicons name={showPaymentDropdown ? "chevron-up" : "chevron-down"} size={16} color="#64748b" />
          </TouchableOpacity>

          {showPaymentDropdown && (
            <View className="mt-2 bg-slate-50 border border-slate-100 rounded-xl overflow-hidden">
              {['all', 'Cash', 'Card', 'UPI'].map((method, index) => (
                <TouchableOpacity
                  key={method}
                  onPress={() => {
                    setPaymentMethod(method);
                    setShowPaymentDropdown(false);
                  }}
                  className={`p-3 flex-row items-center justify-between ${index !== 3 ? 'border-b border-slate-100' : ''}`}
                >
                  <Text className={`text-xs font-bold uppercase tracking-wider ${paymentMethod === method ? 'text-orange-500' : 'text-slate-500'}`}>
                    {method === 'all' ? 'All Methods' : method}
                  </Text>
                  {paymentMethod === method && <Ionicons name="checkmark-circle" size={16} color="#f97316" />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchReport} tintColor="#f97316" />}
      >
        {isExpanded && data?.summary && (
          <View className="flex-row flex-wrap gap-2 mb-4">
            <SummaryCard
              label="Gross Purchase"
              value={fmt(data.summary.total_amount)}
              icon={<Ionicons name="cart-outline" size={16} color="#475569" />}
              accent="bg-slate-50/50"
            />
            <SummaryCard
              label="Purchase Return"
              value={fmt(data.summary.total_returned)}
              icon={<Ionicons name="refresh-outline" size={16} color="#e11d48" />}
              accent="bg-rose-50/50 border-l-2 border-l-rose-400"
            />
            <SummaryCard
              label="Net Purchase"
              value={fmt(data.summary.net_purchase)}
              icon={<Ionicons name="calculator-outline" size={16} color="#475569" />}
              accent="bg-slate-50/50 border-l-2 border-l-slate-400"
            />
            <SummaryCard
              label="Total Paid"
              value={fmt(data.summary.total_paid)}
              icon={<Ionicons name="wallet-outline" size={16} color="#1d4ed8" />}
              accent="bg-blue-50/50 border-l-2 border-l-blue-400"
            />
            <SummaryCard
              label="Refund Received"
              value={fmt(data.summary.refund_received)}
              icon={<Ionicons name="download-outline" size={16} color="#4f46e5" />}
              accent="bg-indigo-50/50 border-l-2 border-l-indigo-400"
            />
            <SummaryCard
              label="Net Paid"
              value={fmt(data.summary.net_paid)}
              icon={<Ionicons name="checkmark-circle-outline" size={16} color="#059669" />}
              accent="bg-emerald-50/50 border-l-2 border-l-emerald-400"
            />
          </View>
        )}

        <GlassCard className="p-3 mb-10">
          <View className="flex-row pb-2 mb-1.5 border-b border-slate-100">
            <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider flex-1">Supplier / Date</Text>
            <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider w-20 text-right">Items / Return</Text>
            <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider w-20 text-right">Net Paid</Text>
          </View>

          {loading && !data ? (
            <CardSkeleton />
          ) : error ? (
            <Text className="text-rose-500 text-center py-10 font-bold">{error}</Text>
          ) : data?.purchases?.length === 0 ? (
            <Text className="text-slate-400 text-center py-10 font-bold">No records found</Text>
          ) : (
            data?.purchases?.map((p, i) => (
              <TouchableOpacity
                key={p.id}
                onPress={() => handleShowDetails(p.id)}
                activeOpacity={0.7}
                className={`py-3.5 flex-row items-center ${i < data.purchases.length - 1 ? "border-b border-slate-100" : ""}`}
              >
                <View className="flex-1 pr-2">
                  <Text className="text-slate-900 text-xs font-black" numberOfLines={1}>
                    {p.supplier_name}
                  </Text>
                  <View className="flex-row items-center gap-1.5 mt-0.5">
                    <Text className="text-slate-400 text-[9px] font-black uppercase tracking-tighter">
                      {p.formatted_id || p.reference || `PRCH-${p.id}`}
                    </Text>
                    <Text className="text-slate-300 text-[9px]">•</Text>
                    <Text className="text-slate-400 text-[9px] font-bold">{p.purchase_date}</Text>
                  </View>
                  <Text className="text-slate-500 text-[8px] font-black uppercase mt-1">
                    {(p.payment_status || p.accounting_status || "Paid")}
                  </Text>
                </View>

                <View className="w-20 items-end">
                  <Text className="text-slate-800 text-xs font-black">{p.items_count || 0} Items</Text>
                  {(p.total_returned || p.return_amount) > 0 && (
                    <Text className="text-rose-500 text-[9px] font-bold mt-0.5">Ret: {fmt(p.total_returned ?? p.return_amount)}</Text>
                  )}
                </View>

                <View className="w-20 items-end">
                  <Text className="text-emerald-700 text-xs font-black">{fmt(p.net_paid ?? p.paid_amount ?? p.paid)}</Text>
                  <View className="mt-0.5">
                    <Badge status={p.payment_status || p.accounting_status || "Paid"} />
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
          {loadingMore && <ActivityIndicator size="small" color="#f97316" className="py-4" />}
        </GlassCard>
      </ScrollView>

      {/* Purchase Detail Modal */}
      <Modal visible={showDetailModal} animationType="slide" transparent={true} onRequestClose={() => setShowDetailModal(false)}>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-[32px] p-6 h-[85%] shadow-2xl">
            <View className="flex-row justify-between items-center mb-6">
              <View>
                <Text className="text-slate-400 text-[10px] font-black uppercase tracking-[2px]">Purchase Details</Text>
                <Text className="text-slate-900 text-xl font-black uppercase tracking-tight">
                  {selectedPurchase?.formatted_id || "Loading..."}
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
            ) : selectedPurchase ? (
              <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
                {/* Header Summary */}
                <View className="bg-slate-50 border border-slate-100 rounded-3xl p-5 mb-6 flex-row justify-between items-center">
                  <View>
                    <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider">Billed Amount</Text>
                    <Text className="text-slate-900 text-xl font-black mt-1">{fmt(selectedPurchase.grand_total)}</Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider">Status</Text>
                    <View className="mt-1"><Badge status={selectedPurchase.payment_status || "Completed"} /></View>
                  </View>
                </View>

                {selectedPurchase?.summary?.refundable_amount > 0 && (
                  <TouchableOpacity
                    onPress={handleReceiveRefund}
                    className="mb-4 bg-emerald-600 rounded-3xl px-4 py-3 items-center"
                  >
                    <Text className="text-white text-xs font-black uppercase">Receive Refund</Text>
                  </TouchableOpacity>
                )}

                {/* Info Grid */}
                <View className="flex-row flex-wrap gap-4 mb-6">
                  <View className="w-[47%] bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
                    <Ionicons name="calendar-outline" size={16} color="#f97316" />
                    <Text className="text-slate-400 text-[9px] font-black uppercase mt-2">Date</Text>
                    <Text className="text-slate-800 text-xs font-bold mt-0.5">{selectedPurchase.purchase_date}</Text>
                  </View>
                  <View className="w-[47%] bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
                    <Ionicons name="business-outline" size={16} color="#6366f1" />
                    <Text className="text-slate-400 text-[9px] font-black uppercase mt-2">Supplier</Text>
                    <Text className="text-slate-800 text-xs font-bold mt-0.5" numberOfLines={1}>
                      {selectedPurchase.supplier?.name || "Unknown"}
                    </Text>
                  </View>
                  <View className="w-[47%] bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
                    <Ionicons name="document-text-outline" size={16} color="#10b981" />
                    <Text className="text-slate-400 text-[9px] font-black uppercase mt-2">Ref No</Text>
                    <Text className="text-slate-800 text-xs font-bold mt-0.5">{selectedPurchase.ref_no || "N/A"}</Text>
                  </View>
                  <View className="w-[47%] bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
                    <Ionicons name="cube-outline" size={16} color="#f59e0b" />
                    <Text className="text-slate-400 text-[9px] font-black uppercase mt-2">Warehouse</Text>
                    <Text className="text-slate-800 text-xs font-bold mt-0.5" numberOfLines={1}>
                      {selectedPurchase.warehouse?.name || "Main"}
                    </Text>
                  </View>
                </View>

                {/* Items List */}
                <Text className="text-slate-400 text-[10px] font-black uppercase tracking-[2px] mb-4 ml-1">Items Purchased</Text>
                <View className="bg-white border border-slate-100 rounded-3xl overflow-hidden mb-6 shadow-sm">
                  <View className="bg-slate-50 px-4 py-3 flex-row border-b border-slate-100">
                    <Text className="text-slate-400 text-[9px] font-black uppercase flex-1">Product</Text>
                    <Text className="text-slate-400 text-[9px] font-black uppercase w-12 text-center">Qty</Text>
                    <Text className="text-slate-400 text-[9px] font-black uppercase w-20 text-right">Cost</Text>
                  </View>
                  {selectedPurchase.items?.map((item, idx) => (
                    <View key={idx} className={`px-4 py-4 flex-row items-center ${idx < selectedPurchase.items.length - 1 ? "border-b border-slate-50" : ""}`}>
                      <View className="flex-1 pr-2">
                        <Text className="text-slate-800 text-xs font-black uppercase">{item.product_name || "Unknown Product"}</Text>
                        <Text className="text-slate-400 text-[9px] font-bold mt-0.5">Rate: {fmt(item.unit_price)} {item.unit ? `per ${item.unit}` : ""}</Text>
                      </View>
                      <Text className="text-slate-700 text-xs font-black w-12 text-center">{item.quantity}</Text>
                      <Text className="text-slate-800 text-xs font-black w-20 text-right">{fmt(item.subtotal)}</Text>
                    </View>
                  ))}
                </View>

                {/* Final Accounting */}
                <View className="bg-orange-50 border border-orange-100 rounded-3xl p-5 mb-10">
                  <View className="flex-row justify-between mb-2">
                    <Text className="text-slate-500 text-xs font-bold">Subtotal</Text>
                    <Text className="text-slate-700 text-xs font-black">{fmt(selectedPurchase.grand_total - (selectedPurchase.tax_amount || 0))}</Text>
                  </View>
                  <View className="flex-row justify-between mb-2">
                    <Text className="text-slate-500 text-xs font-bold">Tax Amount</Text>
                    <Text className="text-slate-700 text-xs font-black">{fmt(selectedPurchase.tax_amount || 0)}</Text>
                  </View>
                  {selectedPurchase.round_off != 0 && (
                    <View className="flex-row justify-between mb-2">
                      <Text className="text-slate-500 text-xs font-bold">Round Off</Text>
                      <Text className="text-slate-700 text-xs font-black">{selectedPurchase.round_off}</Text>
                    </View>
                  )}
                  <View className="flex-row justify-between mt-3 pt-3 border-t border-orange-200">
                    <Text className="text-slate-900 text-sm font-black uppercase">Grand Total</Text>
                    <Text className="text-orange-600 text-base font-black">{fmt(selectedPurchase.grand_total)}</Text>
                  </View>
                  <View className="flex-row justify-between mt-1">
                    <Text className="text-emerald-700 text-[10px] font-black uppercase">Paid Amount</Text>
                    <Text className="text-emerald-700 text-xs font-black">{fmt(selectedPurchase.summary?.paid_amount ?? selectedPurchase.paid_amount)}</Text>
                  </View>
                  {selectedPurchase.summary?.prior_returns_total > 0 && (
                    <View className="flex-row justify-between mt-1">
                      <Text className="text-rose-600 text-[10px] font-black uppercase">Returned Total</Text>
                      <Text className="text-rose-600 text-xs font-black">{fmt(selectedPurchase.summary.prior_returns_total)}</Text>
                    </View>
                  )}
                  {selectedPurchase.summary?.prior_refunds_total > 0 && (
                    <View className="flex-row justify-between mt-1">
                      <Text className="text-rose-600 text-[10px] font-black uppercase">Refund Received</Text>
                      <Text className="text-rose-600 text-xs font-black">{fmt(selectedPurchase.summary.prior_refunds_total)}</Text>
                    </View>
                  )}
                  {selectedPurchase.summary?.outstanding_dues > 0 && (
                    <View className="flex-row justify-between mt-1">
                      <Text className="text-rose-600 text-[10px] font-black uppercase">Outstanding</Text>
                      <Text className="text-rose-600 text-xs font-black">{fmt(selectedPurchase.summary.outstanding_dues)}</Text>
                    </View>
                  )}
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal visible={showRefundModal} animationType="fade" transparent={true} onRequestClose={() => setShowRefundModal(false)}>
        <View className="flex-1 bg-black/40 justify-center px-6">
          <View className="bg-white rounded-3xl p-6 shadow-2xl border border-slate-200">
            <Text className="text-slate-900 text-lg font-black mb-3">Receive Refund</Text>
            <Text className="text-slate-500 text-sm mb-4">
              This supplier has a credit balance — they owe you money from a return or overpayment. Record the amount they pay you here to settle that credit.
            </Text>

            <View className="bg-slate-50 rounded-2xl border border-slate-200 p-4 mb-4">
              <Text className="text-slate-500 text-[10px] uppercase tracking-[1px] mb-2">Invoice</Text>
              <Text className="text-slate-900 text-base font-black">{selectedPurchase?.formatted_id || selectedPurchase?.ref_no || `#${selectedPurchase?.id}`}</Text>
              <Text className="text-slate-400 text-[11px] mt-2">Supplier: {selectedPurchase?.supplier?.name || 'Unknown'}</Text>
            </View>

            <View className="mb-4">
              <Text className="text-slate-500 text-[10px] uppercase tracking-[1px] mb-2">Amount to receive</Text>
              <TextInput
                value={refundAmount}
                onChangeText={(value) => {
                  const cleaned = value.replace(/[^0-9.]/g, '');
                  if (cleaned === '' || cleaned === '.') {
                    setRefundAmount(cleaned);
                    return;
                  }
                  const parsed = parseFloat(cleaned) || 0;
                  const availableRefund = Number(selectedPurchase?.summary?.refundable_amount || 0);
                  const capped = parsed > availableRefund ? availableRefund : parsed;
                  setRefundAmount(capped.toString());
                }}
                keyboardType="decimal-pad"
                placeholder="0.00"
                className="bg-white border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 text-sm font-bold"
              />
            </View>

            <View className="space-y-3 mb-5">
              <View className="flex-row justify-between">
                <Text className="text-slate-500 text-[11px]">Supplier credit balance</Text>
                <Text className="text-indigo-600 text-sm font-black">
                  {fmt(Number(selectedPurchase?.summary?.refundable_amount || 0))}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-slate-500 text-[11px]">Receiving now</Text>
                <Text className="text-slate-900 text-sm font-black">{fmt(Number(refundAmount) || 0)}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-slate-500 text-[11px]">Pending refund amount</Text>
                <Text className="text-rose-600 text-sm font-black">
                  {fmt(
                    Math.max(
                      0,
                      Number(selectedPurchase?.summary?.refundable_amount || 0) - (Number(refundAmount) || 0)
                    )
                  )}
                </Text>
              </View>
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity onPress={() => setShowRefundModal(false)} disabled={refundSubmitting} className="flex-1 bg-slate-100 rounded-2xl px-4 py-3 items-center">
                <Text className="text-slate-700 text-xs font-black uppercase">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmReceiveRefund} disabled={refundSubmitting} className={`flex-1 rounded-2xl px-4 py-3 items-center ${refundSubmitting ? 'bg-emerald-300' : 'bg-emerald-600'}`}>
                {refundSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white text-xs font-black uppercase">Proceed</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
