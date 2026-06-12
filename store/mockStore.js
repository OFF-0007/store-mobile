/**
 * Storeman Store – Synchronizes mobile UI with original Laravel API database.
 * Falls back to local memory if API connectivity is not present.
 */
import { create } from "zustand";
import apiClient from "@/lib/api/client";

const DEFAULT_METRICS = {
  totalSalesBilled: 0,
  totalSalesReceived: 0,
  totalPurchasesBilled: 0,
  totalPurchasesPaid: 0,
  totalPurchaseReturns: 0,
  totalExpenses: 0,
  lowStockCount: 0,
  outstandingSupplierDue: 0,
  analytics: [],
  totalBreakdown: [],
  recentSales: [],
  recentPurchases: [],
  lowStockProducts: [],
};

export const useMockStore = create((set, get) => ({
  products: [],
  sales: [],
  purchases: [],
  expenses: [],
  suppliers: [],
  customers: [],
  units: [],
  categories: [],
  warehouses: [],
  isLoading: false,
  metrics: DEFAULT_METRICS,

  fetchProducts: async () => {
    set({ isLoading: true });
    try {
      const response = await apiClient.get(`/products?t=${Date.now()}`);
      set({
        products: response.data.products || [],
        categories: response.data.categories || [],
        isLoading: false
      });
    } catch (error) {
      console.error('Failed to fetch products:', error);
      set({ isLoading: false });
    }
  },

  fetchCustomers: async () => {
    try {
      const response = await apiClient.get('/customers');
      set({ customers: response.data || [] });
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    }
  },

  fetchSuppliers: async () => {
    try {
      const response = await apiClient.get('/suppliers');
      set({ suppliers: response.data || [] });
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
    }
  },

  fetchUnits: async () => {
    try {
      const response = await apiClient.get('/products');
      set({ units: response.data.units || [] });
    } catch (error) {
      console.error('Failed to fetch units:', error);
    }
  },

  fetchWarehouses: async () => {
    try {
      const response = await apiClient.get('/warehouses');
      set({ warehouses: response.data || [] });
    } catch (error) {
      console.error('Failed to fetch warehouses:', error);
    }
  },

  recordSale: async (saleData) => {
    try {
      const response = await apiClient.post('/sales', saleData);
      // Refresh products to sync the reduced stock
      await get().fetchProducts();
      return response.data;
    } catch (error) {
      console.error('Failed to record sale:', error);
      throw error;
    }
  },

  recordPurchase: async (purchaseData) => {
    try {
      const response = await apiClient.post('/purchases', purchaseData);
      // Refresh products to sync the increased stock
      await get().fetchProducts();
      return response.data;
    } catch (error) {
      console.error('Failed to record purchase:', error);
      throw error;
    }
  },

  fetchDashboardMetrics: async (period = 'daily') => {
    try {
      const response = await apiClient.get(`/dashboard/metrics?period=${period}`);
      set({ metrics: response.data || DEFAULT_METRICS });
    } catch (error) {
      console.error('Failed to fetch dashboard metrics:', error);
      set({ metrics: DEFAULT_METRICS });
    }
  },

  getDashboardMetrics: (period = 'daily') => {
    return get().metrics;
  },

  addProduct: async (productData) => {
    try {
      const response = await apiClient.post('/products', productData);
      // Refresh products after adding
      await get().fetchProducts();
      return response.data;
    } catch (error) {
      console.error('Failed to add product:', error);
      throw error;
    }
  },

  deleteProduct: async (id) => {
    try {
      const response = await apiClient.delete(`/products/${id}`);
      // Refresh products after deleting
      await get().fetchProducts();
      return response.data;
    } catch (error) {
      console.error('Failed to delete product:', error);
      throw error;
    }
  },

  adjustStock: async (id, amount) => {
    try {
      const response = await apiClient.post(`/products/${id}/stock`, { amount });
      // Refresh products after adjusting stock
      await get().fetchProducts();
      return response.data;
    } catch (error) {
      console.error('Failed to adjust stock:', error);
      throw error;
    }
  },
}));
