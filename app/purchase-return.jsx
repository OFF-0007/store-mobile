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
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import apiClient from "@/lib/api/client";

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
  const [refundMode, setRefundMode] = useState('CREDIT');
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
      const items = purchase.items ? purchase.items.map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity.toString(),
        unit_price: item.unit_price.toString(),
        unit: item.unit || '',
        max_quantity: item.quantity, // Store max for validation
        subtotal: item.subtotal,
      })) : [];
      
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
      const newPurchaseVal = (gross - priorRetTotal) - returnTotalVal;
      const currentMaxRefundable = Math.max(0, (paid - priorRefTotal) - Math.max(0, newPurchaseVal));
      
      let credit = 0;
      if (refundMode === 'CREDIT') {
        credit = returnTotalVal;
      } else {
        const actualRefund = Number(cashRefund || 0);
        credit = Math.max(0, returnTotalVal - actualRefund);
      }

      setPurchaseTotal(gross);
      setPaidAmount(paid);
      setPriorReturnsTotal(priorRetTotal);
      setPriorRefundsTotal(priorRefTotal);
      setOutstandingDues(outstanding);
      setMaxRefundable(currentMaxRefundable);
      setSupplierCredit(credit);
      setRemainingPurchasable(remainingPurchasableVal);

      // Auto-cap refund amount
      if (['CASH', 'CARD', 'UPI'].includes(refundMode)) {
        const currentRefund = Number(cashRefund || 0);
        if (currentRefund > currentMaxRefundable) {
          setCashRefund(currentMaxRefundable.toString());
        }
      }
    } else {
      // No linked purchase - simple calculation
      const returnTotalVal = calculateTotal();
      setMaxRefundable(returnTotalVal);
      
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
    let numVal = Number(value) || 0;
    const returnTotalVal = calculateTotal();
    
    if (linkedPurchaseDetails) {
      if (numVal > maxRefundable) {
        numVal = maxRefundable;
      }
    } else {
      if (numVal > returnTotalVal) {
        numVal = returnTotalVal;
      }
    }
    
    setCashRefund(numVal.toString());
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
    updated[index][field] = value;
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
        unit: item.unit || null,
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
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Text style={{ color: '#fff', fontSize: 24 }}>‹</Text>
        </TouchableOpacity>
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>
          Purchase Return
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#f97316" />
        </View>
      ) : (
        <ScrollView className="flex-1 p-4">
          {/* Linked Purchase Info */}
          {linkedPurchaseDetails && (
            <View className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
              <View className="flex-row items-center mb-2">
                <View className="bg-emerald-500 rounded-lg p-2 mr-3">
                  <Text className="text-white text-xs font-bold">INV</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-emerald-800 text-xs font-bold uppercase">Linked Purchase</Text>
                  <Text className="text-slate-900 text-sm font-bold">
                    {linkedPurchaseDetails.formatted_id || `PRCH-${linkedPurchaseDetails.id}`} — {linkedPurchaseDetails.supplier?.name}
                  </Text>
                </View>
                <TouchableOpacity 
                  onPress={() => setSelectedPurchase(null)}
                  className="bg-emerald-600 px-3 py-1 rounded-lg"
                >
                  <Text className="text-white text-xs font-bold">Clear</Text>
                </TouchableOpacity>
              </View>
              
              <View className="bg-white rounded-lg p-3 space-y-2">
                <View className="flex-row justify-between">
                  <Text className="text-slate-600 text-xs">Gross Purchase</Text>
                  <Text className="text-slate-900 text-xs font-bold">₹{purchaseTotal.toLocaleString()}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-slate-600 text-xs">Prior Returns</Text>
                  <Text className="text-rose-600 text-xs font-bold">-₹{priorReturnsTotal.toLocaleString()}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-slate-600 text-xs">Remaining Purchasable</Text>
                  <Text className="text-orange-600 text-xs font-bold">₹{remainingPurchasable.toLocaleString()}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-slate-600 text-xs">Paid Amount</Text>
                  <Text className="text-green-600 text-xs font-bold">₹{paidAmount.toLocaleString()}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-slate-600 text-xs">Prior Refunds</Text>
                  <Text className="text-indigo-600 text-xs font-bold">-₹{priorRefundsTotal.toLocaleString()}</Text>
                </View>
                <View className="border-t border-slate-200 pt-2">
                  <View className="flex-row justify-between">
                    <Text className="text-slate-700 text-xs font-bold">Outstanding Dues</Text>
                    <Text className={`text-xs font-bold ${outstandingDues > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      ₹{outstandingDues.toLocaleString()}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Supplier Selection */}
          {!linkedPurchaseDetails && (
            <View className="mb-4">
              <Text className="text-sm font-bold text-slate-700 mb-2">Supplier *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {suppliers.map((supplier) => (
                  <TouchableOpacity
                    key={supplier.id}
                    onPress={() => setSelectedSupplier(supplier.id)}
                    className={`mr-2 px-4 py-2 rounded-lg ${
                      selectedSupplier === supplier.id ? 'bg-orange-500' : 'bg-slate-200'
                    }`}
                  >
                    <Text className={`text-sm font-bold ${
                      selectedSupplier === supplier.id ? 'text-white' : 'text-slate-700'
                    }`}>
                      {supplier.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Warehouse Selection */}
          {!linkedPurchaseDetails && (
            <View className="mb-4">
              <Text className="text-sm font-bold text-slate-700 mb-2">Warehouse *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {warehouses.map((warehouse) => (
                  <TouchableOpacity
                    key={warehouse.id}
                    onPress={() => setSelectedWarehouse(warehouse.id)}
                    className={`mr-2 px-4 py-2 rounded-lg ${
                      selectedWarehouse === warehouse.id ? 'bg-orange-500' : 'bg-slate-200'
                    }`}
                  >
                    <Text className={`text-sm font-bold ${
                      selectedWarehouse === warehouse.id ? 'text-white' : 'text-slate-700'
                    }`}>
                      {warehouse.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Purchase Selection (Optional) */}
          {!linkedPurchaseDetails && (
            <View className="mb-4">
              <Text className="text-sm font-bold text-slate-700 mb-2">Linked Purchase (Optional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <TouchableOpacity
                  onPress={() => setSelectedPurchase(null)}
                  className={`mr-2 px-4 py-2 rounded-lg ${
                    selectedPurchase === null ? 'bg-orange-500' : 'bg-slate-200'
                  }`}
                >
                  <Text className={`text-sm font-bold ${
                    selectedPurchase === null ? 'text-white' : 'text-slate-700'
                  }`}>
                    None
                  </Text>
                </TouchableOpacity>
                {purchases.map((purchase) => (
                  <TouchableOpacity
                    key={purchase.id}
                    onPress={() => setSelectedPurchase(purchase.id)}
                    className={`mr-2 px-4 py-2 rounded-lg ${
                      selectedPurchase === purchase.id ? 'bg-orange-500' : 'bg-slate-200'
                    }`}
                  >
                    <Text className={`text-sm font-bold ${
                      selectedPurchase === purchase.id ? 'text-white' : 'text-slate-700'
                    }`}>
                      {purchase.formatted_id || `PRCH-${purchase.id}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Return Date */}
          <View className="mb-4">
            <Text className="text-sm font-bold text-slate-700 mb-2">Return Date *</Text>
            <TextInput
              value={returnDate}
              onChangeText={setReturnDate}
              className="bg-white border-2 border-slate-200 rounded-lg px-4 py-3"
              placeholder="YYYY-MM-DD"
            />
          </View>

          {/* Refund Mode */}
          <View className="mb-4">
            <Text className="text-sm font-bold text-slate-700 mb-2">Refund Mode *</Text>
            <View className="flex-row flex-wrap">
              {['CREDIT', 'CASH', 'CARD', 'UPI'].map((mode) => (
                <TouchableOpacity
                  key={mode}
                  onPress={() => handleRefundModeChange(mode)}
                  className={`mr-2 mb-2 px-4 py-2 rounded-lg ${
                    refundMode === mode ? 'bg-orange-500' : 'bg-slate-200'
                  }`}
                >
                  <Text className={`text-sm font-bold ${
                    refundMode === mode ? 'text-white' : 'text-slate-700'
                  }`}>
                    {mode}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Cash Refund (only for CASH/CARD/UPI) */}
          {refundMode !== 'CREDIT' && (
            <View className="mb-4">
              <Text className="text-sm font-bold text-slate-700 mb-2">
                Cash Refund Amount {linkedPurchaseDetails && `(Max: ₹${maxRefundable.toFixed(2)})`}
              </Text>
              <TextInput
                value={cashRefund}
                onChangeText={handleCashRefundChange}
                keyboardType="numeric"
                className="bg-white border-2 border-slate-200 rounded-lg px-4 py-3"
                placeholder="Enter refund amount"
              />
            </View>
          )}

          {/* Current Return Summary */}
          {returnItems.length > 0 && (
            <View className="bg-slate-100 rounded-xl p-4 mb-4">
              <Text className="text-slate-700 text-xs font-bold mb-2">Current Return Summary</Text>
              <View className="flex-row justify-between mb-1">
                <Text className="text-slate-600 text-xs">Return Value</Text>
                <Text className="text-slate-900 text-xs font-bold">₹{calculateTotal().toFixed(2)}</Text>
              </View>
              {refundMode !== 'CREDIT' && (
                <View className="flex-row justify-between mb-1">
                  <Text className="text-slate-600 text-xs">Cash Refund</Text>
                  <Text className="text-indigo-600 text-xs font-bold">₹{(Number(cashRefund) || 0).toFixed(2)}</Text>
                </View>
              )}
              <View className="border-t border-slate-300 pt-1">
                <View className="flex-row justify-between">
                  <Text className="text-slate-700 text-xs font-bold">Supplier Credit</Text>
                  <Text className="text-orange-600 text-xs font-bold">₹{supplierCredit.toFixed(2)}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Return Items */}
          <View className="mb-4">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-sm font-bold text-slate-700">Return Items *</Text>
              <TouchableOpacity onPress={addReturnItem} className="bg-orange-500 px-4 py-2 rounded-lg">
                <Text className="text-white text-sm font-bold">+ Add Item</Text>
              </TouchableOpacity>
            </View>

            {returnItems.map((item, index) => (
              <View key={index} className="bg-white border border-slate-200 rounded-lg p-4 mb-2">
                <View className="flex-row justify-between items-start mb-3">
                  <Text className="text-sm font-bold text-slate-700">Item {index + 1}</Text>
                  <TouchableOpacity onPress={() => removeReturnItem(index)}>
                    <Text className="text-red-500 text-sm font-bold">Remove</Text>
                  </TouchableOpacity>
                </View>

                {/* Product Name Display */}
                {item.product_name && (
                  <View className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 mb-3">
                    <Text className="text-sm font-bold text-orange-800">{item.product_name}</Text>
                    {item.max_quantity && (
                      <Text className="text-orange-600 text-xs">Max returnable: {item.max_quantity}</Text>
                    )}
                  </View>
                )}

                {/* Product ID Input */}
                <View className="mb-2">
                  <Text className="text-xs text-slate-500 mb-1 font-bold">Product ID *</Text>
                  <TextInput
                    value={item.product_id}
                    onChangeText={(text) => updateReturnItem(index, 'product_id', text)}
                    keyboardType="numeric"
                    className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
                    placeholder="Enter Product ID"
                  />
                </View>

                {/* Fields Row */}
                <View className="flex-row gap-2 mb-2">
                  <View className="flex-1">
                    <Text className="text-xs text-slate-500 mb-1 font-bold">Quantity *</Text>
                    <TextInput
                      value={item.quantity}
                      onChangeText={(text) => updateReturnItem(index, 'quantity', text)}
                      keyboardType="numeric"
                      className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
                      placeholder="Qty"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-slate-500 mb-1 font-bold">Unit Price *</Text>
                    <TextInput
                      value={item.unit_price}
                      onChangeText={(text) => updateReturnItem(index, 'unit_price', text)}
                      keyboardType="numeric"
                      className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
                      placeholder="Price"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-slate-500 mb-1 font-bold">Unit</Text>
                    <TextInput
                      value={item.unit}
                      onChangeText={(text) => updateReturnItem(index, 'unit', text)}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
                      placeholder="Unit"
                    />
                  </View>
                </View>

                {/* Item Subtotal */}
                {item.quantity && item.unit_price && (
                  <View className="bg-slate-100 rounded-lg px-3 py-2">
                    <Text className="text-slate-600 text-xs">
                      Subtotal: ₹{(Number(item.quantity) * Number(item.unit_price)).toFixed(2)}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          {/* Notes */}
          <View className="mb-4">
            <Text className="text-sm font-bold text-slate-700 mb-2">Notes</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              className="bg-white border-2 border-slate-200 rounded-lg px-4 py-3 h-24"
              placeholder="Enter notes (optional)"
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            className="bg-orange-500 rounded-xl py-4 items-center"
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold text-lg">Process Purchase Return</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
