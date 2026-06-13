/**
 * Stock Screen – Inventory management matching the POS tab's design pattern.
 * Slate-50 background, white cards, high-contrast typography,
 * modern interactive inputs, and vibrant green/orange status accents.
 * Unified single-screen layout with numbered sections.
 */
import React, { useState, useMemo, useEffect } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMockStore } from "@/store/mockStore";
import { GlassCard } from "@/components/ui";
import { Ionicons } from "@expo/vector-icons";

const fmt = (val) =>
  `₹${Number(val || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function StockScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { products, categories, addProduct, deleteProduct, adjustStock, fetchProducts } =
    useMockStore();

  useEffect(() => {
    fetchProducts();
  }, []);

  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState("All");
  const [onlyLowStock, setOnlyLowStock] = useState(params.lowStock === "true");
  const [showAddForm, setShowAddForm] = useState(false);
  const [detailProduct, setDetailProduct] = useState(null);

  // ── Add form state ─────────────────────────────────────────────────────────
  const [fname, setFname] = useState("");
  const [fsku, setFsku] = useState("");
  const [fbarcode, setFbarcode] = useState("");
  const [fcategory, setFcategory] = useState("");
  const [fprice, setFprice] = useState("");
  const [fcost, setFcost] = useState("");
  const [fstock, setFstock] = useState("");
  const [fthreshold, setFthreshold] = useState("5");
  const [errors, setErrors] = useState({});

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode ?? "").includes(q);
      const matchCat = selectedCat === "All" || p.category === selectedCat;
      const matchLow = !onlyLowStock || p.stock <= (p.low_stock_threshold ?? 5);
      return matchSearch && matchCat && matchLow;
    });
  }, [products, search, selectedCat, onlyLowStock]);

  const lowCount = products.filter(
    (p) => p.stock <= (p.low_stock_threshold ?? 5)
  ).length;

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleSave() {
    const errs = {};
    if (!fname.trim()) errs.name = "Name is required";
    if (!fprice || isNaN(+fprice)) errs.price = "Enter a valid price";

    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    addProduct({
      name: fname,
      sku: fsku,
      barcode: fbarcode || null,
      category: fcategory || "General",
      price: Number(fprice),
      cost: fcost ? Number(fcost) : undefined,
      stock: 0,
      low_stock_threshold: parseInt(fthreshold, 10) || 5,
      image: null,
    });

    setFname(""); setFsku(""); setFbarcode(""); setFcategory("");
    setFprice(""); setFcost(""); setFstock(""); setFthreshold("5");
    setErrors({});
    setShowAddForm(false);
    Alert.alert("Product Added", `"${fname}" has been added to inventory.`);
  }

  function handleDelete(id, name) {
    Alert.alert("Delete Product", `Remove "${name}" from inventory?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteProduct(id) },
    ]);
  }

  const insets = useSafeAreaInsets();

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
            Inventory
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginTop: 1 }}>
            {products.length} products · {lowCount} low stock
          </Text>
        </View>

        {/* Spacer to balance the back button */}
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        extraScrollHeight={20}
      >

        {/* Add New Product Section */}
        <GlassCard className="mb-5 p-5">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-slate-800 font-black text-sm uppercase tracking-wider">
              1. Add New Product
            </Text>
            <TouchableOpacity
              onPress={() => setShowAddForm(!showAddForm)}
              activeOpacity={0.8}
              className="bg-orange-500/10 border border-orange-200 px-3 py-1.5 rounded-lg"
            >
              <Text className="text-orange-600 text-[10px] font-black uppercase tracking-wider">
                {showAddForm ? "✕ Close" : "＋ Expand"}
              </Text>
            </TouchableOpacity>
          </View>

          {showAddForm && (
            <View className="gap-4">
              <View>
                <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">
                  Product Name *
                </Text>
                <TextInput
                  value={fname}
                  onChangeText={setFname}
                  placeholder="e.g. Basmati Rice 5kg"
                  placeholderTextColor="#94a3b8"
                  className={`bg-white border-2 rounded-2xl px-4 py-3.5 text-slate-800 text-sm font-bold focus:border-orange-400 ${errors.name ? "border-rose-300" : "border-slate-200"
                    }`}
                />
                {errors.name && <Text className="text-rose-500 text-[10px] mt-1 ml-1">{errors.name}</Text>}
              </View>

              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">
                    SKU
                  </Text>
                  <TextInput
                    value="Auto-generated"
                    readOnly
                    className="bg-slate-100 border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-500 text-sm font-bold"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">
                    Barcode
                  </Text>
                  <TextInput
                    value={fbarcode}
                    onChangeText={setFbarcode}
                    placeholder="Barcode no."
                    placeholderTextColor="#94a3b8"
                    className="bg-white border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm font-bold focus:border-orange-400"
                  />
                </View>
              </View>

              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">
                    Category
                  </Text>
                  <TextInput
                    value={fcategory}
                    onChangeText={setFcategory}
                    placeholder="e.g. Grains"
                    placeholderTextColor="#94a3b8"
                    className="bg-white border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm font-bold focus:border-orange-400"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">
                    Price ₹ *
                  </Text>
                  <TextInput
                    value={fprice}
                    onChangeText={setFprice}
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor="#94a3b8"
                    className={`bg-white border-2 rounded-2xl px-4 py-3.5 text-slate-800 text-sm font-bold focus:border-orange-400 ${errors.price ? "border-rose-300" : "border-slate-200"
                      }`}
                  />
                  {errors.price && <Text className="text-rose-500 text-[10px] mt-1 ml-1">{errors.price}</Text>}
                </View>
              </View>

              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">
                    Cost ₹
                  </Text>
                  <TextInput
                    value={fcost}
                    onChangeText={setFcost}
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor="#94a3b8"
                    className="bg-white border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm font-bold focus:border-orange-400"
                  />
                </View>
                </View>
              </View>
              <View>
                <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">
                  Low Stock Alert (qty)
                </Text>
                <TextInput
                  value={fthreshold}
                  onChangeText={setFthreshold}
                  keyboardType="numeric"
                  placeholder="5"
                  placeholderTextColor="#94a3b8"
                  className="bg-white border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 text-sm font-bold focus:border-orange-400"
                />
              </View>

              <TouchableOpacity
                onPress={handleSave}
                activeOpacity={0.85}
                className="mt-2 bg-orange-500 rounded-2xl py-4 shadow-lg"
              >
                <Text className="text-white text-center text-sm font-black uppercase tracking-wider">
                  Save Product
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </GlassCard>

        {/* Search & Filter Section */}
        <GlassCard className="mb-5 p-5">
          <Text className="text-slate-800 font-black text-xs uppercase tracking-wider mb-4">
            2. Search & Filter Products
          </Text>

          <View className="gap-3">
            {/* Search Input */}
            <View className="relative">
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search name, SKU, barcode…"
                placeholderTextColor="#94a3b8"
                className="bg-white border-2 border-slate-200 rounded-2xl pl-4 pr-10 py-3.5 text-slate-800 text-sm font-bold focus:border-orange-400"
              />
              {search.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearch("")}
                  className="absolute right-3 top-4"
                >
                  <Ionicons name="close-circle" size={18} color="#cbd5e1" />
                </TouchableOpacity>
              )}
            </View>

            {/* Category chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingRight: 20 }}
              className="mb-1"
            >
              {["All", ...categories].map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setSelectedCat(cat)}
                  activeOpacity={0.8}
                  className={`px-3 py-1.5 rounded-full border ${selectedCat === cat
                    ? "bg-orange-500 border-orange-500 shadow-sm"
                    : "bg-slate-50 border-slate-200"
                    }`}
                >
                  <Text className={`text-[10px] font-black uppercase tracking-wider ${selectedCat === cat ? "text-white" : "text-slate-500"
                    }`}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Low stock toggle */}
            <TouchableOpacity
              onPress={() => setOnlyLowStock(!onlyLowStock)}
              activeOpacity={0.8}
              className={`self-start flex-row items-center px-4 py-2 rounded-full border gap-2 ${onlyLowStock
                ? "bg-amber-50 border-amber-300"
                : "bg-slate-50 border-slate-200"
                }`}
            >
              <Ionicons name="alert-circle-outline" size={14} color={onlyLowStock ? "#ea580c" : "#64748b"} />
              <Text
                className={`text-[10px] font-black uppercase tracking-wide ${onlyLowStock ? "text-amber-800" : "text-slate-500"
                  }`}
              >
                {onlyLowStock
                  ? `Low Stock Only (${lowCount})`
                  : `Show Low Stock (${lowCount})`}
              </Text>
            </TouchableOpacity>
          </View>
        </GlassCard>

        {/* Product List Section */}
        <GlassCard className="mb-8 p-4">
          <Text className="text-slate-800 font-black text-xs uppercase tracking-wider mb-3">
            3. Product Inventory ({filtered.length} items)
          </Text>

          {filtered.length === 0 ? (
            <View className="py-12 items-center justify-center">
              <Ionicons name="cube-outline" size={48} color="#94a3b8" />
              <Text className="text-slate-500 font-bold text-xs uppercase tracking-wider mt-3">
                No products found
              </Text>
              <Text className="text-slate-400 text-[10px] mt-1 text-center font-bold">
                Adjust filters or add a new product.
              </Text>
            </View>
          ) : (
            <View className="gap-3">
              {filtered.map((p) => {
                const isLow = p.stock <= (p.low_stock_threshold ?? 5);
                const isOut = p.stock === 0;
                return (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => setDetailProduct(p)}
                    activeOpacity={0.8}
                  >
                    <View className="p-3 border border-slate-100 bg-slate-50/50 rounded-2xl">
                      <View className="flex-row justify-between items-center">
                        {/* Left info */}
                        <View className="flex-1 pr-2">
                          <View className="flex-row items-center gap-2 mb-0.5">
                            <Text
                              className="text-slate-800 font-black text-xs uppercase"
                              numberOfLines={1}
                            >
                              {p.name}
                            </Text>
                            {isOut && (
                              <View className="bg-rose-50 px-1.5 rounded">
                                <Text className="text-rose-700 text-[9px] font-black uppercase">
                                  OUT
                                </Text>
                              </View>
                            )}
                            {!isOut && isLow && (
                              <View className="bg-amber-50 px-1.5 rounded">
                                <Text className="text-amber-700 text-[9px] font-black uppercase">
                                  LOW
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text className="text-slate-400 text-[10px] font-bold">
                            SKU: {p.sku}
                          </Text>
                          <View className="flex-row gap-2 mt-1.5 items-center">
                            <View className="bg-slate-100 px-2 py-0.5 rounded-full">
                              <Text className="text-slate-500 text-[10px] font-bold">
                                {p.category}
                              </Text>
                            </View>
                            <Text className="text-emerald-600 font-black text-xs">
                              {fmt(p.price)}
                            </Text>
                          </View>
                        </View>

                        {/* Right: stock */}
                        <View className="items-end justify-center">
                          <Text
                            className={`text-xs font-black ${isOut
                              ? "text-rose-600"
                              : isLow
                                ? "text-amber-600"
                                : "text-slate-700"
                              }`}
                          >
                            {p.stock} {p.stock === 1 ? "unit" : "units"}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </GlassCard>
      </KeyboardAwareScrollView>

      {/* Product Detail Modal */}
      <Modal
        visible={!!detailProduct}
        animationType="slide"
        transparent
        onRequestClose={() => setDetailProduct(null)}
      >
        <View className="flex-1 bg-black/40 justify-end">
          {detailProduct && (
            <View className="bg-white border-t border-slate-100 rounded-t-3xl px-5 pt-4 pb-10 shadow-xl max-h-[70%]">
              {/* Handle bar */}
              <View className="self-center w-10 h-1 bg-slate-200 rounded-full mb-4" />

              <Text className="text-slate-800 font-black text-base mb-4 uppercase tracking-tight">
                Product Details
              </Text>

              <View className="flex-row justify-between items-start mb-4">
                <View className="flex-1 pr-4">
                  <Text className="text-slate-800 font-black text-lg">
                    {detailProduct.name}
                  </Text>
                  <Text className="text-slate-400 text-xs mt-0.5 font-bold">
                    SKU: {detailProduct.sku}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setDetailProduct(null)}
                  className="bg-slate-100 p-2 rounded-full"
                >
                  <Text className="text-slate-700 text-sm font-bold">✕</Text>
                </TouchableOpacity>
              </View>

              {[
                { label: "Category", value: detailProduct.category ?? "—" },
                { label: "Barcode", value: detailProduct.barcode ?? "—" },
                { label: "Sell Price", value: fmt(detailProduct.price) },
                { label: "Cost Price", value: detailProduct.cost ? fmt(detailProduct.cost) : "—" },
                { label: "Stock", value: `${detailProduct.stock} units` },
                { label: "Low Alert", value: `${detailProduct.low_stock_threshold ?? 5} units` },
              ].map((row, i, arr) => (
                <View
                  key={row.label}
                  className={`flex-row justify-between py-2.5 ${i < arr.length - 1 ? "border-b border-slate-100" : ""
                    }`}
                >
                  <Text className="text-slate-500 text-xs font-black uppercase tracking-wider">{row.label}</Text>
                  <Text className="text-slate-800 font-semibold text-xs font-bold">
                    {row.value}
                  </Text>
                </View>
              ))}

              <View className="flex-row gap-3 mt-5">
                <TouchableOpacity
                  onPress={() => {
                    handleDelete(detailProduct.id, detailProduct.name);
                    setDetailProduct(null);
                  }}
                  className="flex-1 py-3 rounded-xl border border-rose-200 bg-rose-50 items-center"
                >
                  <Text className="text-rose-700 font-bold text-xs uppercase tracking-wider">
                    🗑️ Delete
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setDetailProduct(null)}
                  className="flex-1 py-3 rounded-xl bg-slate-800 items-center"
                >
                  <Text className="text-white font-bold text-xs uppercase tracking-wider">Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}
