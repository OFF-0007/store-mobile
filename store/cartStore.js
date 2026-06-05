/**
 * Cart store – manages POS cart state in memory.
 */
import { create } from "zustand";

export const useCartStore = create((set, get) => ({
  items: [],
  discount: 0,

  // ── Computed ───────────────────────────────────────────────────────────────
  subtotal: () =>
    get().items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0),

  total: () => Math.max(0, get().subtotal() - get().discount),

  itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

  // ── Add item (or increment quantity if already in cart) ───────────────────
  addItem: (product, variant = null) => {
    set((state) => {
      const existing = state.items.find(
        (i) =>
          i.product.id === product.id &&
          (variant ? i.variant?.id === variant.id : !i.variant)
      );
      if (existing) {
        return {
          items: state.items.map((i) =>
            i === existing ? { ...i, quantity: i.quantity + 1 } : i
          ),
        };
      }
      const newItem = {
        product,
        variant,
        quantity: 1,
        unit_price: variant?.price ?? product.price,
      };
      return { items: [...state.items, newItem] };
    });
  },

  // ── Remove item ────────────────────────────────────────────────────────────
  removeItem: (productId, variantId) => {
    set((state) => ({
      items: state.items.filter(
        (i) =>
          !(
            i.product.id === productId &&
            (variantId ? i.variant?.id === variantId : !i.variant)
          )
      ),
    }));
  },

  // ── Update quantity (0 removes the item) ──────────────────────────────────
  updateQuantity: (productId, quantity, variantId) => {
    if (quantity <= 0) {
      get().removeItem(productId, variantId);
      return;
    }
    set((state) => ({
      items: state.items.map((i) =>
        i.product.id === productId &&
        (variantId ? i.variant?.id === variantId : !i.variant)
          ? { ...i, quantity }
          : i
      ),
    }));
  },

  setDiscount: (amount) => set({ discount: amount }),

  clearCart: () => set({ items: [], discount: 0 }),
}));
