/**
 * Reports Screen
 * Features: Customer, Supplier, Purchase, Sales, and Expense reports.
 * Fully supports PDF and CSV export using native Print & Share capabilities.
 * Horizontal scrollable tabs and clean warm-themed cards.
 */
import React, { useState, useCallback, useEffect } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { GlassCard, CardSkeleton } from "@/components/ui";
import apiClient from "@/lib/api/client";
import { useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

// Safely require native expo modules to prevent crash when native binaries aren't rebuilt yet
let FileSystem = null;
let Sharing = null;
try {
  FileSystem = require("expo-file-system");
  Sharing = require("expo-sharing");
} catch (e) {
  console.warn("Expo sharing/file-system native modules not compiled in dev build:", e.message);
}

// ── Currency formatter ────────────────────────────────────────────────────────
const fmt = (val) =>
  `₹${Number(val || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// ── Tabs Definition ───────────────────────────────────────────────────────────
const TABS = [
  { key: "sale", label: "Sales", iconActive: "stats-chart", iconInactive: "stats-chart-outline", endpoint: "/reports/sales" },
  { key: "purchase", label: "Purchases", iconActive: "cart", iconInactive: "cart-outline", endpoint: "/reports/purchases" },
  { key: "expense", label: "Expenses", iconActive: "wallet", iconInactive: "wallet-outline", endpoint: "/reports/expenses" },
  { key: "customer", label: "Customers", iconActive: "people", iconInactive: "people-outline", endpoint: "/reports/customers" },
  { key: "supplier", label: "Suppliers", iconActive: "business", iconInactive: "business-outline", endpoint: "/reports/suppliers" },
];

// ── Summary card component ────────────────────────────────────────────────────
function SummaryCard({ label, value, accent, icon }) {
  return (
    <View className={`flex-1 rounded-2xl p-3.5 ${accent} border border-slate-100 items-center justify-center shadow-sm`}>
      <View style={{ marginBottom: 6 }}>{icon}</View>
      <Text
        className="text-slate-800 text-sm font-black text-center"
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text className="text-slate-400 text-[8px] font-black uppercase tracking-widest text-center mt-1">
        {label}
      </Text>
    </View>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────
function Badge({ status }) {
  const s = (status ?? "").toLowerCase();
  const isPaid = s === "paid";
  const isPartial = s === "partial";
  return (
    <View
      className={`px-2.5 py-0.5 rounded-full ${isPaid ? "bg-emerald-50 border border-emerald-100" : isPartial ? "bg-amber-50 border border-amber-100" : "bg-rose-50 border border-rose-100"
        }`}
    >
      <Text
        className={`text-[8px] font-black uppercase tracking-wider ${isPaid ? "text-emerald-700" : isPartial ? "text-amber-700" : "text-rose-700"
          }`}
      >
        {status || "PAID"}
      </Text>
    </View>
  );
}

// ── Sub-Report: Sales ─────────────────────────────────────────────────────────
function SalesReport({ data }) {
  if (!data) return <Text className="text-slate-400 text-center py-4">No data available</Text>;
  
  const { summary = {}, sales = [] } = data;
  return (
    <>
      <View className="flex-row gap-2 mb-4">
        <SummaryCard label="Invoices" value={String(summary.total_sales || 0)} icon={<Ionicons name="document-text-outline" size={16} color="#6366f1" />} accent="bg-indigo-50/50" />
        <SummaryCard label="Grand Total" value={fmt(summary.total_amount || 0)} icon={<Ionicons name="cash-outline" size={16} color="#f97316" />} accent="bg-orange-50/50" />
        <SummaryCard label="Amount Paid" value={fmt(summary.total_paid || 0)} icon={<Ionicons name="checkmark-circle-outline" size={16} color="#10b981" />} accent="bg-emerald-50/50" />
      </View>

      <GlassCard className="p-3">
        <View className="flex-row pb-2 mb-1.5 border-b border-slate-100">
          <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider flex-1">Invoice / Customer</Text>
          <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider w-20 text-right">Amount</Text>
          <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider w-16 text-right">Status</Text>
        </View>

        {(!sales || sales.length === 0) ? (
          <Text className="text-slate-400 text-xs text-center py-8 font-bold uppercase tracking-wider">No sales records found</Text>
        ) : (
          sales.map((s, i) => (
            <View
              key={s.id}
              className={`py-3 flex-row items-center ${i < sales.length - 1 ? "border-b border-slate-100" : ""}`}
            >
              <View className="flex-1">
                <Text className="text-slate-800 text-xs font-black" numberOfLines={1}>
                  {s.formatted_id || `INV-${s.id}`}
                </Text>
                <Text className="text-slate-400 text-[10px] font-medium mt-0.5" numberOfLines={1}>
                  {s.customer?.name || "Walk-in Customer"}  ·  {s.sale_date}
                </Text>
              </View>
              <Text className="text-slate-700 text-xs font-black font-mono w-20 text-right">{fmt(s.grand_total)}</Text>
              <View className="w-16 items-end">
                <Badge status={s.payment_status} />
              </View>
            </View>
          ))
        )}
      </GlassCard>
    </>
  );
}

// ── Sub-Report: Customers ─────────────────────────────────────────────────────
function CustomerReport({ data, onPayBalance }) {
  if (!data) return <Text className="text-slate-400 text-center py-4">No data available</Text>;
  
  const { summary = {}, customers = [] } = data;
  return (
    <>
      <View className="flex-row gap-2 mb-4">
        <SummaryCard label="Customers" value={String(summary.total_customers || 0)} icon={<Ionicons name="people-outline" size={16} color="#6366f1" />} accent="bg-indigo-50/50" />
        <SummaryCard label="Total Billed" value={fmt(summary.total_billed || 0)} icon={<Ionicons name="document-text-outline" size={16} color="#3b82f6" />} accent="bg-blue-50/50" />
        <SummaryCard label="Received" value={fmt(summary.total_received || 0)} icon={<Ionicons name="cash-outline" size={16} color="#10b981" />} accent="bg-emerald-50/50" />
        <SummaryCard label="Outstanding" value={fmt(summary.total_outstanding || 0)} icon={<Ionicons name="time-outline" size={16} color="#f43f5e" />} accent="bg-rose-50/50" />
      </View>

      <GlassCard className="p-3">
        <View className="flex-row pb-2 mb-1.5 border-b border-slate-100">
          <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider flex-1">Customer</Text>
          <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider w-20 text-right">Billed</Text>
          <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider w-20 text-right">Due</Text>
          <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider w-12 text-right">Action</Text>
        </View>

        {(!customers || customers.length === 0) ? (
          <Text className="text-slate-400 text-xs text-center py-8 font-bold uppercase tracking-wider">No customer data found</Text>
        ) : (
          customers.map((c, i) => (
            <View
              key={c.id}
              className={`py-3 flex-row items-center ${i < customers.length - 1 ? "border-b border-slate-100" : ""}`}
            >
              <View className="flex-1">
                <Text className="text-slate-800 text-xs font-black" numberOfLines={1}>{c.name}</Text>
                <Text className="text-slate-400 text-[10px] font-medium mt-0.5">
                  {c.phone || "—"}  ·  {c.sales_count || 0} sale{c.sales_count !== 1 ? "s" : ""}
                </Text>
              </View>
              <Text className="text-slate-600 text-xs font-mono w-20 text-right">{fmt(c.total_billed || c.sales_sum_grand_total)}</Text>
              <Text className={`text-xs font-mono w-20 text-right font-black ${c.outstanding || c.current_due > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                {fmt(c.outstanding || c.current_due)}
              </Text>
              <View className="w-12 items-end">
                {(c.outstanding || c.current_due) > 0 && (
                  <TouchableOpacity
                    onPress={() => onPayBalance(c.id, c.name, c.outstanding || c.current_due, 'customer')}
                    className="bg-orange-500 rounded-lg px-2 py-1 shadow-sm shadow-orange-500/20"
                  >
                    <Text className="text-white text-[8px] font-black uppercase tracking-wider">Pay</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}
      </GlassCard>
    </>
  );
}

// ── Sub-Report: Suppliers ─────────────────────────────────────────────────────
function SupplierReport({ data, onPayBalance, onReceiveRefund }) {
  if (!data) return <Text className="text-slate-400 text-center py-4">No data available</Text>;
  
  const { summary = {}, suppliers = [] } = data;
  return (
    <>
      <View className="flex-row gap-2 mb-4">
        <SummaryCard label="Suppliers" value={String(summary.total_suppliers || 0)} icon={<Ionicons name="business-outline" size={16} color="#f97316" />} accent="bg-orange-50/50" />
        <SummaryCard label="Purchased" value={fmt(summary.total_purchased || 0)} icon={<Ionicons name="cart-outline" size={16} color="#f59e0b" />} accent="bg-amber-50/50" />
        <SummaryCard label="Paid" value={fmt(summary.total_paid || 0)} icon={<Ionicons name="card-outline" size={16} color="#10b981" />} accent="bg-emerald-50/50" />
        <SummaryCard label="Due" value={fmt(summary.total_balance_due || 0)} icon={<Ionicons name="warning-outline" size={16} color="#f43f5e" />} accent="bg-rose-50/50" />
      </View>

      <GlassCard className="p-3">
        <View className="flex-row pb-2 mb-1.5 border-b border-slate-100">
          <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider flex-1">Supplier</Text>
          <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider w-16 text-right">Purchased</Text>
          <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider w-16 text-right">Due</Text>
          <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider w-18 text-right">Action</Text>
        </View>

        {(!suppliers || suppliers.length === 0) ? (
          <Text className="text-slate-400 text-xs text-center py-8 font-bold uppercase tracking-wider">No supplier data found</Text>
        ) : (
          suppliers.map((s, i) => {
            const balance = parseFloat(s.balance_due || s.current_due || 0);
            const supplierDue = balance > 0 ? balance : 0;
            const supplierCredit = balance < 0 ? Math.abs(balance) : 0;

            return (
              <View
                key={s.id}
                className={`py-3 flex-row items-center ${i < suppliers.length - 1 ? "border-b border-slate-100" : ""}`}
              >
                <View className="flex-1">
                  <Text className="text-slate-800 text-xs font-black" numberOfLines={1}>{s.name}</Text>
                  <Text className="text-slate-400 text-[10px] font-medium mt-0.5">
                    {s.phone || "—"}  ·  {s.purchases_count || 0} order{s.purchases_count !== 1 ? "s" : ""}
                  </Text>
                </View>
                <Text className="text-slate-600 text-xs font-mono w-16 text-right">{fmt(s.total_purchased)}</Text>
                <Text className={`text-xs font-mono w-16 text-right font-black ${supplierDue > 0 ? "text-rose-600" : "text-slate-300"}`}>
                  {supplierDue > 0 ? fmt(supplierDue) : "—"}
                </Text>
                <View className="w-18 items-end">
                  <View className="flex-row gap-1">
                    {supplierDue > 0 && (
                      <TouchableOpacity
                        onPress={() => onPayBalance(s.id, s.name, supplierDue, 'supplier')}
                        className="bg-orange-500 rounded-lg px-2 py-1 shadow-sm"
                      >
                        <Text className="text-white text-[8px] font-black uppercase tracking-wider">Pay</Text>
                      </TouchableOpacity>
                    )}
                    {supplierCredit > 0 && (
                      <TouchableOpacity
                        onPress={() => onReceiveRefund(s.id, s.name, supplierCredit)}
                        className="bg-indigo-50 border border-indigo-200 px-2 py-1 rounded-lg"
                      >
                        <Text className="text-indigo-700 text-[8px] font-black uppercase tracking-wider">Refund</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            );
          })
        )}
      </GlassCard>
    </>
  );
}

// ── Sub-Report: Purchases ─────────────────────────────────────────────────────
function PurchaseReport({ data }) {
  if (!data) return <Text className="text-slate-400 text-center py-4">No data available</Text>;
  
  const { summary = {}, purchases = [] } = data;
  return (
    <>
      <View className="flex-row gap-2 mb-4">
        <SummaryCard label="Orders" value={String(summary.total_purchases || 0)} icon={<Ionicons name="cube-outline" size={16} color="#8b5cf6" />} accent="bg-violet-50/50" />
        <SummaryCard label="Billed" value={fmt(summary.total_amount || 0)} icon={<Ionicons name="cash-outline" size={16} color="#3b82f6" />} accent="bg-blue-50/50" />
        <SummaryCard label="Paid" value={fmt(summary.total_paid || 0)} icon={<Ionicons name="checkmark-circle-outline" size={16} color="#10b981" />} accent="bg-emerald-50/50" />
      </View>

      <GlassCard className="p-3">
        <View className="flex-row pb-2 mb-1.5 border-b border-slate-100">
          <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider flex-1">Ref / Supplier</Text>
          <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider w-20 text-right">Amount</Text>
          <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider w-16 text-right">Status</Text>
        </View>

        {(!purchases || purchases.length === 0) ? (
          <Text className="text-slate-400 text-xs text-center py-8 font-bold uppercase tracking-wider">No purchase data found</Text>
        ) : (
          purchases.map((p, i) => (
            <View
              key={p.id}
              className={`py-3 flex-row items-center ${i < purchases.length - 1 ? "border-b border-slate-100" : ""}`}
            >
              <View className="flex-1">
                <Text className="text-slate-800 text-xs font-black" numberOfLines={1}>{p.reference}</Text>
                <Text className="text-slate-400 text-[10px] mt-0.5" numberOfLines={1}>{p.supplier_name}  ·  {p.purchase_date}</Text>
              </View>
              <Text className="text-slate-600 text-xs font-mono w-20 text-right">{fmt(p.grand_total)}</Text>
              <View className="w-16 items-end">
                <Badge status={p.payment_status} />
              </View>
            </View>
          ))
        )}
      </GlassCard>
    </>
  );
}

// ── Sub-Report: Expenses ──────────────────────────────────────────────────────
function ExpenseReport({ data }) {
  if (!data) return <Text className="text-slate-400 text-center py-4">No data available</Text>;
  
  const { summary = {}, expenses = [] } = data;
  return (
    <>
      <View className="flex-row gap-2 mb-4">
        <SummaryCard label="Expenses" value={String(summary.total_expenses || 0)} icon={<Ionicons name="wallet-outline" size={16} color="#f43f5e" />} accent="bg-rose-50/50" />
        <SummaryCard label="Total Spend" value={fmt(summary.total_amount || 0)} icon={<Ionicons name="cash-outline" size={16} color="#e11d48" />} accent="bg-rose-100/50" />
      </View>

      <GlassCard className="p-3">
        <View className="flex-row pb-2 mb-1.5 border-b border-slate-100">
          <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider flex-1">Expense / Category</Text>
          <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider w-24 text-right">Amount</Text>
        </View>

        {(!expenses || expenses.length === 0) ? (
          <Text className="text-slate-400 text-xs text-center py-8 font-bold uppercase tracking-wider">No expense records found</Text>
        ) : (
          expenses.map((e, i) => (
            <View
              key={e.id}
              className={`py-3 flex-row items-center ${i < expenses.length - 1 ? "border-b border-slate-100" : ""}`}
            >
              <View className="flex-1">
                <Text className="text-slate-800 text-xs font-black" numberOfLines={1}>{e.item_name}</Text>
                <Text className="text-slate-400 text-[10px] font-medium mt-0.5">
                  {e.category?.name || "Uncategorized"}  ·  {e.date}  ·  {e.payment_type}
                </Text>
              </View>
              <Text className="text-slate-700 text-xs font-black font-mono w-24 text-right">{fmt(e.amount)}</Text>
            </View>
          ))
        )}
      </GlassCard>
    </>
  );
}

// ── Payment Modal ───────────────────────────────────────────────────────────────
function PaymentModal({ visible, onClose, onSubmit, title, entityName, maxAmount, isRefund = false }) {
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [notes, setNotes] = useState("");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }
    if (numAmount > maxAmount && !isRefund) {
      Alert.alert("Error", `Amount cannot exceed ${fmt(maxAmount)}`);
      return;
    }

    setLoading(true);
    try {
      await onSubmit(numAmount, paymentMethod, notes, reference);
      setAmount("");
      setPaymentMethod("Cash");
      setNotes("");
      setReference("");
      onClose();
    } catch (error) {
      Alert.alert("Error", error.message || "Payment failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-center items-center px-4">
        <View className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl">
          <Text className="text-slate-800 text-lg font-black mb-1">{title}</Text>
          <Text className="text-slate-500 text-xs font-bold mb-4 uppercase tracking-wide">{entityName}</Text>

          {isRefund && (
            <View className="bg-indigo-50 border border-indigo-100 rounded-2xl p-3 mb-4">
              <Text className="text-indigo-700 text-[9px] font-black uppercase tracking-wider mb-1">Supplier Refund</Text>
              <Text className="text-indigo-600 text-[11px] font-medium leading-relaxed">
                This supplier owes you credit. Settle it by entering the returned cash amount below.
              </Text>
            </View>
          )}

          <View className={`mb-4 p-4 rounded-2xl border ${isRefund ? "bg-indigo-50 border-indigo-100" : "bg-orange-50 border-orange-100"}`}>
            <Text className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isRefund ? "text-indigo-700" : "text-orange-700"}`}>
              {isRefund ? "Credit Settle Amount" : "Outstanding Due"}
            </Text>
            <Text className={`text-xl font-black ${isRefund ? "text-indigo-600" : "text-orange-600"}`}>
              {fmt(maxAmount)}
            </Text>
          </View>

          <View className="mb-4">
            <Text className="text-slate-500 text-[10px] font-black mb-2 uppercase tracking-wider ml-1">Amount (₹) *</Text>
            <TextInput
              className="border-2 border-slate-200 focus:border-orange-400 rounded-2xl px-4 py-3 text-slate-800 text-sm font-bold bg-white"
              placeholder="0.00"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              editable={!loading}
            />
          </View>

          <View className="mb-4">
            <Text className="text-slate-500 text-[10px] font-black mb-2 uppercase tracking-wider ml-1">Payment Method</Text>
            <View className="flex-row gap-2 flex-wrap">
              {["Cash", "Bank Transfer", "Cheque", "UPI"].map((method) => (
                <TouchableOpacity
                  key={method}
                  onPress={() => setPaymentMethod(method)}
                  className={`flex-1 min-w-[70px] py-2.5 rounded-xl border items-center justify-center ${paymentMethod === method ? "bg-orange-500 border-orange-500" : "bg-white border-slate-200"}`}
                  disabled={loading}
                >
                  <Text className={`text-[10px] font-black uppercase tracking-wider ${paymentMethod === method ? "text-white" : "text-slate-600"}`}>
                    {method}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View className="flex-row gap-3 mt-4">
            <TouchableOpacity
              onPress={onClose}
              disabled={loading}
              className="flex-1 py-3.5 bg-slate-100 rounded-2xl items-center"
            >
              <Text className="text-slate-600 text-xs font-black uppercase tracking-wider">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading || !amount}
              className={`flex-1 py-3.5 rounded-2xl items-center bg-orange-500 shadow-md ${(loading || !amount) ? "opacity-50" : ""}`}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text className="text-white text-xs font-black uppercase tracking-wider">
                  Confirm
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function ReportsScreen() {
  const [activeTab, setActiveTab] = useState("sale");
  const [reportData, setReportData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pagination, setPagination] = useState({});

  // Date filters
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Period sales highlights
  const [periodHighlights, setPeriodHighlights] = useState(null);

  const loadingMoreRef = React.useRef(false);
  const paginationRef = React.useRef(pagination);
  const isFocused = useIsFocused();

  // Payment modal state
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentModalConfig, setPaymentModalConfig] = useState({
    type: null,
    id: null,
    name: "",
    maxAmount: 0,
    isRefund: false,
  });

  useEffect(() => {
    paginationRef.current = pagination;
  }, [pagination]);

  // Load Period Highlights on focus/mount
  async function loadSalesSummary() {
    try {
      const res = await apiClient.get('/reports/sales-summary');
      setPeriodHighlights(res.data);
    } catch (e) {
      console.warn("Failed to fetch period highlights", e.message);
    }
  }

  const fetchReport = useCallback(
    async (tabKey, loadMore = false) => {
      try {
        const tab = TABS.find((t) => t.key === tabKey);
        if (!tab) {
          console.warn(`Tab not found for key: ${tabKey}`);
          return;
        }

        const currentPagination = paginationRef.current[tabKey] || { offset: 0, limit: 6 };
        const offset = loadMore ? currentPagination.offset + currentPagination.limit : 0;

        if (loadMore) {
          setLoadingMore(true);
        } else {
          setLoading(true);
          setError(null);
        }

        console.log(`Fetching ${tabKey} from ${tab.endpoint}`);

        const res = await apiClient.get(tab.endpoint, {
          params: {
            limit: 6,
            offset,
            from: fromDate || undefined,
            to: toDate || undefined
          }
        });

        console.log(`Received data for ${tabKey}:`, res.data);

        const newDataKey = tabKey === 'customer' ? 'customers' : tabKey === 'supplier' ? 'suppliers' : tabKey === 'purchase' ? 'purchases' : tabKey === 'sale' ? 'sales' : 'expenses';

        // Ensure data structure is valid
        const dataToStore = {
          summary: res.data?.summary || {},
          [newDataKey]: res.data?.[newDataKey] || [],
          pagination: res.data?.pagination || { offset, limit: 6, total: 0, has_more: false }
        };

        if (loadMore) {
          setReportData((prev) => ({
            ...prev,
            [tabKey]: {
              ...dataToStore,
              [newDataKey]: [...(prev[tabKey]?.[newDataKey] || []), ...dataToStore[newDataKey]]
            }
          }));
        } else {
          setReportData((prev) => ({ ...prev, [tabKey]: dataToStore }));
        }

        setPagination((prev) => ({
          ...prev,
          [tabKey]: dataToStore.pagination
        }));
      } catch (e) {
        console.error(`Error fetching report:`, e);
        if (!loadMore) {
          const errorMessage = e?.response?.data?.message || e.message || "Failed to load report. Please try again.";
          setError(errorMessage);
          
          // Set empty data structure to prevent crashes
          setReportData((prev) => ({ 
            ...prev, 
            [tabKey]: { 
              summary: {},
              sales: [], 
              purchases: [], 
              expenses: [], 
              customers: [], 
              suppliers: [],
              pagination: { offset: 0, limit: 6, total: 0, has_more: false }
            } 
          }));
        }
      } finally {
        if (loadMore) {
          setLoadingMore(false);
          loadingMoreRef.current = false;
        } else {
          setLoading(false);
        }
      }
    },
    [fromDate, toDate]
  );

  // Trigger load when tab changes or date range is confirmed
  useEffect(() => {
    if (isFocused) {
      loadSalesSummary();
      setPagination((prev) => ({ ...prev, [activeTab]: { offset: 0, limit: 6 } }));
      fetchReport(activeTab, false);
    }
  }, [activeTab, isFocused, fetchReport]);

  const handleApplyFilter = () => {
    setPagination((prev) => ({ ...prev, [activeTab]: { offset: 0, limit: 6 } }));
    fetchReport(activeTab, false);
  };

  const handleResetFilter = () => {
    setFromDate("");
    setToDate("");
    setTimeout(() => {
      setPagination((prev) => ({ ...prev, [activeTab]: { offset: 0, limit: 6 } }));
      fetchReport(activeTab, false);
    }, 50);
  };

  // Payment handlers
  const handlePayBalance = useCallback((id, name, maxAmount, type) => {
    setPaymentModalConfig({
      type,
      id,
      name,
      maxAmount,
      isRefund: false,
    });
    setPaymentModalVisible(true);
  }, []);

  const handleReceiveRefund = useCallback((id, name, maxAmount) => {
    setPaymentModalConfig({
      type: 'supplier',
      id,
      name,
      maxAmount,
      isRefund: true,
    });
    setPaymentModalVisible(true);
  }, []);

  const getModalTitle = useCallback(() => {
    const { type, isRefund } = paymentModalConfig;
    if (type === 'supplier' && isRefund) return 'Receive Refund';
    if (type === 'supplier') return 'Pay Supplier';
    return 'Receive Payment';
  }, [paymentModalConfig]);

  const getModalSubtitle = useCallback(() => {
    const { type, name, isRefund } = paymentModalConfig;
    if (type === 'supplier' && isRefund) return `Supplier ${name} owes you credit`;
    if (type === 'supplier') return `Settle due for ${name}`;
    return `Receive payment from ${name}`;
  }, [paymentModalConfig]);

  const handlePaymentSubmit = useCallback(async (amount, paymentMethod, notes, reference) => {
    const { type, id, isRefund } = paymentModalConfig;
    if (type === 'customer') {
      await apiClient.post(`/customers/${id}/pay-balance`, {
        amount,
        payment_method: paymentMethod,
        notes,
      });
      Alert.alert("Success", "Customer payment recorded successfully");
    } else if (type === 'supplier') {
      if (isRefund) {
        await apiClient.post(`/suppliers/${id}/receive-refund`, {
          amount,
          payment_method: paymentMethod,
          notes,
          reference,
        });
        Alert.alert("Success", "Supplier refund received successfully");
      } else {
        await apiClient.post(`/suppliers/${id}/pay-balance`, {
          amount,
          payment_method: paymentMethod,
          notes,
        });
        Alert.alert("Success", "Supplier payment recorded successfully");
      }
    }
    fetchReport(activeTab);
  }, [paymentModalConfig, activeTab, fetchReport]);

  // Native PDF / CSV Exports
  async function exportToCSV(filename, headers, rows) {
    if (!FileSystem || !Sharing) {
      Alert.alert(
        "Export Unavailable",
        "The file sharing modules are not compiled into this app build. Please rebuild the app binary."
      );
      return;
    }
    try {
      let csvContent = headers.join(",") + "\n";
      rows.forEach(row => {
        const escapedRow = row.map(val => {
          let str = String(val ?? "");
          str = str.replace(/"/g, '""');
          if (str.includes(",") || str.includes("\n") || str.includes('"')) {
            str = `"${str}"`;
          }
          return str;
        });
        csvContent += escapedRow.join(",") + "\n";
      });

      const fileUri = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export CSV Report',
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert("Export Successful", `CSV file created at: ${fileUri}`);
      }
    } catch (e) {
      Alert.alert("Export Failed", e.message);
    }
  }

  async function handleExport(format) {
    const tab = TABS.find((t) => t.key === activeTab);
    const records = reportData[activeTab];
    if (!records) {
      Alert.alert("Warning", "No report data available to export");
      return;
    }

    let headers = [];
    let rows = [];
    let title = `${tab.label} Report`;

    if (activeTab === "sale") {
      const list = records.sales || [];
      headers = ["Date", "Invoice ID", "Customer", "Grand Total", "Paid Amount", "Status"];
      rows = list.map(s => [
        s.sale_date,
        s.formatted_id || `INV-${s.id}`,
        s.customer?.name || "Walk-in Customer",
        fmt(s.grand_total),
        fmt(s.paid_amount),
        s.payment_status
      ]);
    } else if (activeTab === "purchase") {
      const list = records.purchases || [];
      headers = ["Date", "Reference", "Supplier", "Grand Total", "Paid Amount", "Status"];
      rows = list.map(p => [
        p.purchase_date,
        p.reference,
        p.supplier_name || "—",
        fmt(p.grand_total),
        fmt(p.paid),
        p.payment_status
      ]);
    } else if (activeTab === "expense") {
      const list = records.expenses || [];
      headers = ["Date", "Item Name", "Category", "Amount", "Payment Type"];
      rows = list.map(e => [
        e.date,
        e.item_name,
        e.category?.name || "Uncategorized",
        fmt(e.amount),
        e.payment_type
      ]);
    } else if (activeTab === "customer") {
      const list = records.customers || [];
      headers = ["Customer Name", "Phone", "Sales Count", "Total Billed", "Total Received", "Current Due"];
      rows = list.map(c => [
        c.name,
        c.phone,
        c.sales_count,
        fmt(c.sales_sum_grand_total),
        fmt(c.sales_sum_paid_amount),
        fmt(c.current_due)
      ]);
    } else if (activeTab === "supplier") {
      const list = records.suppliers || [];
      headers = ["Supplier Name", "Phone", "Purchases Count", "Total Purchased", "Total Paid", "Current Due"];
      rows = list.map(s => [
        s.name,
        s.phone,
        s.purchases_count,
        fmt(s.total_purchased),
        fmt(s.total_paid),
        fmt(s.current_due)
      ]);
    }

    if (format === 'csv') {
      await exportToCSV(`${activeTab}_report.csv`, headers, rows);
    }
  }

  const handleScroll = (event) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 40;
    const currentPagination = pagination[activeTab] || { has_more: false };
    if (isCloseToBottom && !loadingMoreRef.current && currentPagination.has_more) {
      loadingMoreRef.current = true;
      fetchReport(activeTab, true);
    }
  };

  const insets = useSafeAreaInsets();
  const router = useRouter();

  const data = reportData[activeTab];
  const currentPagination = pagination[activeTab] || { has_more: false };

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
          onPress={() => {
            try {
              if (router.canGoBack?.()) {
                router.back();
              } else {
                router.replace('/(tabs)');
              }
            } catch (e) {
              console.log('Navigation error:', e);
              router.replace('/(tabs)');
            }
          }}
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
            Reports
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginTop: 1 }}>
            Analytics & Insights
          </Text>
        </View>

        <View style={{ width: 36 }} />
      </View>

      {/* Date Range Collapsible Filter Bar */}
      <View className="bg-white border-b border-slate-100 p-4 gap-3">
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Text className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Start Date</Text>
            <TextInput
              value={fromDate}
              onChangeText={setFromDate}
              placeholder="YYYY-MM-DD"
              className="bg-slate-50 border-2 border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 text-xs font-bold focus:border-orange-400"
            />
          </View>
          <View className="flex-1">
            <Text className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">End Date</Text>
            <TextInput
              value={toDate}
              onChangeText={setToDate}
              placeholder="YYYY-MM-DD"
              className="bg-slate-50 border-2 border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 text-xs font-bold focus:border-orange-400"
            />
          </View>
        </View>

        <View className="flex-row gap-2 mt-1">
          <TouchableOpacity
            onPress={handleApplyFilter}
            className="flex-1 bg-orange-500 py-3 rounded-xl items-center justify-center shadow-sm shadow-orange-500/20"
          >
            <Text className="text-white text-[10px] font-black uppercase tracking-wider">Apply Dates</Text>
          </TouchableOpacity>
          {(fromDate || toDate) && (
            <TouchableOpacity
              onPress={handleResetFilter}
              className="bg-slate-100 border border-slate-200 px-4 py-3 rounded-xl items-center justify-center"
            >
              <Text className="text-slate-600 text-[10px] font-black uppercase tracking-wider">Reset</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Horizontal Scrollable Tabs bar */}
      <View className="py-3 bg-white border-b border-slate-100">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {TABS.map((tab) => {
            const isActive = tab.key === activeTab;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                className={`py-2 px-5 rounded-full flex-row items-center gap-1.5 border ${isActive
                  ? "bg-orange-500 border-orange-500 shadow-sm shadow-orange-500/20"
                  : "bg-slate-50 border-slate-200"
                  }`}
              >
                <Ionicons
                  name={isActive ? tab.iconActive : tab.iconInactive}
                  size={14}
                  color={isActive ? "#fff" : "#64748b"}
                />
                <Text
                  className={`text-[10px] font-black uppercase tracking-wider ${isActive ? "text-white" : "text-slate-500"
                    }`}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Period highlights banner for Sales tab */}
      {activeTab === "sale" && periodHighlights && (
        <View className="px-4 pt-4">
          <View className="bg-orange-50 border border-orange-100 rounded-2xl p-4 flex-row justify-around items-center shadow-sm">
            <View className="items-center">
              <Text className="text-slate-500 text-[8px] font-black uppercase tracking-widest">Today</Text>
              <Text className="text-slate-800 text-xs font-black mt-1 font-mono">{fmt(periodHighlights.daily)}</Text>
            </View>
            <View className="w-px h-8 bg-orange-200" />
            <View className="items-center">
              <Text className="text-slate-500 text-[8px] font-black uppercase tracking-widest">This Week</Text>
              <Text className="text-slate-800 text-xs font-black mt-1 font-mono">{fmt(periodHighlights.weekly)}</Text>
            </View>
            <View className="w-px h-8 bg-orange-200" />
            <View className="items-center">
              <Text className="text-slate-500 text-[8px] font-black uppercase tracking-widest">This Month</Text>
              <Text className="text-slate-800 text-xs font-black mt-1 font-mono">{fmt(periodHighlights.monthly)}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Export actions ribbon */}
      {data && (
        <View className="flex-row justify-between items-center px-4 pt-4 mb-2">
          <Text className="text-slate-800 text-[10px] font-black uppercase tracking-widest ml-1">Report Data</Text>
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => handleExport('csv')}
              className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 flex-row items-center gap-1.5 shadow-sm"
            >
              <Ionicons name="document-text-outline" size={13} color="#059669" />
              <Text className="text-emerald-700 text-[9px] font-black uppercase tracking-wider">Excel/CSV</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Main Content scroll window */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 36 }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => {
              setPagination((prev) => ({ ...prev, [activeTab]: { offset: 0, limit: 6 } }));
              fetchReport(activeTab, false);
            }}
            tintColor="#f97316"
          />
        }
      >
        {loading && !data ? (
          <View className="flex-1 p-4 gap-3 bg-slate-50">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </View>
        ) : error ? (
          <View className="items-center justify-center py-20">
            <Ionicons name="alert-circle-outline" size={40} color="#94a3b8" />
            <Text className="text-slate-700 font-black text-sm text-center mt-3 uppercase tracking-wider">Could not load report</Text>
            <Text className="text-slate-400 text-xs text-center mt-1 px-8">{error}</Text>
            <TouchableOpacity
              onPress={() => {
                setPagination((prev) => ({ ...prev, [activeTab]: { offset: 0, limit: 6 } }));
                fetchReport(activeTab, false);
              }}
              className="bg-orange-500 px-6 py-3 rounded-2xl mt-6 shadow-md shadow-orange-500/20"
            >
              <Text className="text-white text-xs font-black uppercase tracking-wider">Retry</Text>
            </TouchableOpacity>
          </View>
        ) : data && Object.keys(data).length > 0 ? (
          <>
            {activeTab === "sale" && data?.summary && <SalesReport data={data} />}
            {activeTab === "purchase" && data?.summary && <PurchaseReport data={data} />}
            {activeTab === "expense" && data?.summary && <ExpenseReport data={data} />}
            {activeTab === "customer" && data?.summary && <CustomerReport data={data} onPayBalance={handlePayBalance} />}
            {activeTab === "supplier" && data?.summary && <SupplierReport data={data} onPayBalance={handlePayBalance} onReceiveRefund={handleReceiveRefund} />}

            {!data?.summary && (
              <View className="items-center justify-center py-20">
                <Ionicons name="alert-circle-outline" size={40} color="#94a3b8" />
                <Text className="text-slate-700 font-black text-sm text-center mt-3 uppercase tracking-wider">No data available</Text>
                <Text className="text-slate-400 text-xs text-center mt-1 px-8">This report category has no records yet</Text>
              </View>
            )}

            {currentPagination.has_more && (
              <View className="py-6 items-center gap-1.5">
                {loadingMore ? (
                  <ActivityIndicator size="small" color="#f97316" />
                ) : (
                  <TouchableOpacity
                    onPress={() => {
                      if (!loadingMoreRef.current) {
                        loadingMoreRef.current = true;
                        fetchReport(activeTab, true);
                      }
                    }}
                    className="bg-orange-500/10 border border-orange-200 px-6 py-2.5 rounded-full"
                  >
                    <Text className="text-orange-600 text-xs font-black uppercase tracking-wider">Load More Records</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {!currentPagination.has_more && data && (
              <View className="py-6 items-center">
                <Text className="text-[9px] text-slate-400 font-black uppercase tracking-widest">
                  Showing all records
                </Text>
              </View>
            )}
          </>
        ) : null}
      </ScrollView>

      {/* Settle outstanding Modal */}
      <PaymentModal
        visible={paymentModalVisible}
        onClose={() => setPaymentModalVisible(false)}
        onSubmit={handlePaymentSubmit}
        title={getModalTitle()}
        entityName={getModalSubtitle()}
        maxAmount={paymentModalConfig.maxAmount}
        isRefund={paymentModalConfig.isRefund}
      />
    </SafeAreaView>
  );
}
