import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import {
  ShoppingBag,
  DollarSign,
  Users,
  TrendingUp,
  Settings,
  Package,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Logo } from "@/components/Logo";

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const { data: orders } = trpc.orders.getAllOrders.useQuery();
  const { data: products } = trpc.products.list.useQuery({});
  const { data: users } = trpc.users.list.useQuery();
  const { data: status } = trpc.system.status.useQuery();

  // Calculate statistics
  const totalRevenue = orders?.reduce(
    (sum, order) => sum + parseFloat(order.totalAmount || "0"),
    0
  ) || 0;

  const totalOrders = orders?.length || 0;
  const totalProducts = products?.length || 0;
  const totalUsers = users?.length || 0;

  // Prepare chart data
  const chartData = (orders || [])
    .slice(-7)
    .map((order) => ({
      date: new Date(order.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      amount: parseFloat(order.totalAmount || "0"),
    }));

  const statusData = [
    {
      status: "Pending",
      count: orders?.filter((o) => o.status === "pending").length || 0,
    },
    {
      status: "Paid",
      count: orders?.filter((o) => o.status === "paid").length || 0,
    },
    {
      status: "Processing",
      count: orders?.filter((o) => o.status === "processing").length || 0,
    },
    {
      status: "Shipped",
      count: orders?.filter((o) => o.status === "shipped").length || 0,
    },
    {
      status: "Delivered",
      count: orders?.filter((o) => o.status === "delivered").length || 0,
    },
  ];

  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-muted-foreground mb-6">
            You don't have permission to access the admin panel.
          </p>
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
      <nav className="sticky top-0 z-50 bg-card border-b border-border shadow-sm">
        <div className="container flex items-center justify-between h-16">
          <Link href="/">
            <span className="cursor-pointer inline-flex items-center gap-2">
              <Logo />
              <span className="text-lg font-semibold text-muted-foreground border-l border-border pl-2">Admin</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Welcome, {user?.name}
            </span>
            <button
              onClick={logout}
              className="flex items-center gap-2 text-foreground hover:text-accent-rose transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Sidebar Navigation */}
      <div className="flex flex-col md:flex-row">
        <div className="w-full md:w-64 bg-card border-b md:border-b-0 md:border-r border-border p-4 md:p-6 md:min-h-screen md:sticky md:top-16">
          <nav className="flex gap-2 overflow-x-auto pb-1 md:pb-0 md:flex-col md:gap-0 md:space-y-2">
            <Link href="/admin">
              <span className="block px-4 py-2 rounded-lg bg-accent text-white font-medium cursor-pointer flex-shrink-0 whitespace-nowrap">
                Dashboard
              </span>
            </Link>
            <Link href="/admin/products">
              <span className="block px-4 py-2 rounded-lg hover:bg-secondary transition-colors cursor-pointer flex-shrink-0 whitespace-nowrap">
                Products
              </span>
            </Link>
            <Link href="/admin/orders">
              <span className="block px-4 py-2 rounded-lg hover:bg-secondary transition-colors cursor-pointer flex-shrink-0 whitespace-nowrap">
                Orders
              </span>
            </Link>
            <Link href="/admin/users">
              <span className="block px-4 py-2 rounded-lg hover:bg-secondary transition-colors cursor-pointer flex-shrink-0 whitespace-nowrap">
                Users
              </span>
            </Link>
            <Link href="/admin/analytics">
              <span className="block px-4 py-2 rounded-lg hover:bg-secondary transition-colors cursor-pointer flex-shrink-0 whitespace-nowrap">
                Analytics
              </span>
            </Link>
            <Link href="/admin/newsletter">
              <span className="block px-4 py-2 rounded-lg hover:bg-secondary transition-colors cursor-pointer flex-shrink-0 whitespace-nowrap">
                Newsletter
              </span>
            </Link>
            <Link href="/admin/payment-settings">
              <span className="block px-4 py-2 rounded-lg hover:bg-secondary transition-colors cursor-pointer flex-shrink-0 whitespace-nowrap">
                Payment Settings
              </span>
            </Link>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome to your e-commerce admin panel
            </p>
          </div>

          {status && (
            <div
              className={`mb-8 p-4 rounded-lg border text-sm flex flex-wrap gap-x-6 gap-y-1 ${
                status.database === "turso"
                  ? "bg-green-50 border-green-200 text-green-900"
                  : "bg-yellow-50 border-yellow-200 text-yellow-900"
              }`}
            >
              <span>
                <strong>Database:</strong>{" "}
                {status.database === "turso"
                  ? "Turso (connected — data persists across redeploys)"
                  : "Local file (⚠️ data will be WIPED on next redeploy — set TURSO_DATABASE_URL / TURSO_AUTH_TOKEN)"}
              </span>
              <span>
                <strong>Image storage:</strong>{" "}
                {status.imageStorage === "cloudinary"
                  ? "Cloudinary (connected)"
                  : "Inline database storage (set CLOUDINARY_* env vars to switch)"}
              </span>
            </div>
          )}

          {/* Statistics Cards */}
          <div className="grid md:grid-cols-4 gap-6 mb-8">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm mb-1">
                    Total Revenue
                  </p>
                  <p className="text-3xl font-bold text-accent-rose">
                    ${totalRevenue.toFixed(2)}
                  </p>
                </div>
                <DollarSign className="w-12 h-12 text-accent-rose/20" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm mb-1">
                    Total Orders
                  </p>
                  <p className="text-3xl font-bold">{totalOrders}</p>
                </div>
                <ShoppingBag className="w-12 h-12 text-blue-500/20" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm mb-1">
                    Total Products
                  </p>
                  <p className="text-3xl font-bold">{totalProducts}</p>
                </div>
                <Package className="w-12 h-12 text-green-500/20" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm mb-1">
                    Total Users
                  </p>
                  <p className="text-3xl font-bold">{totalUsers}</p>
                </div>
                <Users className="w-12 h-12 text-purple-500/20" />
              </div>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid lg:grid-cols-2 gap-8 mb-8">
            {/* Revenue Chart */}
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-6">Revenue Trend</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke="var(--accent-rose)"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            {/* Order Status Chart */}
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-6">Order Status Distribution</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={statusData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="status" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="var(--accent-rose)" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Recent Orders */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Recent Orders</h2>
              <Link href="/admin/orders">
                <a className="text-accent-rose hover:text-accent-rose/80 text-sm font-medium">
                  View All
                </a>
              </Link>
            </div>

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
                    <th className="text-left py-3 px-4 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {orders?.slice(0, 5).map((order) => (
                    <tr key={order.id} className="border-b border-border hover:bg-secondary">
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
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
