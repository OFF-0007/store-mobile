import React, { useState, useEffect, useCallback } from "react";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "@/store/authStore";
import { useMockStore } from "@/store/mockStore";
import { Feather, MaterialIcons, AntDesign } from "@expo/vector-icons";

// ── Currency formatter ────────────────────────────────────────────────────────
const fmt = (val) =>
  `₹${Number(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ title, value, icon, colorClass = "orange" }) {
  const bgColors = {
    orange: "bg-orange-50",
    emerald: "bg-emerald-50",
    rose: "bg-rose-50",
    blue: "bg-blue-50",
  };

  return (
    <View className="flex-1 min-w-[45%] bg-white rounded-2xl p-4 shadow-sm elevation-1 mb-3 border border-slate-100">
      <View className="flex-row items-center mb-3">
        <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${bgColors[colorClass]}`}>
          {icon}
        </View>
        <Text
          className="text-slate-500 text-xs font-bold flex-1"
          numberOfLines={2}
        >
          {title}
        </Text>
      </View>
      <Text
        className="text-slate-800 text-xl font-black tracking-tight"
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
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
      className={`px-2.5 py-1 rounded-md ${isPaid ? "bg-emerald-100" : "bg-orange-100"
        }`}
    >
      <Text
        className={`text-[10px] font-bold uppercase tracking-widest ${isPaid ? "text-emerald-700" : "text-orange-700"
          }`}
      >
        {status}
      </Text>
    </View>
  );
}


export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const getDashboardMetrics = useMockStore((s) => s.getDashboardMetrics);
  const fetchDashboardMetrics = useMockStore((s) => s.fetchDashboardMetrics);

  const [period, setPeriod] = useState("daily");
  const [refreshing, setRefreshing] = useState(false);
  const [showLowStockAlert, setShowLowStockAlert] = useState(true);
  const [isFabOpen, setIsFabOpen] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboardMetrics(period).finally(() => setRefreshing(false));
  }, [period]);

  useFocusEffect(
    useCallback(() => {
      onRefresh();
    }, [onRefresh])
  );

  const metrics = getDashboardMetrics(period);

  useEffect(() => {
    if (metrics.lowStockProducts.length > 0) {
      setShowLowStockAlert(true);
      const timer = setTimeout(() => {
        setShowLowStockAlert(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [metrics.lowStockProducts.length]);

  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-slate-50">
      {/* Normal Orange Header */}
      <View style={{
        backgroundColor: '#f97316',
        paddingTop: insets.top + 10,
        paddingBottom: 16,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        elevation: 4,
        shadowColor: '#f97316',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        zIndex: 10,
      }}>
        <View className="flex-row items-center flex-1">
          <View className="w-10 h-10 bg-white/20 rounded-full items-center justify-center border border-white/30 mr-3">
            <Feather name="user" size={20} color="#fff" />
          </View>
          <View>
            <Text className="text-orange-100 text-xs font-semibold tracking-wide">
              StoreManage POS
            </Text>
            <Text className="text-white text-base font-bold">
              {user?.name || "Dashboard"}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          className="w-10 h-10 bg-white/10 rounded-full items-center justify-center relative"
          onPress={() => router.push("/inventory")}
        >
          <Feather name="bell" size={20} color="#ffffff" />
          {metrics.lowStockCount > 0 && (
            <View className="absolute top-2 right-2 w-2.5 h-2.5 bg-rose-500 rounded-full border border-orange-500" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 30 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#f97316"]} tintColor="#f97316" />
        }
      >

        {/* Action Needed: Supplier Dues */}
        {metrics.outstandingSupplierDue > 0 && (
          <TouchableOpacity
            className="mb-5 bg-white rounded-2xl p-4 shadow-sm elevation-1 border border-red-100 flex-row items-center justify-between"
          >
            <View className="flex-row items-center">
              <View className="w-10 h-10 bg-red-50 rounded-full items-center justify-center mr-3 border border-red-100">
                <Feather name="credit-card" size={18} color="#ef4444" />
              </View>
              <View>
                <Text className="text-slate-800 font-bold text-sm">Outstanding Dues</Text>
                <Text className="text-slate-400 text-[11px]">Pending supplier payments</Text>
              </View>
            </View>
            <View className="items-end">
              <Text className="text-red-600 font-black text-sm">{fmt(metrics.outstandingSupplierDue)}</Text>
              <Text className="text-orange-500 text-[10px] font-bold mt-1">Pay Now</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Inventory Watchlist (Horizontal Scroll) */}
        {(showLowStockAlert && metrics.lowStockProducts.length > 0) && (
          <View className="mb-6">
            <Text className="text-slate-800 font-black text-lg mb-3 px-1">Inventory Watchlist</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="overflow-visible pl-1 pb-2">
              {metrics.lowStockProducts.slice(0, 5).map((prod) => (
                <View key={prod.id} className="bg-white rounded-2xl p-4 shadow-sm elevation-1 border border-slate-100 mr-3 w-36">
                  <View className="w-10 h-10 bg-rose-50 rounded-full items-center justify-center mb-3 border border-rose-100">
                    <Feather name="package" size={16} color="#e11d48" />
                  </View>
                  <Text className="text-slate-800 font-bold text-sm mb-1" numberOfLines={1}>{prod.name}</Text>
                  <Text className="text-rose-600 font-black text-xs">{prod.stock} left in stock</Text>
                </View>
              ))}
              <TouchableOpacity
                onPress={() => router.push("/inventory")}
                className="bg-orange-50 rounded-2xl p-4 border border-orange-100 mr-4 w-36 items-center justify-center shadow-sm elevation-1"
              >
                <View className="w-10 h-10 bg-white rounded-full items-center justify-center mb-2 shadow-sm">
                  <Feather name="arrow-right" size={16} color="#f97316" />
                </View>
                <Text className="text-orange-700 font-bold text-xs text-center">View All Stock</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        <View className="flex-row items-center justify-between mb-3 px-1 mt-2">
          <Text className="text-slate-800 font-black text-lg">Overview</Text>
          <View className="bg-orange-100 px-3 py-1.5 rounded-lg border border-orange-200">
            <Text className="text-orange-700 font-bold text-[10px] uppercase tracking-wider">Today</Text>
          </View>
        </View>

        {/* Stat Cards Grid */}
        <View className="flex-row flex-wrap justify-between mb-4">
          <StatCard title="Revenue" value={fmt(metrics.totalSalesBilled)} icon={<Feather name="trending-up" size={18} color="#10b981" />} colorClass="emerald" />
          <StatCard title="Cash In" value={fmt(metrics.totalSalesReceived)} icon={<Feather name="dollar-sign" size={18} color="#3b82f6" />} colorClass="blue" />
          <StatCard title="Purchases" value={fmt(metrics.totalPurchasesBilled)} icon={<Feather name="shopping-bag" size={18} color="#f97316" />} colorClass="orange" />
          <StatCard title="Expenses" value={fmt(metrics.totalExpenses)} icon={<Feather name="file-text" size={18} color="#f43f5e" />} colorClass="rose" />
        </View>

        {/* Smart Insights & Goals */}
        <View className="flex-row gap-3 mb-6">
          {/* Daily Goal */}
          <View className="flex-1 bg-white rounded-2xl p-4 shadow-sm elevation-1 border border-slate-100 justify-between">
            <View className="flex-row items-center mb-2">
              <View className="w-7 h-7 rounded-full bg-indigo-50 items-center justify-center mr-2">
                <Feather name="target" size={14} color="#6366f1" />
              </View>
              <Text className="text-slate-500 font-bold text-[10px] uppercase tracking-wider">Daily Goal</Text>
            </View>
            <View>
              <Text className="text-slate-800 font-black text-lg mb-1">82%</Text>
              <View className="w-full h-1.5 bg-slate-100 rounded-full mb-1.5 overflow-hidden">
                <View className="h-full bg-indigo-500 rounded-full" style={{ width: '82%' }} />
              </View>
              <Text className="text-slate-400 text-[9px] font-bold">₹{fmt(metrics.totalSalesBilled).replace('₹', '')} / ₹50,000</Text>
            </View>
          </View>

          {/* AI Insight */}
          <View className="flex-1 bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-4 shadow-sm elevation-1 border border-orange-100 justify-between">
            <View className="flex-row items-center mb-2">
              <View className="w-7 h-7 rounded-full bg-orange-100 items-center justify-center mr-2">
                <Feather name="zap" size={14} color="#f97316" />
              </View>
              <Text className="text-orange-800 font-bold text-[10px] uppercase tracking-wider">Insight</Text>
            </View>
            <Text className="text-orange-900 text-[11px] font-semibold leading-snug">
              Sales are looking great today! You're on track to beat yesterday's revenue by 15%.
            </Text>
          </View>
        </View>

        {/* Recent Sales Activity */}
        <View className="bg-white rounded-2xl p-5 shadow-sm elevation-1 border border-slate-100 mb-5">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-slate-800 font-black text-base">Recent Sales</Text>
            <TouchableOpacity onPress={() => router.push("/reports/sales")}>
              <Text className="text-orange-500 font-bold text-xs">View All</Text>
            </TouchableOpacity>
          </View>

          {metrics.recentSales.length === 0 ? (
            <View className="items-center py-6">
              <View className="w-14 h-14 bg-slate-50 rounded-full items-center justify-center mb-3">
                <Feather name="inbox" size={24} color="#cbd5e1" />
              </View>
              <Text className="text-slate-400 text-sm font-medium">No sales recorded today</Text>
            </View>
          ) : (
            metrics.recentSales.slice(0, 4).map((sale, i) => (
              <View
                key={sale.id}
                className={`flex-row items-center py-3.5 ${i < Math.min(metrics.recentSales.length - 1, 3) ? "border-b border-slate-100" : ""}`}
              >
                <View className="w-10 h-10 bg-orange-50 rounded-full items-center justify-center mr-3">
                  <Feather name="user" size={16} color="#f97316" />
                </View>
                <View className="flex-1">
                  <Text className="text-slate-800 text-sm font-bold mb-0.5" numberOfLines={1}>
                    {sale.customer_name ?? "Walk-in"}
                  </Text>
                  <Text className="text-slate-400 text-[11px] font-medium">{sale.reference}</Text>
                </View>
                <View className="items-end pl-2">
                  <Text className="text-slate-800 text-sm font-black mb-1.5 font-mono">
                    {fmt(sale.total)}
                  </Text>
                  <Badge status={sale.status} />
                </View>
              </View>
            ))
          )}
        </View>

        {/* Recent Procurements */}
        <View className="bg-white rounded-2xl p-5 shadow-sm elevation-1 border border-slate-100 mb-5">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-slate-800 font-black text-base">Recent Procurements</Text>
            <TouchableOpacity onPress={() => router.push("/reports/purchases")}>
              <Text className="text-orange-500 font-bold text-xs">View All</Text>
            </TouchableOpacity>
          </View>

          {metrics.recentPurchases.length === 0 ? (
            <View className="items-center py-6">
              <View className="w-14 h-14 bg-slate-50 rounded-full items-center justify-center mb-3">
                <Feather name="package" size={24} color="#cbd5e1" />
              </View>
              <Text className="text-slate-400 text-sm font-medium">No purchases recorded yet</Text>
            </View>
          ) : (
            metrics.recentPurchases.slice(0, 4).map((pur, i) => (
              <View
                key={pur.id}
                className={`flex-row items-center py-3.5 ${i < Math.min(metrics.recentPurchases.length - 1, 3) ? "border-b border-slate-100" : ""}`}
              >
                <View className="w-10 h-10 bg-slate-100 rounded-full items-center justify-center mr-3">
                  <Feather name="briefcase" size={16} color="#64748b" />
                </View>
                <View className="flex-1">
                  <Text className="text-slate-800 text-sm font-bold mb-0.5" numberOfLines={1}>
                    {pur.supplier_name}
                  </Text>
                  <Text className="text-slate-400 text-[11px] font-medium">{pur.reference}</Text>
                </View>
                <View className="items-end pl-2">
                  <Text className="text-slate-800 text-sm font-black mb-1.5 font-mono">
                    {fmt(pur.grand_total)}
                  </Text>
                  <Badge status={pur.payment_status} />
                </View>
              </View>
            ))
          )}
        </View>

      </ScrollView>

      {/* FAB Overlay */}
      {isFabOpen && (
        <TouchableOpacity
          className="absolute inset-0 bg-black/40 z-40"
          activeOpacity={1}
          onPress={() => setIsFabOpen(false)}
        />
      )}

      {/* Floating Action Button (FAB) Menu */}
      <View className="absolute bottom-6 right-6 z-50 items-end">
        {isFabOpen && (
          <View className="items-end mb-4">
            <TouchableOpacity
              className="flex-row items-center mb-4"
              onPress={() => { setIsFabOpen(false); router.push("/(tabs)/reports"); }}
            >
              <Text className="bg-white px-3 py-1.5 rounded-lg shadow-sm elevation-2 mr-3 font-bold text-slate-700 text-xs">Reports</Text>
              <View className="w-12 h-12 bg-indigo-500 rounded-full items-center justify-center shadow-md elevation-3">
                <Feather name="pie-chart" size={20} color="#fff" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-row items-center mb-4"
              onPress={() => { setIsFabOpen(false); router.push("/inventory"); }}
            >
              <Text className="bg-white px-3 py-1.5 rounded-lg shadow-sm elevation-2 mr-3 font-bold text-slate-700 text-xs">Stock</Text>
              <View className="w-12 h-12 bg-blue-500 rounded-full items-center justify-center shadow-md elevation-3">
                <Feather name="box" size={20} color="#fff" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-row items-center mb-4"
              onPress={() => { setIsFabOpen(false); router.push("/purchase"); }}
            >
              <Text className="bg-white px-3 py-1.5 rounded-lg shadow-sm elevation-2 mr-3 font-bold text-slate-700 text-xs">Procure</Text>
              <View className="w-12 h-12 bg-orange-500 rounded-full items-center justify-center shadow-md elevation-3">
                <Feather name="truck" size={20} color="#fff" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-row items-center mb-3"
              onPress={() => { setIsFabOpen(false); router.push("/pos"); }}
            >
              <Text className="bg-white px-3 py-1.5 rounded-lg shadow-sm elevation-2 mr-3 font-bold text-slate-700 text-xs">New Sale</Text>
              <View className="w-12 h-12 bg-emerald-500 rounded-full items-center justify-center shadow-md elevation-3">
                <Feather name="shopping-cart" size={20} color="#fff" />
              </View>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          className={`w-14 h-14 rounded-full items-center justify-center shadow-lg elevation-4 ${isFabOpen ? 'bg-slate-800' : 'bg-f97316'}`}
          style={{ backgroundColor: isFabOpen ? '#1e293b' : '#f97316' }}
          activeOpacity={0.8}
          onPress={() => setIsFabOpen(!isFabOpen)}
        >
          <Feather name={isFabOpen ? "x" : "plus"} size={28} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
