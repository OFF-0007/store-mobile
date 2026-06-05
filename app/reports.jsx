/**
 * Reports screen – Customer, Supplier & Purchase reports.
 * Fetches data from the Laravel Mobile API and presents
 * summary cards + scrollable detail rows.
 * Light-mode theme consistent with the rest of the app.
 */
import React, { useState, useCallback } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { GlassCard } from "@/components/ui";
import apiClient from "@/lib/api/client";
import { useIsFocused } from "@react-navigation/native";

// ── Currency formatter ────────────────────────────────────────────────────────
const fmt = (val) =>
  `₹${Number(val || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// ── Report tab types ──────────────────────────────────────────────────────────
const TABS = [
  { key: "customer", label: "Customers", emoji: "👥", endpoint: "/reports/customers" },
  { key: "supplier", label: "Suppliers", emoji: "🏭", endpoint: "/reports/suppliers" },
  { key: "purchase", label: "Purchases", emoji: "🛍️", endpoint: "/reports/purchases" },
];

// ── Summary card strip ────────────────────────────────────────────────────────
function SummaryCard({ label, value, accent, icon }) {
  return (
    <View className={`flex-1 rounded-2xl p-3 ${accent} border border-slate-100 items-center`}>
      <Text className="text-lg mb-1">{icon}</Text>
      <Text
        className="text-slate-800 text-sm font-black text-center"
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text className="text-slate-500 text-[9px] font-bold uppercase tracking-wider text-center mt-0.5">
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
      className={`px-2 py-0.5 rounded-full ${isPaid ? "bg-emerald-50" : isPartial ? "bg-amber-50" : "bg-emerald-50"
        }`}
    >
      <Text
        className={`text-[9px] font-black uppercase tracking-tight ${isPaid ? "text-emerald-700" : isPartial ? "text-amber-700" : "text-emerald-700"
          }`}
      >
        {isPaid || isPartial ? status : "PAID"}
      </Text>
    </View>
  );
}

// ── Customer Report ───────────────────────────────────────────────────────────
function CustomerReport({ data, onPayBalance }) {
  const { summary, customers } = data;
  return (
    <>
      {/* Summary strip */}
      <View className="flex-row gap-2 mb-4">
        <SummaryCard label="Customers" value={String(summary.total_customers)} icon="👥" accent="bg-indigo-50" />
        <SummaryCard label="Total Billed" value={fmt(summary.total_billed)} icon="📄" accent="bg-blue-50" />
        <SummaryCard label="Received" value={fmt(summary.total_received)} icon="💰" accent="bg-emerald-50" />
        <SummaryCard label="Outstanding" value={fmt(summary.total_outstanding)} icon="⏳" accent="bg-rose-50" />
      </View>

      {/* Rows */}
      <GlassCard>
        {/* Header */}
        <View className="flex-row pb-2 mb-1 border-b border-slate-100">
          <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider flex-1">Customer</Text>
          <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider w-20 text-right">Billed</Text>
          <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider w-20 text-right">Due</Text>
          <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider w-16 text-right">Action</Text>
        </View>

        {customers.length === 0 ? (
          <Text className="text-slate-400 text-xs text-center py-6">No customer data found</Text>
        ) : (
          customers.map((c, i) => (
            <View
              key={c.id}
              className={`py-3 flex-row items-center ${i < customers.length - 1 ? "border-b border-slate-100" : ""}`}
            >
              <View className="flex-1">
                <Text className="text-slate-700 text-xs font-bold" numberOfLines={1}>{c.name}</Text>
                <Text className="text-slate-400 text-[10px]">{c.phone}  ·  {c.sales_count} sale{c.sales_count !== 1 ? "s" : ""}</Text>
              </View>
              <Text className="text-slate-600 text-xs font-mono w-20 text-right">{fmt(c.total_billed)}</Text>
              <Text className={`text-xs font-mono w-20 text-right font-black ${c.outstanding > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                {fmt(c.outstanding)}
              </Text>
              <View className="w-16 items-end">
                {c.outstanding > 0 && (
                  <TouchableOpacity
                    onPress={() => onPayBalance(c.id, c.name, c.outstanding, 'customer')}
                    className="bg-blue-600 px-3 py-1.5 rounded-lg"
                  >
                    <Text className="text-white text-[9px] font-black uppercase tracking-wider">Pay</Text>
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

// ── Supplier Report ───────────────────────────────────────────────────────────
function SupplierReport({ data, onPayBalance, onReceiveRefund }) {
  const { summary, suppliers } = data;
  return (
    <>
      <View className="flex-row gap-2 mb-4">
        <SummaryCard label="Suppliers" value={String(summary.total_suppliers)} icon="🏭" accent="bg-orange-50" />
        <SummaryCard label="Purchased" value={fmt(summary.total_purchased)} icon="🛍️" accent="bg-amber-50" />
        <SummaryCard label="Paid" value={fmt(summary.total_paid)} icon="💳" accent="bg-emerald-50" />
        <SummaryCard label="Supplier Due" value={fmt(summary.total_balance_due > 0 ? summary.total_balance_due : 0)} icon="⚠️" accent="bg-rose-50" />
        <SummaryCard label="Supplier Credit" value={fmt(summary.total_balance_due < 0 ? Math.abs(summary.total_balance_due) : 0)} icon="💰" accent="bg-indigo-50" />
      </View>

      <GlassCard>
        <View className="flex-row pb-2 mb-1 border-b border-slate-100">
          <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider flex-1">Supplier</Text>
          <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider w-16 text-right">Purchased</Text>
          <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider w-16 text-right">Due</Text>
          <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider w-16 text-right">Credit</Text>
          <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider w-20 text-right">Action</Text>
        </View>

        {suppliers.length === 0 ? (
          <Text className="text-slate-400 text-xs text-center py-6">No supplier data found</Text>
        ) : (
          suppliers.map((s, i) => {
            const balance = parseFloat(s.balance_due || 0);
            const supplierDue = balance > 0 ? balance : 0;
            const supplierCredit = balance < 0 ? Math.abs(balance) : 0;
            
            return (
              <View
                key={s.id}
                className={`py-3 flex-row items-center ${i < suppliers.length - 1 ? "border-b border-slate-100" : ""}`}
              >
                <View className="flex-1">
                  <Text className="text-slate-700 text-xs font-bold" numberOfLines={1}>{s.name}</Text>
                  <Text className="text-slate-400 text-[10px]">{s.phone}  ·  {s.purchases_count} order{s.purchases_count !== 1 ? "s" : ""}</Text>
                </View>
                <Text className="text-slate-600 text-xs font-mono w-16 text-right">{fmt(s.total_purchased)}</Text>
                <Text className={`text-xs font-mono w-16 text-right font-black ${supplierDue > 0 ? "text-rose-600" : "text-slate-300"}`}>
                  {supplierDue > 0 ? fmt(supplierDue) : "—"}
                </Text>
                <Text className={`text-xs font-mono w-16 text-right font-black ${supplierCredit > 0 ? "text-indigo-600" : "text-slate-300"}`}>
                  {supplierCredit > 0 ? fmt(supplierCredit) : "—"}
                </Text>
                <View className="w-20 items-end">
                  <View className="flex-row gap-1">
                    {supplierDue > 0 && (
                      <TouchableOpacity
                        onPress={() => onPayBalance(s.id, s.name, supplierDue, 'supplier')}
                        className="bg-green-50 border border-green-200 px-2 py-1 rounded-lg"
                      >
                        <Text className="text-green-700 text-[9px] font-black uppercase tracking-wider">Pay</Text>
                      </TouchableOpacity>
                    )}
                    {supplierCredit > 0 && (
                      <TouchableOpacity
                        onPress={() => onReceiveRefund(s.id, s.name, supplierCredit)}
                        className="bg-indigo-50 border border-indigo-200 px-2 py-1 rounded-lg"
                      >
                        <Text className="text-indigo-700 text-[9px] font-black uppercase tracking-wider">Refund</Text>
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

// ── Purchase Report ───────────────────────────────────────────────────────────
function PurchaseReport({ data }) {
  const { summary, purchases } = data;
  return (
    <>
      <View className="flex-row gap-2 mb-4">
        <SummaryCard label="Orders" value={String(summary.total_purchases)} icon="📦" accent="bg-violet-50" />
        <SummaryCard label="Amount" value={fmt(summary.total_amount)} icon="💵" accent="bg-blue-50" />
        <SummaryCard label="Paid" value={fmt(summary.total_paid)} icon="✅" accent="bg-emerald-50" />
      </View>

      <GlassCard>
        <View className="flex-row pb-2 mb-1 border-b border-slate-100">
          <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider flex-1">Ref / Supplier</Text>
          <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider w-20 text-right">Amount</Text>
          <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider w-16 text-right">Status</Text>
        </View>

        {purchases.length === 0 ? (
          <Text className="text-slate-400 text-xs text-center py-6">No purchase data found</Text>
        ) : (
          purchases.map((p, i) => (
            <View
              key={p.id}
              className={`py-3 flex-row items-center ${i < purchases.length - 1 ? "border-b border-slate-100" : ""}`}
            >
              <View className="flex-1">
                <Text className="text-slate-700 text-xs font-bold" numberOfLines={1}>{p.reference}</Text>
                <Text className="text-slate-400 text-[10px]" numberOfLines={1}>{p.supplier_name}  ·  {p.purchase_date}</Text>
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
        <View className="bg-white rounded-2xl w-full max-w-sm p-6">
          <Text className="text-slate-800 text-lg font-black mb-1">{title}</Text>
          <Text className="text-slate-500 text-xs mb-4">{entityName}</Text>

          {isRefund && (
            <View className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 mb-4">
              <Text className="text-indigo-700 text-[10px] font-black uppercase tracking-wider mb-1">How does this work?</Text>
              <Text className="text-indigo-600 text-xs">
                This supplier has a credit balance — they owe you money (e.g. from a return where no cash was refunded yet). Record the amount they pay you here to settle that credit.
              </Text>
            </View>
          )}

          <View className={`mb-4 p-3 rounded-xl border ${isRefund ? "bg-indigo-50 border-indigo-100" : "bg-rose-50 border-rose-100"}`}>
            <Text className={`text-[10px] font-black uppercase tracking-wider mb-1 ${isRefund ? "text-indigo-700" : "text-rose-700"}`}>
              {isRefund ? "Supplier Credit" : "Outstanding Due"}
            </Text>
            <Text className={`text-xl font-black ${isRefund ? "text-indigo-600" : "text-rose-600"}`}>
              ₹{maxAmount.toLocaleString()}
            </Text>
          </View>

          <View className="mb-4">
            <Text className="text-slate-600 text-xs font-bold mb-2 uppercase tracking-wider">
              {isRefund ? "Amount Received" : "Amount to Pay"} (₹)
            </Text>
            <TextInput
              className="border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm"
              placeholder="0.00"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              editable={!loading}
            />
          </View>

          <View className="mb-4">
            <Text className="text-slate-600 text-xs font-bold mb-2 uppercase tracking-wider">Payment Method</Text>
            <View className="flex-row gap-2 flex-wrap">
              {["Cash", "Bank Transfer", "Cheque", "UPI"].map((method) => (
                <TouchableOpacity
                  key={method}
                  onPress={() => setPaymentMethod(method)}
                  className={`flex-1 min-w-[70px] py-2 rounded-lg border ${paymentMethod === method ? (isRefund ? "bg-indigo-600 border-indigo-600" : "bg-green-600 border-green-600") : "bg-white border-slate-200"}`}
                  disabled={loading}
                >
                  <Text className={`text-[10px] font-black text-center ${paymentMethod === method ? "text-white" : "text-slate-600"}`}>
                    {method}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {isRefund && (
            <View className="mb-4">
              <Text className="text-slate-600 text-xs font-bold mb-2 uppercase tracking-wider">Reference / Cheque No. (Optional)</Text>
              <TextInput
                className="border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm"
                placeholder="e.g. CHQ-001234"
                value={reference}
                onChangeText={setReference}
                editable={!loading}
              />
            </View>
          )}

          <View className="mb-6">
            <Text className="text-slate-600 text-xs font-bold mb-2 uppercase tracking-wider">Notes (Optional)</Text>
            <TextInput
              className="border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm"
              placeholder="Add notes..."
              value={notes}
              onChangeText={setNotes}
              editable={!loading}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </View>

          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={onClose}
              disabled={loading}
              className="flex-1 py-3 bg-slate-100 rounded-xl items-center"
            >
              <Text className="text-slate-600 text-sm font-bold">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading || !amount}
              className={`flex-1 py-3 rounded-xl items-center ${isRefund ? "bg-indigo-600" : "bg-green-600"} ${(loading || !amount) ? "opacity-50" : ""}`}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text className="text-white text-sm font-bold">
                  {isRefund ? "Confirm Receipt" : "Confirm Payment"}
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
  const [activeTab, setActiveTab] = useState("customer");
  const [reportData, setReportData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pagination, setPagination] = useState({});
  const loadingMoreRef = React.useRef(false);
  const paginationRef = React.useRef(pagination);

  React.useEffect(() => {
    paginationRef.current = pagination;
  }, [pagination]);

  // Payment modal state
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentModalConfig, setPaymentModalConfig] = useState({
    type: null, // 'customer' or 'supplier'
    id: null,
    name: "",
    maxAmount: 0,
    isRefund: false,
  });

  const fetchReport = useCallback(
    async (tabKey, loadMore = false) => {
      const tab = TABS.find((t) => t.key === tabKey);
      if (!tab) return;

      const currentPagination = paginationRef.current[tabKey] || { offset: 0, limit: 6 };
      const offset = loadMore ? currentPagination.offset + currentPagination.limit : 0;

      if (loadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }

      try {
        const res = await apiClient.get(tab.endpoint, {
          params: { limit: 6, offset }
        });

        console.log('API Response:', res.data);
        console.log('Pagination from API:', res.data.pagination);

        if (loadMore) {
          // Append new data to existing data
          const newDataKey = tabKey === 'customer' ? 'customers' : tabKey === 'supplier' ? 'suppliers' : 'purchases';
          setReportData((prev) => ({
            ...prev,
            [tabKey]: {
              ...res.data,
              [newDataKey]: [...(prev[tabKey]?.[newDataKey] || []), ...res.data[newDataKey]]
            }
          }));
        } else {
          // Replace data for initial load
          setReportData((prev) => ({ ...prev, [tabKey]: res.data }));
        }

        setPagination((prev) => ({
          ...prev,
          [tabKey]: res.data.pagination || { offset, limit: 6, total: 0, has_more: false }
        }));
      } catch (e) {
        if (!loadMore) {
          setError(e.message ?? "Failed to load report.");
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
    []
  );

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
    if (type === 'supplier' && isRefund) {
      return 'Receive Refund';
    } else if (type === 'supplier') {
      return 'Pay Supplier';
    } else if (type === 'customer') {
      return 'Receive Payment';
    }
    return 'Payment';
  }, [paymentModalConfig]);

  const getModalSubtitle = useCallback(() => {
    const { type, name, isRefund } = paymentModalConfig;
    if (type === 'supplier' && isRefund) {
      return `Supplier ${name} owes you this credit`;
    } else if (type === 'supplier') {
      return `Settle outstanding due for ${name}`;
    } else if (type === 'customer') {
      return `Receive payment from ${name}`;
    }
    return '';
  }, [paymentModalConfig]);

  const handlePaymentSubmit = useCallback(async (amount, paymentMethod, notes, reference) => {
    const { type, id, isRefund } = paymentModalConfig;

    try {
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

      // Refresh the current report
      fetchReport(activeTab);
    } catch (error) {
      throw error;
    }
  }, [paymentModalConfig, activeTab, fetchReport]);

  const handleClosePaymentModal = useCallback(() => {
    setPaymentModalVisible(false);
    setPaymentModalConfig({
      type: null,
      id: null,
      name: "",
      maxAmount: 0,
      isRefund: false,
    });
  }, []);

  const isFocused = useIsFocused();
  const prevActiveTabRef = React.useRef(activeTab);
  const mountedRef = React.useRef(false);

  // Initial load and auto-load when tab changes
  React.useEffect(() => {
    const tabChanged = prevActiveTabRef.current !== activeTab;

    if (tabChanged || !mountedRef.current) {
      if (tabChanged) {
        setPagination((prev) => ({ ...prev, [activeTab]: { offset: 0, limit: 6 } }));
        prevActiveTabRef.current = activeTab;
      }
      fetchReport(activeTab, false);
      mountedRef.current = true;
    }
  }, [activeTab]);

  const data = reportData[activeTab];
  const currentPagination = pagination[activeTab] || { has_more: false };

  const handleScroll = (event) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 40;
    if (isCloseToBottom && !loadingMoreRef.current && currentPagination.has_more) {
      loadingMoreRef.current = true;
      fetchReport(activeTab, true);
    }
  };

  const insets = useSafeAreaInsets();
  const router = useRouter();

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
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'rgba(255,255,255,0.2)',
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 20,
            minWidth: 44,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginRight: 2 }}>‹</Text>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>Back</Text>
        </TouchableOpacity>

        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' }}>
            📊 Reports
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginTop: 1 }}>
            Analytics & Insights
          </Text>
        </View>

        {/* Spacer to balance the back button */}
        <View style={{ minWidth: 44 }} />
      </View>

      {/* ── Report type tabs ───────────────────────────────────────────────── */}
      <View className="flex-row px-4 py-8 mb-4 gap-2 pt-8">
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 rounded-2xl items-center border ${isActive
                ? "bg-blue-600 border-blue-600"
                : "bg-white border-slate-200"
                }`}
            >
              <Text className="text-base">{tab.emoji}</Text>
              <Text
                className={`text-[10px] font-black uppercase tracking-wider mt-0.5 ${isActive ? "text-white" : "text-slate-500"
                  }`}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
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
            tintColor="#2563eb"
          />
        }
      >
        {loading && !data ? (
          <View className="flex-1 items-center justify-center py-24">
            <ActivityIndicator size="large" color="#2563eb" />
            <Text className="text-slate-400 text-xs font-bold mt-3 uppercase tracking-wider">
              Loading report…
            </Text>
          </View>
        ) : error ? (
          <View className="items-center justify-center py-24">
            <Text className="text-4xl mb-3">⚠️</Text>
            <Text className="text-slate-700 font-bold text-sm text-center mb-1">Could not load report</Text>
            <Text className="text-slate-400 text-xs text-center mb-6">{error}</Text>
            <TouchableOpacity
              onPress={() => {
                setPagination((prev) => ({ ...prev, [activeTab]: { offset: 0, limit: 6 } }));
                fetchReport(activeTab, false);
              }}
              className="bg-blue-600 px-6 py-2.5 rounded-xl"
            >
              <Text className="text-white text-xs font-black uppercase tracking-wider">Retry</Text>
            </TouchableOpacity>
          </View>
        ) : data ? (
          <>
            {activeTab === "customer" && <CustomerReport data={data} onPayBalance={handlePayBalance} />}
            {activeTab === "supplier" && <SupplierReport data={data} onPayBalance={handlePayBalance} onReceiveRefund={handleReceiveRefund} />}
            {activeTab === "purchase" && <PurchaseReport data={data} />}

            {currentPagination.has_more && (
              <View className="py-4 items-center gap-1">
                {loadingMore ? (
                  <ActivityIndicator size="small" color="#2563eb" />
                ) : (
                  <TouchableOpacity
                    onPress={() => {
                      if (!loadingMoreRef.current) {
                        loadingMoreRef.current = true;
                        fetchReport(activeTab, true);
                      }
                    }}
                    className="bg-blue-600 px-6 py-2.5 rounded-xl"
                  >
                    <Text className="text-white text-xs font-black uppercase tracking-wider">Load More</Text>
                  </TouchableOpacity>
                )}
                <Text className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                  {loadingMore ? "Loading more…" : "Tap to load more"}
                </Text>
              </View>
            )}

            {!currentPagination.has_more && data && (
              <View className="py-4 items-center">
                <Text className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Showing all records
                </Text>
              </View>
            )}
          </>
        ) : null}
      </ScrollView>

      {/* Payment Modal */}
      <PaymentModal
        visible={paymentModalVisible}
        onClose={handleClosePaymentModal}
        onSubmit={handlePaymentSubmit}
        title={getModalTitle()}
        entityName={getModalSubtitle()}
        maxAmount={paymentModalConfig.maxAmount}
        isRefund={paymentModalConfig.isRefund}
      />
    </SafeAreaView>
  );
}
