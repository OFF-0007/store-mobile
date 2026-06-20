/**
 * Purchase Return Screen
 * Allows returning purchased items to suppliers
 * Matches desktop logic with all validations and calculations
 */
import React, { useState, useEffect } from "react";
import {
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import apiClient from "@/lib/api/client";
import { Ionicons } from "@expo/vector-icons";
import { GlassCard, CardSkeleton } from "@/components/ui";

export default function PurchaseReturnScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [linkedPurchaseDetails, setLinkedPurchaseDetails] = useState(null);
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [refundMode, setRefundMode] = useState('CASH');
  const [cashRefund, setCashRefund] = useState('');
  const [notes, setNotes] = useState('');

  const [returnItems, setReturnItems] = useState([]);

  // Calculation values
  const [purchaseTotal, setPurchaseTotal] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [priorReturnsTotal, setPriorReturnsTotal] = useState(0);
  const [priorRefundsTotal, setPriorRefundsTotal] = useState(0);
  const [outstandingDues, setOutstandingDues] = useState(0);
  const [maxRefundable, setMaxRefundable] = useState(0);
  const [supplierCredit, setSupplierCredit] = useState(0);
  const [remainingPurchasable, setRemainingPurchasable] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedPurchase) {
      fetchPurchaseDetails(selectedPurchase);
    } else {
      setLinkedPurchaseDetails(null);
      setReturnItems([]);
      resetCalculations();
    }
  }, [selectedPurchase]);

  useEffect(() => {
    calculateValues();
  }, [returnItems, refundMode, cashRefund, linkedPurchaseDetails]);

  const resetCalculations = () => {
    setPurchaseTotal(0);
    setPaidAmount(0);
    setPriorReturnsTotal(0);
    setPriorRefundsTotal(0);
    setOutstandingDues(0);
    setMaxRefundable(0);
    setSupplierCredit(0);
    setRemainingPurchasable(0);
  };

  const fetchPurchaseDetails = async (purchaseId) => {
    try {
      const res = await apiClient.get(`/purchases/${purchaseId}`);
      const purchase = res.data;

      setLinkedPurchaseDetails(purchase);
      setSelectedSupplier(purchase.supplier?.id);
      setSelectedWarehouse(purchase.warehouse?.id);

      // Set return items from purchase items
      const items = purchase.items ? purchase.items.map(item => {
        const remainingQty = (item.quantity || 0) - (item.returned_qty || 0);
        const isSecondary = item.unit_id && item.unit_id == item.secondary_unit_id;
        const convRate = parseFloat(item.conversion_rate || 1);
        const baseQty = isSecondary ? remainingQty * convRate : remainingQty;
        return {
          product_id: item.product_id?.toString() || '',
          product_name: item.product_name,
          quantity: remainingQty > 0 ? remainingQty.toString() : '',
          base_quantity: baseQty.toString(),
          unit_price: item.unit_price?.toString() || '',
          unit: typeof item.unit === 'object' ? item.unit?.name || '' : item.unit || '',
          unit_id: item.unit_id,
          secondary_unit_id: item.secondary_unit_id,
          conversion_rate: convRate,
          max_quantity: remainingQty, // Store max for validation
          subtotal: item.subtotal,
        };
      }) : [];

      setReturnItems(items);
    } catch (error) {
      console.error('Error fetching purchase details:', error);
      Alert.alert('Error', 'Failed to fetch purchase details');
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [suppliersRes, warehousesRes, purchasesRes] = await Promise.all([
        apiClient.get('/suppliers'),
        apiClient.get('/warehouses'),
        apiClient.get('/purchases'),
      ]);
      setSuppliers(suppliersRes.data);
      setWarehouses(warehousesRes.data);
      setPurchases(purchasesRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', `Failed to load data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    return returnItems.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unit_price) || 0;
      return sum + (qty * price);
    }, 0);
  };

  const calculateValues = () => {
    if (linkedPurchaseDetails) {
      const gross = Number(linkedPurchaseDetails.grand_total || 0) + Number(linkedPurchaseDetails.round_off || 0);
      const paid = Number(linkedPurchaseDetails.paid_amount || 0);

      let priorRetTotal = 0;
      let priorRefTotal = 0;

      if (linkedPurchaseDetails.returns && Array.isArray(linkedPurchaseDetails.returns)) {
        priorRetTotal = linkedPurchaseDetails.returns.reduce((sum, r) => sum + Number(r.total_amount || 0), 0);
        priorRefTotal = linkedPurchaseDetails.returns.reduce((sum, r) => sum + Number(r.cash_refund || 0), 0);
      }

      const outstanding = Math.max(0, gross - priorRetTotal - paid);
      const remainingPurchasableVal = gross - priorRetTotal;

      const returnTotalVal = calculateTotal();
      const credit = Math.max(0, returnTotalVal - Number(cashRefund || 0));

      setPurchaseTotal(gross);
      setPaidAmount(paid);
      setPriorReturnsTotal(priorRetTotal);
      setPriorRefundsTotal(priorRefTotal);
      setOutstandingDues(outstanding);
      setSupplierCredit(credit);
      setRemainingPurchasable(remainingPurchasableVal);

      // Auto-cap refund amount by return total only
      if (['CASH', 'CARD', 'UPI'].includes(refundMode)) {
        const currentRefund = Number(cashRefund || 0);
        if (currentRefund > returnTotalVal) {
          setCashRefund(returnTotalVal.toString());
        }
      }
    } else {
      // No linked purchase - simple calculation
      const returnTotalVal = calculateTotal();

      if (['CASH', 'CARD', 'UPI'].includes(refundMode)) {
        const currentRefund = Number(cashRefund || 0);
        if (currentRefund > returnTotalVal) {
          setCashRefund(returnTotalVal.toString());
        }
      }
    }
  };

  const handleRefundModeChange = (mode) => {
    let refundVal = '0';
    if (['CASH', 'CARD', 'UPI'].includes(mode)) {
      if (linkedPurchaseDetails) {
        refundVal = maxRefundable.toString();
      } else {
        refundVal = calculateTotal().toString();
      }
    }
    setRefundMode(mode);
    setCashRefund(refundVal);
  };

  const handleCashRefundChange = (value) => {
    setCashRefundEdited(true);
    let cleaned = value.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) cleaned = parts[0] + '.' + parts.slice(1).join('');

    const numVal = parseFloat(cleaned) || 0;
    const returnTotalVal = calculateTotal();

    if (numVal > returnTotalVal) {
      setCashRefund(returnTotalVal.toString());
    } else {
      setCashRefund(cleaned);
    }
  };

  const addReturnItem = () => {
    setReturnItems([...returnItems, {
      product_id: '',
      product_name: '',
      quantity: '',
      unit_price: '',
      unit: '',
      max_quantity: null
    }]);
  };

  const updateReturnItem = (index, field, value) => {
    const updated = [...returnItems];
    if (field === 'quantity') {
      let cleaned = value.replace(/[^0-9.]/g, '');
      const parts = cleaned.split('.');
      if (parts.length > 2) cleaned = parts[0] + '.' + parts.slice(1).join('');
      updated[index][field] = cleaned;
      
      const qty = parseFloat(cleaned || 0);
      const isSecondary = updated[index].unit_id && updated[index].unit_id == updated[index].secondary_unit_id;
      const convRate = parseFloat(updated[index].conversion_rate || 1);
      updated[index].base_quantity = (isSecondary ? qty * convRate : qty).toString();
    } else {
      updated[index][field] = value;
    }
    setReturnItems(updated);
  };

  const removeReturnItem = (index) => {
    setReturnItems(returnItems.filter((_, i) => i !== index));
  };

  const validateReturn = () => {
    if (!selectedSupplier || !selectedWarehouse) {
      Alert.alert('Validation Error', 'Please select supplier and warehouse');
      return false;
    }

    if (returnItems.length === 0) {
      Alert.alert('Validation Error', 'Please add at least one item');
      return false;
    }

    const validItems = returnItems.filter(item => item.product_id && item.quantity && item.unit_price);
    if (validItems.length === 0) {
      Alert.alert('Validation Error', 'Please fill in all item details');
      return false;
    }

    const returnTotal = calculateTotal();

    // Validate against linked purchase
    if (linkedPurchaseDetails) {
      // Check total return value doesn't exceed remaining purchasable
      if (returnTotal > remainingPurchasable + 0.01) {
        Alert.alert(
          'Validation Error',
          `Return value (₹${returnTotal.toFixed(2)}) exceeds remaining purchasable value (₹${remainingPurchasable.toFixed(2)})`
        );
        return false;
      }

      // Check quantity per item
      for (const item of validItems) {
        if (item.max_quantity) {
          const returnedQty = Number(item.quantity) || 0;
          const maxQty = Number(item.max_quantity) || 0;

          if (returnedQty > maxQty + 0.001) {
            Alert.alert(
              'Validation Error',
              `Return quantity exceeds purchased quantity for ${item.product_name || 'product'}`
            );
            return false;
          }
        }
      }

      // Validate refund amount
      if (['CASH', 'CARD', 'UPI'].includes(refundMode)) {
        const refundAmount = Number(cashRefund) || 0;
        if (refundAmount > maxRefundable + 0.01) {
          Alert.alert(
            'Validation Error',
            `Refund (₹${refundAmount.toFixed(2)}) cannot exceed the maximum refundable amount (₹${maxRefundable.toFixed(2)})`
          );
          return false;
        }
      }
    } else {
      // No linked purchase - simple validation
      if (['CASH', 'CARD', 'UPI'].includes(refundMode)) {
        const refundAmount = Number(cashRefund) || 0;
        if (refundAmount > returnTotal + 0.01) {
          Alert.alert(
            'Validation Error',
            `Refund (₹${refundAmount.toFixed(2)}) cannot exceed return value (₹${returnTotal.toFixed(2)})`
          );
          return false;
        }
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateReturn()) {
      return;
    }

    setSubmitting(true);
    try {
      const validItems = returnItems.filter(item => item.product_id && item.quantity && item.unit_price).map(item => ({
        product_id: Number(item.product_id),
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        unit: typeof item.unit === 'object' ? item.unit?.name || null : item.unit || null,
        unit_id: item.unit_id || null,
        base_quantity: item.base_quantity != null ? Number(item.base_quantity) : Number(item.quantity),
        tax_rate: Number(item.tax_rate || 0),
        tax: Number(item.tax || 0),
        discount: Number(item.discount || 0),
        subtotal: Number(item.quantity) * Number(item.unit_price),
      }));

      await apiClient.post('/purchase-returns', {
        supplier_id: selectedSupplier,
        warehouse_id: selectedWarehouse,
        purchase_id: selectedPurchase,
        return_date: returnDate,
        refund_mode: refundMode,
        cash_refund: Number(cashRefund) || 0,
        notes: notes,
        items: validItems,
      });

      Alert.alert('Success', 'Purchase return processed successfully', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.response?.data?.errors?.cash_refund?.[0] || 'Failed to process return';
      Alert.alert('Error', errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={[]}>
      {/* Header */}
      <View style={{
        backgroundColor: '#f97316',
        paddingTop: insets.top + 8,
        paddingBottom: 10,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        elevation: 4,
        shadowColor: '#f97316',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      }}>
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255,255,255,0.2)',
            width: 36,
            height: 36,
            borderRadius: 18,
          }}
        >
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </TouchableOpacity>

        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' }}>
            Purchase Return
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginTop: 1 }}>
            Return items to suppliers
          </Text>
        </View>

        {/* Spacer to balance the back button */}
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View className="flex-1 p-4 gap-3 bg-slate-50">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="p-4 pb-12"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={fetchData} colors={["#f97316"]} />
          }
        >
          {/* Linked Purchase Info */}
          {linkedPurchaseDetails && (
            <GlassCard className="mb-4 bg-emerald-50/30 border-emerald-200">
              <View className="flex-row items-center mb-3">
                <View className="bg-emerald-500 rounded-xl p-2.5 mr-3">
                  <Ionicons name="document-text" size={18} color="#fff" />
                </View>
                <View className="flex-1">
                  <Text className="text-emerald-800 text-[10px] font-black uppercase tracking-wider">Linked Purchase Invoice</Text>
                  <Text className="text-slate-900 text-sm font-black uppercase tracking-tight">
                    {linkedPurchaseDetails.formatted_id || `PRCH-${linkedPurchaseDetails.id}`}
                  </Text>
                  <Text className="text-slate-500 text-xs font-bold mt-0.5">
                    {linkedPurchaseDetails.supplier?.name}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSelectedPurchase(null)}
                  activeOpacity={0.8}
                  className="bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl"
                >
                  <Text className="text-rose-600 text-[10px] font-black uppercase tracking-wider">Clear</Text>
                </TouchableOpacity>
              </View>

              <View className="bg-white/80 border border-emerald-100 rounded-2xl p-4 gap-2.5">
                <View className="flex-row justify-between">
                  <Text className="text-slate-500 text-xs font-bold">Gross Purchase</Text>
                  <Text className="text-slate-800 text-xs font-black">₹{purchaseTotal.toLocaleString()}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-slate-500 text-xs font-bold">Prior Returns</Text>
                  <Text className="text-rose-600 text-xs font-black">-₹{priorReturnsTotal.toLocaleString()}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-slate-500 text-xs font-bold">Remaining Purchasable</Text>
                  <Text className="text-orange-600 text-xs font-black">₹{remainingPurchasable.toLocaleString()}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-slate-500 text-xs font-bold">Paid Amount</Text>
                  <Text className="text-emerald-600 text-xs font-black">₹{paidAmount.toLocaleString()}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-slate-500 text-xs font-bold">Prior Refunds</Text>
                  <Text className="text-indigo-600 text-xs font-black">-₹{priorRefundsTotal.toLocaleString()}</Text>
                </View>
                <View className="border-t border-slate-100 pt-2.5 mt-1">
                  <View className="flex-row justify-between">
                    <Text className="text-slate-700 text-xs font-black uppercase tracking-wider">Outstanding Dues</Text>
                    <Text className={`text-xs font-black ${outstandingDues > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      ₹{outstandingDues.toLocaleString()}
                    </Text>
                  </View>
                </View>
              </View>
            </GlassCard>
          )}

          {/* Configuration Form Card (if no linked purchase) */}
          {!linkedPurchaseDetails && (
            <GlassCard className="mb-4 p-4 gap-4">
              {/* Supplier Selection */}
              <View>
                <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2.5 ml-1">Supplier *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 16 }}>
                  {suppliers.map((supplier) => (
                    <TouchableOpacity
                      key={supplier.id}
                      onPress={() => setSelectedSupplier(supplier.id)}
                      activeOpacity={0.8}
                      className={`px-3.5 py-2 rounded-full border ${selectedSupplier === supplier.id ? 'bg-orange-500 border-orange-500 shadow-sm' : 'bg-slate-50 border-slate-200'
                        }`}
                    >
                      <Text className={`text-[10px] font-black uppercase tracking-wider ${selectedSupplier === supplier.id ? 'text-white' : 'text-slate-500'
                        }`}>
                        {supplier.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Warehouse Selection */}
              <View>
                <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2.5 ml-1">Warehouse *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 16 }}>
                  {warehouses.map((warehouse) => (
                    <TouchableOpacity
                      key={warehouse.id}
                      onPress={() => setSelectedWarehouse(warehouse.id)}
                      activeOpacity={0.8}
                      className={`px-3.5 py-2 rounded-full border ${selectedWarehouse === warehouse.id ? 'bg-orange-500 border-orange-500 shadow-sm' : 'bg-slate-50 border-slate-200'
                        }`}
                    >
                      <Text className={`text-[10px] font-black uppercase tracking-wider ${selectedWarehouse === warehouse.id ? 'text-white' : 'text-slate-500'
                        }`}>
                        {warehouse.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Purchase Selection */}
              <View>
                <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2.5 ml-1">Linked Purchase (Optional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 16 }}>
                  <TouchableOpacity
                    onPress={() => setSelectedPurchase(null)}
                    activeOpacity={0.8}
                    className={`px-3.5 py-2 rounded-full border ${selectedPurchase === null ? 'bg-orange-500 border-orange-500 shadow-sm' : 'bg-slate-50 border-slate-200'
                      }`}
                  >
                    <Text className={`text-[10px] font-black uppercase tracking-wider ${selectedPurchase === null ? 'text-white' : 'text-slate-500'
                      }`}>
                      None
                    </Text>
                  </TouchableOpacity>
                  {purchases.map((purchase) => (
                    <TouchableOpacity
                      key={purchase.id}
                      onPress={() => setSelectedPurchase(purchase.id)}
                      activeOpacity={0.8}
                      className={`px-3.5 py-2 rounded-full border ${selectedPurchase === purchase.id ? 'bg-orange-500 border-orange-500 shadow-sm' : 'bg-slate-50 border-slate-200'
                        }`}
                    >
                      <Text className={`text-[10px] font-black uppercase tracking-wider ${selectedPurchase === purchase.id ? 'text-white' : 'text-slate-500'
                        }`}>
                        {purchase.formatted_id || `PRCH-${purchase.id}`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </GlassCard>
          )}

          {/* Date & Refund Info Card */}
          <GlassCard className="mb-4 p-4 gap-4">
            {/* Return Date */}
            <View>
              <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1 font-bold">Return Date *</Text>
              <TextInput
                value={returnDate}
                onChangeText={setReturnDate}
                className="bg-white border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm font-bold focus:border-orange-400"
                placeholder="YYYY-MM-DD"
              />
            </View>

            {/* Refund Mode */}
            <View>
              <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2.5 ml-1 font-bold">Refund Mode *</Text>
              <View className="flex-row flex-wrap gap-2">
                {['CASH', 'CARD', 'UPI'].map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    onPress={() => handleRefundModeChange(mode)}
                    activeOpacity={0.8}
                    className={`px-4 py-2 rounded-full border ${refundMode === mode ? 'bg-orange-500 border-orange-500 shadow-sm' : 'bg-slate-50 border-slate-200'
                      }`}
                  >
                    <Text className={`text-[10px] font-black uppercase tracking-wider ${refundMode === mode ? 'text-white' : 'text-slate-500'
                      }`}>
                      {mode}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Cash Refund */}
            <View>
              <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1 font-bold">
                Refund Amount {linkedPurchaseDetails && `(Max: ₹${maxRefundable.toFixed(2)})`} *
              </Text>
              <TextInput
                value={cashRefund}
                onChangeText={handleCashRefundChange}
                keyboardType="numeric"
                className="bg-white border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm font-bold focus:border-orange-400"
                placeholder="Enter refund amount"
              />
            </View>
          </GlassCard>

          {/* Current Return Summary Card */}
          {returnItems.length > 0 && (
            <GlassCard className="mb-4 bg-orange-500/5 border-orange-200/50">
              <Text className="text-slate-700 text-[10px] font-black uppercase tracking-wider mb-2.5">Current Return Summary</Text>
              <View className="gap-2 bg-white/80 border border-orange-100 rounded-2xl p-4">
                <View className="flex-row justify-between">
                  <Text className="text-slate-500 text-xs font-bold">Return Value</Text>
                  <Text className="text-slate-800 text-xs font-black">₹{calculateTotal().toFixed(2)}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-slate-500 text-xs font-bold">Cash Refund</Text>
                  <Text className="text-indigo-600 text-xs font-black">₹{(Number(cashRefund) || 0).toFixed(2)}</Text>
                </View>
                <View className="border-t border-slate-100 pt-2.5 mt-1">
                  <View className="flex-row justify-between">
                    <Text className="text-slate-700 text-xs font-black uppercase tracking-wider">Supplier Credit</Text>
                    <Text className="text-orange-600 text-xs font-black">₹{supplierCredit.toFixed(2)}</Text>
                  </View>
                </View>
              </View>
            </GlassCard>
          )}

          {/* Return Items Section */}
          <GlassCard className="mb-4 p-4">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-slate-800 font-black text-sm uppercase tracking-wider">Return Items *</Text>
              <TouchableOpacity
                onPress={addReturnItem}
                activeOpacity={0.8}
                className="bg-orange-500/10 border border-orange-200 px-3 py-1.5 rounded-lg"
              >
                <Text className="text-orange-600 text-[10px] font-black uppercase tracking-wider">+ Add Item</Text>
              </TouchableOpacity>
            </View>

            {returnItems.map((item, index) => (
              <View key={index} className="bg-slate-50/50 border border-slate-150 rounded-2xl p-4 mb-3">
                <View className="flex-row justify-between items-center mb-3.5">
                  <View className="bg-slate-200 px-2.5 py-1 rounded-lg">
                    <Text className="text-slate-700 text-[10px] font-black uppercase tracking-wide">Item #{index + 1}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeReturnItem(index)} activeOpacity={0.8}>
                    <Text className="text-rose-500 text-[10px] font-black uppercase tracking-wider">✕ Remove</Text>
                  </TouchableOpacity>
                </View>

                {/* Product Name Display */}
                {item.product_name && (
                  <View className="bg-orange-50 border border-orange-100 rounded-xl p-3 mb-3">
                    <Text className="text-orange-800 text-xs font-black uppercase">{item.product_name}</Text>
                    {item.max_quantity && (
                      <Text className="text-orange-600 text-[10px] font-bold mt-0.5">Max returnable: {item.max_quantity} units</Text>
                    )}
                  </View>
                )}

                {/* Product ID Input */}
                <View className="mb-3">
                  <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Product ID *</Text>
                  <TextInput
                    value={item.product_id}
                    onChangeText={(text) => updateReturnItem(index, 'product_id', text)}
                    keyboardType="numeric"
                    className="bg-white border-2 border-slate-200 rounded-2xl px-4 py-3 text-slate-800 text-xs font-bold focus:border-orange-400"
                    placeholder="Enter Product ID"
                  />
                </View>

                {/* Fields Row */}
                <View className="flex-row gap-2 mb-3">
                  <View className="flex-[1.2]">
                    <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Quantity *</Text>
                    <TextInput
                      value={item.quantity}
                      onChangeText={(text) => updateReturnItem(index, 'quantity', text)}
                      keyboardType="numeric"
                      className="bg-white border-2 border-slate-200 rounded-2xl px-3 py-3 text-slate-800 text-xs font-bold focus:border-orange-400"
                      placeholder="Qty"
                    />
                  </View>
                  <View className="flex-[1.5]">
                    <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Unit Price *</Text>
                    <TextInput
                      value={item.unit_price}
                      onChangeText={(text) => updateReturnItem(index, 'unit_price', text)}
                      keyboardType="numeric"
                      className="bg-white border-2 border-slate-200 rounded-2xl px-3 py-3 text-slate-800 text-xs font-bold focus:border-orange-400"
                      placeholder="Price"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Unit</Text>
                    <TextInput
                      value={item.unit}
                      editable={false}
                      className="bg-slate-50 border-2 border-slate-200 rounded-2xl px-3 py-3 text-slate-500 text-xs font-bold"
                      placeholder="Unit"
                    />
                  </View>
                </View>

                {/* Item Subtotal */}
                {item.quantity && item.unit_price && (
                  <View className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5">
                    <Text className="text-emerald-800 text-[10px] font-black uppercase tracking-wide">
                      Subtotal: ₹{(Number(item.quantity) * Number(item.unit_price)).toFixed(2)}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </GlassCard>

          {/* Notes */}
          <GlassCard className="mb-6 p-4">
            <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Notes</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              className="bg-white border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm font-bold focus:border-orange-400 h-24"
              placeholder="Enter notes (optional)"
              multiline
              textAlignVertical="top"
            />
          </GlassCard>

          {/* Submit Button */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.8}
            className="bg-orange-500 rounded-2xl py-4 shadow-lg flex-row items-center justify-center"
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text className="text-white text-center text-sm font-black uppercase tracking-wider">
                Process Purchase Return
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
