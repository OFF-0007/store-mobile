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

export default function ExpenseReportScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pagination, setPagination] = useState({ offset: 0, limit: 10, total: 0, has_more: false });
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const fetchReport = useCallback(async (loadMore = false) => {
    try {
      const offset = loadMore ? pagination.offset + pagination.limit : 0;
      if (loadMore) setLoadingMore(true);
      else { setLoading(true); setError(null); }

      const res = await apiClient.get("/reports/expenses", {
        params: { limit: 10, offset, from: fromDate || undefined, to: toDate || undefined },
      });

      if (loadMore) {
        setData((prev) => ({ ...res.data, expenses: [...(prev?.expenses || []), ...(res.data.expenses || [])] }));
      } else {
        setData(res.data);
      }
      setPagination(res.data.pagination);
    } catch (e) { setError(e.message || "Failed to load expense report"); }
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
        <View className="flex-1 items-center mr-8">
          <Text className="text-white font-black text-base uppercase tracking-wider">Expense Report</Text>
        </View>
      </View>

      <View className="bg-white border-b border-slate-100 p-4">
        <View className="flex-row gap-2">
          <TextInput placeholderTextColor="#94a3b8" value={fromDate} onChangeText={setFromDate} placeholder="Start Date (YYYY-MM-DD)" className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800" />
          <TextInput placeholderTextColor="#94a3b8" value={toDate} onChangeText={setToDate} placeholder="End Date (YYYY-MM-DD)" className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800" />
        </View>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" onScroll={handleScroll} scrollEventThrottle={16} refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchReport} tintColor="#f97316" />}>
        {data?.summary && (
          <View className="flex-row gap-2 mb-4">
            <SummaryCard label="Expenses" value={String(data.summary.total_expenses || 0)} icon={<Ionicons name="wallet-outline" size={16} color="#f43f5e" />} accent="bg-rose-50/50" />
            <SummaryCard label="Total Spend" value={fmt(data.summary.total_amount || 0)} icon={<Ionicons name="cash-outline" size={16} color="#e11d48" />} accent="bg-rose-100/50" />
          </View>
        )}

        <GlassCard className="p-3 mb-10">
          <View className="flex-row pb-2 mb-1.5 border-b border-slate-100">
            <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider flex-1">Expense / Category</Text>
            <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider w-24 text-right">Amount</Text>
          </View>

          {loading && !data ? <CardSkeleton /> : error ? <Text className="text-rose-500 text-center py-10 font-bold">{error}</Text> : data?.expenses?.length === 0 ? <Text className="text-slate-400 text-center py-10 font-bold">No records found</Text> : (
            data?.expenses?.map((e, i) => (
              <View key={e.id} className={`py-3 flex-row items-center ${i < data.expenses.length - 1 ? "border-b border-slate-100" : ""}`}>
                <View className="flex-1">
                  <Text className="text-slate-800 text-xs font-black">{e.item_name}</Text>
                  <Text className="text-slate-400 text-[10px] font-medium">{e.category?.name || "Uncategorized"} · {e.date}</Text>
                </View>
                <Text className="text-slate-700 text-xs font-black font-mono w-24 text-right">{fmt(e.amount)}</Text>
              </View>
            ))
          )}
          {loadingMore && <ActivityIndicator size="small" color="#f97316" className="py-4" />}
        </GlassCard>
      </ScrollView>
    </SafeAreaView>
  );
}
