/**
 * Purchase Screen – Purchase Terminal matching the web app's behaviour.
 * Similar to POS but for purchasing from suppliers.
 * Stock increases after purchase.
 */
import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  RefreshControl,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useMockStore } from "@/store/mockStore";
import { GlassCard, SkeletonLoader } from "@/components/ui";
import { printThermalReceipt } from "../../utils/printer";
import apiClient from "@/lib/api/client";
// Safely require expo-camera to prevent crash when native modules aren't compiled yet
let CameraView = null;
let useCameraPermissions = () => [null, () => { }];
try {
  const ExpoCamera = require("expo-camera");
  CameraView = ExpoCamera.CameraView;
  useCameraPermissions = ExpoCamera.useCameraPermissions;
} catch (e) {
  console.warn("expo-camera not loaded:", e);
}
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
const fmt = (val) =>
  `₹${Number(val || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const PAYMENT_METHODS = [
  { key: "Cash", label: "Cash", icon: "💵", activeBg: "#10b981", shadowColor: "#10b981" },
  { key: "Card", label: "Card", icon: "💳", activeBg: "#3b82f6", shadowColor: "#3b82f6" },
  { key: "UPI", label: "UPI", icon: "📱", activeBg: "#8b5cf6", shadowColor: "#8b5cf6" },
];

export default function PurchaseScreen() {
  const router = useRouter();
  const {
    products,
    suppliers,
    units,
    categories,
    recordPurchase,
    fetchProducts,
    fetchSuppliers,
    fetchUnits,
    isLoading: storeLoading,
    addProduct,
  } = useMockStore();

  const [permission, requestPermission] = useCameraPermissions();
  const insets = useSafeAreaInsets();

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchProducts(), fetchSuppliers(), fetchUnits()]);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchSuppliers();
    fetchUnits();
    apiClient.get('/store').then(res => {
      if (res.data && res.data.name) setStoreName(res.data.name);
    }).catch(() => {});
  }, []);

  // ── States ─────────────────────────────────────────────────────────────────
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [cart, setCart] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);
  const [supplierName, setSupplierName] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [paidAmount, setPaidAmount] = useState("");
  const [isPaidAmountEdited, setIsPaidAmountEdited] = useState(false);
  const [refNo, setRefNo] = useState("");
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState("");
  const [isSearchingInvoice, setIsSearchingInvoice] = useState(false);
  const [additionalNotes, setAdditionalNotes] = useState("");

  // Checkout Success Receipt Modal
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [completedPurchase, setCompletedPurchase] = useState(null);
  const [storeName, setStoreName] = useState("");

  // ── Scanner & Add Product States ───────────────────────────────────────────
  const [isScanning, setIsScanning] = useState(false);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState("");
  const [showScanQuantityModal, setShowScanQuantityModal] = useState(false);
  const [scannedProductForQty, setScannedProductForQty] = useState(null);
  const [scanQuantity, setScanQuantity] = useState("1");
  const [isTorchOn, setIsTorchOn] = useState(false);

  // Quick Add Form States
  const [fname, setFname] = useState("");
  const [fsku, setFsku] = useState("");
  const [fprice, setFprice] = useState("");
  const [fcost, setFcost] = useState("");
  const [fstock, setFstock] = useState("");
  const [quickAddErrors, setQuickAddErrors] = useState({});

  // ── Supplier Suggestions ───────────────────────────────────────────────────
  const filteredSuppliers = useMemo(() => {
    if (!supplierSearch.trim()) return [];
    const q = supplierSearch.toLowerCase();
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.phone && s.phone.includes(q))
    );
  }, [suppliers, supplierSearch]);

  const handleSelectSupplier = (supplier) => {
    setSelectedSupplierId(supplier.id);
    setSupplierName(supplier.name);
    setSupplierPhone(supplier.phone || "");
    setSupplierSearch(supplier.name);
    setShowSupplierSuggestions(false);
  };

  const handleSupplierInputChange = (text) => {
    setSupplierSearch(text);
    setSelectedSupplierId(null);
    setSupplierName(text);
    setShowSupplierSuggestions(true);
  };

  const handleSearchInvoice = async () => {
    if (!invoiceSearchQuery.trim()) return;
    setIsSearchingInvoice(true);
    try {
      const res = await apiClient.get(`/purchases/${invoiceSearchQuery.trim()}`);
      const purchase = res.data;
      if (purchase) {
        setCompletedPurchase({
          ...purchase,
          store_name: storeName, // Include store name
          supplier_display_name: purchase.supplier?.name || "Unknown",
        });
        setIsSuccessOpen(true);
      }
    } catch (e) {
      Alert.alert("Purchase Not Found", e.message);
    } finally {
      setIsSearchingInvoice(false);
      setInvoiceSearchQuery("");
    }
  };

  // ── Product Suggestions & Search ───────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    const filtered = products.filter((p) => {
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))
      );
    });
    console.log('Search Query:', searchQuery);
    console.log('Products Count:', products.length);
    console.log('Filtered Products Count:', filtered.length);
    return filtered;
  }, [products, searchQuery]);

  // Quick Add (Filtered by category, up to 24 products)
  const quickAddProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = selectedCategory === "All" || p.category === selectedCategory;
      return matchCat;
    }).slice(0, 24);
  }, [products, selectedCategory]);

  // ── Cart Operations ────────────────────────────────────────────────────────
  const addToCart = (product, qtyToAdd = 1) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product_id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + qtyToAdd }
            : item
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          name: product.name,
          cost: product.cost || product.price,
          quantity: qtyToAdd,
          gst_rate: product.gst || 0,
          discount: 0,
          discount_type: "fixed",
          unit: product.unit || "Unit",
          unit_id: product.unit_id || null,
        },
      ];
    });
    setSearchQuery("");
  };

  const updateItemQuantity = (id, qty) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((item) => item.product_id !== id));
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.product_id === id ? { ...item, quantity: qty } : item
      )
    );
  };

  const updateCartItemField = (id, field, value) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product_id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const removeFromCart = (id) => {
    setCart((prev) => prev.filter((item) => item.product_id !== id));
  };

  // ── Math Calculations ──────────────────────────────────────────────────────
  const {
    itemsWithTotals,
    subtotal,
    taxAmount,
    discountTotal,
    grandTotal,
  } = useMemo(() => {
    let sub = 0;
    let tax = 0;
    let disc = 0;

    const items = cart.map((item) => {
      const itemBaseTotal = item.cost * item.quantity;
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

    const finalGrandTotal = Math.max(0, sub + tax);

    return {
      itemsWithTotals: items,
      subtotal: sub,
      taxAmount: tax,
      discountTotal: disc,
      grandTotal: finalGrandTotal,
    };
  }, [cart]);

  // Sync paidAmount with grandTotal if user hasn't edited it manually
  useEffect(() => {
    if (!isPaidAmountEdited) {
      setPaidAmount(grandTotal.toString());
    }
  }, [grandTotal, isPaidAmountEdited]);

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

  // ── Scanner Handlers ───────────────────────────────────────────────────────
  const handleScanPress = async () => {
    if (!CameraView) {
      Alert.alert(
        "Scanner Unavailable",
        "Camera scanning requires a rebuilt development client. Please run a new development build to compile the camera modules."
      );
      return;
    }
    if (!permission?.granted) {
      const response = await requestPermission();
      if (!response.granted) {
        Alert.alert("Camera Permission Required", "Please grant camera access to scan barcodes.");
        return;
      }
    }
    setIsScanning(true);
  };

  const handleBarcodeScanned = (event) => {
    const { type, data, bounds } = event;

    // We removed the strict bounding box coordinate check here.
    // Device camera coordinates (especially on Android) don't always map 1:1 to screen layout coordinates,
    // which caused valid scans inside the box to be rejected. The scanner will now confidently grab the barcode as soon as it is clear!

    setIsScanning(false);

    // Check if product exists by barcode or SKU
    const scannedBarcode = String(data).trim();
    const existingProduct = products.find(p =>
      (p.barcode && String(p.barcode).trim() === scannedBarcode) ||
      (p.sku && String(p.sku).trim() === scannedBarcode)
    );

    if (existingProduct) {
      setScannedProductForQty(existingProduct);
      setScanQuantity("1");
      setShowScanQuantityModal(true);
    } else {
      // Direct to Quick Add Modal instead of native Alert
      setScannedBarcode(scannedBarcode);
      setFname(""); setFsku(""); setFprice(""); setFcost(""); setFstock("");
      setQuickAddErrors({});
      setShowQuickAddModal(true);
    }
  };

  const handleQuickAddProduct = () => {
    const errs = {};
    if (!fname.trim()) errs.name = "Name is required";
    if (!fsku.trim()) errs.sku = "SKU is required";
    if (!fprice || isNaN(+fprice)) errs.price = "Enter a valid price";
    if (!fstock || isNaN(+fstock)) errs.stock = "Enter a valid stock qty";

    if (Object.keys(errs).length) {
      setQuickAddErrors(errs);
      return;
    }

    const newProduct = {
      name: fname,
      sku: fsku,
      barcode: scannedBarcode,
      category: "General",
      price: Number(fprice),
      cost: fcost ? Number(fcost) : undefined,
      stock: parseInt(fstock, 10),
      low_stock_threshold: 5,
      image: null,
    };

    // Store the product (assuming mockStore addProduct handles IDs sync properly)
    addProduct(newProduct);

    // Add to cart with default values since mockStore addProduct doesn't return the full assigned ID synchronously, 
    // we generate a temp ID or re-fetch. Since addProduct is synchronous in mockStore, let's just add to cart using the details.
    // We will use a mock ID if needed, but since mockStore adds it locally, the products array will update soon.
    // We will just add it directly to cart.
    const productForCart = {
      id: Date.now().toString(), // temporary ID
      ...newProduct,
      unit: "Unit",
    };

    addToCart(productForCart);
    setShowQuickAddModal(false);
    Alert.alert("Product Added", `"${fname}" has been added to the system and your cart.`);
  };

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleCheckoutSubmit = async () => {
    if (cart.length === 0) {
      Alert.alert("Cart Empty", "Please add at least one item to checkout.");
      return;
    }

    if (!selectedSupplierId && !supplierName.trim()) {
      Alert.alert("Supplier Required", "Please select or enter a supplier name.");
      return;
    }

    const preparedItems = itemsWithTotals.map((item) => ({
      product_id: item.product_id,
      name: item.name, // Include name
      quantity: item.quantity,
      cost: item.cost,
      tax: item.tax_amount,
      tax_rate: item.gst_rate,
      discount: item.discount_amount,
      subtotal: item.subtotal,
    }));

    const purchasePayload = {
      supplier_id: selectedSupplierId,
      supplier_name: selectedSupplierId ? null : supplierName.trim(),
      purchase_date: new Date().toISOString().split("T")[0],
      items: preparedItems,
      subtotal: Number(subtotal.toFixed(2)),
      tax_amount: Number(taxAmount.toFixed(2)),
      discount: Number(discountTotal.toFixed(2)),
      grand_total: grandTotal,
      paid_amount: Number(paidAmount || 0),
      payment_method: paymentMethod,
      ref_no: refNo.trim(),
      notes: additionalNotes.trim() || "Purchase processed via Mobile App",
    };

    try {
      const response = await recordPurchase(purchasePayload);
      if (response && response.purchase) {
        setCompletedPurchase({
          ...purchasePayload,
          reference: response.purchase.reference,
          id: response.purchase.id,
          store_name: storeName, // Include store name
          supplier_display_name: selectedSupplierId
            ? (suppliers.find((s) => s.id === selectedSupplierId)?.name || "Supplier")
            : (supplierName.trim() || "New Supplier"),
        });

        // Reset state
        setCart([]);
        setAdditionalNotes("");
        setIsPaidAmountEdited(false);
        setSelectedSupplierId(null);
        setSupplierName("");
        setSupplierPhone("");
        setSupplierSearch("");
        setRefNo("");
        setIsSuccessOpen(true);
      }
    } catch (err) {
      Alert.alert("Checkout Failed", err?.response?.data?.message || err.message || "An error occurred.");
    }
  };

  const handleStartNewTransaction = () => {
    setIsSuccessOpen(false);
    setCompletedPurchase(null);
  };

  const handlePrintReceipt = () => {
    if (completedPurchase) {
      printThermalReceipt({
        ...completedPurchase,
        type: 'purchase',
        date: new Date().toLocaleString(),
      });
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={[]}>
      {/* Orange header with back button and stock button */}
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
            Purchase
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginTop: 1 }}>
            {selectedSupplierId ? `Supplier: ${supplierName}` : supplierName.trim() ? `New: ${supplierName}` : 'Purchase Terminal'}
          </Text>
        </View>

        {/* Spacer to balance the back button */}
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#f97316"]} />
          }
        >
          {/* Search by Purchase ID */}
          <GlassCard className="mb-4 p-4">
            <Text className="text-slate-800 font-black text-[10px] uppercase tracking-widest mb-3">Find & Re-print Purchase Invoice</Text>
            <View className="flex-row gap-2">
              <TextInput
                value={invoiceSearchQuery}
                onChangeText={setInvoiceSearchQuery}
                placeholder="Enter Purchase ID (e.g. PRCH-1)"
                className="flex-1 bg-white border-2 border-slate-100 rounded-xl px-4 py-2.5 text-slate-800 text-xs font-bold"
              />
              <TouchableOpacity
                onPress={handleSearchInvoice}
                disabled={isSearchingInvoice}
                className="bg-slate-800 px-5 rounded-xl items-center justify-center"
              >
                {isSearchingInvoice ? <ActivityIndicator size="small" color="#fff" /> : <Text className="text-white text-[10px] font-black uppercase">Find</Text>}
              </TouchableOpacity>
            </View>
          </GlassCard>

          {/* Shortcuts Banner */}
          <View className="mb-4 flex-row gap-2">
            <TouchableOpacity
              onPress={() => router.push('/inventory')}
              activeOpacity={0.8}
              className="flex-1 bg-white border border-slate-200 rounded-2xl p-3 flex-row items-center justify-between shadow-sm"
            >
              <View className="flex-row items-center gap-2.5">
                <View className="w-8 h-8 rounded-xl bg-orange-100 items-center justify-center">
                  <Ionicons name="cube-outline" size={16} color="#ea580c" />
                </View>
                <View>
                  <Text className="text-slate-800 text-[10px] font-black uppercase tracking-wider">Inventory</Text>
                  <Text className="text-slate-400 text-[9px] font-bold">Check stock</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={12} color="#94a3b8" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/returns/purchase')}
              activeOpacity={0.8}
              className="flex-1 bg-white border border-slate-200 rounded-2xl p-3 flex-row items-center justify-between shadow-sm"
            >
              <View className="flex-row items-center gap-2.5">
                <View className="w-8 h-8 rounded-xl bg-rose-100 items-center justify-center">
                  <Ionicons name="arrow-undo-outline" size={16} color="#e11d48" />
                </View>
                <View>
                  <Text className="text-slate-800 text-[10px] font-black uppercase tracking-wider">Return</Text>
                  <Text className="text-slate-400 text-[9px] font-bold">Return items</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={12} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* Product Search */}
          <GlassCard className="mb-5 p-5">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-slate-800 font-black text-sm uppercase tracking-wider">
                Add Products
              </Text>
            </View>
            <View className="flex-row gap-2 mb-4">
              <View className="flex-1 relative">
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search Product..."
                  placeholderTextColor="#94a3b8"
                  className="bg-white border-2 border-slate-200 rounded-2xl pl-4 pr-10 py-3.5 text-slate-800 text-sm font-bold focus:border-orange-400"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setSearchQuery("")}
                    className="absolute right-3 top-4"
                  >
                    <Ionicons name="close-circle" size={18} color="#cbd5e1" />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                onPress={handleScanPress}
                activeOpacity={0.8}
                className="bg-orange-500 rounded-2xl px-5 justify-center items-center shadow-lg"
              >
                <Ionicons name="camera-outline" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Categories & Quick Add Tags */}
            <View className="mt-2">
              <View className="flex-row items-center gap-1 mb-3">
                <Ionicons name="grid-outline" size={12} color="#f97316" />
                <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Categories
                </Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingRight: 20 }}
                className="mb-4"
              >
                <TouchableOpacity
                  onPress={() => setSelectedCategory("All")}
                  activeOpacity={0.8}
                  className={`px-3 py-1.5 rounded-full border ${
                    selectedCategory === "All"
                      ? "bg-orange-500 border-orange-500"
                      : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <Text
                    className={`text-[10px] font-black uppercase tracking-wider ${
                      selectedCategory === "All" ? "text-white" : "text-slate-500"
                    }`}
                  >
                    All
                  </Text>
                </TouchableOpacity>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setSelectedCategory(cat)}
                    activeOpacity={0.8}
                    className={`px-3 py-1.5 rounded-full border ${
                      selectedCategory === cat
                        ? "bg-orange-500 border-orange-500"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <Text
                      className={`text-[10px] font-black uppercase tracking-wider ${
                        selectedCategory === cat ? "text-white" : "text-slate-500"
                      }`}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View className="flex-row items-center gap-1 mb-3">
                <Ionicons name="flame" size={12} color="#f97316" />
                <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Products ({quickAddProducts.length})
                </Text>
              </View>

              {storeLoading ? (
                <View className="flex-row gap-2">
                  <SkeletonLoader height={36} width={100} className="rounded-xl" />
                  <SkeletonLoader height={36} width={120} className="rounded-xl" />
                  <SkeletonLoader height={36} width={90} className="rounded-xl" />
                  <SkeletonLoader height={36} width={110} className="rounded-xl" />
                </View>
              ) : quickAddProducts.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingRight: 20 }}
                >
                  {quickAddProducts.map((p) => {
                    const isInCart = cart.some((i) => i.product_id === p.id);
                    return (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() => addToCart(p)}
                        className={`px-4 py-2.5 rounded-xl border-2 flex-row items-center gap-2 ${
                          isInCart ? "bg-orange-50 border-orange-300" : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <Text className="text-xs font-bold text-slate-800 max-w-[120px]" numberOfLines={1}>
                          {p.name}
                        </Text>
                        <Text className="text-xs font-black text-orange-500">
                          ₹{Math.round(p.cost || p.price)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : (
                <Text className="text-slate-400 text-[10px] italic font-bold ml-1">
                  No products in this category
                </Text>
              )}
            </View>
          </GlassCard>

          {/* Active Cart Section */}
          <GlassCard className="mb-5 p-5">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-slate-800 font-black text-sm uppercase tracking-wider">
                Purchase Cart ({cart.reduce((sum, item) => sum + item.quantity, 0)} Items)
              </Text>
              {cart.length > 0 && (
                <TouchableOpacity onPress={() => setCart([])}>
                  <Text className="text-rose-500 text-xs font-black uppercase tracking-wider">
                    Clear All
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {cart.length === 0 ? (
              <View className="py-12 items-center justify-center">
                <Text className="text-5xl mb-3">📦</Text>
                <Text className="text-slate-400 font-bold text-sm uppercase tracking-wide">
                  Empty Cart
                </Text>
                <Text className="text-slate-300 text-xs mt-1">
                  Add products to create purchase
                </Text>
              </View>
            ) : (
              <ScrollView
                style={{ maxHeight: 350 }}
                contentContainerStyle={{ gap: 12, paddingBottom: 10 }}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
              >
                {itemsWithTotals.map((item) => (
                  <View
                    key={item.product_id}
                    className="p-4 border-2 border-slate-100 bg-white rounded-2xl gap-3 shadow-sm"
                  >
                    {/* Item title & Delete */}
                    <View className="flex-row justify-between items-start">
                      <View className="flex-1 pr-3">
                        <Text className="text-slate-800 font-black text-sm uppercase" numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text className="text-slate-400 text-xs font-bold">
                          Cost: ₹{item.cost}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => removeFromCart(item.product_id)}
                        className="bg-rose-50 p-2 rounded-xl border-2 border-rose-200"
                      >
                        <Text className="text-rose-500 text-sm">🗑️</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Quantity controls */}
                    <View className="flex-row justify-between items-center">
                      <View className="flex-row border-2 border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                        <TouchableOpacity
                          onPress={() => updateItemQuantity(item.product_id, item.quantity - 1)}
                          className="px-4 py-2 bg-slate-100 active:bg-slate-200"
                        >
                          <Text className="text-slate-800 font-bold text-sm">−</Text>
                        </TouchableOpacity>
                        <View className="px-4 py-2 justify-center bg-white">
                          <Text className="text-slate-800 font-black text-sm font-mono">
                            {item.quantity}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => updateItemQuantity(item.product_id, item.quantity + 1)}
                          className="px-4 py-2 bg-slate-100 active:bg-slate-200"
                        >
                          <Text className="text-slate-800 font-bold text-sm">＋</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Cost input */}
                      <View className="flex-1 ml-3">
                        <Text className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                          Cost/Unit
                        </Text>
                        <TextInput
                          value={String(item.cost)}
                          onChangeText={(val) => {
                            const parsed = parseFloat(val);
                            updateCartItemField(item.product_id, "cost", isNaN(parsed) ? 0 : parsed);
                          }}
                          keyboardType="numeric"
                          className="bg-white border-2 border-slate-200 rounded-xl px-3 py-2 font-bold text-sm"
                        />
                      </View>
                    </View>

                    {/* GST & Discount fields inline */}
                    <View className="flex-row gap-3 pt-2">
                      <View className="flex-1">
                        <Text className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                          GST %
                        </Text>
                        <TextInput
                          value={String(item.gst_rate ?? 0)}
                          onChangeText={(val) => {
                            const parsed = parseFloat(val);
                            updateCartItemField(item.product_id, "gst_rate", isNaN(parsed) ? 0 : parsed);
                          }}
                          keyboardType="numeric"
                          className="bg-white border-2 border-slate-200 rounded-xl px-3 py-2 text-center font-bold text-sm"
                        />
                      </View>

                      <View className="flex-1">
                        <Text className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
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
                            className="flex-1 bg-white border-2 border-slate-200 border-r-0 rounded-l-xl px-3 py-2 text-center font-bold text-sm"
                          />
                          <TouchableOpacity
                            onPress={() => {
                              const newType = item.discount_type === "percent" ? "fixed" : "percent";
                              updateCartItemField(item.product_id, "discount_type", newType);
                            }}
                            className="bg-slate-200 px-3 py-2 rounded-r-xl border-2 border-l-0 border-slate-200 justify-center"
                          >
                            <Text className="text-xs font-black text-slate-700">
                              {item.discount_type === "percent" ? "%" : "₹"}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View className="justify-end items-end pb-1 pr-1">
                        <Text className="text-slate-400 text-[10px] font-bold uppercase">Subtotal</Text>
                        <Text className="text-slate-800 font-bold text-sm font-mono">
                          {fmt(item.subtotal)}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </GlassCard>

          {cart.length > 0 && (
            <GlassCard className="mb-5 p-5">
              <Text className="text-slate-800 font-black text-sm uppercase tracking-wider mb-4">
                Supplier & Payment Details
              </Text>
              <View className="gap-3">
                {/* Supplier Input */}
                <View className="relative">
                  <Text className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2 ml-1">
                    Supplier Name *
                  </Text>
                  <TextInput
                    value={supplierSearch}
                    onChangeText={handleSupplierInputChange}
                    onFocus={() => setShowSupplierSuggestions(true)}
                    placeholder="Search or Type Supplier Name..."
                    placeholderTextColor="#94a3b8"
                    className="bg-white border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm font-bold focus:border-orange-400"
                  />

                  {/* Suggestions Overlay */}
                  {showSupplierSuggestions && filteredSuppliers.length > 0 && (
                    <View className="absolute top-14 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-40 overflow-y-auto">
                      {filteredSuppliers.map((s) => (
                        <TouchableOpacity
                          key={s.id}
                          onPress={() => handleSelectSupplier(s)}
                          className="p-3 border-b border-slate-50 flex-row justify-between items-center"
                        >
                          <View>
                            <Text className="text-slate-800 font-bold text-xs">{s.name}</Text>
                            {s.phone && <Text className="text-slate-400 text-[10px]">{s.phone}</Text>}
                          </View>
                          <Text className="text-slate-400 text-xs">➔</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {/* Reference Number */}
                <View>
                  <Text className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2 ml-1">
                    Reference No (Optional)
                  </Text>
                  <TextInput
                    value={refNo}
                    onChangeText={setRefNo}
                    placeholder="Enter Invoice/Reference Number..."
                    placeholderTextColor="#94a3b8"
                    className="bg-white border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm font-bold focus:border-orange-400"
                  />
                </View>

                {/* Payment Methods – Segmented Switcher */}
                <View>
                  <Text className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2 ml-1">
                    Payment Method
                  </Text>
                  <View style={{
                    flexDirection: 'row',
                    backgroundColor: '#f1f5f9',
                    borderRadius: 16,
                    padding: 5,
                    borderWidth: 1,
                    borderColor: '#e2e8f0',
                  }}>
                    {PAYMENT_METHODS.map((method) => {
                      const isActive = paymentMethod === method.key;
                      return (
                        <TouchableOpacity
                          key={method.key}
                          onPress={() => setPaymentMethod(method.key)}
                          activeOpacity={0.8}
                          style={[{
                            flex: 1,
                            paddingVertical: 12,
                            borderRadius: 12,
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexDirection: 'row',
                            gap: 6,
                          }, isActive && {
                            backgroundColor: method.activeBg,
                            shadowColor: method.shadowColor,
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.25,
                            shadowRadius: 6,
                            elevation: 4,
                          }]}
                        >
                          <Text style={{ fontSize: 14 }}>{method.icon}</Text>
                          <Text style={{
                            fontSize: 11,
                            fontWeight: '900',
                            textTransform: 'uppercase',
                            letterSpacing: 0.5,
                            color: isActive ? '#fff' : '#64748b',
                          }}>{method.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>
            </GlassCard>
          )}


          {/* Checkout & Bill Summary */}
          {cart.length > 0 && (
            <GlassCard className="mb-8 p-5">
              <Text className="text-slate-800 font-black text-sm uppercase tracking-wider mb-4">
                Checkout & Total
              </Text>

              <View className="gap-4">
                {/* Summary */}
                <View className="bg-slate-50 rounded-xl p-4 gap-2">
                  <View className="flex-row justify-between">
                    <Text className="text-slate-600 text-xs font-bold">Subtotal</Text>
                    <Text className="text-slate-800 text-xs font-black">{fmt(subtotal)}</Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-slate-600 text-xs font-bold">Tax</Text>
                    <Text className="text-slate-800 text-xs font-black">{fmt(taxAmount)}</Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-slate-600 text-xs font-bold">Discount</Text>
                    <Text className="text-green-600 text-xs font-black">-{fmt(discountTotal)}</Text>
                  </View>
                  <View className="border-t border-slate-200 pt-2 mt-2">
                    <View className="flex-row justify-between">
                      <Text className="text-slate-800 text-sm font-black">Grand Total</Text>
                      <Text className="text-orange-500 text-lg font-black">{fmt(grandTotal)}</Text>
                    </View>
                  </View>
                </View>

                {/* Paid amount */}
                <View>
                  <Text className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2">
                    Amount Paid
                  </Text>
                  <TextInput
                    value={paidAmount}
                    onChangeText={(val) => {
                      setIsPaidAmountEdited(true);
                      setPaidAmount(val);
                    }}
                    keyboardType="numeric"
                    className="bg-white border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 font-black text-sm focus:border-orange-400"
                  />
                </View>

                {/* Balance */}
                {balanceOutstanding > 0 && (
                  <View className="flex-row justify-between items-center bg-amber-50 rounded-xl p-3 border border-amber-200">
                    <Text className="text-amber-800 text-xs font-bold">Balance Due</Text>
                    <Text className="text-amber-800 text-sm font-black">{fmt(balanceOutstanding)}</Text>
                  </View>
                )}

                {/* Notes */}
                <View>
                  <Text className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2">
                    Notes (Optional)
                  </Text>
                  <TextInput
                    value={additionalNotes}
                    onChangeText={setAdditionalNotes}
                    placeholder="Add any notes..."
                    placeholderTextColor="#94a3b8"
                    className="bg-white border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm focus:border-orange-400"
                    multiline
                    numberOfLines={2}
                  />
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                  onPress={handleCheckoutSubmit}
                  activeOpacity={0.8}
                  className="bg-orange-500 rounded-2xl py-4 shadow-lg"
                >
                  <Text className="text-white text-center text-sm font-black uppercase tracking-wider">
                    Complete Purchase
                  </Text>
                </TouchableOpacity>
              </View>
            </GlassCard>
          )}
        </ScrollView>
      {/* Floating Scanner FAB */}
      <TouchableOpacity
        onPress={handleScanPress}
        activeOpacity={0.8}
        style={{
          position: 'absolute',
          bottom: 24,
          right: 20,
          backgroundColor: '#f97316',
          borderRadius: 28,
          width: 56,
          height: 56,
          justifyContent: 'center',
          alignItems: 'center',
          shadowColor: '#ea580c',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 6,
          elevation: 6,
          zIndex: 999,
        }}
      >
        <Ionicons name="scan-outline" size={24} color="#fff" />
      </TouchableOpacity>
      </KeyboardAvoidingView>

      {/* Product Search Suggestions Modal */}
      <Modal
        visible={searchQuery.trim().length > 0}
        transparent={true}
        animationType="none"
        onRequestClose={() => setSearchQuery("")}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setSearchQuery("")}
          className="flex-1 bg-black/30"
        >
          <View className="mt-24 mx-4 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
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
                      Cost: ₹{p.cost || p.price} | Stock: {p.stock}
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
        </TouchableOpacity>
      </Modal>

      {/* Success Modal */}
      {isSuccessOpen && completedPurchase && (
        <View className="absolute inset-0 bg-black/50 justify-center items-center p-6 z-50">
          <View className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <View className="items-center mb-6">
              <Text className="text-6xl mb-4">✅</Text>
              <Text className="text-slate-800 text-2xl font-black text-center uppercase">
                Purchase Complete!
              </Text>
              <Text className="text-slate-500 text-sm font-bold text-center mt-2">
                {completedPurchase.reference}
              </Text>
            </View>

            <View className="bg-slate-50 rounded-xl p-4 mb-4 gap-2">
              <View className="flex-row justify-between">
                <Text className="text-slate-600 text-xs font-bold">Supplier</Text>
                <Text className="text-slate-800 text-xs font-black">{completedPurchase.supplier_display_name}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-slate-600 text-xs font-bold">Total</Text>
                <Text className="text-orange-500 text-sm font-black">{fmt(completedPurchase.grand_total)}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-slate-600 text-xs font-bold">Paid</Text>
                <Text className="text-slate-800 text-xs font-black">{fmt(completedPurchase.paid_amount)}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-slate-600 text-xs font-bold">Status</Text>
                <Text className="text-green-600 text-xs font-black uppercase">{paymentStatus}</Text>
              </View>
            </View>

            <View className="gap-3">
              <TouchableOpacity
                onPress={handlePrintReceipt}
                activeOpacity={0.8}
                className="bg-slate-800 rounded-2xl py-3.5"
              >
                <Text className="text-white text-center text-xs font-black uppercase tracking-wider">
                  🖨️ Print Receipt
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleStartNewTransaction}
                activeOpacity={0.8}
                className="bg-orange-500 rounded-2xl py-3.5"
              >
                <Text className="text-white text-center text-xs font-black uppercase tracking-wider">
                  New Purchase
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ── BARCODE SCANNER MODAL ─────────────────────────────────────────── */}
      <Modal
        visible={isScanning}
        animationType="slide"
        onRequestClose={() => setIsScanning(false)}
      >
        <SafeAreaView className="flex-1 bg-black justify-between">
          {/* Header overlay */}
          <View className="p-6 flex-row justify-between items-center z-10 bg-black/60">
            <Text className="text-white font-black text-lg uppercase">Scan Item Barcode</Text>
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setIsTorchOn(!isTorchOn)}
                className={`p-3 rounded-full ${isTorchOn ? 'bg-orange-500' : 'bg-white/20'}`}
              >
                <Text className="text-white text-sm font-bold px-3">
                  {isTorchOn ? "🔦 Off" : "🔦 On"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setIsScanning(false)}
                className="bg-white/20 p-3 rounded-full"
              >
                <Text className="text-white text-sm font-bold px-3">✕ Close</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Camera Frame */}
          <View className="flex-1 justify-center items-center relative">
            {CameraView ? (
              <CameraView
                style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                facing="back"
                enableTorch={isTorchOn}
                barcodeScannerSettings={{
                  barcodeTypes: ["qr", "ean13", "ean8", "upc_a", "upc_e", "code128", "code39"],
                }}
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
            <View className="w-80 h-48 border-2 border-orange-500 rounded-3xl justify-center items-center bg-transparent">
              <View className="w-72 h-0.5 bg-red-500 opacity-60" />
            </View>
          </View>

          {/* Status Bar overlay */}
          <View className="p-8 bg-black/80 items-center justify-center min-h-[120px]">
            <Text className="text-slate-400 text-sm text-center mb-4">
              Align the barcode inside the orange box.
            </Text>
            <TouchableOpacity
              onPress={() => setIsScanning(false)}
              className="bg-orange-500 py-4 px-10 rounded-2xl shadow-lg"
            >
              <Text className="text-white font-black text-sm uppercase tracking-wider">Done</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Quick Add Product Modal */}
      <Modal
        visible={showQuickAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowQuickAddModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-5 shadow-2xl max-h-[85%]">
            <View className="self-center w-12 h-1.5 bg-slate-200 rounded-full mb-6" />

            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-slate-800 font-black text-lg uppercase tracking-tight">
                Add Scanned Product
              </Text>
              <TouchableOpacity onPress={() => setShowQuickAddModal(false)}>
                <Text className="text-slate-400 font-bold text-lg">✕</Text>
              </TouchableOpacity>
            </View>

            <View className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-4">
              <Text className="text-orange-800 font-bold text-xs uppercase tracking-wider mb-1">
                ⚠️ Product Not Found
              </Text>
              <Text className="text-orange-700 text-[10px] font-bold">
                Barcode {scannedBarcode} is new. Enter details below to add it.
              </Text>
            </View>

            <KeyboardAwareScrollView
              keyboardShouldPersistTaps="handled"
              enableOnAndroid={true}
              extraScrollHeight={100}
              contentContainerStyle={{ paddingBottom: 50 }}
            >
              <View className="gap-4">
                <View>
                  <Text className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                    Product Name *
                  </Text>
                  <TextInput
                    value={fname}
                    onChangeText={setFname}
                    placeholder="e.g. Water Bottle 1L"
                    className={`bg-slate-50 border-2 rounded-xl px-4 py-3 text-slate-800 font-bold ${quickAddErrors.name ? "border-rose-300" : "border-slate-200"}`}
                  />
                  {quickAddErrors.name && <Text className="text-rose-500 text-xs mt-1 ml-1">{quickAddErrors.name}</Text>}
                </View>

                <View>
                  <Text className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                    SKU *
                  </Text>
                  <TextInput
                    value={fsku}
                    onChangeText={setFsku}
                    placeholder="e.g. WAT-BOT-1L"
                    className={`bg-slate-50 border-2 rounded-xl px-4 py-3 text-slate-800 font-bold ${quickAddErrors.sku ? "border-rose-300" : "border-slate-200"}`}
                  />
                  {quickAddErrors.sku && <Text className="text-rose-500 text-xs mt-1 ml-1">{quickAddErrors.sku}</Text>}
                </View>

                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Text className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                      Sell Price ₹ *
                    </Text>
                    <TextInput
                      value={fprice}
                      onChangeText={setFprice}
                      keyboardType="numeric"
                      placeholder="0.00"
                      className={`bg-slate-50 border-2 rounded-xl px-4 py-3 text-slate-800 font-bold ${quickAddErrors.price ? "border-rose-300" : "border-slate-200"}`}
                    />
                    {quickAddErrors.price && <Text className="text-rose-500 text-xs mt-1 ml-1">{quickAddErrors.price}</Text>}
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                      Cost ₹
                    </Text>
                    <TextInput
                      value={fcost}
                      onChangeText={setFcost}
                      keyboardType="numeric"
                      placeholder="0.00"
                      className="bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-bold"
                    />
                  </View>
                </View>


              </View>

              <TouchableOpacity
                onPress={handleQuickAddProduct}
                className="bg-orange-500 py-4 rounded-2xl mt-6 shadow-lg shadow-orange-500/30"
              >
                <Text className="text-white text-center font-black uppercase tracking-wider">
                  Save & Add to Cart
                </Text>
              </TouchableOpacity>
              <View className="h-6" />
            </KeyboardAwareScrollView>
          </View>
        </View>
      </Modal>

      {/* Scan Quantity Modal */}
      <Modal
        visible={showScanQuantityModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowScanQuantityModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1 bg-black/50 justify-center items-center p-6"
        >
          <View className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <View className="flex-row justify-between items-center mb-5">
              <Text className="text-slate-800 font-black text-lg uppercase tracking-tight">
                Add to Cart
              </Text>
              <TouchableOpacity onPress={() => setShowScanQuantityModal(false)}>
                <Text className="text-slate-400 font-bold text-lg">✕</Text>
              </TouchableOpacity>
            </View>

            <Text className="text-slate-600 font-bold text-sm mb-4" numberOfLines={2}>
              {scannedProductForQty?.name}
            </Text>

            <View className="mb-6">
              <Text className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">
                Quantity
              </Text>
              <View className="flex-row items-center justify-between border-2 border-slate-200 rounded-2xl p-2 bg-slate-50">
                <TouchableOpacity
                  onPress={() => setScanQuantity(String(Math.max(1, parseInt(scanQuantity || 0) - 1)))}
                  className="bg-white px-4 py-3 rounded-xl shadow-sm border border-slate-200"
                >
                  <Text className="text-slate-800 font-black text-lg">−</Text>
                </TouchableOpacity>

                <TextInput
                  value={scanQuantity}
                  onChangeText={setScanQuantity}
                  keyboardType="numeric"
                  className="flex-1 text-center font-black text-xl text-slate-800"
                  selectTextOnFocus
                />

                <TouchableOpacity
                  onPress={() => setScanQuantity(String(parseInt(scanQuantity || 0) + 1))}
                  className="bg-white px-4 py-3 rounded-xl shadow-sm border border-slate-200"
                >
                  <Text className="text-slate-800 font-black text-lg">＋</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View className="gap-3">
              <TouchableOpacity
                onPress={() => {
                  const qty = parseInt(scanQuantity, 10);
                  if (!isNaN(qty) && qty > 0) {
                    addToCart(scannedProductForQty, qty);
                    setShowScanQuantityModal(false);
                  } else {
                    Alert.alert("Invalid Quantity", "Please enter a valid quantity greater than 0.");
                  }
                }}
                className="bg-orange-500 py-4 rounded-2xl shadow-lg shadow-orange-500/30"
              >
                <Text className="text-white text-center font-black uppercase tracking-wider">
                  Add to Cart
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  const qty = parseInt(scanQuantity, 10);
                  if (!isNaN(qty) && qty > 0) {
                    addToCart(scannedProductForQty, qty);
                    setShowScanQuantityModal(false);
                    setTimeout(() => setIsScanning(true), 400); // Wait for modal to close
                  } else {
                    Alert.alert("Invalid Quantity", "Please enter a valid quantity greater than 0.");
                  }
                }}
                className="bg-slate-800 py-4 rounded-2xl shadow-lg"
              >
                <Text className="text-white text-center font-black uppercase tracking-wider">
                  Add & Scan Again 📷
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
