import { trpc } from "@/lib/trpc";
import { useGuestCart } from "@/contexts/GuestCartContext";
import { useAuth } from "@/_core/hooks/useAuth";

export type CartLine = {
  // For server cart items this is the cartItems.id; for guest lines there's
  // no server row, so we key by productId instead — callers should use
  // `productId` for update/remove, not this id.
  id: number | string;
  productId: number;
  quantity: number;
  product: {
    id: number;
    name: string;
    price: string;
    imageUrl: string | null;
    stock: number;
  } | null;
};

export function useCart() {
  const { isAuthenticated } = useAuth();
  const guestCart = useGuestCart();
  const utils = trpc.useUtils();

  const serverCartQuery = trpc.cart.get.useQuery(undefined, { enabled: isAuthenticated });
  // Guests never persisted products server-side, so resolve their cart
  // lines against the live product list (small catalog — fine to fetch all).
  const { data: allProducts } = trpc.products.list.useQuery({}, { enabled: !isAuthenticated });

  const addMutation = trpc.cart.add.useMutation({
    onSuccess: () => utils.cart.get.invalidate(),
  });
  const updateMutation = trpc.cart.updateQuantity.useMutation({
    onSuccess: () => utils.cart.get.invalidate(),
  });
  const removeMutation = trpc.cart.remove.useMutation({
    onSuccess: () => utils.cart.get.invalidate(),
  });
  const clearMutation = trpc.cart.clear.useMutation({
    onSuccess: () => utils.cart.get.invalidate(),
  });

  const items: CartLine[] = isAuthenticated
    ? (serverCartQuery.data ?? []).map((item) => ({
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        product: (item as any).product ?? null,
      }))
    : guestCart.items.map((line) => ({
        id: line.productId,
        productId: line.productId,
        quantity: line.quantity,
        product: allProducts?.find((p) => p.id === line.productId) ?? null,
      }));

  const isLoading = isAuthenticated ? serverCartQuery.isLoading : !allProducts;

  function add(productId: number, quantity: number) {
    if (isAuthenticated) {
      addMutation.mutate({ productId, quantity });
    } else {
      guestCart.addItem(productId, quantity);
    }
  }

  function updateQuantity(line: CartLine, quantity: number) {
    if (isAuthenticated) {
      updateMutation.mutate({ cartItemId: line.id as number, quantity });
    } else {
      guestCart.updateQuantity(line.productId, quantity);
    }
  }

  function remove(line: CartLine) {
    if (isAuthenticated) {
      removeMutation.mutate({ cartItemId: line.id as number });
    } else {
      guestCart.removeItem(line.productId);
    }
  }

  function clear() {
    if (isAuthenticated) {
      clearMutation.mutate();
    } else {
      guestCart.clear();
    }
  }

  return {
    items,
    isLoading,
    isAuthenticated,
    add,
    updateQuantity,
    remove,
    clear,
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
  };
}
