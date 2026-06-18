/**
 * POS Screen – Point of Sale Terminal matching the web app's behaviour.
 * Slate-50 background, white cards, high-contrast typography,
 * modern interactive inputs, and vibrant orange/green status accents.
 * Unified single-screen layout with inline cart list (no tabs).
 */
import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Alert,
  Dimensions,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, Redirect } from "expo-router";
import { useAuthStore } from "@/store/authStore";
import { useMockStore } from "@/store/mockStore";
import { GlassCard, SkeletonLoader } from "@/components/ui";
import { printThermalReceipt } from "../../utils/printer";
import apiClient from "@/lib/api/client";
import { Ionicons } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

// Safely require expo-camera to prevent crash when native modules aren't compiled yet
let CameraView = null;
let useCameraPermissions = () => [null, () => { }];

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
  { key: "Cash", label: "Cash", iconName: "cash-outline", activeBg: "#10b981", shadowColor: "#10b981" },
  { key: "Card", label: "Card", iconName: "card-outline", activeBg: "#3b82f6", shadowColor: "#3b82f6" },
  { key: "UPI", label: "UPI", iconName: "phone-portrait-outline", activeBg: "#8b5cf6", shadowColor: "#8b5cf6" },
];

export default function POSScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);

  if (!user?.permissions?.includes('sale.create')) {
    return <Redirect href="/(tabs)" />;
  }
  const {
    products,
    customers,
    units,
    categories,
    recordSale,
    fetchProducts,
    fetchCustomers,
    isLoading: storeLoading,
  } = useMockStore();

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchProducts(), fetchCustomers()]);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchCustomers();
    apiClient.get('/store').then(res => {
      if (res.data && res.data.name) setStoreName(res.data.name);
    }).catch(() => {});
  }, []);

  // ── States ─────────────────────────────────────────────────────────────────
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [cart, setCart] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState("");
  const [isSearchingInvoice, setIsSearchingInvoice] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [payableAmount, setPayableAmount] = useState("");
  const [isPayableAmountEdited, setIsPayableAmountEdited] = useState(false);
  const [paidAmount, setPaidAmount] = useState("");
  const [isPaidAmountEdited, setIsPaidAmountEdited] = useState(false);
  const [isOutsideState, setIsOutsideState] = useState(false);
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split("T")[0]);

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

  const [showScanQuantityModal, setShowScanQuantityModal] = useState(false);
  const [scannedProductForQty, setScannedProductForQty] = useState(null);
  const [scanQuantity, setScanQuantity] = useState("1");
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [storeName, setStoreName] = useState("");

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

  const handleSearchInvoice = async () => {
    if (!invoiceSearchQuery.trim()) return;
    setIsSearchingInvoice(true);
    try {
      const res = await apiClient.get(`/sales/${invoiceSearchQuery.trim()}`);
      const sale = res.data;
      if (sale) {
        setCompletedSale({
          ...sale,
          store_name: storeName, // Include store name
          customer_display_name: sale.customer?.name || "Walk-in Customer",
        });
        setIsSuccessOpen(true);
      }
    } catch (e) {
      Alert.alert("Invoice Not Found", e.message);
    } finally {
      setIsSearchingInvoice(false);
      setInvoiceSearchQuery("");
    }
  };

  // ── Product Suggestions & Search ───────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 3) return [];
    const q = searchQuery.toLowerCase().trim();
    return products.filter((p) => {
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))
      );
    }).slice(0, 3);
  }, [products, searchQuery]);

  // Quick Add (Filtered by category, up to 24 available products in stock)
  const quickAddProducts = useMemo(() => {
    return products.filter((p) => {
      const matchStock = p.stock > 0;
      const matchCat = selectedCategory === "All" || p.category === selectedCategory;
      return matchStock && matchCat;
    }).slice(0, 24);
  }, [products, selectedCategory]);

  // ── Cart Operations ────────────────────────────────────────────────────────
  const addToCart = useCallback((product, qtyToAdd = 1) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product_id === product.id);
      if (existing) {
        let newBaseQuantity = existing.quantity + qtyToAdd;
        if (existing.unit_id == product.secondary_unit_id) {
            newBaseQuantity = (existing.quantity + qtyToAdd) * (product.conversion_rate || 1);
        }
        if (newBaseQuantity > product.stock) {
          Alert.alert("Stock Limit Reached", `Only ${product.stock} units available.`);
          return prev;
        }
        return prev.map((item) =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + qtyToAdd, base_quantity: newBaseQuantity }
            : item
        );
      }
      if (qtyToAdd > product.stock) {
        Alert.alert("Stock Limit Reached", `Only ${product.stock} units available.`);
        return prev;
      }
      return [
        ...prev,
        {
          product_id: product.id,
          product: product,
          name: product.name,
          price: product.price,
          quantity: qtyToAdd,
          base_quantity: qtyToAdd,
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
    if (qty !== "" && Number(qty) < 0) {
      return;
    }
    if (qty === 0) {
      setCart((prev) => prev.filter((item) => item.product_id !== id));
      return;
    }
    setCart((prev) =>
      prev.map((item) => {
        if (item.product_id === id) {
          let newBaseQuantity = qty;
          if (item.unit_id == item.product.secondary_unit_id) {
              newBaseQuantity = qty * (item.product.conversion_rate || 1);
          }
          return { ...item, quantity: qty, base_quantity: newBaseQuantity };
        }
        return item;
      })
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

  // Sync payableAmount with grandTotal if user hasn't edited it manually
  useEffect(() => {
    if (!isPayableAmountEdited) {
      setPayableAmount(grandTotal.toString());
    }
  }, [grandTotal, isPayableAmountEdited]);

  // Sync paidAmount with payableAmount if user hasn't edited it manually
  useEffect(() => {
    if (!isPaidAmountEdited) {
      setPaidAmount(payableAmount.toString());
    }
  }, [payableAmount, isPaidAmountEdited]);

  const effectivePayableAmount = useMemo(() => {
    return Number(payableAmount || 0);
  }, [payableAmount]);

  const changeDue = useMemo(() => {
    const paid = Number(paidAmount || 0);
    return Math.max(0, paid - effectivePayableAmount);
  }, [paidAmount, effectivePayableAmount]);

  const balanceOutstanding = useMemo(() => {
    const paid = Number(paidAmount || 0);
    return Math.max(0, effectivePayableAmount - paid);
  }, [paidAmount, effectivePayableAmount]);

  const paymentStatus = useMemo(() => {
    const paid = Number(paidAmount || 0);
    if (paid === 0) return "Unpaid";
    if (paid < effectivePayableAmount) return "Partial";
    return "Paid";
  }, [paidAmount, effectivePayableAmount]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleOpenUnitPicker = (item) => {
    setActiveUnitItem(item);
    setShowUnitModal(true);
  };

  const handleSelectUnit = (unit) => {
    if (activeUnitItem && activeUnitItem.product) {
      const product = activeUnitItem.product;
      let newPrice = product.price;
      let newBaseQuantity = activeUnitItem.quantity;
      
      if (unit.id == product.secondary_unit_id) {
          if (product.secondary_selling_price) {
              newPrice = product.secondary_selling_price;
          } else {
              newPrice = newPrice * (product.conversion_rate || 1);
          }
          newBaseQuantity = activeUnitItem.quantity * (product.conversion_rate || 1);
      }
      
      setCart((prev) =>
        prev.map((item) =>
          item.product_id === activeUnitItem.product_id
            ? {
                ...item,
                unit_id: unit.id,
                unit: unit.short_name || unit.name,
                price: newPrice,
                base_quantity: newBaseQuantity
              }
            : item
        )
      );
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

    // Check stock levels and valid quantities
    for (const item of cart) {
      if (!item.quantity || Number(item.quantity) <= 0) {
        Alert.alert("Invalid Quantity", `Please enter a valid quantity for "${item.name}".`);
        return;
      }
      const liveProduct = products.find((p) => p.id === item.product_id);
      if (!liveProduct || liveProduct.stock < item.base_quantity) {
        Alert.alert(
          "Insufficient Stock",
          `"${item.name}" has only ${liveProduct?.stock || 0} base units left in warehouse.`
        );
        return;
      }
    }

    const preparedItems = itemsWithTotals.map((item) => ({
      product_id: item.product_id,
      name: item.name, // Include name for printing
      unit_id: item.unit_id,
      quantity: item.quantity,
      base_quantity: item.base_quantity || item.quantity,
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
      sale_date: saleDate,
      items: preparedItems,
      subtotal: Number(subtotal.toFixed(2)),
      tax: 0,
      tax_amount: Number(taxAmount.toFixed(2)),
      discount: Number(discountTotal.toFixed(2)),
      grand_total: grandTotal,
      payable_amount: effectivePayableAmount,
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
          store_name: storeName, // Include store name for printing
          customer_display_name: selectedCustomerId
            ? (customers.find((c) => c.id === selectedCustomerId)?.name || "Client")
            : (customerName.trim() || "Walk-in Customer"),
        });

        // Reset state
        setCart([]);
        setAdditionalNotes("");
        setSaleDate(new Date().toISOString().split("T")[0]);
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

  // ── A4 Invoice PDF Generator ──────────────────────────────────────────────
  const handleDownloadA4Invoice = async (sale) => {
    if (!sale) return;

    const sName = sale.store_name || "StoreManage";
    const ref = sale.reference || sale.id || "N/A";
    const saleDate = sale.sale_date || new Date().toISOString().split("T")[0];
    const customer = sale.customer_display_name || "Walk-in Customer";
    const payMethod = sale.payment_method || "Cash";
    const payStatus = sale.payment_status || "Paid";
    const isOutside = !!sale.is_outside_state;

    const subtotalVal = Number(sale.subtotal || 0);
    const taxAmountVal = Number(sale.tax_amount || 0);
    const discountVal = Number(sale.discount || 0);
    const grandTotalVal = Number(sale.grand_total || 0);
    const paidAmountVal = Number(sale.paid_amount || 0);
    const roundOffVal = Number(sale.round_off || 0);

    const itemRows = (sale.items || []).map((item, idx) => {
      const prod = products.find((p) => p.id === item.product_id);
      const name = item.name || prod?.name || `Item ${idx + 1}`;
      const qty = Number(item.quantity || 0);
      const price = Number(item.price || 0);
      const taxRate = Number(item.tax_rate || 0);
      const discount = Number(item.discount || 0);
      const subtotal = Number(item.subtotal || 0);
      const taxAmt = Number(item.tax || 0);
      const taxLabel = isOutside
        ? `IGST ${taxRate}%`
        : `CGST ${taxRate / 2}% + SGST ${taxRate / 2}%`;

      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${name}</td>
          <td style="text-align:center">${qty}</td>
          <td style="text-align:right">₹${price.toFixed(2)}</td>
          <td style="text-align:center">${discount > 0 ? `₹${discount.toFixed(2)}` : "—"}</td>
          <td style="text-align:center;font-size:10px">${taxRate > 0 ? taxLabel : "—"}</td>
          <td style="text-align:right;color:#f97316;font-weight:700">₹${subtotal.toFixed(2)}</td>
        </tr>`;
    }).join("");

    const cgst = isOutside ? 0 : taxAmountVal / 2;
    const sgst = isOutside ? 0 : taxAmountVal / 2;
    const igst = isOutside ? taxAmountVal : 0;

    const taxBreakdown = isOutside
      ? `<div class="tax-row"><span>IGST:</span><span>₹${igst.toFixed(2)}</span></div>`
      : `<div class="tax-row"><span>CGST:</span><span>₹${cgst.toFixed(2)}</span></div>
         <div class="tax-row"><span>SGST:</span><span>₹${sgst.toFixed(2)}</span></div>`;

    const balanceDue = Math.max(0, grandTotalVal - paidAmountVal);
    const changeReturned = Math.max(0, paidAmountVal - grandTotalVal);

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invoice ${ref}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #fff; color: #1e293b; font-size: 13px; padding: 32px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; border-bottom: 3px solid #f97316; padding-bottom: 24px; }
    .brand-name { font-size: 28px; font-weight: 900; color: #f97316; letter-spacing: -1px; }
    .brand-sub { font-size: 11px; color: #64748b; font-weight: 600; margin-top: 2px; }
    .invoice-badge { background: #f97316; color: #fff; padding: 8px 20px; border-radius: 8px; text-align: right; }
    .invoice-badge .label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; opacity: 0.85; }
    .invoice-badge .ref { font-size: 18px; font-weight: 900; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 28px; }
    .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 18px; }
    .meta-box .title { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #94a3b8; letter-spacing: 1px; margin-bottom: 6px; }
    .meta-box .value { font-size: 14px; font-weight: 700; color: #1e293b; }
    .meta-box .sub { font-size: 11px; color: #64748b; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    thead th { background: #1e293b; color: #fff; padding: 10px 12px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
    thead th:first-child { border-radius: 8px 0 0 0; }
    thead th:last-child { border-radius: 0 8px 0 0; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    tbody td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 12px; vertical-align: middle; }
    .totals-section { display: flex; justify-content: flex-end; }
    .totals-box { width: 320px; }
    .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; color: #475569; border-bottom: 1px solid #f1f5f9; }
    .totals-row span:last-child { font-weight: 700; }
    .tax-row { display: flex; justify-content: space-between; padding: 4px 0 4px 16px; font-size: 11px; color: #64748b; }
    .grand-total-row { display: flex; justify-content: space-between; padding: 12px 0 8px; font-size: 16px; font-weight: 900; color: #f97316; border-top: 2px solid #f97316; margin-top: 4px; }
    .paid-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; color: #16a34a; font-weight: 700; }
    .balance-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; color: #ef4444; font-weight: 700; }
    .status-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
    .badge-paid { background: #dcfce7; color: #16a34a; }
    .badge-partial { background: #fef3c7; color: #d97706; }
    .badge-unpaid { background: #fee2e2; color: #dc2626; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; }
    .footer strong { color: #f97316; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand-name">${sName}</div>
      <div class="brand-sub">GST Tax Invoice</div>
    </div>
    <div class="invoice-badge">
      <div class="label">Invoice</div>
      <div class="ref">${ref}</div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-box">
      <div class="title">Bill To</div>
      <div class="value">${customer}</div>
    </div>
    <div class="meta-box">
      <div class="title">Invoice Details</div>
      <div class="value">${saleDate}</div>
      <div class="sub">Payment: ${payMethod} &nbsp;|&nbsp; <span class="status-badge badge-${payStatus.toLowerCase()}">${payStatus}</span></div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Item Description</th>
        <th style="text-align:center">Qty</th>
        <th style="text-align:right">Rate</th>
        <th style="text-align:center">Discount</th>
        <th style="text-align:center">Tax</th>
        <th style="text-align:right">Amount</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="totals-section">
    <div class="totals-box">
      <div class="totals-row"><span>Taxable Subtotal</span><span>₹${subtotalVal.toFixed(2)}</span></div>
      ${taxBreakdown}
      ${discountVal > 0 ? `<div class="totals-row" style="color:#ef4444"><span>Discount</span><span>-₹${discountVal.toFixed(2)}</span></div>` : ""}
      ${Math.abs(roundOffVal) > 0 ? `<div class="totals-row"><span>Round Off</span><span>${roundOffVal > 0 ? '+' : ''}₹${roundOffVal.toFixed(2)}</span></div>` : ""}
      <div class="grand-total-row"><span>GRAND TOTAL</span><span>₹${grandTotalVal.toFixed(2)}</span></div>
      <div class="paid-row"><span>Amount Paid</span><span>₹${paidAmountVal.toFixed(2)}</span></div>
      ${changeReturned > 0 ? `<div class="paid-row"><span>Change Returned</span><span>₹${changeReturned.toFixed(2)}</span></div>` : ""}
      ${balanceDue > 0 ? `<div class="balance-row"><span>Balance Due</span><span>₹${balanceDue.toFixed(2)}</span></div>` : ""}
    </div>
  </div>

  <div class="footer">
    Thank you for your business! &mdash; Powered by <strong>StoreManage by Fillosoft</strong>
  </div>
</body>
</html>`;

    try {
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: `Invoice ${ref}`,
          UTI: "com.adobe.pdf",
        });
      } else {
        Alert.alert("Saved", `Invoice saved to: ${uri}`);
      }
    } catch (err) {
      Alert.alert("Error", "Failed to generate invoice PDF. " + (err?.message || ""));
    }
  };

  const handleStartNewTransaction = () => {
    setIsSuccessOpen(false);
    setCompletedSale(null);
  };

  const handleBarcodeScanned = useCallback((event) => {
    const { data, bounds } = event;
    if (scannedLock.current) return;

    // We removed the strict bounding box coordinate check here.
    // Device camera coordinates (especially on Android) don't always map 1:1 to screen layout coordinates,
    // which caused valid scans inside the box to be rejected. The scanner will now confidently grab the barcode as soon as it is clear!

    scannedLock.current = true;
    setTimeout(() => {
      scannedLock.current = false;
    }, 5000);

    const matched = products.find(
      (p) =>
        (p.barcode && String(p.barcode).trim() === String(data).trim()) ||
        (p.sku && String(p.sku).trim() === String(data).trim())
    );

    if (matched) {
      if (matched.stock <= 0) {
        setLastScannedMessage(`⚠️ ${matched.name} is out of stock`);
      } else {
        setShowScanner(false);
        setScannedProductForQty(matched);
        setScanQuantity("1");
        setShowScanQuantityModal(true);
        setLastScannedMessage("");
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
    <SafeAreaView className="flex-1 bg-slate-50" edges={[]}>
      {/* Orange header with back button */}
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
            Sell
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginTop: 1 }}>
            {selectedCustomerId ? `Customer: ${customerName}` : customerName.trim() ? `Guest: ${customerName}` : 'Retail Terminal'}
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

          {/* Search by Invoice ID */}
          <GlassCard className="mb-4 p-4">
            <Text className="text-slate-800 font-black text-[10px] uppercase tracking-widest mb-3">Find & Re-print Invoice</Text>
            <View className="flex-row gap-2">
              <TextInput
                value={invoiceSearchQuery}
                onChangeText={setInvoiceSearchQuery}
                placeholder="Enter Invoice ID (e.g. SALE-1)"
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

          {/* Process Sales Return Banner */}
          <TouchableOpacity
            onPress={() => router.push('/returns/sales')}
            activeOpacity={0.8}
            className="bg-orange-50 border border-orange-200 rounded-2xl p-3 mb-4 flex-row items-center justify-between"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-8 h-8 rounded-full bg-orange-100 items-center justify-center">
                <Ionicons name="arrow-undo-outline" size={16} color="#f97316" />
              </View>
              <View>
                <Text className="text-slate-800 font-black text-xs uppercase tracking-wider">Process Sales Return</Text>
                <Text className="text-slate-500 text-[10px]">Return items sold to customers</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#f97316" />
          </TouchableOpacity>


          {/* Product Search & Dropdown Picker (Matching Web Search Box) */}
          <GlassCard className="mb-5 p-5">
            <Text className="text-slate-800 font-black text-sm uppercase tracking-wider mb-4">
              Add Products
            </Text>
            <View className="flex-row gap-3">
              <View className="flex-1 relative">
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search Product..."
                  placeholderTextColor="#94a3b8"
                  className="bg-white border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm font-bold focus:border-orange-400"
                />

                {/* Search Suggestions Overlay */}
                {searchQuery.trim().length >= 3 && (
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
                className="bg-orange-500 rounded-2xl px-5 justify-center items-center shadow-lg"
              >
                <Ionicons name="camera-outline" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
 
            {/* Categories & Quick Add Tags */}
            <View className="mt-5">
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
                          ₹{Math.round(p.price)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : (
                <Text className="text-slate-400 text-[10px] italic font-bold ml-1">
                  No in-stock products in this category
                </Text>
              )}
            </View>
          </GlassCard>

          {/* Active Cart Section */}
          {cart.length > 0 && (
            <GlassCard className="mb-5 p-4">
              <View className="flex-row justify-between items-center mb-3">
                <Text className="text-slate-800 font-black text-sm uppercase tracking-wider">
                  Cart ({cart.reduce((sum, item) => sum + item.quantity, 0)})
                </Text>
                <TouchableOpacity onPress={() => setCart([])}>
                  <Text className="text-rose-500 text-[10px] font-black uppercase tracking-widest bg-rose-50 px-2 py-1 rounded">
                    Clear
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={{ gap: 10 }}>
                {itemsWithTotals.map((item) => (
                  <View
                    key={item.product_id}
                    className="p-3 border-2 border-slate-100 bg-slate-50 rounded-2xl gap-3"
                  >
                    <View className="flex-row justify-between items-start">
                      <View className="flex-1 pr-3">
                        <Text className="text-slate-800 font-bold text-sm uppercase" numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text className="text-slate-400 text-[10px] font-bold">
                          ₹{item.price} • Stock: {item.available_stock} 
                        </Text>
                      </View>
                      <View className="items-end gap-1">
                        <Text className="text-orange-500 font-black text-sm font-mono">
                          {fmt(item.subtotal)}
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleOpenUnitPicker(item)}
                          className="bg-slate-200 px-2 py-0.5 rounded flex-row items-center gap-1"
                        >
                          <Text className="text-slate-700 text-[9px] font-black uppercase">
                            {item.unit ?? "Unit"}
                          </Text>
                          <Ionicons name="caret-down" size={10} color="#334155" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View className="flex-row justify-between items-center">
                      {/* Quantity Picker */}
                      <View className="flex-row items-center border border-slate-200 rounded-lg overflow-hidden bg-white">
                        <TouchableOpacity
                          onPress={() => updateItemQuantity(item.product_id, item.quantity - 1)}
                          className="px-3 py-1.5 bg-slate-100 active:bg-slate-200"
                        >
                          <Text className="text-slate-800 font-bold text-sm">−</Text>
                        </TouchableOpacity>
                        <View className="px-1 py-1 justify-center bg-white min-w-[40px]">
                          <TextInput
                            value={item.quantity === "" ? "" : String(item.quantity)}
                            onChangeText={(val) => {
                              if (val === "") {
                                updateItemQuantity(item.product_id, "");
                                return;
                              }
                              const parsed = parseInt(val, 10);
                              if (!isNaN(parsed)) {
                                if (parsed > item.available_stock) {
                                  Alert.alert("Stock Limit", `Only ${item.available_stock} available.`);
                                  return;
                                }
                                updateItemQuantity(item.product_id, parsed);
                              }
                            }}
                            keyboardType="numeric"
                            className="text-slate-800 font-black text-xs text-center py-1 m-0 font-mono"
                          />
                        </View>
                        <TouchableOpacity
                          onPress={() => {
                            if (item.quantity >= item.available_stock) {
                              Alert.alert("Stock Limit", `Only ${item.available_stock} available.`);
                              return;
                            }
                            updateItemQuantity(item.product_id, item.quantity + 1);
                          }}
                          className="px-3 py-1.5 bg-slate-100 active:bg-slate-200"
                        >
                          <Text className="text-slate-800 font-bold text-sm">＋</Text>
                        </TouchableOpacity>
                      </View>

                      {/* GST and Disc condensed inline */}
                      <View className="flex-row gap-2">
                        <View className="flex-row items-center border border-slate-200 bg-white rounded-lg px-2">
                          <Text className="text-[9px] font-bold text-slate-400 mr-1">GST%</Text>
                          <TextInput
                            value={String(item.gst_rate ?? 0)}
                            onChangeText={(val) => {
                              const parsed = parseFloat(val);
                              updateCartItemField(item.product_id, "gst_rate", isNaN(parsed) ? 0 : parsed);
                            }}
                            keyboardType="numeric"
                            className="w-8 text-center text-xs font-bold text-slate-700 py-1"
                          />
                        </View>
                        <View className="flex-row items-center border border-slate-200 bg-white rounded-lg px-2">
                          <Text className="text-[9px] font-bold text-slate-400 mr-1">Disc</Text>
                          <TextInput
                            value={String(item.discount ?? 0)}
                            onChangeText={(val) => {
                              const parsed = parseFloat(val);
                              updateCartItemField(item.product_id, "discount", isNaN(parsed) ? 0 : parsed);
                            }}
                            keyboardType="numeric"
                            className="w-10 text-center text-xs font-bold text-slate-700 py-1"
                          />
                        </View>
                        <TouchableOpacity
                            onPress={() => removeFromCart(item.product_id)}
                            className="bg-rose-50 px-2.5 py-1.5 rounded-lg border border-rose-100 justify-center"
                          >
                            <Ionicons name="trash-outline" size={14} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </GlassCard>
          )}
          {/* Customer and Payment Details (Matching Web POS columns/fields layout) */}
          {cart.length > 0 && (
            <GlassCard className="mb-5 p-5">
              <Text className="text-slate-800 font-black text-sm uppercase tracking-wider mb-4">
                Customer & Payment Details
              </Text>
              <View className="gap-3">
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
                          <Ionicons name={method.iconName} size={16} color={isActive ? '#fff' : '#64748b'} />
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

                {/* Customer Info - Only shown when taking on Credit (Partial Payment) */}
                {(grandTotal > 0 && Number(paidAmount || 0) < grandTotal) && (
                  <>
                    {/* Customer Input */}
                    <View className="relative mt-2">
                      <Text className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2 ml-1">
                        Customer Name
                      </Text>
                      <TextInput
                        value={customerSearch}
                        onChangeText={handleCustomerInputChange}
                        onFocus={() => setShowCustomerSuggestions(true)}
                        placeholder="Search or Type Guest Name..."
                        placeholderTextColor="#94a3b8"
                        className="bg-white border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm font-bold focus:border-orange-400"
                      />

                      {/* Suggestions Overlay */}
                      {showCustomerSuggestions && filteredCustomers.length > 0 && (
                        <View className="absolute top-20 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-40 overflow-y-auto">
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
                      <Text className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2 ml-1">
                        Phone Number *
                      </Text>
                      <TextInput
                        value={customerPhone}
                        onChangeText={setCustomerPhone}
                        placeholder="Enter Phone Number..."
                        placeholderTextColor="#94a3b8"
                        keyboardType="numeric"
                        disabled={!!selectedCustomerId}
                        className={`bg-white border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm font-bold focus:border-orange-400 ${selectedCustomerId ? "opacity-60 bg-slate-100" : ""
                          }`}
                      />
                    </View>
                  </>
                )}
              </View>
            </GlassCard>
          )}
        </ScrollView>
      {/* Floating Scanner FAB */}
      <TouchableOpacity
        onPress={handleOpenScanner}
        activeOpacity={0.8}
        style={{
          position: 'absolute',
          bottom: cart.length > 0 ? 100 : 24,
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

      {/* Fixed Bottom Checkout Bar */}
      {cart.length > 0 && (
        <View style={{
          padding: 16,
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#e2e8f0',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
          elevation: 10,
          paddingBottom: insets.bottom > 0 ? insets.bottom + 10 : 16,
        }} className="flex-row items-center justify-between z-40">
          <View>
            <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Grand Total</Text>
            <Text className="text-2xl font-black text-slate-800 font-mono tracking-tight">{fmtInt(grandTotal)}</Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowCheckoutModal(true)}
            activeOpacity={0.8}
            className="bg-orange-500 flex-row items-center justify-center px-6 py-4 rounded-2xl shadow-lg shadow-orange-500/40"
          >
            <Text className="text-white font-black text-sm uppercase tracking-widest mr-2">Checkout</Text>
            <Ionicons name="arrow-forward" size={14} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

 
      {/* ── CHECKOUT MODAL (Math & Submit) ─────────────────────────────────── */}
      <Modal visible={showCheckoutModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-white rounded-t-3xl pt-6 px-6 pb-10 max-h-[90%]">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-black text-slate-800 uppercase tracking-tight">Final Checkout</Text>
              <TouchableOpacity onPress={() => setShowCheckoutModal(false)} className="w-8 h-8 bg-slate-100 rounded-full items-center justify-center">
                <Ionicons name="close" size={16} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <View className="gap-5">
                {/* Math breakdown */}
                <View className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                  <View className="flex-row justify-between mb-2">
                    <Text className="text-slate-500 text-xs font-bold uppercase">Subtotal</Text>
                    <Text className="text-slate-800 text-sm font-bold font-mono">{fmt(subtotal)}</Text>
                  </View>
                  <View className="flex-row justify-between mb-2 items-center">
                    <Text className="text-slate-500 text-xs font-bold uppercase">{isOutsideState ? "IGST Total" : "CGST + SGST"}</Text>
                    <View className="flex-row items-center gap-2">
                      <TouchableOpacity onPress={() => setIsOutsideState(!isOutsideState)} className="bg-white border border-slate-200 px-2 py-1 rounded">
                        <Text className="text-[9px] font-bold text-slate-500 uppercase">{isOutsideState ? "To Intrastate" : "To Interstate"}</Text>
                      </TouchableOpacity>
                      <Text className="text-slate-800 text-sm font-bold font-mono">{fmt(taxAmount)}</Text>
                    </View>
                  </View>
                  {discountTotal > 0 && (
                    <View className="flex-row justify-between mb-2">
                      <Text className="text-slate-500 text-xs font-bold uppercase">Total Discount</Text>
                      <Text className="text-rose-500 text-sm font-bold font-mono">-{fmt(discountTotal)}</Text>
                    </View>
                  )}
                  {roundOff !== 0 && (
                    <View className="flex-row justify-between mb-2">
                      <Text className="text-slate-500 text-xs font-bold uppercase">Round Off</Text>
                      <Text className="text-slate-800 text-sm font-bold font-mono">{roundOff > 0 ? "+" : ""}{roundOff.toFixed(2)}</Text>
                    </View>
                  )}
                  <View className="flex-row justify-between pt-3 mt-1 border-t border-slate-200">
                    <Text className="text-slate-800 font-black text-sm uppercase">Grand Total</Text>
                    <Text className="text-orange-500 font-black text-lg font-mono">{fmtInt(grandTotal)}</Text>
                  </View>
                </View>

                {/* Amounts Input */}
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Payable Amount</Text>
                    <TextInput
                      value={payableAmount}
                      onChangeText={(val) => { setIsPayableAmountEdited(true); setPayableAmount(val); }}
                      keyboardType="numeric"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-black text-sm"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Amount Paid</Text>
                    <TextInput
                      value={paidAmount}
                      onChangeText={(val) => { setIsPaidAmountEdited(true); setPaidAmount(val); }}
                      keyboardType="numeric"
                      className="bg-slate-50 border border-orange-200 rounded-xl px-4 py-3 text-orange-600 font-black text-sm bg-orange-50/50"
                    />
                  </View>
                </View>

                {/* Change or due info */}
                {changeDue > 0 ? (
                  <View className="flex-row justify-between items-center bg-green-50 px-4 py-3 rounded-xl border border-green-100">
                    <Text className="text-green-600 text-xs uppercase font-black tracking-wider">Return Change</Text>
                    <Text className="text-green-600 font-black text-lg font-mono">{fmtInt(changeDue)}</Text>
                  </View>
                ) : balanceOutstanding > 0 ? (
                  <View className="flex-row justify-between items-center bg-rose-50 px-4 py-3 rounded-xl border border-rose-100">
                    <Text className="text-rose-600 text-xs uppercase font-black tracking-wider">Balance Due</Text>
                    <Text className="text-rose-600 font-black text-lg font-mono">{fmtInt(balanceOutstanding)}</Text>
                  </View>
                ) : null}

                {/* Date & Notes */}
                <View className="flex-row gap-3">
                  <View className="flex-[0.4]">
                    <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Sale Date</Text>
                    <TextInput
                      value={saleDate}
                      onChangeText={setSaleDate}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#94a3b8"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm font-bold"
                    />
                  </View>
                  <View className="flex-[0.6]">
                    <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Notes</Text>
                    <TextInput
                      value={additionalNotes}
                      onChangeText={setAdditionalNotes}
                      placeholder="Optional notes..."
                      placeholderTextColor="#94a3b8"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm font-bold"
                    />
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => { setShowCheckoutModal(false); handleCheckoutSubmit(); }}
                  disabled={storeLoading || cart.length === 0}
                  activeOpacity={0.85}
                  className="mt-2"
                  style={{
                    backgroundColor: storeLoading || cart.length === 0 ? "#fdba74" : "#f97316",
                    borderRadius: 20,
                    paddingVertical: 18,
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "row",
                    shadowColor: "#ea580c",
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.4,
                    shadowRadius: 12,
                    elevation: 8,
                  }}
                >
                  {storeLoading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={{ color: "#fff", fontWeight: "900", fontSize: 15, textTransform: "uppercase", letterSpacing: 1.5 }}>
                      Confirm & Submit
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── UNIT PICKER MODAL ──────────────────────────────────────────────── */}
      <Modal
        visible={showUnitModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowUnitModal(false)}
      >
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white border-t-2 border-slate-100 rounded-t-3xl px-6 pt-5 pb-10 shadow-2xl max-h-[50%]">
            <View className="self-center w-12 h-1.5 bg-slate-200 rounded-full mb-5" />
            <Text className="text-slate-800 font-black text-lg mb-5 uppercase tracking-tight">
              Select Packaging Unit
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {units.map((u) => (
                <TouchableOpacity
                  key={u.id}
                  onPress={() => handleSelectUnit(u)}
                  className="flex-row items-center justify-between py-4 border-b border-slate-50 active:bg-slate-50"
                >
                  <View>
                    <Text className="text-slate-800 font-black text-sm uppercase">
                      {u.name} ({u.short_name})
                    </Text>
                  </View>
                  {activeUnitItem?.unit_id === u.id && (
                    <Ionicons name="checkmark-circle" size={20} color="#f97316" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              onPress={() => setShowUnitModal(false)}
              className="mt-6 py-4 rounded-2xl bg-slate-100 border-2 border-slate-200 items-center active:bg-slate-200"
            >
              <Text className="text-slate-700 font-black text-sm uppercase tracking-wider">Cancel</Text>
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
          <ScrollView className="flex-1 px-6 pt-8" showsVerticalScrollIndicator={false}>
            {/* Success Status banner */}
            <View className="items-center mb-8">
              <View className="w-20 h-20 bg-green-100 rounded-3xl items-center justify-center mb-4 shadow-lg">
                <Ionicons name="checkmark-circle-outline" size={44} color="#16a34a" />
              </View>
              <Text className="text-slate-800 text-2xl font-black uppercase tracking-tight">
                Transaction Success!
              </Text>
              <Text className="text-slate-400 text-sm font-bold mt-2">
                The sale has been saved to the database ledger.
              </Text>
            </View>

            {/* Simulated Printed Receipt Card */}
            <View className="bg-white p-6 rounded-3xl border-2 border-slate-200 shadow-lg relative overflow-hidden mb-8">
              {/* Receipt teeth visual dots */}
              <View className="absolute top-0 left-0 w-full flex-row justify-between px-4 pt-2 opacity-10">
                {[...Array(16)].map((_, i) => (
                  <View key={i} className="w-2 h-2 bg-slate-900 rounded-full" />
                ))}
              </View>

              <View className="text-center items-center mt-4 mb-5 border-b-2 border-slate-100 pb-4">
                <Text className="font-black text-sm uppercase tracking-widest text-slate-800">
                  Storeman Retail POS
                </Text>
                <Text className="text-xs text-slate-400 font-bold uppercase mt-1">
                  Receipt Ref: {completedSale?.reference}
                </Text>
              </View>

              {/* Metadata */}
              <View className="border-b-2 border-dashed border-slate-200 pb-4 mb-4" style={{ gap: 5 }}>
                <View className="flex-row justify-between">
                  <Text className="text-xs font-black text-slate-400 uppercase">Customer:</Text>
                  <Text className="text-xs font-black text-slate-800 uppercase">
                    {completedSale?.customer_display_name}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-xs font-black text-slate-400 uppercase">Date:</Text>
                  <Text className="text-xs font-black text-slate-800 uppercase">
                    {completedSale?.sale_date}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-xs font-black text-slate-400 uppercase">Payment Mode:</Text>
                  <Text className="text-xs font-black text-slate-800 uppercase">
                    {completedSale?.payment_method} ({completedSale?.payment_status})
                  </Text>
                </View>
              </View>

              {/* Items List */}
              <View className="mb-5" style={{ gap: 10 }}>
                {completedSale?.items.map((item, idx) => {
                  const prod = products.find((p) => p.id === item.product_id);
                  return (
                    <View key={idx} className="flex-row justify-between">
                      <Text className="text-xs font-bold text-slate-600 max-w-[70%]">
                        {item.quantity}x {prod ? prod.name : "Item"}
                      </Text>
                      <Text className="text-xs font-black text-slate-800 font-mono">
                        {fmt(item.subtotal)}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {/* Calculations Summary */}
              <View className="border-t-2 border-dashed border-slate-200 pt-4" style={{ gap: 5 }}>
                <View className="flex-row justify-between">
                  <Text className="text-xs font-bold text-slate-400 uppercase">Taxable Subtotal</Text>
                  <Text className="text-xs font-bold text-slate-600 font-mono">
                    ₹{completedSale?.subtotal}
                  </Text>
                </View>

                {completedSale?.is_outside_state ? (
                  <View className="flex-row justify-between">
                    <Text className="text-xs font-bold text-slate-400 uppercase">IGST Tax</Text>
                    <Text className="text-xs font-bold text-slate-600 font-mono">
                      ₹{completedSale?.tax_amount}
                    </Text>
                  </View>
                ) : (
                  <>
                    <View className="flex-row justify-between">
                      <Text className="text-xs font-bold text-slate-400 uppercase">CGST Tax</Text>
                      <Text className="text-xs font-bold text-slate-600 font-mono">
                        ₹{((completedSale?.tax_amount ?? 0) / 2).toFixed(2)}
                      </Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text className="text-xs font-bold text-slate-400 uppercase">SGST Tax</Text>
                      <Text className="text-xs font-bold text-slate-600 font-mono">
                        ₹{((completedSale?.tax_amount ?? 0) / 2).toFixed(2)}
                      </Text>
                    </View>
                  </>
                )}

                {completedSale?.discount > 0 && (
                  <View className="flex-row justify-between">
                    <Text className="text-xs font-bold text-rose-400 uppercase">Total Discount</Text>
                    <Text className="text-xs font-bold text-rose-500 font-mono">
                      -₹{completedSale?.discount}
                    </Text>
                  </View>
                )}

                {completedSale?.round_off !== 0 && (
                  <View className="flex-row justify-between">
                    <Text className="text-xs font-bold text-slate-400 uppercase">Round Off</Text>
                    <Text className="text-xs font-bold text-slate-600 font-mono">
                      {completedSale?.round_off > 0 ? "+" : ""}{completedSale?.round_off}
                    </Text>
                  </View>
                )}

                <View className="flex-row justify-between pt-3 border-t-2 border-slate-100 mt-3">
                  <Text className="text-sm font-black text-slate-800 uppercase">Grand Total</Text>
                  <Text className="text-orange-500 font-black text-base font-mono">
                    {fmtInt(completedSale?.grand_total)}
                  </Text>
                </View>

                <View className="flex-row justify-between pt-2">
                  <Text className="text-xs font-black text-slate-400 uppercase">Paid Amount</Text>
                  <Text className="text-slate-800 font-black text-xs font-mono">
                    ₹{completedSale?.paid_amount}
                  </Text>
                </View>

                {completedSale?.paid_amount > completedSale?.grand_total ? (
                  <View className="flex-row justify-between">
                    <Text className="text-xs font-black text-green-500 uppercase">Change Returned</Text>
                    <Text className="text-green-600 font-black text-xs font-mono">
                      ₹{(completedSale?.paid_amount - completedSale?.grand_total).toFixed(2)}
                    </Text>
                  </View>
                ) : completedSale?.paid_amount < completedSale?.grand_total ? (
                  <View className="flex-row justify-between">
                    <Text className="text-xs font-black text-rose-400 uppercase">Outstanding Balance</Text>
                    <Text className="text-rose-500 font-black text-xs font-mono">
                      ₹{(completedSale?.grand_total - completedSale?.paid_amount).toFixed(2)}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View className="mt-10 items-center">
                <Text className="text-xs font-black text-slate-300 uppercase tracking-wider italic">
                  Digital Invoice Certified
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Action buttons */}
          <View className="p-6 bg-white border-t-2 border-slate-200" style={{ gap: 12 }}>
            <TouchableOpacity
              onPress={() => printThermalReceipt(completedSale)}
              activeOpacity={0.85}
              style={{ width: "100%", paddingVertical: 20, backgroundColor: "#f97316", borderRadius: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", elevation: 6, shadowColor: "#f97316", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }}
            >
              <Ionicons name="print-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
              <Text className="text-white font-black text-sm uppercase tracking-widest">
                Print Thermal Receipt
              </Text>
            </TouchableOpacity>
 
            <TouchableOpacity
              onPress={() => handleDownloadA4Invoice(completedSale)}
              activeOpacity={0.85}
              style={{ width: "100%", paddingVertical: 20, backgroundColor: "#1e293b", borderRadius: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", elevation: 4, shadowColor: "#1e293b", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }}
            >
              <Ionicons name="document-text-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
              <Text className="text-white font-black text-sm uppercase tracking-widest">
                Download A4 Invoice
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleStartNewTransaction}
              className="w-full py-4 items-center"
            >
              <Text className="text-slate-400 font-black text-xs uppercase tracking-widest">
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
          <View className="p-6 flex-row justify-between items-center z-10 bg-black/60">
            <Text className="text-white font-black text-sm uppercase tracking-wider">Scan Item Barcode</Text>
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => setIsTorchOn(!isTorchOn)}
                className={`flex-row items-center gap-1.5 px-4 py-2.5 rounded-full ${isTorchOn ? 'bg-orange-500' : 'bg-white/10 border border-white/20'}`}
              >
                <Ionicons name={isTorchOn ? "flash" : "flash-outline"} size={14} color="#fff" />
                <Text className="text-white text-xs font-black uppercase tracking-wider">
                  {isTorchOn ? "Off" : "On"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowScanner(false)}
                className="flex-row items-center gap-1.5 bg-white/10 border border-white/20 px-4 py-2.5 rounded-full"
              >
                <Ionicons name="close" size={14} color="#fff" />
                <Text className="text-white text-xs font-black uppercase tracking-wider">Close</Text>
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
            {lastScannedMessage ? (
              <Text className="text-white font-black text-base text-center mb-4">
                {lastScannedMessage}
              </Text>
            ) : (
              <Text className="text-slate-400 text-sm text-center mb-4">
                Align the barcode inside the orange box.
              </Text>
            )}
            <TouchableOpacity
              onPress={() => setShowScanner(false)}
              className="bg-orange-500 py-4 px-10 rounded-2xl shadow-lg"
            >
              <Text className="text-white font-black text-sm uppercase tracking-wider">Done</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
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
                    setTimeout(() => setShowScanner(true), 400); // Wait for modal to close
                  } else {
                    Alert.alert("Invalid Quantity", "Please enter a valid quantity greater than 0.");
                  }
                }}
                className="bg-slate-800 py-4 rounded-2xl shadow-lg flex-row items-center justify-center gap-2"
              >
                <Ionicons name="camera-outline" size={14} color="#fff" />
                <Text className="text-white text-center font-black uppercase tracking-wider">
                  Add & Scan Again
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {/* Unit Selection Modal */}
      <Modal visible={showUnitModal} animationType="fade" transparent>
        <View className="flex-1 bg-black/60 justify-center items-center px-4">
          <View className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl" style={{ maxHeight: '80%' }}>
            <Text className="text-lg font-black text-slate-800 uppercase mb-4 text-center tracking-tight">Select Unit</Text>
            
            <ScrollView className="mb-2">
              {units.map((unit) => {
                const product = activeUnitItem?.product;
                let isPrimary = product && product.unit_id == unit.id;
                let isSecondary = product && product.secondary_unit_id == unit.id;
                
                let displayName = unit.short_name || unit.name;
                let subtitle = "";
                
                if (isPrimary) {
                  subtitle = "(Base Unit)";
                } else if (isSecondary) {
                  subtitle = `(1 = ${product.conversion_rate || 1} Base)`;
                }
                
                return (
                  <TouchableOpacity
                    key={unit.id}
                    onPress={() => handleSelectUnit(unit)}
                    className="py-4 border-b border-slate-100 flex-row justify-between items-center"
                  >
                    <Text className="text-sm font-bold text-slate-800">
                      {displayName} {subtitle && <Text className="text-slate-400 text-xs">{subtitle}</Text>}
                    </Text>
                    {activeUnitItem?.unit_id == unit.id && <Ionicons name="checkmark-circle" size={20} color="#f97316" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              onPress={() => setShowUnitModal(false)}
              activeOpacity={0.8}
              className="mt-6 bg-slate-100 rounded-xl py-3 items-center shadow-sm"
            >
              <Text className="text-slate-600 font-black uppercase tracking-wider text-xs">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
