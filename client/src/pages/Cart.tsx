import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ShoppingBag, Trash2, ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useMemo } from "react";
import { Logo } from "@/components/Logo";

export default function Cart() {
  const { data: cartItems, refetch } = trpc.cart.get.useQuery();
  const updateQuantityMutation = trpc.cart.updateQuantity.useMutation({
    onSuccess: () => refetch(),
  });
  const removeFromCartMutation = trpc.cart.remove.useMutation({
    onSuccess: () => {
      toast.success("Item removed from cart");
      refetch();
    },
  });
  const clearCartMutation = trpc.cart.clear.useMutation({
    onSuccess: () => {
      toast.success("Cart cleared");
      refetch();
    },
  });

  const totals = useMemo(() => {
    if (!cartItems) return { subtotal: 0, tax: 0, total: 0 };

    const subtotal = cartItems.reduce((sum, item) => {
      const price = item.product ? parseFloat(item.product.price) : 0;
      return sum + price * item.quantity;
    }, 0);

    const tax = subtotal * 0.1; // 10% tax
    const total = subtotal + tax;

    return { subtotal, tax, total };
  }, [cartItems]);

  if (!cartItems) {
    return (
      <div className="min-h-screen bg-background">
        <nav className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
          <div className="container flex items-center justify-between h-16">
            <Link href="/">
              <a className="cursor-pointer">
                <Logo />
              </a>
            </Link>
          </div>
        </nav>
        <div className="container py-12 flex items-center justify-center min-h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-rose"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
        <div className="container flex items-center justify-between h-16">
          <Link href="/">
            <a className="cursor-pointer">
                <Logo />
              </a>
          </Link>
        </div>
      </nav>

      <div className="container py-12">
        {/* Header */}
        <div className="mb-8">
          <Link href="/products">
            <a className="inline-flex items-center gap-2 text-accent-rose hover:text-accent-rose/80 mb-4">
              <ArrowLeft className="w-4 h-4" />
              Continue Shopping
            </a>
          </Link>
          <h1 className="text-4xl font-bold">Shopping Cart</h1>
        </div>

        {cartItems.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingBag className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h2 className="text-2xl font-bold mb-2">Your cart is empty</h2>
            <p className="text-muted-foreground mb-6">
              Add some premium products to get started
            </p>
            <Link href="/products">
              <a className="btn-primary inline-block">Start Shopping</a>
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {cartItems.map((item) => (
                <Card key={item.id} className="p-6">
                  <div className="flex gap-6">
                    {/* Product Image */}
                    <div className="w-24 h-24 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                      {item.product?.imageUrl ? (
                        <img
                          src={item.product.imageUrl}
                          alt={item.product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-accent-rose/20 to-transparent">
                          <ShoppingBag className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Product Details */}
                    <div className="flex-1">
                      <Link href={`/products/${item.productId}`}>
                        <a className="text-lg font-semibold hover:text-accent-rose transition-colors">
                          {item.product?.name}
                        </a>
                      </Link>
                      <p className="text-muted-foreground text-sm mb-4">
                        {item.product?.description?.substring(0, 100)}...
                      </p>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              updateQuantityMutation.mutate({
                                cartItemId: item.id,
                                quantity: Math.max(1, item.quantity - 1),
                              })
                            }
                            className="px-2 py-1 border border-border rounded hover:bg-muted transition-colors"
                          >
                            −
                          </button>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              updateQuantityMutation.mutate({
                                cartItemId: item.id,
                                quantity: Math.max(1, parseInt(e.target.value) || 1),
                              })
                            }
                            className="w-16 text-center"
                          />
                          <button
                            onClick={() =>
                              updateQuantityMutation.mutate({
                                cartItemId: item.id,
                                quantity: item.quantity + 1,
                              })
                            }
                            className="px-2 py-1 border border-border rounded hover:bg-muted transition-colors"
                          >
                            +
                          </button>
                        </div>

                        <div className="text-right">
                          <p className="text-2xl font-bold text-accent-rose">
                            ${(
                              parseFloat(item.product?.price || "0") * item.quantity
                            ).toFixed(2)}
                          </p>
                          <button
                            onClick={() =>
                              removeFromCartMutation.mutate({ cartItemId: item.id })
                            }
                            className="text-red-600 hover:text-red-700 text-sm font-medium mt-2 flex items-center gap-1"
                          >
                            <Trash2 className="w-4 h-4" />
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <Card className="p-6 sticky top-24 space-y-6">
                <h2 className="text-2xl font-bold">Order Summary</h2>

                <div className="space-y-3 border-b border-border pb-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-semibold">
                      ${totals.subtotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax (10%)</span>
                    <span className="font-semibold">
                      ${totals.tax.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shipping</span>
                    <span className="font-semibold">Free</span>
                  </div>
                </div>

                <div className="flex justify-between text-xl font-bold">
                  <span>Total</span>
                  <span className="text-accent-rose">
                    ${totals.total.toFixed(2)}
                  </span>
                </div>

                <Link href="/checkout">
                  <a className="btn-primary w-full text-center py-3 flex items-center justify-center gap-2">
                    Proceed to Checkout
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </Link>

                <Button
                  onClick={() => clearCartMutation.mutate()}
                  variant="outline"
                  className="w-full"
                >
                  Clear Cart
                </Button>

                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>✓ Free shipping on orders over $100</p>
                  <p>✓ 30-day money-back guarantee</p>
                  <p>✓ Secure checkout</p>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
