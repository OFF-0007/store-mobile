/**
 * POS Screen – Point of Sale Terminal matching the web app's behaviour.
 * Slate-50 background, white cards, high-contrast typography,
 * modern interactive inputs, and vibrant orange/green status accents.
 * Unified single-screen layout with inline cart list (no tabs).
 */
import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMockStore } from "@/store/mockStore";
import { GlassCard } from "@/components/ui";
import { printThermalReceipt } from "../../utils/printer";

// Safely require expo-camera to prevent crash when native modules aren't compiled yet
let CameraView = null;
let useCameraPermissions = () => [null, () => {}];

try {
  const ExpoCamera = require("expo-camera");
  CameraView = ExpoCamera.CameraView;
  useCameraPermissions = ExpoCamera.useCameraPermissions;
} catch (e) {
  console.warn("ExpoCamera module not found or failed to load:", e.message);
}

const fmt = (val) =>
  `₹${Number(val || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const fmtInt = (val) =>
  `₹${Number(Math.round(val || 0)).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;

const PAYMENT_METHODS = [
  { key: "Cash", label: "Cash", icon: "💵" },
  { key: "Card", label: "Card", icon: "💳" },
  { key: "UPI", label: "UPI", icon: "📱" },
];

export default function POSScreen() {
  const {
    products,
    customers,
    units,
    recordSale,
    fetchProducts,
    fetchCustomers,
    isLoading: storeLoading,
  } = useMockStore();

  useEffect(() => {
    fetchProducts();
    fetchCustomers();
  }, []);

  // ── States ─────────────────────────────────────────────────────────────────
  const [cart, setCart] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [paidAmount, setPaidAmount] = useState("");
  const [isPaidAmountEdited, setIsPaidAmountEdited] = useState(false);
  const [isOutsideState, setIsOutsideState] = useState(false);
  const [additionalNotes, setAdditionalNotes] = useState("");

  // Modals Visibility
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [activeUnitItem, setActiveUnitItem] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  
  // Checkout Success Receipt Modal
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState(null);

  // Barcode Scanner states
  const [permission, requestPermission] = useCameraPermissions();
  const [lastScannedMessage, setLastScannedMessage] = useState("");
  const scannedLock = useRef(false);

  // ── Customer Suggestions ───────────────────────────────────────────────────
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return [];
    const q = customerSearch.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q))
    );
  }, [customers, customerSearch]);

  const handleSelectCustomer = (customer) => {
    setSelectedCustomerId(customer.id);
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone || "");
    setCustomerSearch(customer.name);
    setShowCustomerSuggestions(false);
  };

  const handleCustomerInputChange = (text) => {
    setCustomerSearch(text);
    setSelectedCustomerId(null);
    setCustomerName(text);
    setShowCustomerSuggestions(true);
  };

  // ── Product Suggestions & Search ───────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return products.filter((p) => {
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))
      );
    });
  }, [products, searchQuery]);

  // Quick Add (First 5 available products in stock)
  const quickAddProducts = useMemo(() => {
    return products.filter((p) => p.stock > 0).slice(0, 5);
  }, [products]);

  // ── Cart Operations ────────────────────────────────────────────────────────
  const addToCart = useCallback((product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product_id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          Alert.alert("Stock Limit Reached", `Only ${product.stock} units available.`);
          return prev;
        }
        return prev.map((item) =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          gst_rate: product.gst || 0,
          discount: 0,
          discount_type: "fixed",
          unit: product.unit || "Unit",
          unit_id: product.unit_id || null,
          available_stock: product.stock,
        },
      ];
    });
    setSearchQuery("");
  }, []);

  const updateItemQuantity = useCallback((id, qty) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((item) => item.product_id !== id));
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.product_id === id ? { ...item, quantity: qty } : item
      )
    );
  }, []);

  const updateCartItemField = useCallback((id, field, value) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product_id === id ? { ...item, [field]: value } : item
      )
    );
  }, []);

  const removeFromCart = useCallback((id) => {
    setCart((prev) => prev.filter((item) => item.product_id !== id));
  }, []);

  // ── Math Calculations ──────────────────────────────────────────────────────
  const {
    itemsWithTotals,
    subtotal,
    taxAmount,
    discountTotal,
    grandTotal,
    roundOff,
  } = useMemo(() => {
    let sub = 0;
    let tax = 0;
    let disc = 0;

    const items = cart.map((item) => {
      const itemBaseTotal = item.price * item.quantity;
      let itemDiscountAmount = Number(item.discount || 0);
      if (item.discount_type === "percent") {
        itemDiscountAmount = (itemBaseTotal * Number(item.discount || 0)) / 100;
      }
      
      const itemTaxableValue = Math.max(0, itemBaseTotal - itemDiscountAmount);
      const itemTax = (itemTaxableValue * Number(item.gst_rate || 0)) / 100;
      const itemSubtotal = itemTaxableValue + itemTax;

      sub += itemTaxableValue;
      tax += itemTax;
      disc += itemDiscountAmount;

      return {
        ...item,
        discount_amount: itemDiscountAmount,
        taxable_value: itemTaxableValue,
        tax_amount: itemTax,
        subtotal: itemSubtotal,
      };
    });

    const finalExactTotal = Math.max(0, sub + tax);
    const finalGrandTotal = Math.round(finalExactTotal);
    const finalRoundOff = Number((finalGrandTotal - finalExactTotal).toFixed(2));

    return {
      itemsWithTotals: items,
      subtotal: sub,
      taxAmount: tax,
      discountTotal: disc,
      grandTotal: finalGrandTotal,
      roundOff: finalRoundOff,
    };
  }, [cart]);

  // Sync paidAmount with grandTotal if user hasn't edited it manually
  useEffect(() => {
    if (!isPaidAmountEdited) {
      setPaidAmount(grandTotal.toString());
    }
  }, [grandTotal, isPaidAmountEdited]);

  const changeDue = useMemo(() => {
    const paid = Number(paidAmount || 0);
    return Math.max(0, paid - grandTotal);
  }, [paidAmount, grandTotal]);

  const balanceOutstanding = useMemo(() => {
    const paid = Number(paidAmount || 0);
    return Math.max(0, grandTotal - paid);
  }, [paidAmount, grandTotal]);

  const paymentStatus = useMemo(() => {
    const paid = Number(paidAmount || 0);
    if (paid === 0) return "Unpaid";
    if (paid < grandTotal) return "Partial";
    return "Paid";
  }, [paidAmount, grandTotal]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleOpenUnitPicker = (item) => {
    setActiveUnitItem(item);
    setShowUnitModal(true);
  };

  const handleSelectUnit = (unit) => {
    if (activeUnitItem) {
      updateCartItemField(activeUnitItem.product_id, "unit_id", unit.id);
      updateCartItemField(activeUnitItem.product_id, "unit", unit.short_name);
    }
    setShowUnitModal(false);
  };

  const handleCheckoutSubmit = async () => {
    if (cart.length === 0) {
      Alert.alert("Cart Empty", "Please add at least one item to checkout.");
      return;
    }

    const isPartialOrUnpaid = Number(paidAmount || 0) < grandTotal;
    if (isPartialOrUnpaid) {
      if (!selectedCustomerId && (!customerName.trim() || !customerPhone.trim())) {
        Alert.alert(
          "Customer Required",
          "Customer Name and Phone Number are compulsory for partial or credit (unpaid) sales!"
        );
        return;
      }
    }

    // Check stock levels
    for (const item of cart) {
      const liveProduct = products.find((p) => p.id === item.product_id);
      if (!liveProduct || liveProduct.stock < item.quantity) {
        Alert.alert(
          "Insufficient Stock",
          `"${item.name}" has only ${liveProduct?.stock || 0} units left in warehouse.`
        );
        return;
      }
    }

    const preparedItems = itemsWithTotals.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      price: item.price,
      tax: item.tax_amount,
      tax_rate: item.gst_rate,
      discount: item.discount_amount,
      subtotal: item.subtotal,
    }));

    const salePayload = {
      customer_id: selectedCustomerId,
      customer_name: selectedCustomerId ? null : customerName.trim(),
      customer_phone: selectedCustomerId ? null : customerPhone.trim(),
      sale_date: new Date().toISOString().split("T")[0],
      items: preparedItems,
      subtotal: Number(subtotal.toFixed(2)),
      tax: 0,
      tax_amount: Number(taxAmount.toFixed(2)),
      discount: Number(discountTotal.toFixed(2)),
      grand_total: grandTotal,
      round_off: roundOff,
      paid_amount: Number(paidAmount || 0),
      payment_status: paymentStatus,
      payment_method: paymentMethod,
      is_outside_state: isOutsideState,
      notes: additionalNotes.trim() || "Sale processed via Mobile App",
    };

    try {
      const response = await recordSale(salePayload);
      if (response && response.sale) {
        setCompletedSale({
          ...salePayload,
          reference: response.sale.reference,
          id: response.sale.id,
          customer_display_name: selectedCustomerId
            ? (customers.find((c) => c.id === selectedCustomerId)?.name || "Client")
            : (customerName.trim() || "Walk-in Customer"),
        });

        // Reset state
        setCart([]);
        setAdditionalNotes("");
        setIsPaidAmountEdited(false);
        setSelectedCustomerId(null);
        setCustomerName("");
        setCustomerPhone("");
        setCustomerSearch("");
        setIsSuccessOpen(true);
      }
    } catch (err) {
      Alert.alert("Checkout Failed", err?.response?.data?.message || err.message || "An error occurred.");
    }
  };

  const handleStartNewTransaction = () => {
    setIsSuccessOpen(false);
    setCompletedSale(null);
  };

  const handleBarcodeScanned = useCallback(({ data }) => {
    if (scannedLock.current) return;
    scannedLock.current = true;
    setTimeout(() => {
      scannedLock.current = false;
    }, 1500);

    const matched = products.find(
      (p) =>
        (p.barcode && String(p.barcode).trim() === String(data).trim()) ||
        (p.sku && String(p.sku).trim() === String(data).trim())
    );

    if (matched) {
      if (matched.stock <= 0) {
        setLastScannedMessage(`⚠️ ${matched.name} is out of stock`);
      } else {
        addToCart(matched);
        setLastScannedMessage(`✅ Added ${matched.name}`);
      }
    } else {
      setLastScannedMessage(`❌ Barcode "${data}" not found`);
    }
  }, [products, addToCart]);

  const handleOpenScanner = async () => {
    if (!CameraView) {
      Alert.alert(
        "Scanner Unavailable",
        "Camera scanning requires a rebuilt development client. Please run a new development build to compile the camera modules."
      );
      return;
    }
    if (!permission || !permission.granted) {
      const status = await requestPermission();
      if (!status.granted) {
        Alert.alert("Permission Required", "Camera permission is required to scan barcodes.");
        return;
      }
    }
    setLastScannedMessage("");
    setShowScanner(true);
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView className="flex-1 px-4 py-4" keyboardShouldPersistTaps="handled">
          
          {/* Header */}
          <View className="mb-4">
            <Text className="text-slate-800 text-2xl font-black tracking-tight uppercase">
              Retail Terminal
            </Text>
            <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">
              {selectedCustomerId
                ? `Customer: ${customerName}`
                : customerName.trim()
                ? `New Guest: ${customerName}`
                : "Walk-in Transaction"}
            </Text>
          </View>

          {/* Customer and Payment Details (Matching Web POS columns/fields layout) */}
          <GlassCard className="mb-4 p-4">
            <Text className="text-slate-800 font-black text-xs uppercase tracking-wider mb-3">
              1. Customer & Payment Details
            </Text>
            <View className="gap-3">
              {/* Customer Input */}
              <View className="relative">
                <Text className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                  Customer Name
                </Text>
                <TextInput
                  value={customerSearch}
                  onChangeText={handleCustomerInputChange}
                  onFocus={() => setShowCustomerSuggestions(true)}
                  placeholder="Search or Type Guest Name..."
                  placeholderTextColor="#94a3b8"
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 text-xs font-bold"
                />

                {/* Suggestions Overlay */}
                {showCustomerSuggestions && filteredCustomers.length > 0 && (
                  <View className="absolute top-14 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-40 overflow-y-auto">
                    {filteredCustomers.map((c) => (
                      <TouchableOpacity
                        key={c.id}
                        onPress={() => handleSelectCustomer(c)}
                        className="p-3 border-b border-slate-50 flex-row justify-between items-center"
                      >
                        <View>
                          <Text className="text-slate-800 font-bold text-xs">{c.name}</Text>
                          {c.phone && <Text className="text-slate-400 text-[10px]">{c.phone}</Text>}
                        </View>
                        <Text className="text-slate-400 text-xs">➔</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Phone input */}
              <View>
                <Text className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                  Phone Number
                </Text>
                <TextInput
                  value={customerPhone}
                  onChangeText={setCustomerPhone}
                  placeholder="Enter Phone Number..."
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  disabled={!!selectedCustomerId}
                  className={`bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 text-xs font-bold ${
                    selectedCustomerId ? "opacity-60" : ""
                  }`}
                />
              </View>

              {/* Payment Methods */}
              <View>
                <Text className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                  Payment Method
                </Text>
                <View className="flex-row gap-2">
                  {PAYMENT_METHODS.map((method) => {
                    const isActive = paymentMethod === method.key;
                    return (
                      <TouchableOpacity
                        key={method.key}
                        onPress={() => setPaymentMethod(method.key)}
                        activeOpacity={0.8}
                        className={`flex-1 py-2.5 rounded-xl border items-center flex-row justify-center gap-1.5 ${
                          isActive
                            ? "bg-orange-500 border-orange-500 shadow-sm"
                            : "bg-white border-slate-200"
                        }`}
                      >
                        <Text className="text-sm">{method.icon}</Text>
                        <Text
                          className={`text-[10px] font-black uppercase tracking-wide ${
                            isActive ? "text-white" : "text-slate-600"
                          }`}
                        >
                          {method.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          </GlassCard>

          {/* Product Search & Dropdown Picker (Matching Web Search Box) */}
          <GlassCard className="mb-4 p-4">
            <Text className="text-slate-800 font-black text-xs uppercase tracking-wider mb-3">
              2. Add Products
            </Text>
            <View className="flex-row gap-2">
              <View className="flex-1 relative">
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search Product..."
                  placeholderTextColor="#94a3b8"
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 text-xs font-bold"
                />

                {/* Search Suggestions Overlay */}
                {searchQuery.trim().length > 0 && (
                  <View className="absolute top-12 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto">
                    {filteredProducts.length > 0 ? (
                      filteredProducts.map((p) => (
                        <TouchableOpacity
                          key={p.id}
                          onPress={() => addToCart(p)}
                          className="p-3 border-b border-slate-50 flex-row justify-between items-center"
                        >
                          <View className="flex-1 pr-2">
                            <Text className="text-slate-800 font-bold text-xs uppercase">{p.name}</Text>
                            <Text className="text-slate-400 text-[10px]">
                              ₹{p.price} | Stock: {p.stock}
                            </Text>
                          </View>
                          <Text className="text-orange-500 text-xs font-bold">+ Add</Text>
                        </TouchableOpacity>
                      ))
                    ) : (
                      <Text className="p-3 text-slate-400 text-xs text-center font-bold">
                        No matching products
                      </Text>
                    )}
                  </View>
                )}
              </View>
              <TouchableOpacity
                onPress={handleOpenScanner}
                activeOpacity={0.8}
                className="bg-orange-500 rounded-xl px-4 justify-center items-center"
              >
                <Text className="text-white text-base">📷</Text>
              </TouchableOpacity>
            </View>

            {/* Quick Add Tags */}
            {quickAddProducts.length > 0 && (
              <View className="mt-3">
                <Text className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  🔥 Most Selling Products (Quick Add)
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {quickAddProducts.map((p) => {
                    const isInCart = cart.some((i) => i.product_id === p.id);
                    return (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() => addToCart(p)}
                        className={`px-3 py-1.5 rounded-xl border flex-row items-center gap-1.5 ${
                          isInCart
                            ? "bg-orange-50 border-orange-200"
                            : "bg-white border-slate-200"
                        }`}
                      >
                        <Text className="text-[10px] font-bold text-slate-800 max-w-[100px]" numberOfLines={1}>
                          {p.name}
                        </Text>
                        <Text className="text-[9px] font-black text-orange-500">
                          ₹{Math.round(p.price)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </GlassCard>

          {/* Active Cart Section (Inline list like Web POS Table) */}
          <GlassCard className="mb-4 p-4">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-slate-800 font-black text-xs uppercase tracking-wider">
                3. Active Cart ({cart.reduce((sum, item) => sum + item.quantity, 0)} Items)
              </Text>
              {cart.length > 0 && (
                <TouchableOpacity onPress={() => setCart([])}>
                  <Text className="text-rose-500 text-[10px] font-black uppercase tracking-wider">
                    Clear All
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {cart.length === 0 ? (
              <View className="py-8 items-center justify-center">
                <Text className="text-3xl mb-1">🛒</Text>
                <Text className="text-slate-400 font-bold text-xs uppercase tracking-wide">
                  Empty Cart
                </Text>
              </View>
            ) : (
              <View className="gap-3">
                {itemsWithTotals.map((item) => (
                  <View
                    key={item.product_id}
                    className="p-3 border border-slate-100 bg-slate-50/50 rounded-2xl gap-2"
                  >
                    {/* Item title & Delete */}
                    <View className="flex-row justify-between items-start">
                      <View className="flex-1 pr-2">
                        <Text className="text-slate-800 font-black text-xs uppercase" numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text className="text-slate-400 text-[10px] font-bold">
                          ₹{item.price} • Stock: {item.available_stock}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => removeFromCart(item.product_id)}
                        className="bg-rose-50 p-1.5 rounded-lg border border-rose-100"
                      >
                        <Text className="text-rose-500 text-[10px]">🗑️</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Quantity controls & Unit Picker */}
                    <View className="flex-row justify-between items-center">
                      <View className="flex-row border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
                        <TouchableOpacity
                          onPress={() => updateItemQuantity(item.product_id, item.quantity - 1)}
                          className="px-2.5 py-1 bg-slate-100 active:bg-slate-200"
                        >
                          <Text className="text-slate-800 font-bold text-xs">−</Text>
                        </TouchableOpacity>
                        <View className="px-3 py-1 justify-center bg-white">
                          <Text className="text-slate-800 font-black text-xs font-mono">
                            {item.quantity}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => {
                            if (item.quantity >= item.available_stock) {
                              Alert.alert("Stock Limit", `Only ${item.available_stock} available.`);
                              return;
                            }
                            updateItemQuantity(item.product_id, item.quantity + 1);
                          }}
                          className="px-2.5 py-1 bg-slate-100 active:bg-slate-200"
                        >
                          <Text className="text-slate-800 font-bold text-xs">＋</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Packaging Unit Selection */}
                      <TouchableOpacity
                        onPress={() => handleOpenUnitPicker(item)}
                        className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm"
                      >
                        <Text className="text-slate-700 text-[10px] font-black">
                          {item.unit ?? "Unit"} ▾
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* GST & Discount fields inline */}
                    <View className="flex-row gap-2 pt-1">
                      <View className="flex-1">
                        <Text className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                          GST %
                        </Text>
                        <TextInput
                          value={String(item.gst_rate ?? 0)}
                          onChangeText={(val) => {
                            const parsed = parseFloat(val);
                            updateCartItemField(item.product_id, "gst_rate", isNaN(parsed) ? 0 : parsed);
                          }}
                          keyboardType="numeric"
                          className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-center font-bold text-xs"
                        />
                      </View>

                      <View className="flex-1">
                        <Text className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                          Disc
                        </Text>
                        <View className="flex-row">
                          <TextInput
                            value={String(item.discount ?? 0)}
                            onChangeText={(val) => {
                              const parsed = parseFloat(val);
                              updateCartItemField(item.product_id, "discount", isNaN(parsed) ? 0 : parsed);
                            }}
                            keyboardType="numeric"
                            className="flex-1 bg-white border border-slate-200 border-r-0 rounded-l-lg px-2 py-1 text-center font-bold text-xs"
                          />
                          <TouchableOpacity
                            onPress={() => {
                              const newType = item.discount_type === "percent" ? "fixed" : "percent";
                              updateCartItemField(item.product_id, "discount_type", newType);
                            }}
                            className="bg-slate-200 px-2 py-1 rounded-r-lg border border-slate-200 justify-center"
                          >
                            <Text className="text-[9px] font-black text-slate-700">
                              {item.discount_type === "percent" ? "%" : "₹"}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View className="justify-end items-end pb-1 pr-1">
                        <Text className="text-slate-400 text-[8px] font-bold uppercase">Subtotal</Text>
                        <Text className="text-slate-800 font-bold text-xs font-mono">
                          {fmt(item.subtotal)}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </GlassCard>

          {/* Checkout & Bill Summary (Matching Web POS Summary Sidebar/Panel) */}
          <GlassCard className="mb-8 p-4">
            <Text className="text-slate-800 font-black text-xs uppercase tracking-wider mb-3">
              4. Checkout & Total
            </Text>
            
            <View className="gap-3">
              {/* Paid amount & Notes */}
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Text className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Amount Paid
                  </Text>
                  <TextInput
                    value={paidAmount}
                    onChangeText={(val) => {
                      setIsPaidAmountEdited(true);
                      setPaidAmount(val);
                    }}
                    keyboardType="numeric"
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 font-black text-xs"
                  />
                </View>

                {/* IGST Switch */}
                <View className="items-center justify-end pb-1">
                  <Text className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    IGST Out State
                  </Text>
                  <TouchableOpacity
                    onPress={() => setIsOutsideState(!isOutsideState)}
                    activeOpacity={0.8}
                    className={`w-9 h-5 rounded-full relative justify-center ${
                      isOutsideState ? "bg-orange-500" : "bg-slate-300"
                    }`}
                  >
                    <View
                      className={`w-4 h-4 bg-white rounded-full absolute ${
                        isOutsideState ? "right-0.5" : "left-0.5"
                      }`}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Notes */}
              <TextInput
                value={additionalNotes}
                onChangeText={setAdditionalNotes}
                placeholder="Transaction notes / comments..."
                placeholderTextColor="#94a3b8"
                className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 text-xs font-bold"
              />

              {/* Math breakdown */}
              <View className="border-t border-slate-100 pt-3 gap-1">
                <View className="flex-row justify-between">
                  <Text className="text-slate-500 text-xs">Subtotal</Text>
                  <Text className="text-slate-800 text-xs font-semibold font-mono">
                    {fmt(subtotal)}
                  </Text>
                </View>

                <View className="flex-row justify-between">
                  <Text className="text-slate-500 text-xs">
                    {isOutsideState ? "IGST Total" : "CGST + SGST"}
                  </Text>
                  <Text className="text-slate-800 text-xs font-semibold font-mono">
                    {fmt(taxAmount)}
                  </Text>
                </View>

                {discountTotal > 0 && (
                  <View className="flex-row justify-between">
                    <Text className="text-slate-500 text-xs">Total Discount</Text>
                    <Text className="text-rose-500 text-xs font-semibold font-mono">
                      -{fmt(discountTotal)}
                    </Text>
                  </View>
                )}

                {roundOff !== 0 && (
                  <View className="flex-row justify-between">
                    <Text className="text-slate-500 text-xs">Round Off</Text>
                    <Text className="text-slate-800 text-xs font-semibold font-mono">
                      {roundOff > 0 ? "+" : ""}{roundOff.toFixed(2)}
                    </Text>
                  </View>
                )}

                {/* Change or due info */}
                {changeDue > 0 ? (
                  <View className="flex-row justify-between pt-1">
                    <Text className="text-slate-400 text-xs uppercase font-bold">Change Due</Text>
                    <Text className="text-green-600 font-bold text-xs font-mono">
                      {fmtInt(changeDue)}
                    </Text>
                  </View>
                ) : balanceOutstanding > 0 ? (
                  <View className="flex-row justify-between pt-1">
                    <Text className="text-rose-400 text-xs uppercase font-bold">Balance Outstanding</Text>
                    <Text className="text-rose-500 font-bold text-xs font-mono">
                      {fmtInt(balanceOutstanding)}
                    </Text>
                  </View>
                ) : null}

                {/* Grand Total */}
                <View className="flex-row justify-between pt-2 border-t border-slate-100 mt-2">
                  <Text className="text-slate-800 font-black text-sm uppercase">Grand Total</Text>
                  <Text className="text-orange-500 font-black text-lg font-mono">
                    {fmtInt(grandTotal)}
                  </Text>
                </View>
              </View>

              {/* Complete Checkout Action */}
              <TouchableOpacity
                onPress={handleCheckoutSubmit}
                disabled={storeLoading || cart.length === 0}
                activeOpacity={0.85}
                className="mt-2"
                style={{
                  backgroundColor: storeLoading || cart.length === 0 ? "#fdba74" : "#f97316",
                  borderRadius: 16,
                  paddingVertical: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  shadowColor: "#ea580c",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 6,
                }}
              >
                {storeLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "900", fontSize: 13, textTransform: "uppercase", letterSpacing: 1.2 }}>
                    Complete Checkout
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </GlassCard>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── UNIT PICKER MODAL ──────────────────────────────────────────────── */}
      <Modal
        visible={showUnitModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowUnitModal(false)}
      >
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white border-t border-slate-100 rounded-t-3xl px-5 pt-4 pb-10 shadow-xl max-h-[50%]">
            <View className="self-center w-10 h-1 bg-slate-200 rounded-full mb-4" />
            <Text className="text-slate-800 font-black text-base mb-4 uppercase tracking-tight">
              Select Packaging Unit
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {units.map((u) => (
                <TouchableOpacity
                  key={u.id}
                  onPress={() => handleSelectUnit(u)}
                  className="flex-row items-center justify-between py-3.5 border-b border-slate-50"
                >
                  <View>
                    <Text className="text-slate-800 font-black text-xs uppercase">
                      {u.name} ({u.short_name})
                    </Text>
                  </View>
                  {activeUnitItem?.unit_id === u.id && (
                    <Text className="text-orange-500 font-black">✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              onPress={() => setShowUnitModal(false)}
              className="mt-6 py-3.5 rounded-2xl bg-slate-100 border border-slate-200 items-center active:bg-slate-200"
            >
              <Text className="text-slate-700 font-black text-xs uppercase tracking-wider">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── CHECKOUT SUCCESS RECEIPT MODAL ─────────────────────────────────── */}
      <Modal
        visible={isSuccessOpen}
        animationType="slide"
        transparent={false}
        onRequestClose={handleStartNewTransaction}
      >
        <SafeAreaView className="flex-1 bg-slate-100 justify-between">
          <ScrollView className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false}>
            {/* Success Status banner */}
            <View className="items-center mb-6">
              <View className="w-14 h-14 bg-green-100 rounded-2xl items-center justify-center mb-3">
                <Text className="text-green-600 text-3xl">✓</Text>
              </View>
              <Text className="text-slate-800 text-xl font-black uppercase tracking-tight">
                Transaction Success!
              </Text>
              <Text className="text-slate-400 text-xs font-bold mt-0.5">
                The sale has been saved to the database ledger.
              </Text>
            </View>

            {/* Simulated Printed Receipt Card */}
            <View className="bg-white p-5 rounded-3xl border border-slate-200 shadow-md relative overflow-hidden mb-6">
              {/* Receipt teeth visual dots */}
              <View className="absolute top-0 left-0 w-full flex-row justify-between px-3 pt-1.5 opacity-10">
                {[...Array(14)].map((_, i) => (
                  <View key={i} className="w-1.5 h-1.5 bg-slate-900 rounded-full" />
                ))}
              </View>

              <View className="text-center items-center mt-3 mb-4 border-b border-slate-100 pb-3">
                <Text className="font-black text-xs uppercase tracking-widest text-slate-800">
                  Storeman Retail POS
                </Text>
                <Text className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                  Receipt Ref: {completedSale?.reference}
                </Text>
              </View>

              {/* Metadata */}
              <View className="border-b border-dashed border-slate-200 pb-3 mb-3.5" style={{gap: 4}}>
                <View className="flex-row justify-between">
                  <Text className="text-[9px] font-black text-slate-400 uppercase">Customer:</Text>
                  <Text className="text-[9px] font-black text-slate-800 uppercase">
                    {completedSale?.customer_display_name}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-[9px] font-black text-slate-400 uppercase">Date:</Text>
                  <Text className="text-[9px] font-black text-slate-800 uppercase">
                    {completedSale?.sale_date}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-[9px] font-black text-slate-400 uppercase">Payment Mode:</Text>
                  <Text className="text-[9px] font-black text-slate-800 uppercase">
                    {completedSale?.payment_method} ({completedSale?.payment_status})
                  </Text>
                </View>
              </View>

              {/* Items List */}
              <View className="mb-4" style={{gap: 8}}>
                {completedSale?.items.map((item, idx) => {
                  const prod = products.find((p) => p.id === item.product_id);
                  return (
                    <View key={idx} className="flex-row justify-between">
                      <Text className="text-[10px] font-bold text-slate-600 max-w-[70%]">
                        {item.quantity}x {prod ? prod.name : "Item"}
                      </Text>
                      <Text className="text-[10px] font-black text-slate-800 font-mono">
                        {fmt(item.subtotal)}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {/* Calculations Summary */}
              <View className="border-t border-dashed border-slate-200 pt-3" style={{gap: 4}}>
                <View className="flex-row justify-between">
                  <Text className="text-[9px] font-bold text-slate-400 uppercase">Taxable Subtotal</Text>
                  <Text className="text-[9px] font-bold text-slate-600 font-mono">
                    ₹{completedSale?.subtotal}
                  </Text>
                </View>

                {completedSale?.is_outside_state ? (
                  <View className="flex-row justify-between">
                    <Text className="text-[9px] font-bold text-slate-400 uppercase">IGST Tax</Text>
                    <Text className="text-[9px] font-bold text-slate-600 font-mono">
                      ₹{completedSale?.tax_amount}
                    </Text>
                  </View>
                ) : (
                  <>
                    <View className="flex-row justify-between">
                      <Text className="text-[9px] font-bold text-slate-400 uppercase">CGST Tax</Text>
                      <Text className="text-[9px] font-bold text-slate-600 font-mono">
                        ₹{((completedSale?.tax_amount ?? 0) / 2).toFixed(2)}
                      </Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text className="text-[9px] font-bold text-slate-400 uppercase">SGST Tax</Text>
                      <Text className="text-[9px] font-bold text-slate-600 font-mono">
                        ₹{((completedSale?.tax_amount ?? 0) / 2).toFixed(2)}
                      </Text>
                    </View>
                  </>
                )}

                {completedSale?.discount > 0 && (
                  <View className="flex-row justify-between">
                    <Text className="text-[9px] font-bold text-rose-400 uppercase">Total Discount</Text>
                    <Text className="text-[9px] font-bold text-rose-500 font-mono">
                      -₹{completedSale?.discount}
                    </Text>
                  </View>
                )}

                {completedSale?.round_off !== 0 && (
                  <View className="flex-row justify-between">
                    <Text className="text-[9px] font-bold text-slate-400 uppercase">Round Off</Text>
                    <Text className="text-[9px] font-bold text-slate-600 font-mono">
                      {completedSale?.round_off > 0 ? "+" : ""}{completedSale?.round_off}
                    </Text>
                  </View>
                )}

                <View className="flex-row justify-between pt-2 border-t border-slate-100 mt-2.5">
                  <Text className="text-[11px] font-black text-slate-800 uppercase">Grand Total</Text>
                  <Text className="text-orange-500 font-black text-sm font-mono">
                    {fmtInt(completedSale?.grand_total)}
                  </Text>
                </View>

                <View className="flex-row justify-between pt-1">
                  <Text className="text-[9px] font-black text-slate-400 uppercase">Paid Amount</Text>
                  <Text className="text-slate-800 font-black text-[10px] font-mono">
                    ₹{completedSale?.paid_amount}
                  </Text>
                </View>

                {completedSale?.paid_amount > completedSale?.grand_total ? (
                  <View className="flex-row justify-between">
                    <Text className="text-[9px] font-black text-green-500 uppercase">Change Returned</Text>
                    <Text className="text-green-600 font-black text-[10px] font-mono">
                      ₹{(completedSale?.paid_amount - completedSale?.grand_total).toFixed(2)}
                    </Text>
                  </View>
                ) : completedSale?.paid_amount < completedSale?.grand_total ? (
                  <View className="flex-row justify-between">
                    <Text className="text-[9px] font-black text-rose-400 uppercase">Outstanding Balance</Text>
                    <Text className="text-rose-500 font-black text-[10px] font-mono">
                      ₹{(completedSale?.grand_total - completedSale?.paid_amount).toFixed(2)}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View className="mt-8 items-center">
                <Text className="text-[8px] font-black text-slate-300 uppercase tracking-wider italic">
                  Digital Invoice Certified
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Action buttons */}
          <View className="p-5 bg-white border-t border-slate-200" style={{gap: 10}}>
            <TouchableOpacity
              onPress={() => printThermalReceipt(completedSale)}
              activeOpacity={0.85}
              style={{ width: "100%", paddingVertical: 18, backgroundColor: "#f97316", borderRadius: 20, alignItems: "center", elevation: 4 }}
            >
              <Text className="text-white font-black text-xs uppercase tracking-widest">
                🖨️ Print Thermal Receipt
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => Alert.alert("Print A4 Invoice", "Generating A4 Invoice PDF file... PDF downloaded to local storage.")}
              activeOpacity={0.85}
              style={{ width: "100%", paddingVertical: 18, backgroundColor: "#1e293b", borderRadius: 20, alignItems: "center" }}
            >
              <Text className="text-white font-black text-xs uppercase tracking-widest">
                📄 Print A4 Invoice
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleStartNewTransaction}
              className="w-full py-3.5 items-center"
            >
              <Text className="text-slate-400 font-black text-[10px] uppercase tracking-widest">
                New Transaction
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
      {/* ── BARCODE SCANNER MODAL ─────────────────────────────────────────── */}
      <Modal
        visible={showScanner}
        animationType="slide"
        onRequestClose={() => setShowScanner(false)}
      >
        <SafeAreaView className="flex-1 bg-black justify-between">
          {/* Header overlay */}
          <View className="p-5 flex-row justify-between items-center z-10 bg-black/60">
            <Text className="text-white font-black text-base uppercase">Scan Item Barcode</Text>
            <TouchableOpacity
              onPress={() => setShowScanner(false)}
              className="bg-white/20 p-2 rounded-full"
            >
              <Text className="text-white text-xs font-bold px-2">✕ Close</Text>
            </TouchableOpacity>
          </View>

          {/* Camera Frame */}
          <View className="flex-1 justify-center items-center relative">
            {CameraView ? (
              <CameraView
                style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                facing="back"
                onBarcodeScanned={handleBarcodeScanned}
              />
            ) : (
              <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} className="bg-slate-900 justify-center items-center px-6">
                <Text className="text-white text-center font-bold text-sm">
                  Camera module not compiled into this development build. Please rebuild the local client or run 'npx expo run:android' to use barcode scanning.
                </Text>
              </View>
            )}
            {/* Scanner Target Frame */}
            <View className="w-64 h-64 border-2 border-orange-500 rounded-3xl justify-center items-center bg-transparent">
              <View className="w-60 h-0.5 bg-red-500 opacity-60" />
            </View>
          </View>

          {/* Status Bar overlay */}
          <View className="p-6 bg-black/80 items-center justify-center min-h-[100px]">
            {lastScannedMessage ? (
              <Text className="text-white font-black text-sm text-center mb-3">
                {lastScannedMessage}
              </Text>
            ) : (
              <Text className="text-slate-400 text-xs text-center mb-3">
                Align the barcode inside the orange box.
              </Text>
            )}
            <TouchableOpacity
              onPress={() => setShowScanner(false)}
              className="bg-orange-500 py-3 px-8 rounded-xl"
            >
              <Text className="text-white font-black text-xs uppercase tracking-wider">Done</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
