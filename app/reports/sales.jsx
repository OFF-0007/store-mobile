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
import { printThermalReceipt } from "@/utils/printer";

// ── Currency formatter ────────────────────────────────────────────────────────
const fmt = (val) =>
  `₹${Number(val || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// ── Summary card component ────────────────────────────────────────────────────
function SummaryCard({ label, value, accent, icon }) {
  return (
    <View className={`flex-1 rounded-2xl p-3.5 ${accent} border border-slate-100 items-center justify-center shadow-sm`}>
      <View style={{ marginBottom: 6 }}>{icon}</View>
      <Text
        className="text-slate-800 text-sm font-black text-center"
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text className="text-slate-400 text-[8px] font-black uppercase tracking-widest text-center mt-1">
        {label}
      </Text>
    </View>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────
function Badge({ status }) {
  const s = (status ?? "").toLowerCase();
  const isPaid = s === "paid" || s === "completed";
  const isPartial = s === "partial";
  return (
    <View
      className={`px-2.5 py-0.5 rounded-full ${isPaid ? "bg-emerald-50 border border-emerald-100" : isPartial ? "bg-amber-50 border border-amber-100" : "bg-rose-50 border border-rose-100"
        }`}
    >
      <Text
        className={`text-[8px] font-black uppercase tracking-wider ${isPaid ? "text-emerald-700" : isPartial ? "text-amber-700" : "text-rose-700"
          }`}
      >
        {status || "PAID"}
      </Text>
    </View>
  );
}

export default function SalesReportScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pagination, setPagination] = useState({ offset: 0, limit: 10, total: 0, has_more: false });
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [periodHighlights, setPeriodHighlights] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Detail Modal States
  const [selectedSale, setSelectedSale] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [fetchingDetails, setFetchingDetails] = useState(false);

  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleShowDetails = async (saleId) => {
    setFetchingDetails(true);
    setShowDetailModal(true);
    try {
      const res = await apiClient.get(`/sales/${saleId}`);
      setSelectedSale(res.data);
    } catch (e) {
      Alert.alert("Error", "Failed to fetch sale details");
      setShowDetailModal(false);
    } finally {
      setFetchingDetails(false);
    }
  };

  const fetchReport = useCallback(async (loadMore = false) => {
    try {
      const offset = loadMore ? pagination.offset + pagination.limit : 0;
      if (loadMore) setLoadingMore(true);
      else {
        setLoading(true);
        setError(null);
      }

      const res = await apiClient.get("/reports/sales", {
        params: {
          limit: 10,
          offset,
          from: fromDate || undefined,
          to: toDate || undefined,
        },
      });

      const reportData = res.data;
      if (loadMore) {
        setData((prev) => ({
          ...reportData,
          sales: [...(prev?.sales || []), ...(reportData.sales || [])],
        }));
      } else {
        setData(reportData);
      }
      setPagination(reportData.pagination);
    } catch (e) {
      setError(e.message || "Failed to load sales report");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [fromDate, toDate, pagination.offset, pagination.limit]);

  useEffect(() => {
    if (isFocused) {
      apiClient.get('/reports/sales-summary').then(res => setPeriodHighlights(res.data)).catch(() => {});
      fetchReport();
    }
  }, [isFocused, fromDate, toDate]);

  const handleScroll = (event) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 40;
    if (isCloseToBottom && !loadingMore && pagination.has_more) {
      fetchReport(true);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={[]}>
      <View style={{
        backgroundColor: '#f97316',
        paddingTop: insets.top + 8,
        paddingBottom: 10,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
      }}>
        <TouchableOpacity onPress={() => router.back()} className="p-2">
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View className="flex-1 items-center">
          <Text className="text-white font-black text-base uppercase tracking-wider">Sales Report</Text>
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
        <View className="flex-row gap-2 mb-3">
          <TextInput placeholderTextColor="#94a3b8" value={fromDate} onChangeText={setFromDate} placeholder="Start Date (YYYY-MM-DD)" className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800" />
          <TextInput placeholderTextColor="#94a3b8" value={toDate} onChangeText={setToDate} placeholder="End Date (YYYY-MM-DD)" className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800" />
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
              label="Sales Amount" 
              value={fmt(data.summary.total_amount)} 
              icon={<Ionicons name="cash-outline" size={16} color="#10b981" />} 
              accent="bg-emerald-50/50" 
            />
            <SummaryCard 
              label="Invoice Count" 
              value={String(data.summary.total_sales || 0)} 
              icon={<Ionicons name="document-text-outline" size={16} color="#6366f1" />} 
              accent="bg-indigo-50/50" 
            />
            <SummaryCard 
              label="Total Tax" 
              value={fmt(data.summary.total_tax)} 
              icon={<Ionicons name="receipt-outline" size={16} color="#f59e0b" />} 
              accent="bg-amber-50/50" 
            />
            <SummaryCard 
              label="Total Discount" 
              value={fmt(data.summary.total_discount)} 
              icon={<Ionicons name="trending-down-outline" size={16} color="#64748b" />} 
              accent="bg-slate-100/50" 
            />
          </View>
        )}

        <GlassCard className="p-3 mb-10">
          <View className="flex-row pb-2 mb-1.5 border-b border-slate-100">
            <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider flex-1">Transaction / Date</Text>
            <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider w-20 text-right">Items / Tax</Text>
            <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider w-20 text-right">Paid Amount</Text>
          </View>

          {loading && !data ? (
            <CardSkeleton />
          ) : error ? (
            <Text className="text-rose-500 text-center py-10 font-bold">{error}</Text>
          ) : data?.sales?.length === 0 ? (
            <Text className="text-slate-400 text-center py-10 font-bold">No sales records found</Text>
          ) : (
            data?.sales?.map((s, i) => (
              <TouchableOpacity 
                key={s.id} 
                onPress={() => handleShowDetails(s.id)}
                activeOpacity={0.7}
                className={`py-3.5 flex-row items-center ${i < data.sales.length - 1 ? "border-b border-slate-100" : ""}`}
              >
                <View className="flex-1 pr-2">
                  <Text className="text-slate-900 text-xs font-black" numberOfLines={1}>
                    {s.customer?.name || "Walk-in Customer"}
                  </Text>
                  <View className="flex-row items-center gap-1.5 mt-0.5">
                    <Text className="text-slate-400 text-[9px] font-black uppercase tracking-tighter">
                      {s.formatted_id || `SAL-${s.id}`}
                    </Text>
                    <Text className="text-slate-300 text-[9px]">•</Text>
                    <Text className="text-slate-400 text-[9px] font-bold">{s.sale_date}</Text>
                  </View>
                </View>

                <View className="w-20 items-end">
                  <Text className="text-slate-800 text-xs font-black">{s.items?.length || 0} Items</Text>
                  <Text className="text-slate-400 text-[9px] font-bold mt-0.5">Tax: {fmt(s.tax_amount)}</Text>
                </View>

                <View className="w-24 items-end">
                  <Text className="text-emerald-700 text-xs font-black">{fmt(s.paid_amount)}</Text>
                  {s.discount > 0 ? (
                    <Text className="text-rose-500 text-[9px] font-bold mt-0.5">-Disc: {fmt(s.discount)}</Text>
                  ) : (
                    <Badge status={s.payment_status} />
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}
          {loadingMore && <ActivityIndicator size="small" color="#f97316" className="py-4" />}
        </GlassCard>
      </ScrollView>

      {/* Sale Detail Modal */}
      <Modal visible={showDetailModal} animationType="slide" transparent={true} onRequestClose={() => setShowDetailModal(false)}>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-[32px] p-6 h-[85%] shadow-2xl">
            <View className="flex-row justify-between items-center mb-6">
              <View>
                <Text className="text-slate-400 text-[10px] font-black uppercase tracking-[2px]">Invoice Details</Text>
                <Text className="text-slate-900 text-xl font-black uppercase tracking-tight">
                  {selectedSale?.formatted_id || "Loading..."}
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
            ) : selectedSale ? (
              <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
                {/* Header Summary */}
                <View className="bg-slate-50 border border-slate-100 rounded-3xl p-5 mb-6 flex-row justify-between items-center">
                  <View>
                    <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider">Total Amount</Text>
                    <Text className="text-slate-900 text-xl font-black mt-1">{fmt(selectedSale.grand_total)}</Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider">Status</Text>
                    <View className="mt-1"><Badge status={selectedSale.payment_status} /></View>
                  </View>
                </View>

                {/* Info Grid */}
                <View className="flex-row flex-wrap gap-4 mb-6">
                  <View className="w-[47%] bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
                    <Ionicons name="calendar-outline" size={16} color="#f97316" />
                    <Text className="text-slate-400 text-[9px] font-black uppercase mt-2">Date</Text>
                    <Text className="text-slate-800 text-xs font-bold mt-0.5">{selectedSale.sale_date}</Text>
                  </View>
                  <View className="w-[47%] bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
                    <Ionicons name="person-outline" size={16} color="#6366f1" />
                    <Text className="text-slate-400 text-[9px] font-black uppercase mt-2">Customer</Text>
                    <Text className="text-slate-800 text-xs font-bold mt-0.5" numberOfLines={1}>
                      {selectedSale.customer?.name || "Walkk-in"}
                    </Text>
                  </View>
                  <View className="w-[47%] bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
                    <Ionicons name="card-outline" size={16} color="#10b981" />
                    <Text className="text-slate-400 text-[9px] font-black uppercase mt-2">Payment</Text>
                    <Text className="text-slate-800 text-xs font-bold mt-0.5">{selectedSale.payment_method}</Text>
                  </View>
                  <View className="w-[47%] bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
                    <Ionicons name="business-outline" size={16} color="#f59e0b" />
                    <Text className="text-slate-400 text-[9px] font-black uppercase mt-2">Warehouse</Text>
                    <Text className="text-slate-800 text-xs font-bold mt-0.5" numberOfLines={1}>
                      {selectedSale.warehouse?.name || "Main"}
                    </Text>
                  </View>
                </View>

                {/* Items List */}
                <Text className="text-slate-400 text-[10px] font-black uppercase tracking-[2px] mb-4 ml-1">Items Sold</Text>
                <View className="bg-white border border-slate-100 rounded-3xl overflow-hidden mb-6 shadow-sm">
                  <View className="bg-slate-50 px-4 py-3 flex-row border-b border-slate-100">
                    <Text className="text-slate-400 text-[9px] font-black uppercase flex-1">Item Description</Text>
                    <Text className="text-slate-400 text-[9px] font-black uppercase w-12 text-center">Qty</Text>
                    <Text className="text-slate-400 text-[9px] font-black uppercase w-20 text-right">Subtotal</Text>
                  </View>
                  {selectedSale.items?.map((item, idx) => (
                    <View key={idx} className={`px-4 py-4 flex-row items-center ${idx < selectedSale.items.length - 1 ? "border-b border-slate-50" : ""}`}>
                      <View className="flex-1 pr-2">
                        <Text className="text-slate-800 text-xs font-black uppercase">{item.product_name || "Unknown Product"}</Text>
                        <Text className="text-slate-400 text-[9px] font-bold mt-0.5">Price: {fmt(item.unit_price)} · Tax: {item.tax_rate}%</Text>
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
                    <Text className="text-slate-700 text-xs font-black">{fmt(selectedSale.subtotal)}</Text>
                  </View>
                  <View className="flex-row justify-between mb-2">
                    <Text className="text-slate-500 text-xs font-bold">Tax Amount</Text>
                    <Text className="text-slate-700 text-xs font-black">{fmt(selectedSale.tax_amount)}</Text>
                  </View>
                  {selectedSale.discount > 0 && (
                    <View className="flex-row justify-between mb-2">
                      <Text className="text-rose-400 text-xs font-bold">Discount</Text>
                      <Text className="text-rose-600 text-xs font-black">-{fmt(selectedSale.discount)}</Text>
                    </View>
                  )}
                  {selectedSale.round_off != 0 && (
                    <View className="flex-row justify-between mb-2">
                      <Text className="text-slate-500 text-xs font-bold">Round Off</Text>
                      <Text className="text-slate-700 text-xs font-black">{selectedSale.round_off}</Text>
                    </View>
                  )}
                  <View className="flex-row justify-between mt-3 pt-3 border-t border-orange-200">
                    <Text className="text-slate-900 text-sm font-black uppercase">Grand Total</Text>
                    <Text className="text-orange-600 text-base font-black">{fmt(selectedSale.grand_total)}</Text>
                  </View>
                  <View className="flex-row justify-between mt-1">
                    <Text className="text-emerald-700 text-[10px] font-black uppercase">Paid Amount</Text>
                    <Text className="text-emerald-700 text-xs font-black">{fmt(selectedSale.paid_amount)}</Text>
                  </View>
                  {selectedSale.grand_total > selectedSale.paid_amount && (
                    <View className="flex-row justify-between mt-1">
                      <Text className="text-rose-600 text-[10px] font-black uppercase">Balance Due</Text>
                      <Text className="text-rose-600 text-xs font-black">{fmt(selectedSale.grand_total - selectedSale.paid_amount)}</Text>
                    </View>
                  )}
                </View>

                {/* Print Button */}
                <TouchableOpacity
                  onPress={() => {
                    // Fetch store name first if needed, or just print
                    apiClient.get('/store').then(res => {
                      printThermalReceipt({
                        ...selectedSale,
                        store_name: res.data?.name || "Storeman POS",
                        customer_display_name: selectedSale.customer?.name || "Walk-in Customer",
                        items: selectedSale.items?.map(i => ({ ...i, name: i.product_name }))
                      });
                    }).catch(() => {
                      printThermalReceipt({
                        ...selectedSale,
                        customer_display_name: selectedSale.customer?.name || "Walk-in Customer",
                        items: selectedSale.items?.map(i => ({ ...i, name: i.product_name }))
                      });
                    });
                  }}
                  activeOpacity={0.8}
                  className="bg-slate-800 flex-row items-center justify-center gap-2 py-4 rounded-3xl mb-10 shadow-lg"
                >
                  <Ionicons name="print-outline" size={18} color="#fff" />
                  <Text className="text-white font-black text-xs uppercase tracking-widest">Reprint Thermal Receipt</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
