import React, { useState, useCallback, useEffect } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { GlassCard, CardSkeleton } from "@/components/ui";
import apiClient from "@/lib/api/client";
import { useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useMockStore } from "@/store/mockStore";
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

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

export default function WarehouseReportScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");

  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { warehouses, fetchWarehouses } = useMockStore();

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await apiClient.get("/reports/warehouse", {
        params: { warehouse_id: selectedWarehouseId || undefined },
      });

      setData(res.data);
    } catch (e) {
      setError(e.message || "Failed to load warehouse report");
    } finally {
      setLoading(false);
    }
  }, [selectedWarehouseId]);

  useEffect(() => {
    if (isFocused) {
      fetchWarehouses();
      fetchReport();
    }
  }, [isFocused, selectedWarehouseId]);

  const exportPDF = async () => {
    if (!data?.products || data.products.length === 0) {
      Alert.alert("No Data", "There is no data to export.");
      return;
    }
    
    try {
      const htmlContent = `
        <html>
          <head>
            <style>
              body { font-family: 'Helvetica', sans-serif; padding: 20px; }
              h1 { color: #f97316; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
              th { background-color: #f8fafc; font-weight: bold; }
            </style>
          </head>
          <body>
            <h1>Warehouse Inventory Report</h1>
            <p><strong>Total Products:</strong> ${data.stats.total_products}</p>
            <p><strong>Total Stock Qty:</strong> ${data.stats.total_stock}</p>
            <p><strong>Total Stock Value:</strong> ${fmt(data.stats.total_value)}</p>
            
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Warehouse</th>
                  <th>Cost</th>
                  <th>Qty</th>
                  <th>Total Value</th>
                </tr>
              </thead>
              <tbody>
                ${data.products.map(p => `
                  <tr>
                    <td>${p.name}</td>
                    <td>${p.category}</td>
                    <td>${p.warehouse}</td>
                    <td>${fmt(p.cost)}</td>
                    <td>${p.qty}</td>
                    <td>${fmt(p.total_value)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (err) {
      Alert.alert("Export Error", "Failed to export PDF");
      console.error(err);
    }
  };

  const exportCSV = async () => {
    if (!data?.products || data.products.length === 0) {
      Alert.alert("No Data", "There is no data to export.");
      return;
    }

    try {
      let csvContent = "Product,Category,Warehouse,Cost,Qty,Total Value\n";
      data.products.forEach(p => {
        csvContent += `"${p.name}","${p.category}","${p.warehouse}",${p.cost},${p.qty},${p.total_value}\n`;
      });

      const fileUri = FileSystem.documentDirectory + "Warehouse_Report.csv";
      await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(fileUri, { UTI: 'public.comma-separated-values-text', mimeType: 'text/csv' });
    } catch (err) {
      Alert.alert("Export Error", "Failed to export CSV");
      console.error(err);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={[]}>
      <View style={{ backgroundColor: '#f97316', paddingTop: insets.top + 8, paddingBottom: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => router.back()} className="p-2">
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View className="flex-1 items-center">
          <Text className="text-white font-black text-base uppercase tracking-wider">Warehouse Report</Text>
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
        {warehouses && warehouses.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
            <TouchableOpacity
              onPress={() => setSelectedWarehouseId("")}
              className={`mr-2 px-4 py-2 rounded-xl border-2 ${
                selectedWarehouseId === "" ? "bg-orange-50 border-orange-500" : "bg-slate-50 border-slate-200"
              }`}
            >
              <Text className={`text-xs font-bold ${selectedWarehouseId === "" ? "text-orange-600" : "text-slate-600"}`}>All Warehouses</Text>
            </TouchableOpacity>
            {warehouses.map((w) => (
              <TouchableOpacity
                key={w.id}
                onPress={() => setSelectedWarehouseId(w.id)}
                className={`mr-2 px-4 py-2 rounded-xl border-2 ${
                  selectedWarehouseId === w.id ? "bg-orange-50 border-orange-500" : "bg-slate-50 border-slate-200"
                }`}
              >
                <Text className={`text-xs font-bold ${selectedWarehouseId === w.id ? "text-orange-600" : "text-slate-600"}`}>{w.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
        
        <View className="flex-row gap-2 mt-2">
          <TouchableOpacity onPress={exportCSV} className="flex-1 bg-green-50 border border-green-200 rounded-xl p-2 items-center flex-row justify-center gap-2">
            <Ionicons name="document-text-outline" size={16} color="#15803d" />
            <Text className="text-green-700 font-bold text-xs">Excel (CSV)</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={exportPDF} className="flex-1 bg-red-50 border border-red-200 rounded-xl p-2 items-center flex-row justify-center gap-2">
            <Ionicons name="document-outline" size={16} color="#b91c1c" />
            <Text className="text-red-700 font-bold text-xs">PDF</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchReport} tintColor="#f97316" />}
      >
        {isExpanded && data?.stats && (
          <View className="flex-row flex-wrap justify-between gap-2 mb-4">
            <SummaryCard 
              label="Total Products" 
              value={data.stats.total_products} 
              icon={<Ionicons name="cube-outline" size={16} color="#475569" />} 
              accent="bg-slate-50/50" 
            />
            <SummaryCard 
              label="Stock Quantity" 
              value={data.stats.total_stock} 
              icon={<Ionicons name="layers-outline" size={16} color="#e11d48" />} 
              accent="bg-rose-50/50 border-l-2 border-l-rose-400" 
            />
            <SummaryCard 
              label="Total Value" 
              value={fmt(data.stats.total_value)} 
              icon={<Ionicons name="wallet-outline" size={16} color="#1d4ed8" />} 
              accent="bg-blue-50/50 border-l-2 border-l-blue-400" 
            />
          </View>
        )}

        <GlassCard className="p-3 mb-10">
          <View className="flex-row pb-2 mb-1.5 border-b border-slate-100">
            <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider flex-1">Product</Text>
            <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider w-16 text-right">Qty</Text>
            <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider w-20 text-right">Value</Text>
          </View>

          {loading && !data ? (
            <CardSkeleton />
          ) : error ? (
            <Text className="text-rose-500 text-center py-10 font-bold">{error}</Text>
          ) : data?.products?.length === 0 ? (
            <Text className="text-slate-400 text-center py-10 font-bold">No items found</Text>
          ) : (
            data?.products?.map((p, i) => (
              <View 
                key={p.id + '-' + p.warehouse} 
                className={`py-3.5 flex-row items-center ${i < data.products.length - 1 ? "border-b border-slate-100" : ""}`}
              >
                <View className="flex-1 pr-2">
                  <Text className="text-slate-900 text-xs font-black" numberOfLines={1}>
                    {p.name}
                  </Text>
                  <View className="flex-row items-center gap-1.5 mt-0.5">
                    <Text className="text-slate-400 text-[9px] font-black uppercase tracking-tighter">
                      {p.category}
                    </Text>
                    <Text className="text-slate-300 text-[9px]">•</Text>
                    <Text className="text-slate-400 text-[9px] font-bold">{p.warehouse}</Text>
                  </View>
                  <Text className="text-slate-500 text-[9px] font-black uppercase mt-1">
                    Cost: {fmt(p.cost)}
                  </Text>
                </View>

                <View className="w-16 items-end">
                  <Text className="text-slate-800 text-xs font-black">{p.qty}</Text>
                </View>

                <View className="w-20 items-end">
                  <Text className="text-orange-600 text-xs font-black">{fmt(p.total_value)}</Text>
                </View>
              </View>
            ))
          )}
        </GlassCard>
      </ScrollView>
    </SafeAreaView>
  );
}
