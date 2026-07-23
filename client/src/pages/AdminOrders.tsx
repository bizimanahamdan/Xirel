import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LogOut, Eye } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState } from "react";
import { Logo } from "@/components/Logo";

export default function AdminOrders() {
  const { user, logout } = useAuth();
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const { data: orders, refetch } = trpc.orders.getAllOrders.useQuery();

  const updateStatusMutation = trpc.orders.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Order status updated");
      refetch();
      setSelectedOrder(null);
    },
    onError: (error) => {
      toast.error("Failed to update order status", {
        description: error.message,
      });
    },
  });

  const handleStatusChange = (orderId: number, newStatus: string) => {
    updateStatusMutation.mutate({
      id: orderId,
      status: newStatus as any,
    });
  };

  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <Link href="/">
            <span className="btn-primary inline-block">Go Home</span>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
        <div className="container flex items-center justify-between h-16">
          <Link href="/">
            <span className="cursor-pointer inline-flex items-center gap-2">
              <Logo />
              <span className="text-lg font-semibold text-muted-foreground border-l border-border pl-2">Admin</span>
            </span>
          </Link>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-foreground hover:text-accent-rose transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </nav>

      {/* Sidebar Navigation */}
      <div className="flex">
        <div className="w-64 bg-white border-r border-border min-h-screen p-6 sticky top-16">
          <nav className="space-y-2">
            <Link href="/admin">
              <span className="block px-4 py-2 rounded-lg hover:bg-secondary transition-colors cursor-pointer">
                Dashboard
              </span>
            </Link>
            <Link href="/admin/products">
              <span className="block px-4 py-2 rounded-lg hover:bg-secondary transition-colors cursor-pointer">
                Products
              </span>
            </Link>
            <Link href="/admin/orders">
              <span className="block px-4 py-2 rounded-lg bg-accent text-white font-medium cursor-pointer">
                Orders
              </span>
            </Link>
            <Link href="/admin/users">
              <span className="block px-4 py-2 rounded-lg hover:bg-secondary transition-colors cursor-pointer">
                Users
              </span>
            </Link>
            <Link href="/admin/payment-settings">
              <span className="block px-4 py-2 rounded-lg hover:bg-secondary transition-colors cursor-pointer">
                Payment Settings
              </span>
            </Link>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Orders</h1>
            <p className="text-muted-foreground">
              Manage and track all customer orders
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Orders List */}
            <div className="lg:col-span-2">
              <Card className="p-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border">
                      <tr>
                        <th className="text-left py-3 px-4 font-semibold">
                          Order #
                        </th>
                        <th className="text-left py-3 px-4 font-semibold">
                          Customer
                        </th>
                        <th className="text-left py-3 px-4 font-semibold">
                          Amount
                        </th>
                        <th className="text-left py-3 px-4 font-semibold">
                          Status
                        </th>
                        <th className="text-left py-3 px-4 font-semibold">
                          Date
                        </th>
                        <th className="text-left py-3 px-4 font-semibold">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders?.map((order) => (
                        <tr
                          key={order.id}
                          className="border-b border-border hover:bg-secondary"
                        >
                          <td className="py-3 px-4 font-medium">
                            {order.orderNumber}
                          </td>
                          <td className="py-3 px-4">
                            {order.shippingAddress?.firstName}{" "}
                            {order.shippingAddress?.lastName}
                          </td>
                          <td className="py-3 px-4 font-semibold text-accent-rose">
                            ${parseFloat(order.totalAmount || "0").toFixed(2)}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium ${
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
                          </td>
                          <td className="py-3 px-4">
                            {new Date(order.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => setSelectedOrder(order)}
                              className="text-accent-rose hover:text-accent-rose/80"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            {/* Order Details */}
            {selectedOrder && (
              <div className="lg:col-span-1">
                <Card className="p-6 sticky top-24">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold">Order Details</h2>
                    <button
                      onClick={() => setSelectedOrder(null)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        Order Number
                      </p>
                      <p className="font-semibold">
                        {selectedOrder.orderNumber}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        Total Amount
                      </p>
                      <p className="text-2xl font-bold text-accent-rose">
                        ${parseFloat(selectedOrder.totalAmount || "0").toFixed(2)}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Status
                      </p>
                      <Select
                        value={selectedOrder.status}
                        onValueChange={(value) =>
                          handleStatusChange(selectedOrder.id, value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="processing">Processing</SelectItem>
                          <SelectItem value="shipped">Shipped</SelectItem>
                          <SelectItem value="delivered">Delivered</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="border-t border-border pt-4">
                      <p className="text-sm text-muted-foreground mb-3">
                        Shipping Address
                      </p>
                      <div className="bg-secondary p-3 rounded text-sm space-y-1">
                        <p className="font-semibold">
                          {selectedOrder.shippingAddress?.firstName}{" "}
                          {selectedOrder.shippingAddress?.lastName}
                        </p>
                        <p className="text-muted-foreground">
                          {selectedOrder.shippingAddress?.street}
                        </p>
                        <p className="text-muted-foreground">
                          {selectedOrder.shippingAddress?.city},{" "}
                          {selectedOrder.shippingAddress?.state}{" "}
                          {selectedOrder.shippingAddress?.zipCode}
                        </p>
                        <p className="text-muted-foreground">
                          {selectedOrder.shippingAddress?.country}
                        </p>
                        <p className="text-muted-foreground">
                          {selectedOrder.shippingAddress?.email}
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-border pt-4">
                      <p className="text-sm text-muted-foreground mb-3">
                        Items
                      </p>
                      <div className="space-y-2">
                        {selectedOrder.items?.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span>
                              {item.name} x {item.quantity}
                            </span>
                            <span className="font-semibold">
                              ${(parseFloat(item.price) * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-border pt-4">
                      <p className="text-sm text-muted-foreground mb-1">
                        Order Date
                      </p>
                      <p className="font-semibold">
                        {new Date(selectedOrder.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
