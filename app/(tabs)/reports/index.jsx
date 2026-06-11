import React from "react";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { GlassCard } from "@/components/ui";
import { Ionicons } from "@expo/vector-icons";

function ReportMenuItem({ title, subtitle, icon, color, route }) {
  const router = useRouter();
  return (
    <TouchableOpacity
      onPress={() => router.push(route)}
      className="bg-white rounded-3xl p-5 mb-4 shadow-sm border border-slate-100 flex-row items-center"
    >
      <View className={`w-14 h-14 rounded-2xl ${color} items-center justify-center mr-4 shadow-sm`}>
        <Ionicons name={icon} size={28} color="#fff" />
      </View>
      <View className="flex-1">
        <Text className="text-slate-800 text-base font-black uppercase tracking-tight">{title}</Text>
        <Text className="text-slate-400 text-xs font-medium mt-0.5">{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
    </TouchableOpacity>
  );
}

export default function ReportsMenuScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={[]}>
      <View style={{
        backgroundColor: '#f97316',
        paddingTop: insets.top + 12,
        paddingBottom: 20,
        paddingHorizontal: 20,
        elevation: 4,
        shadowColor: '#f97316',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      }}>
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-white text-2xl font-black uppercase tracking-tighter">Reports</Text>
            <Text className="text-orange-100 text-xs font-bold tracking-widest uppercase mt-1">Analytics & Insights</Text>
          </View>
          <TouchableOpacity 
            onPress={() => router.back()}
            className="w-10 h-10 bg-white/20 rounded-full items-center justify-center border border-white/30"
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        className="flex-1 px-5 pt-6"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <Text className="text-slate-400 text-[10px] font-black uppercase tracking-[2px] mb-4 ml-1">Financial Summaries</Text>
        
        <ReportMenuItem 
          title="Sales Report"
          subtitle="Revenue, tax & invoice analytics"
          icon="stats-chart"
          color="bg-indigo-500"
          route="/reports/sales"
        />

        <ReportMenuItem 
          title="Purchase Report"
          subtitle="Procurement & supplier orders"
          icon="cart"
          color="bg-orange-500"
          route="/reports/purchases"
        />

        <ReportMenuItem 
          title="Expense Report"
          subtitle="Business overheads & spending"
          icon="wallet"
          color="bg-rose-500"
          route="/reports/expenses"
        />

        <Text className="text-slate-400 text-[10px] font-black uppercase tracking-[2px] mt-4 mb-4 ml-1">Inventory Analytics</Text>

        <ReportMenuItem 
          title="Warehouse Report"
          subtitle="Stock valuation & product quantities"
          icon="cube"
          color="bg-amber-500"
          route="/reports/warehouse"
        />

        <Text className="text-slate-400 text-[10px] font-black uppercase tracking-[2px] mt-4 mb-4 ml-1">Ledger Analytics</Text>

        <ReportMenuItem 
          title="Customer Report"
          subtitle="Balances & sales by customer"
          icon="people"
          color="bg-blue-500"
          route="/reports/customers"
        />

        <ReportMenuItem 
          title="Supplier Report"
          subtitle="Outstanding dues & purchases"
          icon="business"
          color="bg-emerald-500"
          route="/reports/suppliers"
        />

        <View className="bg-orange-50 border border-orange-100 rounded-3xl p-6 mt-4 flex-row items-center">
          <View className="flex-1">
            <Text className="text-orange-800 text-sm font-black uppercase mb-1">Need detailed reports?</Text>
            <Text className="text-orange-600 text-xs font-medium leading-relaxed">
              Use the web dashboard for advanced filtering and bulk PDF exports.
            </Text>
          </View>
          <View className="ml-4 w-12 h-12 bg-orange-100 rounded-full items-center justify-center">
            <Ionicons name="desktop-outline" size={20} color="#f97316" />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
