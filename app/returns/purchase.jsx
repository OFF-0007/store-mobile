/**
 * Purchase Return Screen
 * Allows returning purchased items to suppliers via Barcode Scan
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
import { useRouter, useLocalSearchParams } from "expo-router";
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

export default function PurchaseReturnScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchingInvoice, setFetchingInvoice] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [linkedPurchaseDetails, setLinkedPurchaseDetails] = useState(null);
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [refundMode, setRefundMode] = useState('CASH');
  const [cashRefund, setCashRefund] = useState('');
  const [cashRefundEdited, setCashRefundEdited] = useState(false);
  const [notes, setNotes] = useState('');
  const [invoicePrefilled, setInvoicePrefilled] = useState(false);

  const [returnItems, setReturnItems] = useState([]);
  const [invoiceSearch, setInvoiceSearch] = useState("");

  // Barcode Scanner states
  const [showScanner, setShowScanner] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const scannedLock = useRef(false);

  // Accounting Summary
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

  useEffect(() => {
    if (params?.invoice) {
      setInvoiceSearch(params.invoice);
      setInvoicePrefilled(true);

      const amount = Number(params.refund_amount ?? params.refundAmount ?? 0);
      if (!Number.isNaN(amount) && amount > 0) {
        setRefundMode('CASH');
        setCashRefund(amount.toString());
        setCashRefundEdited(true);
      }

      fetchPurchaseDetails(params.invoice).catch(() => {
        setInvoicePrefilled(false);
      });
    }
  }, [params?.invoice, params?.refund_amount, params?.refundAmount]);

  const calculateTotalReturn = useCallback(() => {
    return returnItems.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unit_price) || 0;
      return sum + (qty * price);
    }, 0);
  }, [returnItems]);

  useEffect(() => {
    if (linkedPurchaseDetails) {
      const returnTotalVal = calculateTotalReturn();
      if (!cashRefundEdited) {
        setCashRefund(returnTotalVal.toString());
      }
    }
  }, [returnItems, linkedPurchaseDetails, refundMode, calculateTotalReturn]);

  const fetchPurchaseDetails = async (purchaseIdOrRef) => {
    setFetchingInvoice(true);
    try {
      const res = await apiClient.get(`/purchases/${purchaseIdOrRef}`);
      const purchase = res.data;
      
      setLinkedPurchaseDetails(purchase);
      setSelectedPurchase(purchase.id);
      setSelectedSupplier(purchase.supplier?.id);
      setSelectedWarehouse(purchase.warehouse?.id);
      setReturnDate(purchase.purchase_date);
      setSummary(purchase.summary);

      const items = purchase.items ? purchase.items.map(item => {
        const originalQty = item.quantity > 0 ? item.quantity : 1;
        const remainingQty = (item.quantity || 0) - (item.returned_qty || 0);
        const cost = item.unit_price || 0; // API returns cost as unit_price
        const taxRate = item.tax_rate || 0;
        const discountPerUnit = (item.discount || 0) / originalQty;
        
        // Compute true tax inclusive unit price matching how it was bought
        const taxablePerUnit = cost - discountPerUnit;
        const taxPerUnit = taxablePerUnit * (taxRate / 100);
        const unitPriceWithTax = taxablePerUnit + taxPerUnit;

        return {
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: remainingQty > 0 ? remainingQty.toString() : "",
          unit_price: unitPriceWithTax.toString(), // Tax inclusive price for UI calculations
          cost: cost.toString(),
          tax_rate: taxRate.toString(),
          discount_per_unit: discountPerUnit.toString(),
          unit: item.unit || '',
          max_quantity: remainingQty,
          original_purchased: item.quantity,
          already_returned: item.returned_qty,
        };
      }) : [];
      
      setReturnItems(items);
    } catch (error) {
      console.error('Error fetching purchase details:', error);
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
    fetchPurchaseDetails(data);
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

  const handleFetchByInvoice = () => {
    if (!invoiceSearch.trim()) {
      Alert.alert('Enter Invoice', 'Please type the invoice number before fetching.');
      return;
    }
    fetchPurchaseDetails(invoiceSearch.trim());
  };

  const updateReturnItem = (index, value) => {
    let cleaned = value.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) cleaned = parts[0] + '.' + parts.slice(1).join('');

    const qty = parseFloat(cleaned) || 0;
    const max = returnItems[index].max_quantity;
    
    if (qty > max) {
      Alert.alert('Invalid Quantity', `Cannot return more than remaining items (${max})`);
      const updated = [...returnItems];
      updated[index].quantity = max.toString();
      setReturnItems(updated);
      return;
    }

    const updated = [...returnItems];
    updated[index].quantity = cleaned;
    setReturnItems(updated);
  };

  const handleCashRefundChange = (value) => {
    setCashRefundEdited(true);
    let cleaned = value.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) cleaned = parts[0] + '.' + parts.slice(1).join('');

    const numVal = parseFloat(cleaned) || 0;
    const returnTotalVal = calculateTotalReturn();
    
    // Only cap refund by what is actually being returned (return total)
    if (numVal > returnTotalVal) {
      setCashRefund(returnTotalVal.toString());
    } else {
      setCashRefund(cleaned);
    }
  };

  const handleSubmit = async () => {
    const itemsToReturn = returnItems.filter(item => parseFloat(item.quantity) > 0);

    if (!selectedWarehouse || !selectedPurchase) {
      Alert.alert('Error', 'Please scan a valid purchase invoice first.');
      return;
    }

    if (itemsToReturn.length === 0) {
      Alert.alert('Error', 'Please enter quantity for at least one item.');
      return;
    }

    setSubmitting(true);
    try {
      const itemsPayload = itemsToReturn.map(item => {
        const qty = Number(item.quantity);
        const cost = Number(item.cost);
        const taxRate = Number(item.tax_rate);
        const discount = Number(item.discount_per_unit) * qty;
        const taxableAmt = (qty * cost) - discount;
        const tax = taxableAmt * (taxRate / 100);
        const subtotal = taxableAmt + tax;

        return {
          product_id: item.product_id,
          quantity: qty,
          unit_price: cost, // Send cost as unit_price for backend compatibility
          cost: cost,
          tax_rate: taxRate,
          tax: tax,
          discount: discount,
          subtotal: subtotal,
          unit: item.unit || null,
        };
      });

      const grossTotal = itemsPayload.reduce((sum, item) => sum + item.subtotal, 0);
      const totalTaxable = itemsPayload.reduce((sum, item) => sum + ((item.quantity * item.cost) - item.discount), 0);
      const totalTax = itemsPayload.reduce((sum, item) => sum + item.tax, 0);

      await apiClient.post('/purchase-returns', {
        supplier_id: selectedSupplier,
        warehouse_id: selectedWarehouse,
        purchase_id: selectedPurchase,
        return_date: returnDate,
        refund_mode: refundMode,
        cash_refund: Number(cashRefund) || 0,
        subtotal: totalTaxable,
        tax_amount: totalTax,
        grand_total: grossTotal,
        notes: notes,
        items: itemsPayload,
      });

      Alert.alert('Success', 'Purchase return processed successfully', [
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
        <View className="flex-1 items-center"><Text className="text-white font-black text-base uppercase">Purchase Return</Text></View>
        <TouchableOpacity onPress={handleOpenScanner} className="p-2"><Ionicons name="barcode-outline" size={24} color="#fff" /></TouchableOpacity>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        {!linkedPurchaseDetails && !fetchingInvoice && !invoicePrefilled && (
          <GlassCard className="mb-4 p-6 border-dashed border-2 border-slate-300">
            <Ionicons name="scan-outline" size={48} color="#94a3b8" />
            <Text className="text-slate-500 font-black text-xs uppercase mt-4 text-center">Scan Purchase Barcode</Text>
            <TouchableOpacity onPress={handleOpenScanner} className="mt-6 bg-orange-500 px-8 py-3 rounded-2xl shadow-sm"><Text className="text-white font-black text-xs uppercase">Open Scanner</Text></TouchableOpacity>

            <View className="mt-6 w-full">
              <Text className="text-slate-500 text-[10px] font-black uppercase mb-2">Or enter invoice number</Text>
              <TextInput
                value={invoiceSearch}
                onChangeText={setInvoiceSearch}
                placeholder="Invoice no."
                returnKeyType="done"
                onSubmitEditing={handleFetchByInvoice}
                className="w-full bg-slate-100 border border-slate-200 rounded-2xl px-3 py-3 text-sm text-slate-900"
              />
              <TouchableOpacity onPress={handleFetchByInvoice} className="mt-4 bg-slate-900 px-5 py-3 rounded-2xl items-center">
                <Text className="text-white text-xs uppercase font-black">Fetch Invoice</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        )}

        {fetchingInvoice && <GlassCard className="mb-4 p-8 items-center"><ActivityIndicator color="#f97316" /><Text className="text-slate-500 text-[10px] font-bold mt-2 uppercase">Fetching Invoice...</Text></GlassCard>}

        {linkedPurchaseDetails && (
          <>
            <GlassCard className="mb-4 bg-emerald-50/30 border-emerald-200 p-4">
              <View className="flex-row items-center justify-between mb-4">
                <View className="flex-1">
                  <Text className="text-emerald-800 text-[10px] font-black uppercase">Purchase Details</Text>
                  <Text className="text-slate-900 text-sm font-black">{linkedPurchaseDetails.formatted_id}</Text>
                  <Text className="text-slate-500 text-xs font-bold">{linkedPurchaseDetails.supplier?.name} · {linkedPurchaseDetails.purchase_date}</Text>
                </View>
                <TouchableOpacity onPress={() => {setLinkedPurchaseDetails(null); setSelectedPurchase(null);}} className="bg-rose-50 px-3 py-1.5 rounded-xl"><Text className="text-rose-600 text-[10px] font-black uppercase">Reset</Text></TouchableOpacity>
              </View>

              <View className="bg-white/80 border border-emerald-100 rounded-2xl p-4 gap-2.5">
                <View className="flex-row justify-between"><Text className="text-slate-500 text-xs font-bold">Gross Bill</Text><Text className="text-slate-800 text-xs font-black">{fmt(summary.gross_total)}</Text></View>
                <View className="flex-row justify-between"><Text className="text-slate-500 text-xs font-bold">Paid Amount</Text><Text className="text-emerald-600 text-xs font-black">{fmt(summary.paid_amount)}</Text></View>
                <View className="flex-row justify-between"><Text className="text-slate-500 text-xs font-bold">Prior Returns</Text><Text className="text-rose-600 text-xs font-black">-{fmt(summary.prior_returns_total)}</Text></View>
                <View className="border-t border-slate-100 pt-2.5 mt-1 flex-row justify-between"><Text className="text-slate-700 text-xs font-black uppercase">Outstanding</Text><Text className={`text-xs font-black ${summary.outstanding_dues > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{fmt(summary.outstanding_dues)}</Text></View>
              </View>
            </GlassCard>

            <GlassCard className="mb-4 p-4 gap-4">
              <View>
                <Text className="text-[10px] font-black text-slate-500 uppercase mb-2">Refund Mode *</Text>
                <View className="flex-row flex-wrap gap-2">
                  {['CASH', 'CARD', 'UPI'].map((mode) => (
                    <TouchableOpacity
                      key={mode}
                      onPress={() => {
                        setRefundMode(mode);
                        setCashRefundEdited(false);
                      }}
                      className={`px-4 py-2 rounded-full border ${refundMode === mode ? 'bg-orange-500 border-orange-500' : 'bg-slate-50 border-slate-200'}`}>
                      <Text className={`text-[10px] font-black uppercase ${refundMode === mode ? 'text-white' : 'text-slate-500'}`}>{mode}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
                  <View>
                    <Text className="text-[10px] font-black text-slate-500 uppercase mb-2">Refund Amount (Max: {fmt(maxRefundable)})</Text>
                    <TextInput
                      value={cashRefund}
                      onChangeText={(value) => { setCashRefundEdited(true); handleCashRefundChange(value); }}
                      keyboardType="numeric"
                      placeholder="0"
                      className="bg-white border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm font-bold"
                    />
                  </View>
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
                    <View className="flex-1"><Text className="text-[10px] font-black text-slate-500 uppercase mb-1.5">Unit Cost</Text>
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
                <View className="flex-row justify-between"><Text className="text-slate-500 text-xs font-bold">Cash Refunded</Text><Text className="text-indigo-600 text-xs font-black">{fmt(Number(cashRefund))}</Text></View>
                <View className="border-t border-slate-100 pt-2.5 mt-1 flex-row justify-between"><Text className="text-slate-700 text-xs font-black uppercase">Supplier Credit</Text><Text className="text-orange-600 text-xs font-black">{fmt(Math.max(0, calculateTotalReturn() - Number(cashRefund)))}</Text></View>
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
          <View style={{ flex: 1, position: 'relative' }}>
            {CameraView && <CameraView style={{ flex: 1 }} onBarcodeScanned={handleBarcodeScanned} barcodeSettings={{ barcodeTypes: ["code128", "qr"] }} />}
            <View style={{ position: 'absolute', top: '25%', left: '12%', right: '12%', height: 220, borderWidth: 2, borderColor: '#f97316', borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)' }} pointerEvents="none" />
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: 32, alignItems: 'center' }}>
              <Text className="text-white/80 text-[12px]">Place barcode inside the box</Text>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
