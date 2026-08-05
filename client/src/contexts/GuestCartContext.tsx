import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "xirel_guest_cart";

export type GuestCartLine = { productId: number; quantity: number };

type GuestCartContextValue = {
  items: GuestCartLine[];
  addItem: (productId: number, quantity: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  removeItem: (productId: number) => void;
  clear: () => void;
};

const GuestCartContext = createContext<GuestCartContextValue | null>(null);

function loadFromStorage(): GuestCartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function GuestCartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<GuestCartLine[]>(() => loadFromStorage());

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Storage full/unavailable — the cart still works for this session,
      // it just won't persist across a reload. Not worth failing loudly over.
    }
  }, [items]);

  const addItem = (productId: number, quantity: number) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === productId);
      if (existing) {
        return prev.map((i) =>
          i.productId === productId ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [...prev, { productId, quantity }];
    });
  };

  const updateQuantity = (productId: number, quantity: number) => {
    setItems((prev) => {
      if (quantity <= 0) return prev.filter((i) => i.productId !== productId);
      return prev.map((i) => (i.productId === productId ? { ...i, quantity } : i));
    });
  };

  const removeItem = (productId: number) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  const clear = () => setItems([]);

  return (
    <GuestCartContext.Provider value={{ items, addItem, updateQuantity, removeItem, clear }}>
      {children}
    </GuestCartContext.Provider>
  );
}

export function useGuestCart() {
  const ctx = useContext(GuestCartContext);
  if (!ctx) {
    throw new Error("useGuestCart must be used within GuestCartProvider");
  }
  return ctx;
}
