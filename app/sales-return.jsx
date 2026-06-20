/**
 * Sales Return Screen
 * Allows returning sold items from customers
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

export default function SalesReturnScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [customers, setCustomers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [selectedSale, setSelectedSale] = useState(null);
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [refundMode, setRefundMode] = useState('CREDIT');
  const [notes, setNotes] = useState('');
  const [isOutsideState, setIsOutsideState] = useState(false);

  const [returnItems, setReturnItems] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedSale) {
      fetchSaleItems(selectedSale);
    } else {
      setReturnItems([]);
    }
  }, [selectedSale]);

  const fetchSaleItems = async (saleId) => {
    try {
      const res = await apiClient.get(`/sales/${saleId}/items`);
      const items = res.data.map(item => {
        const isSecondary = item.unit_id && item.unit_id == item.secondary_unit_id;
        const convRate = parseFloat(item.conversion_rate || 1);
        const qty = parseFloat(item.quantity);
        const baseQty = isSecondary ? qty * convRate : qty;

        return {
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity.toString(),
          base_quantity: baseQty.toString(),
          unit_price: item.unit_price.toString(),
          tax_rate: item.tax_rate.toString(),
          unit: typeof item.unit === 'object' ? item.unit?.name || '' : item.unit || '',
          unit_id: item.unit_id,
          secondary_unit_id: item.secondary_unit_id,
          conversion_rate: convRate,
        };
      });
      setReturnItems(items);
    } catch (error) {
      console.error('Error fetching sale items:', error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [customersRes, warehousesRes, salesRes] = await Promise.all([
        apiClient.get('/customers'),
        apiClient.get('/warehouses'),
        apiClient.get('/sales'),
      ]);
      setCustomers(customersRes.data);
      setWarehouses(warehousesRes.data);
      setSales(salesRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', `Failed to load data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const addReturnItem = () => {
    setReturnItems([...returnItems, { product_id: '', quantity: '', unit_price: '', tax_rate: '' }]);
  };

  const updateReturnItem = (index, field, value) => {
    const updated = [...returnItems];
    if (field === 'quantity') {
      let cleaned = value.replace(/[^0-9.]/g, '');
      const parts = cleaned.split('.');
      if (parts.length > 2) cleaned = parts[0] + '.' + parts.slice(1).join('');
      updated[index][field] = cleaned;
      
      const qty = parseFloat(cleaned || 0);
      const isSecondary = updated[index].unit_id != null && updated[index].unit_id == updated[index].secondary_unit_id;
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

  const calculateTotal = () => {
    return returnItems.reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unit_price) || 0;
      return sum + (qty * price);
    }, 0);
  };

  const handleSubmit = async () => {
    if (!selectedWarehouse) {
      Alert.alert('Validation Error', 'Please select warehouse');
      return;
    }

    if (returnItems.length === 0) {
      Alert.alert('Validation Error', 'Please add at least one item');
      return;
    }

    const validItems = returnItems.map(item => {
      const qty = parseFloat(item.quantity) || 0;
      const isSecondary = item.unit_id != null && item.unit_id == item.secondary_unit_id;
      const convRate = parseFloat(item.conversion_rate || 1);
      return {
        ...item,
        base_quantity: isSecondary ? qty * convRate : qty
      };
    }).filter(item => item.product_id && item.quantity && item.unit_price);
    if (validItems.length === 0) {
      Alert.alert('Validation Error', 'Please fill in all item details');
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
        notes: notes,
        is_outside_state: isOutsideState,
        items: validItems,
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
            Sales Return
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginTop: 1 }}>
            Return items from customers
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
          {/* Configuration Form Card */}
          <GlassCard className="mb-4 p-4 gap-4">
            {/* Customer Selection */}
            <View>
              <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2.5 ml-1">Customer (Optional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 16 }}>
                <TouchableOpacity
                  onPress={() => setSelectedCustomer(null)}
                  activeOpacity={0.8}
                  className={`px-3.5 py-2 rounded-full border ${selectedCustomer === null ? 'bg-orange-500 border-orange-500 shadow-sm' : 'bg-slate-50 border-slate-200'
                    }`}
                >
                  <Text className={`text-[10px] font-black uppercase tracking-wider ${selectedCustomer === null ? 'text-white' : 'text-slate-500'
                    }`}>
                    Walk-in
                  </Text>
                </TouchableOpacity>
                {customers.map((customer) => (
                  <TouchableOpacity
                    key={customer.id}
                    onPress={() => setSelectedCustomer(customer.id)}
                    activeOpacity={0.8}
                    className={`px-3.5 py-2 rounded-full border ${selectedCustomer === customer.id ? 'bg-orange-500 border-orange-500 shadow-sm' : 'bg-slate-50 border-slate-200'
                      }`}
                  >
                    <Text className={`text-[10px] font-black uppercase tracking-wider ${selectedCustomer === customer.id ? 'text-white' : 'text-slate-500'
                      }`}>
                      {customer.name}
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

            {/* Sale Selection */}
            <View>
              <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2.5 ml-1">Linked Sale (Optional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 16 }}>
                <TouchableOpacity
                  onPress={() => setSelectedSale(null)}
                  activeOpacity={0.8}
                  className={`px-3.5 py-2 rounded-full border ${selectedSale === null ? 'bg-orange-500 border-orange-500 shadow-sm' : 'bg-slate-50 border-slate-200'
                    }`}
                >
                  <Text className={`text-[10px] font-black uppercase tracking-wider ${selectedSale === null ? 'text-white' : 'text-slate-500'
                    }`}>
                    None
                  </Text>
                </TouchableOpacity>
                {sales.map((sale) => (
                  <TouchableOpacity
                    key={sale.id}
                    onPress={() => setSelectedSale(sale.id)}
                    activeOpacity={0.8}
                    className={`px-3.5 py-2 rounded-full border ${selectedSale === sale.id ? 'bg-orange-500 border-orange-500 shadow-sm' : 'bg-slate-50 border-slate-200'
                      }`}
                  >
                    <Text className={`text-[10px] font-black uppercase tracking-wider ${selectedSale === sale.id ? 'text-white' : 'text-slate-500'
                      }`}>
                      {sale.formatted_id || `SALE-${sale.id}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </GlassCard>

          {/* Date, Refund & Outside State Info Card */}
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
                {['CREDIT', 'CASH', 'CARD', 'UPI'].map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    onPress={() => setRefundMode(mode)}
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

            {/* Outside State Transaction */}
            <TouchableOpacity
              onPress={() => setIsOutsideState(!isOutsideState)}
              activeOpacity={0.8}
              className="flex-row items-center mt-1 ml-1"
            >
              <View className={`w-5.5 h-5.5 rounded-lg border-2 items-center justify-center mr-3 ${isOutsideState ? 'bg-orange-500 border-orange-500 shadow-sm' : 'border-slate-300'
                }`}>
                {isOutsideState && <Ionicons name="checkmark" size={12} color="#fff" />}
              </View>
              <Text className="text-slate-600 text-xs font-bold uppercase tracking-wider">Outside State Transaction</Text>
            </TouchableOpacity>
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
                {refundMode !== 'CREDIT' && (
                  <View className="flex-row justify-between">
                    <Text className="text-slate-500 text-xs font-bold">Cash Refund</Text>
                    <Text className="text-indigo-600 text-xs font-black">₹{calculateTotal().toFixed(2)}</Text>
                  </View>
                )}
                {refundMode === 'CREDIT' && (
                  <View className="flex-row justify-between">
                    <Text className="text-slate-500 text-xs font-bold">Customer Credit</Text>
                    <Text className="text-orange-600 text-xs font-black">₹{calculateTotal().toFixed(2)}</Text>
                  </View>
                )}
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
                  <View className="flex-1">
                    <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Quantity *</Text>
                    <TextInput
                      value={item.quantity}
                      onChangeText={(text) => updateReturnItem(index, 'quantity', text)}
                      keyboardType="numeric"
                      className="bg-white border-2 border-slate-200 rounded-2xl px-3 py-3 text-slate-800 text-xs font-bold focus:border-orange-400"
                      placeholder="Qty"
                    />
                  </View>
                  <View className="flex-1.5">
                    <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Unit Price *</Text>
                    <TextInput
                      value={item.unit_price}
                      onChangeText={(text) => updateReturnItem(index, 'unit_price', text)}
                      keyboardType="numeric"
                      className="bg-white border-2 border-slate-200 rounded-2xl px-3 py-3 text-slate-800 text-xs font-bold focus:border-orange-400"
                      placeholder="Price"
                    />
                  </View>
                  <View className="flex-1.2">
                    <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Tax Rate %</Text>
                    <TextInput
                      value={item.tax_rate}
                      onChangeText={(text) => updateReturnItem(index, 'tax_rate', text)}
                      keyboardType="numeric"
                      className="bg-white border-2 border-slate-200 rounded-2xl px-3 py-3 text-slate-800 text-xs font-bold focus:border-orange-400"
                      placeholder="Tax %"
                    />
                  </View>
                </View>
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
              placeholder="Add notes..."
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
                Process Return
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
