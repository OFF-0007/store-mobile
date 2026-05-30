/**
 * Storeman Store – Synchronizes mobile UI with original Laravel API database.
 * Falls back to local memory if API connectivity is not present.
 */
import { create } from "zustand";
import apiClient from "@/lib/api/client";
import type { Product, Sale, SaleItem } from "@/types/models";

export interface Supplier {
  id: number;
  name: string;
  phone?: string;
  balance: number;
}

export interface Customer {
  id: number;
  name: string;
  phone?: string;
  balance: number;
}

export interface Purchase {
  id: number;
  reference: string;
  supplier_id: number;
  supplier_name: string;
  grand_total: number;
  paid: number;
  payment_status: "Paid" | "Partial" | "Unpaid";
  items: any[];
  created_at: string;
}

export interface DashboardMetrics {
  totalSalesBilled: number;
  totalSalesReceived: number;
  totalPurchasesBilled: number;
  totalPurchasesPaid: number;
  totalExpenses: number;
  lowStockCount: number;
  outstandingSupplierDue: number;
  analytics: Array<{ name: string; sales: number; purchases: number }>;
  totalBreakdown: Array<{ name: string; value: number }>;
  recentSales: any[];
  recentPurchases: any[];
  lowStockProducts: any[];
}

const DEFAULT_METRICS: DashboardMetrics = {
  totalSalesBilled: 0,
  totalSalesReceived: 0,
  totalPurchasesBilled: 0,
  totalPurchasesPaid: 0,
  totalExpenses: 0,
  lowStockCount: 0,
  outstandingSupplierDue: 0,
  analytics: [],
  totalBreakdown: [],
  recentSales: [],
  recentPurchases: [],
  lowStockProducts: [],
};

interface MockState {
  products: Product[];
  sales: Sale[];
  purchases: Purchase[];
  expenses: any[];
  suppliers: Supplier[];
  customers: Customer[];
  categories: string[];
  units: any[];
  isLoading: boolean;
  dashboardMetrics: Record<string, DashboardMetrics>;

  // Sync actions
  fetchProducts: () => Promise<void>;
  fetchCustomers: () => Promise<void>;
  fetchDashboardMetrics: (period: string) => Promise<void>;

  // CRUD Sync actions
  addProduct: (product: Omit<Product, "id">) => Promise<void>;
  deleteProduct: (id: number) => Promise<void>;
  adjustStock: (id: number, amount: number) => Promise<void>;
  recordSale: (saleData: any) => Promise<any>;

  // Sync helper/fallback
  getDashboardMetrics: (period: string) => DashboardMetrics;
}

export const useMockStore = create<MockState>((set, get) => ({
  products: [],
  sales: [],
  purchases: [],
  expenses: [],
  suppliers: [],
  customers: [],
  categories: ["General"],
  units: [],
  isLoading: false,
  dashboardMetrics: {},

  // ── Sync Actions ───────────────────────────────────────────────────────────
  fetchProducts: async () => {
    set({ isLoading: true });
    try {
      const res = await apiClient.get("/products");
      set({
        products: res.data.products,
        categories: res.data.categories,
        units: res.data.units || [],
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false });
      console.warn("Failed to fetch products from API:", err);
    }
  },

  fetchCustomers: async () => {
    try {
      const res = await apiClient.get("/customers");
      set({ customers: res.data });
    } catch (err) {
      console.warn("Failed to fetch customers from API:", err);
    }
  },

  fetchDashboardMetrics: async (period) => {
    try {
      const res = await apiClient.get(`/dashboard/metrics?period=${period}`);
      set((state) => ({
        dashboardMetrics: {
          ...state.dashboardMetrics,
          [period]: res.data,
        },
      }));
    } catch (err) {
      console.warn("Failed to fetch dashboard metrics:", err);
    }
  },

  // ── Product CRUD Sync ──────────────────────────────────────────────────────
  addProduct: async (productData) => {
    set({ isLoading: true });
    try {
      await apiClient.post("/products", {
        name: productData.name,
        sku: productData.sku,
        barcode: productData.barcode,
        category: productData.category,
        price: productData.price,
        cost: productData.cost,
        stock: productData.stock,
        low_stock_threshold: productData.low_stock_threshold,
      });
      // Refetch
      await get().fetchProducts();
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  deleteProduct: async (id) => {
    set({ isLoading: true });
    try {
      await apiClient.delete(`/products/${id}`);
      await get().fetchProducts();
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  adjustStock: async (id, amount) => {
    // Optimistic UI Update
    set((state) => ({
      products: state.products.map((p) =>
        p.id === id ? { ...p, stock: Math.max(0, p.stock + amount) } : p
      ),
    }));

    try {
      await apiClient.post(`/products/${id}/stock`, { amount });
      await get().fetchProducts();
    } catch (err) {
      console.warn("Failed to adjust stock on API:", err);
    }
  },

  // ── Record POS Sale Sync ───────────────────────────────────────────────────
  recordSale: async (saleData) => {
    set({ isLoading: true });
    try {
      const res = await apiClient.post("/sales", saleData);
      await get().fetchProducts();
      set({ isLoading: false });
      return res.data;
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  // ── Sync Helper/Fallback ───────────────────────────────────────────────────
  getDashboardMetrics: (period) => {
    return get().dashboardMetrics[period] ?? DEFAULT_METRICS;
  },
}));
