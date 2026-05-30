/**
 * Home – Dashboard screen mirroring the STOREMANAGE web app exactly.
 * Light mode theme: clean layout with slate-50 background, white cards,
 * clear typography, and vibrant green/orange status accents.
 */
import React, { useState, useEffect } from "react";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "@/store/authStore";
import { useMockStore } from "@/store/mockStore";
import { GlassCard } from "@/components/ui";

// ── Currency formatter ────────────────────────────────────────────────────────
const fmt = (val) =>
  `₹${Number(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ title, value, icon, accent, sub }) {
  return (
    <GlassCard className="flex-1 min-w-[44%] py-4 shadow-sm">
      <View className="flex-row justify-between items-start mb-2">
        <Text
          className="text-slate-500 text-[10px] font-black uppercase tracking-wider flex-1 mr-2"
          numberOfLines={2}
        >
          {title}
        </Text>
        <View className={`w-9 h-9 rounded-xl items-center justify-center ${accent}`}>
          <Text className="text-lg">{icon}</Text>
        </View>
      </View>
      <Text
        className="text-slate-800 text-xl font-black tracking-tight"
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      {sub ? (
        <Text className="text-rose-600 text-[10px] font-bold mt-1">{sub}</Text>
      ) : null}
    </GlassCard>
  );
}

// ── Mini bar chart (pure View-based, no library needed) ───────────────────────
function BarChart({ data }) {
  const maxVal = Math.max(...data.flatMap((d) => [d.sales, d.purchases]), 10);
  return (
    <View className="flex-row items-end justify-between px-1 h-36">
      {data.map((d, i) => {
        const salesH = Math.max(6, (d.sales / maxVal) * 120);
        const purchH = Math.max(6, (d.purchases / maxVal) * 120);
        return (
          <View key={i} className="items-center flex-1">
            <View className="flex-row items-end gap-0.5">
              <View style={{ height: salesH }} className="w-2.5 rounded-t bg-emerald-500" />
              <View style={{ height: purchH }} className="w-2.5 rounded-t bg-orange-500" />
            </View>
            <Text className="text-slate-500 text-[9px] mt-1.5 font-bold">{d.name}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Operations Mix (segmented bar + legend) ───────────────────────────────────
function OperationsMix({ breakdown }) {
  const total = breakdown.reduce((s, i) => s + i.value, 0);
  const colors = ["#22c55e", "#f97316", "#ef4444"];

  if (total === 0) {
    return (
      <View className="items-center justify-center h-32">
        <Text className="text-slate-400 text-xs font-bold">No data yet</Text>
        <Text className="text-slate-500 text-[10px] mt-1">
          Perform transactions to see breakdown
        </Text>
      </View>
    );
  }

  return (
    <View>
      {/* Segmented bar */}
      <View className="flex-row h-5 rounded-full overflow-hidden mb-4">
        {breakdown.map((item, idx) => {
          const pct = total > 0 ? (item.value / total) * 100 : 0;
          return pct > 0 ? (
            <View key={idx} style={{ flex: pct, backgroundColor: colors[idx] }} />
          ) : null;
        })}
      </View>

      {/* Legend */}
      {breakdown.map((item, idx) => {
        const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : "0.0";
        return (
          <View key={idx} className="flex-row items-center justify-between py-1.5">
            <View className="flex-row items-center gap-2">
              <View className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[idx] }} />
              <Text className="text-slate-500 text-xs font-bold uppercase tracking-wider">
                {item.name}
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-slate-800 text-xs font-black font-mono">{fmt(item.value)}</Text>
              <Text className="text-slate-400 text-[9px] font-bold">{pct}%</Text>
            </View>
          </View>
        );
      })}

      <View className="border-t border-slate-100 mt-2 pt-2 flex-row justify-between">
        <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Total</Text>
        <Text className="text-slate-800 text-xs font-black font-mono">{fmt(total)}</Text>
      </View>
    </View>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────
function Badge({ status }) {
  const isPaid =
    (status ?? "").toLowerCase() === "paid" ||
    (status ?? "").toLowerCase() === "completed";
  return (
    <View
      className={`px-2 py-0.5 rounded-full ${
        isPaid ? "bg-emerald-50" : "bg-orange-50"
      }`}
    >
      <Text
        className={`text-[10px] font-black uppercase tracking-tight ${
          isPaid ? "text-emerald-700" : "text-orange-700"
        }`}
      >
        {status}
      </Text>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
const PERIODS = ["daily", "weekly", "monthly"];

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const getDashboardMetrics = useMockStore((s) => s.getDashboardMetrics);
  const fetchDashboardMetrics = useMockStore((s) => s.fetchDashboardMetrics);

  const [period, setPeriod] = useState("daily");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setRefreshing(true);
    fetchDashboardMetrics(period).finally(() => setRefreshing(false));
  }, [period]);

  const metrics = getDashboardMetrics(period);

  const periodLabel = {
    daily:   { sales: "Revenue Today",     purchases: "Purchases Today",   expenses: "Expenses Today" },
    weekly:  { sales: "Revenue This Week", purchases: "Purchases This Wk", expenses: "Expenses This Wk" },
    monthly: { sales: "Monthly Revenue",   purchases: "Total Purchases",   expenses: "Total Expenses" },
  }[period];

  const trendLabel = {
    daily:   "Daily Activity (Last 7 Days)",
    weekly:  "Weekly Activity (Last 4 Weeks)",
    monthly: "Monthly Activity (Last 6 Months)",
  }[period];

  const periodButtonLabel = { daily: "Day", weekly: "Week", monthly: "Month" };

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 py-5 pb-12"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View className="flex-row justify-between items-center mb-4">
          <View>
            <Text className="text-slate-500 text-xs font-bold uppercase tracking-wider">
              Operations Dashboard
            </Text>
            <Text className="text-slate-800 text-xl font-black tracking-tight mt-0.5">
              Good day, {user?.name?.split(" ")[0] ?? "Manager"} 👋
            </Text>
          </View>
          <View className="bg-primary-50 px-3 py-1 rounded-full border border-primary-100">
            <Text className="text-primary-700 text-[10px] font-black uppercase tracking-wider">
              {user?.role ?? "Staff"}
            </Text>
          </View>
        </View>

        {/* ── Low Stock Alert ──────────────────────────────────────────────── */}
        {metrics.lowStockProducts.length > 0 && (
          <View className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <Text className="text-amber-800 font-black text-xs uppercase tracking-wider mb-1">
              ⚠️  Critical Stock Warning
            </Text>
            <Text className="text-amber-700 text-xs">
              {metrics.lowStockProducts.length} product
              {metrics.lowStockProducts.length > 1 ? "s" : ""} below alert level
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mt-2 flex-row"
            >
              {metrics.lowStockProducts.slice(0, 6).map((p) => (
                <View key={p.id} className="mr-2 bg-amber-100/80 px-2.5 py-1 rounded-full border border-amber-200">
                  <Text className="text-amber-800 text-[10px] font-black">
                    {p.name} ({p.stock})
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Period Selector ──────────────────────────────────────────────── */}
        <View className="flex-row justify-between items-center mb-4">
          <View>
            <Text className="text-slate-800 font-black text-sm uppercase tracking-tight">
              Overview
            </Text>
            <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
              Showing data for this {period}
            </Text>
          </View>
          <View className="flex-row bg-slate-200/60 rounded-xl p-0.5 border border-slate-200">
            {PERIODS.map((p) => (
              <TouchableOpacity
                key={p}
                onPress={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg ${period === p ? "bg-white shadow-sm" : ""}`}
              >
                <Text
                  className={`text-[10px] font-black uppercase tracking-wider ${
                    period === p ? "text-primary-600" : "text-slate-500"
                  }`}
                >
                  {periodButtonLabel[p]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Stat Cards Grid ──────────────────────────────────────────────── */}
        <View className="flex-row flex-wrap gap-3 mb-6">
          <StatCard
            title={periodLabel.sales}
            value={fmt(metrics.totalSalesBilled)}
            icon="📈"
            accent="bg-indigo-50"
          />
          <StatCard
            title="Cash Collected"
            value={fmt(metrics.totalSalesReceived)}
            icon="💰"
            accent="bg-emerald-50"
          />
          <StatCard
            title={periodLabel.purchases}
            value={fmt(metrics.totalPurchasesBilled)}
            icon="🛍️"
            accent="bg-orange-50"
          />
          <StatCard
            title="Cash Paid (Net)"
            value={fmt(metrics.totalPurchasesPaid)}
            icon="💳"
            accent="bg-amber-50"
          />
          {metrics.outstandingSupplierDue > 0 && (
            <StatCard
              title="Supplier Due"
              value={fmt(metrics.outstandingSupplierDue)}
              icon="⚠️"
              accent="bg-rose-50"
            />
          )}
          <StatCard
            title={periodLabel.expenses}
            value={fmt(metrics.totalExpenses)}
            icon="📋"
            accent="bg-red-50"
          />
          <StatCard
            title="Low Stock"
            value={String(metrics.lowStockCount)}
            icon="📦"
            accent="bg-rose-50"
          />
        </View>

        {/* ── Performance Trends Bar Chart ─────────────────────────────────── */}
        <GlassCard className="mb-4 shadow-sm">
          <Text className="text-slate-800 font-black text-sm uppercase tracking-tight mb-0.5">
            Performance Trends
          </Text>
          <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-4">
            {trendLabel}
          </Text>
          <View className="flex-row gap-4 mb-3">
            <View className="flex-row items-center gap-1.5">
              <View className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
              <Text className="text-slate-500 text-[10px] font-bold">Revenue</Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <View className="w-2.5 h-2.5 rounded-sm bg-orange-500" />
              <Text className="text-slate-500 text-[10px] font-bold">Purchases</Text>
            </View>
          </View>
          {refreshing ? (
            <View className="h-36 items-center justify-center">
              <ActivityIndicator size="small" color="#2563eb" />
            </View>
          ) : (
            <BarChart data={metrics.analytics} />
          )}
        </GlassCard>

        {/* ── Operations Mix ───────────────────────────────────────────────── */}
        <GlassCard className="mb-4 shadow-sm">
          <Text className="text-slate-800 font-black text-sm uppercase tracking-tight mb-0.5">
            Operations Mix
          </Text>
          <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-4">
            Revenue vs Costs
          </Text>
          <OperationsMix breakdown={metrics.totalBreakdown} />
        </GlassCard>

        {/* ── Recent Sales ─────────────────────────────────────────────────── */}
        <GlassCard className="mb-4 shadow-sm">
          <Text className="text-slate-800 font-black text-sm uppercase tracking-tight mb-4">
            Recent Sales Activity
          </Text>
          <View className="flex-row border-b border-slate-100 pb-2 mb-1">
            <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider flex-1">
              Customer
            </Text>
            <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider w-24 text-right">
              Amount
            </Text>
            <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider w-16 text-right">
              Status
            </Text>
          </View>
          {metrics.recentSales.length === 0 ? (
            <Text className="text-slate-400 text-xs text-center py-4">
              No sales recorded yet
            </Text>
          ) : (
            metrics.recentSales.map((sale, i) => (
              <View
                key={sale.id}
                className={`flex-row items-center py-3 ${
                  i < metrics.recentSales.length - 1 ? "border-b border-slate-100" : ""
                }`}
              >
                <View className="flex-1">
                  <Text className="text-slate-700 text-xs font-bold" numberOfLines={1}>
                    {sale.customer_name ?? "Walk-in"}
                  </Text>
                  <Text className="text-slate-400 text-[10px]">{sale.reference}</Text>
                </View>
                <Text className="text-slate-600 text-xs font-mono w-24 text-right">
                  {fmt(sale.total)}
                </Text>
                <View className="w-16 items-end">
                  <Badge status={sale.status} />
                </View>
              </View>
            ))
          )}
        </GlassCard>

        {/* ── Recent Procurement ───────────────────────────────────────────── */}
        <GlassCard className="shadow-sm">
          <Text className="text-slate-800 font-black text-sm uppercase tracking-tight mb-4">
            Recent Procurement
          </Text>
          <View className="flex-row border-b border-slate-100 pb-2 mb-1">
            <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider flex-1">
              Supplier
            </Text>
            <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider w-24 text-right">
              Amount
            </Text>
            <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider w-16 text-right">
              Status
            </Text>
          </View>
          {metrics.recentPurchases.length === 0 ? (
            <Text className="text-slate-400 text-xs text-center py-4">
              No purchases recorded yet
            </Text>
          ) : (
            metrics.recentPurchases.map((pur, i) => (
              <View
                key={pur.id}
                className={`flex-row items-center py-3 ${
                  i < metrics.recentPurchases.length - 1 ? "border-b border-slate-100" : ""
                }`}
              >
                <View className="flex-1">
                  <Text className="text-slate-700 text-xs font-bold" numberOfLines={1}>
                    {pur.supplier_name}
                  </Text>
                  <Text className="text-slate-400 text-[10px]">{pur.reference}</Text>
                </View>
                <Text className="text-slate-600 text-xs font-mono w-24 text-right">
                  {fmt(pur.grand_total)}
                </Text>
                <View className="w-16 items-end">
                  <Badge status={pur.payment_status} />
                </View>
              </View>
            ))
          )}
        </GlassCard>
      </ScrollView>
    </SafeAreaView>
  );
}
