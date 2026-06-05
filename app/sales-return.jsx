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
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import apiClient from "@/lib/api/client";

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
      const items = res.data.map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity.toString(),
        unit_price: item.unit_price.toString(),
        tax_rate: item.tax_rate.toString(),
      }));
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
    updated[index][field] = value;
    setReturnItems(updated);
  };

  const removeReturnItem = (index) => {
    setReturnItems(returnItems.filter((_, i) => i !== index));
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

    const validItems = returnItems.filter(item => item.product_id && item.quantity && item.unit_price);
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
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Text style={{ color: '#fff', fontSize: 24 }}>‹</Text>
        </TouchableOpacity>
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>
          Sales Return
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#f97316" />
        </View>
      ) : (
        <ScrollView className="flex-1 p-4">
          {/* Customer Selection (Optional) */}
          <View className="mb-4">
            <Text className="text-sm font-bold text-slate-700 mb-2">Customer (Optional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity
                onPress={() => setSelectedCustomer(null)}
                className={`mr-2 px-4 py-2 rounded-lg ${
                  selectedCustomer === null ? 'bg-orange-500' : 'bg-slate-200'
                }`}
              >
                <Text className={`text-sm font-bold ${
                  selectedCustomer === null ? 'text-white' : 'text-slate-700'
                }`}>
                  Walk-in
                </Text>
              </TouchableOpacity>
              {customers.map((customer) => (
                <TouchableOpacity
                  key={customer.id}
                  onPress={() => setSelectedCustomer(customer.id)}
                  className={`mr-2 px-4 py-2 rounded-lg ${
                    selectedCustomer === customer.id ? 'bg-orange-500' : 'bg-slate-200'
                  }`}
                >
                  <Text className={`text-sm font-bold ${
                    selectedCustomer === customer.id ? 'text-white' : 'text-slate-700'
                  }`}>
                    {customer.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Warehouse Selection */}
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

          {/* Sale Selection (Optional) */}
          <View className="mb-4">
            <Text className="text-sm font-bold text-slate-700 mb-2">Linked Sale (Optional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity
                onPress={() => setSelectedSale(null)}
                className={`mr-2 px-4 py-2 rounded-lg ${
                  selectedSale === null ? 'bg-orange-500' : 'bg-slate-200'
                }`}
              >
                <Text className={`text-sm font-bold ${
                  selectedSale === null ? 'text-white' : 'text-slate-700'
                }`}>
                  None
                </Text>
              </TouchableOpacity>
              {sales.map((sale) => (
                <TouchableOpacity
                  key={sale.id}
                  onPress={() => setSelectedSale(sale.id)}
                  className={`mr-2 px-4 py-2 rounded-lg ${
                    selectedSale === sale.id ? 'bg-orange-500' : 'bg-slate-200'
                  }`}
                >
                  <Text className={`text-sm font-bold ${
                    selectedSale === sale.id ? 'text-white' : 'text-slate-700'
                  }`}>
                    {sale.formatted_id || `SALE-${sale.id}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

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
                  onPress={() => setRefundMode(mode)}
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

          {/* Outside State */}
          <View className="mb-4">
            <View className="flex-row items-center">
              <TouchableOpacity
                onPress={() => setIsOutsideState(!isOutsideState)}
                className={`w-6 h-6 rounded border-2 ${
                  isOutsideState ? 'bg-orange-500 border-orange-500' : 'border-slate-300'
                } items-center justify-center mr-3`}
              >
                {isOutsideState && <Text className="text-white text-xs">✓</Text>}
              </TouchableOpacity>
              <Text className="text-sm text-slate-700">Outside State Transaction</Text>
            </View>
          </View>

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

                {/* Product Name Box */}
                {item.product_name && (
                  <View className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 mb-3">
                    <Text className="text-sm font-bold text-orange-800">{item.product_name}</Text>
                  </View>
                )}

                {/* Fields Row */}
                <View className="flex-row gap-2 mb-2">
                  <View className="flex-1">
                    <Text className="text-xs text-slate-500 mb-1 font-bold">Quantity</Text>
                    <TextInput
                      value={item.quantity}
                      onChangeText={(text) => updateReturnItem(index, 'quantity', text)}
                      keyboardType="numeric"
                      className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
                      placeholder="Qty"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-slate-500 mb-1 font-bold">Unit Price</Text>
                    <TextInput
                      value={item.unit_price}
                      onChangeText={(text) => updateReturnItem(index, 'unit_price', text)}
                      keyboardType="numeric"
                      className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
                      placeholder="Price"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-slate-500 mb-1 font-bold">Tax Rate %</Text>
                    <TextInput
                      value={item.tax_rate}
                      onChangeText={(text) => updateReturnItem(index, 'tax_rate', text)}
                      keyboardType="numeric"
                      className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
                      placeholder="Tax %"
                    />
                  </View>
                </View>

                {/* Hidden Product ID */}
                <TextInput
                  value={item.product_id}
                  onChangeText={(text) => updateReturnItem(index, 'product_id', text)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
                  placeholder="Product ID"
                />
              </View>
            ))}
          </View>

          {/* Notes */}
          <View className="mb-4">
            <Text className="text-sm font-bold text-slate-700 mb-2">Notes</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              className="bg-white border-2 border-slate-200 rounded-lg px-4 py-3"
              placeholder="Add notes..."
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            className="bg-orange-500 rounded-lg py-4"
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white text-center font-bold">Process Return</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
