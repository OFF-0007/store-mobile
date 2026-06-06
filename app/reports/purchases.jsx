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

function SummaryCard({ label, value, accent, icon }) {
  return (
    <View className={`flex-1 rounded-2xl p-3.5 ${accent} border border-slate-100 items-center justify-center shadow-sm`}>
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
  const [isExpanded, setIsExpanded] = useState(false);

  // Detail Modal States
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
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

  const fetchReport = useCallback(async (loadMore = false) => {
    try {
      const offset = loadMore ? pagination.offset + pagination.limit : 0;
      if (loadMore) setLoadingMore(true);
      else { setLoading(true); setError(null); }

      const res = await apiClient.get("/reports/purchases", {
        params: { limit: 10, offset, from: fromDate || undefined, to: toDate || undefined },
      });

      if (loadMore) {
        setData((prev) => ({ ...res.data, purchases: [...(prev?.purchases || []), ...(res.data.purchases || [])] }));
      } else {
        setData(res.data);
      }
      setPagination(res.data.pagination);
    } catch (e) { setError(e.message || "Failed to load purchase report"); }
    finally { setLoading(false); setLoadingMore(false); }
  }, [fromDate, toDate, pagination.offset, pagination.limit]);

  useEffect(() => { if (isFocused) fetchReport(); }, [isFocused, fromDate, toDate]);

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

      <View className="bg-white border-b border-slate-100 p-4">
        <View className="flex-row gap-2">
          <TextInput value={fromDate} onChangeText={setFromDate} placeholder="Start Date" className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold" />
          <TextInput value={toDate} onChangeText={setToDate} placeholder="End Date" className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold" />
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
              label="Gross Billed" 
              value={fmt(data.summary.total_amount)} 
              icon={<Ionicons name="cart-outline" size={16} color="#f97316" />} 
              accent="bg-orange-50/50" 
            />
            <SummaryCard 
              label="Purchase Return" 
              value={fmt(data.summary.total_returns || 0)} 
              icon={<Ionicons name="refresh-outline" size={16} color="#ef4444" />} 
              accent="bg-rose-50/50" 
            />
            <SummaryCard 
              label="Net Purchase" 
              value={fmt(data.summary.net_purchase || (data.summary.total_amount - (data.summary.total_returns || 0)))} 
              icon={<Ionicons name="calculator-outline" size={16} color="#10b981" />} 
              accent="bg-emerald-50/50" 
            />
            <SummaryCard 
              label="Net Paid" 
              value={fmt(data.summary.total_paid)} 
              icon={<Ionicons name="wallet-outline" size={16} color="#6366f1" />} 
              accent="bg-indigo-50/50" 
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
                </View>

                <View className="w-20 items-end">
                  <Text className="text-slate-800 text-xs font-black">{p.items_count || 0} Items</Text>
                  {p.return_amount > 0 && (
                    <Text className="text-rose-500 text-[9px] font-bold mt-0.5">Ret: {fmt(p.return_amount)}</Text>
                  )}
                </View>

                <View className="w-20 items-end">
                  <Text className="text-emerald-700 text-xs font-black">{fmt(p.paid_amount)}</Text>
                  <View className="mt-0.5">
                    <Badge status={p.payment_status || "Paid"} />
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
                    <Text className="text-emerald-700 text-xs font-black">{fmt(selectedPurchase.paid_amount)}</Text>
                  </View>
                  {selectedPurchase.grand_total > selectedPurchase.paid_amount && (
                    <View className="flex-row justify-between mt-1">
                      <Text className="text-rose-600 text-[10px] font-black uppercase">Balance Due</Text>
                      <Text className="text-rose-600 text-xs font-black">{fmt(selectedPurchase.grand_total - selectedPurchase.paid_amount)}</Text>
                    </View>
                  )}
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
