import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { ShoppingBag, ArrowLeft } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Logo } from "@/components/Logo";

export default function Orders() {
  const { isAuthenticated } = useAuth();
  const { data: orders } = trpc.orders.getUserOrders.useQuery();

  if (!isAuthenticated) {
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
          <Card className="p-8 text-center">
            <h1 className="text-2xl font-bold mb-4">Sign In Required</h1>
            <p className="text-muted-foreground mb-6">
              Please sign in to view your orders
            </p>
            <Link href="/">
              <a className="btn-primary inline-block">Go Home</a>
            </Link>
          </Card>
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
          <div className="flex items-center gap-4">
            <Link href="/cart">
              <a className="text-foreground hover:text-accent-rose transition-colors">
                <ShoppingBag className="w-5 h-5" />
              </a>
            </Link>
          </div>
        </div>
      </nav>

      <div className="container py-12">
        <Link href="/">
          <a className="inline-flex items-center gap-2 text-accent-rose hover:text-accent-rose/80 mb-8">
            <ArrowLeft className="w-4 h-4" />
            Back Home
          </a>
        </Link>

        <h1 className="text-4xl font-bold mb-8">Order History</h1>

        {!orders || orders.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingBag className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h2 className="text-2xl font-bold mb-2">No orders yet</h2>
            <p className="text-muted-foreground mb-6">
              Start shopping to place your first order
            </p>
            <Link href="/products">
              <a className="btn-primary inline-block">Browse Products</a>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <Card key={order.id} className="p-6 hover:shadow-lg transition-shadow">
                <div className="grid md:grid-cols-4 gap-6">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Order Number
                    </p>
                    <p className="font-semibold text-lg">
                      {order.orderNumber}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Order Date
                    </p>
                    <p className="font-semibold">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Total</p>
                    <p className="text-2xl font-bold text-accent-rose">
                      ${parseFloat(order.totalAmount || "0").toFixed(2)}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Status</p>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium inline-block ${
                        order.status === "delivered"
                          ? "bg-green-100 text-green-800"
                          : order.status === "pending"
                          ? "bg-yellow-100 text-yellow-800"
                          : order.status === "cancelled"
                          ? "bg-red-100 text-red-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {order.status}
                    </span>
                  </div>
                </div>

                {/* Order Items */}
                <div className="mt-6 pt-6 border-t border-border">
                  <p className="text-sm font-semibold mb-3">Items:</p>
                  <div className="space-y-2">
                    {order.items?.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span>
                          {item.name} x {item.quantity}
                        </span>
                        <span className="font-medium">
                          ${(parseFloat(item.price) * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Shipping Address */}
                <div className="mt-6 pt-6 border-t border-border">
                  <p className="text-sm font-semibold mb-3">Shipping Address:</p>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>
                      {order.shippingAddress?.firstName}{" "}
                      {order.shippingAddress?.lastName}
                    </p>
                    <p>{order.shippingAddress?.street}</p>
                    <p>
                      {order.shippingAddress?.city},{" "}
                      {order.shippingAddress?.state}{" "}
                      {order.shippingAddress?.zipCode}
                    </p>
                    <p>{order.shippingAddress?.country}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
