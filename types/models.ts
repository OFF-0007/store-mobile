/**
 * Shared TypeScript model types that mirror the Laravel API responses.
 */

export interface User {
  id: number;
  name: string;
  email: string;
  role?: string;
  avatar?: string | null;
  created_at?: string;
}

export interface Product {
  id: number;
  name: string;
  sku: string;
  barcode?: string | null;
  price: number;
  cost?: number;
  stock: number;
  low_stock_threshold?: number;
  category?: string;
  image?: string | null;
  variants?: ProductVariant[];
}

export interface ProductVariant {
  id: number;
  name: string;
  sku: string;
  price: number;
  stock: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
  variant?: ProductVariant | null;
  unit_price: number;
}

export interface Sale {
  id: number;
  reference: string;
  total: number;
  payment_method: "cash" | "card" | "bank";
  status: "completed" | "pending" | "refunded";
  items: SaleItem[];
  created_at: string;
}

export interface SaleItem {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface DashboardMetrics {
  today_sales: number;
  today_transactions: number;
  total_expenses: number;
  low_stock_count: number;
  sales_chart: ChartDataPoint[];
}

export interface ChartDataPoint {
  label: string;
  value: number;
}
