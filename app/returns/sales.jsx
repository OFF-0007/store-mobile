/**
 * Sales Return Screen
 * Allows returning sold items from customers via Barcode Scan
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import apiClient from "@/lib/api/client";
import { Ionicons } from "@expo/vector-icons";
import { GlassCard, CardSkeleton } from "@/components/ui";

// Safely require expo-camera
let CameraView = null;
let useCameraPermissions = () => [null, () => { }];
try {
  const ExpoCamera = require("expo-camera");
  CameraView = ExpoCamera.CameraView;
  useCameraPermissions = ExpoCamera.useCameraPermissions;
} catch (e) {
  console.warn("ExpoCamera module not found:", e.message);
}

const fmt = (val) => `₹${Number(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function SalesReturnScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchingInvoice, setFetchingInvoice] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [selectedSale, setSelectedSale] = useState(null);
  const [linkedSaleDetails, setLinkedSaleDetails] = useState(null);
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [refundMode, setRefundMode] = useState('CREDIT');
  const [cashRefund, setCashRefund] = useState('');
  const [notes, setNotes] = useState('');
  const [isOutsideState, setIsOutsideState] = useState(false);

  const [returnItems, setReturnItems] = useState([]);

  // Barcode Scanner states
  const [showScanner, setShowScanner] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const scannedLock = useRef(false);

  // Accounting Summary from Backend
  const [summary, setSummary] = useState({
    gross_total: 0,
    paid_amount: 0,
    prior_returns_total: 0,
    prior_refunds_total: 0,
    outstanding_dues: 0,
    remaining_purchasable: 0,
  });

  const [maxRefundable, setMaxRefundable] = useState(0);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const calculateTotalReturn = useCallback(() => {
    return returnItems.reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unit_price) || 0;
      const taxRate = parseFloat(item.tax_rate) || 0;
      const subtotal = qty * price;
      const tax = subtotal * (taxRate / 100);
      return sum + subtotal + tax;
    }, 0);
  }, [returnItems]);

  useEffect(() => {
    if (linkedSaleDetails) {
      const returnTotalVal = calculateTotalReturn();
      const newSaleVal = Math.max(0, summary.remaining_purchasable - returnTotalVal);
      const currentMaxRefundable = Math.max(0, (summary.paid_amount - summary.prior_refunds_total) - newSaleVal);
      setMaxRefundable(currentMaxRefundable);
      
      if (refundMode !== 'CREDIT') {
        setCashRefund(currentMaxRefundable.toString());
      } else {
        setCashRefund('0');
      }
    }
  }, [returnItems, linkedSaleDetails, refundMode, summary, calculateTotalReturn]);

  const handleCashRefundChange = (value) => {
    let numVal = parseFloat(value) || 0;
    const returnTotalVal = calculateTotalReturn();
    
    // Cap refund by BOTH what is refundable (paid amount) and what is actually being returned (return total)
    const absoluteMax = Math.min(maxRefundable, returnTotalVal);
    
    if (numVal > absoluteMax) {
      numVal = absoluteMax;
    }
    
    setCashRefund(numVal.toString());
  };

  const fetchSaleDetails = async (saleIdOrRef) => {
    setFetchingInvoice(true);
    try {
      const res = await apiClient.get(`/sales/${saleIdOrRef}`);
      const sale = res.data;
      
      setLinkedSaleDetails(sale);
      setSelectedSale(sale.id);
      setSelectedCustomer(sale.customer_id);
      setSelectedWarehouse(sale.warehouse_id);
      setReturnDate(sale.sale_date);
      setSummary(sale.summary);
      
      const items = sale.items.map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: '0', // Start with 0 for manual entry
        unit_price: item.unit_price.toString(),
        tax_rate: item.tax_rate.toString(),
        max_quantity: item.quantity - item.returned_qty,
        original_purchased: item.quantity,
        already_returned: item.returned_qty,
      }));
      setReturnItems(items);
    } catch (error) {
      console.error('Error fetching sale details:', error);
      Alert.alert('Not Found', error.message);
    } finally {
      setFetchingInvoice(false);
    }
  };

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const warehousesRes = await apiClient.get('/warehouses');
      setWarehouses(warehousesRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBarcodeScanned = useCallback((event) => {
    if (scannedLock.current) return;
    scannedLock.current = true;
    
    // Reset lock after 2 seconds to allow next scan
    setTimeout(() => { scannedLock.current = false; }, 2000);

    let { data } = event;
    console.log('Scanned data:', data);

    // Clean data: remove any whitespace or hidden characters
    data = data.trim();
    
    setShowScanner(false);
    fetchSaleDetails(data);
  }, []);

  const handleOpenScanner = async () => {
    if (!CameraView) {
      Alert.alert("Scanner Unavailable", "Camera module not found.");
      return;
    }
    const status = await requestPermission();
    if (!status.granted) {
      Alert.alert("Permission Required", "Camera permission needed.");
      return;
    }
    setShowScanner(true);
  };

  const updateReturnItem = (index, value) => {
    const qty = parseFloat(value) || 0;
    const max = returnItems[index].max_quantity;
    
    if (qty > max) {
      Alert.alert('Invalid Quantity', `Cannot return more than remaining items (${max})`);
      return;
    }

    const updated = [...returnItems];
    updated[index].quantity = value;
    setReturnItems(updated);
  };

  const handleSubmit = async () => {
    const itemsToReturn = returnItems.filter(item => parseFloat(item.quantity) > 0);

    if (!selectedWarehouse || !selectedSale) {
      Alert.alert('Error', 'Please scan a valid invoice first.');
      return;
    }

    if (itemsToReturn.length === 0) {
      Alert.alert('Error', 'Please enter quantity for at least one item.');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post('/sales-returns', {
        customer_id: selectedCustomer,
        warehouse_id: selectedWarehouse,
        sale_id: selectedSale,
        return_date: returnDate,
        refund_mode: refundMode,
        cash_refund: Number(cashRefund) || 0,
        notes: notes,
        is_outside_state: isOutsideState,
        items: itemsToReturn.map(item => ({
          product_id: item.product_id,
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          tax_rate: Number(item.tax_rate),
        })),
      });

      Alert.alert('Success', 'Sales return processed successfully', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to process return');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={[]}>
      <View style={{ backgroundColor: '#f97316', paddingTop: insets.top + 8, paddingBottom: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <TouchableOpacity onPress={() => router.back()} className="p-2"><Ionicons name="chevron-back" size={24} color="#fff" /></TouchableOpacity>
        <View className="flex-1 items-center"><Text className="text-white font-black text-base uppercase">Sales Return</Text></View>
        <TouchableOpacity onPress={handleOpenScanner} className="p-2"><Ionicons name="barcode-outline" size={24} color="#fff" /></TouchableOpacity>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        {!linkedSaleDetails && !fetchingInvoice && (
          <GlassCard className="mb-4 p-8 items-center border-dashed border-2 border-slate-300">
            <Ionicons name="scan-outline" size={48} color="#94a3b8" />
            <Text className="text-slate-500 font-black text-xs uppercase mt-4 text-center">Scan Invoice Barcode</Text>
            <TouchableOpacity onPress={handleOpenScanner} className="mt-6 bg-orange-500 px-8 py-3 rounded-2xl shadow-sm"><Text className="text-white font-black text-xs uppercase">Open Scanner</Text></TouchableOpacity>
          </GlassCard>
        )}

        {fetchingInvoice && <GlassCard className="mb-4 p-8 items-center"><ActivityIndicator color="#f97316" /><Text className="text-slate-500 text-[10px] font-bold mt-2 uppercase">Fetching Invoice...</Text></GlassCard>}

        {linkedSaleDetails && (
          <>
            <GlassCard className="mb-4 bg-emerald-50/30 border-emerald-200 p-4">
              <View className="flex-row items-center justify-between mb-4">
                <View className="flex-1">
                  <Text className="text-emerald-800 text-[10px] font-black uppercase">Invoice Details</Text>
                  <Text className="text-slate-900 text-sm font-black">{linkedSaleDetails.formatted_id}</Text>
                  <Text className="text-slate-500 text-xs font-bold">{linkedSaleDetails.customer?.name} · {linkedSaleDetails.sale_date}</Text>
                </View>
                <TouchableOpacity onPress={() => {setLinkedSaleDetails(null); setSelectedSale(null);}} className="bg-rose-50 px-3 py-1.5 rounded-xl"><Text className="text-rose-600 text-[10px] font-black uppercase">Reset</Text></TouchableOpacity>
              </View>

              <View className="bg-white/80 border border-emerald-100 rounded-2xl p-4 gap-2.5">
                <View className="flex-row justify-between"><Text className="text-slate-500 text-xs font-bold">Gross Bill</Text><Text className="text-slate-800 text-xs font-black">{fmt(summary.gross_total)}</Text></View>
                <View className="flex-row justify-between"><Text className="text-slate-500 text-xs font-bold">Paid Amount</Text><Text className="text-emerald-600 text-xs font-black">{fmt(summary.paid_amount)}</Text></View>
                <View className="flex-row justify-between"><Text className="text-slate-500 text-xs font-bold">Prior Returns</Text><Text className="text-rose-600 text-xs font-black">-{fmt(summary.prior_returns_total)}</Text></View>
                <View className="border-t border-slate-100 pt-2.5 mt-1 flex-row justify-between"><Text className="text-slate-700 text-xs font-black uppercase">Outstanding</Text><Text className="text-rose-600 text-xs font-black">{fmt(summary.outstanding_dues)}</Text></View>
              </View>
            </GlassCard>

            <GlassCard className="mb-4 p-4 gap-4">
              <View>
                <Text className="text-[10px] font-black text-slate-500 uppercase mb-2">Refund Mode *</Text>
                <View className="flex-row flex-wrap gap-2">
                  {['CREDIT', 'CASH', 'CARD', 'UPI'].map((mode) => (
                    <TouchableOpacity key={mode} onPress={() => setRefundMode(mode)} className={`px-4 py-2 rounded-full border ${refundMode === mode ? 'bg-orange-500 border-orange-500' : 'bg-slate-50 border-slate-200'}`}><Text className={`text-[10px] font-black uppercase ${refundMode === mode ? 'text-white' : 'text-slate-500'}`}>{mode}</Text></TouchableOpacity>
                  ))}
                </View>
              </View>
              {refundMode !== 'CREDIT' && (
                <View>
                  <Text className="text-[10px] font-black text-slate-500 uppercase mb-2">Refund Amount (Max: {fmt(maxRefundable)}) *</Text>
                  <TextInput value={cashRefund} onChangeText={handleCashRefundChange} keyboardType="numeric" className="bg-white border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm font-bold" />
                </View>
              )}
            </GlassCard>

            <GlassCard className="mb-4 p-4">
              <Text className="text-slate-800 font-black text-sm uppercase mb-3">Return Items (Enter Quantities)</Text>
              {returnItems.map((item, index) => (
                <View key={index} className="bg-slate-50/50 border border-slate-150 rounded-2xl p-4 mb-3">
                  <View className="flex-row justify-between items-start">
                    <View className="flex-1"><Text className="text-slate-800 text-xs font-black uppercase">{item.product_name}</Text><Text className="text-slate-400 text-[10px] font-bold mt-0.5">Purchased: {item.original_purchased} · Returned: {item.already_returned}</Text></View>
                    <View className="bg-orange-50 px-2 py-1 rounded-lg"><Text className="text-orange-600 text-[10px] font-black">{item.max_quantity} LEFT</Text></View>
                  </View>
                  <View className="flex-row gap-4 mt-3 items-end">
                    <View className="flex-1"><Text className="text-[10px] font-black text-slate-500 uppercase mb-1.5">Return Qty</Text>
                      <TextInput value={item.quantity} onChangeText={(text) => updateReturnItem(index, text)} keyboardType="numeric" placeholder="0" className="bg-white border-2 border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 text-xs font-bold" />
                    </View>
                    <View className="flex-1"><Text className="text-[10px] font-black text-slate-500 uppercase mb-1.5">Unit Price</Text>
                      <View className="bg-slate-100 border border-slate-200 rounded-xl px-3 py-2.5"><Text className="text-slate-500 text-xs font-bold">{fmt(item.unit_price)}</Text></View>
                    </View>
                  </View>
                </View>
              ))}
            </GlassCard>

            <GlassCard className="mb-6 bg-orange-500/5 border-orange-200/50 p-4">
              <View className="flex-row justify-between items-center mb-2.5"><Text className="text-slate-700 text-[10px] font-black uppercase">Final Return Summary</Text><View className="bg-orange-500 px-2 py-0.5 rounded-full"><Text className="text-white text-[8px] font-black">ESTIMATE</Text></View></View>
              <View className="bg-white/80 border border-orange-100 rounded-2xl p-4 gap-2.5">
                <View className="flex-row justify-between"><Text className="text-slate-500 text-xs font-bold">Total Return Value</Text><Text className="text-slate-800 text-xs font-black">{fmt(calculateTotalReturn())}</Text></View>
                <View className="flex-row justify-between"><Text className="text-slate-500 text-xs font-bold">Cash to Refund</Text><Text className="text-indigo-600 text-xs font-black">{fmt(Number(cashRefund))}</Text></View>
                <View className="border-t border-slate-100 pt-2.5 mt-1 flex-row justify-between"><Text className="text-slate-700 text-xs font-black uppercase">Customer Credit</Text><Text className="text-orange-600 text-xs font-black">{fmt(Math.max(0, calculateTotalReturn() - Number(cashRefund)))}</Text></View>
              </View>
            </GlassCard>

            <TouchableOpacity onPress={handleSubmit} disabled={submitting} className="bg-orange-500 rounded-2xl py-4 shadow-lg flex-row items-center justify-center">
              {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text className="text-white text-center text-sm font-black uppercase tracking-wider">Process Return</Text>}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      <Modal visible={showScanner} animationType="slide" onRequestClose={() => setShowScanner(false)}>
        <SafeAreaView className="flex-1 bg-black">
          <View className="flex-row justify-between items-center p-6"><Text className="text-white font-black text-lg">Scan Invoice</Text><TouchableOpacity onPress={() => setShowScanner(false)}><Ionicons name="close" size={28} color="#fff" /></TouchableOpacity></View>
          {CameraView && <CameraView style={{ flex: 1 }} onBarcodeScanned={handleBarcodeScanned} barcodeSettings={{ barcodeTypes: ["code128", "qr"] }} />}
          <View className="p-10 items-center"><Text className="text-white/60 text-xs text-center">Point camera at the barcode on the bottom of the receipt</Text></View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
