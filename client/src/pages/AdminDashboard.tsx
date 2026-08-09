import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Cell,
} from "recharts";
import {
  ShoppingBag,
  DollarSign,
  Users,
  Package,
  LogOut,
  Plus,
  AlertTriangle,
  ArrowUpRight,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Logo } from "@/components/Logo";

const AVATAR_COLORS = ["#B5602B", "#5E6B4C", "#71685A", "#E08B4E"];

function initials(name: string | undefined | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

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

  const lowStockProducts = (products ?? [])
    .filter((p) => p.stock <= 5)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 5);

  // Orders per day, last 7 days present in the data
  const chartData = (orders || [])
    .slice()
    .reverse()
    .slice(-7)
    .map((order) => ({
      date: new Date(order.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      amount: parseFloat(order.totalAmount || "0"),
    }));

  const statusData = [
    { status: "Pending", count: orders?.filter((o) => o.status === "pending").length || 0 },
    { status: "Paid", count: orders?.filter((o) => o.status === "paid").length || 0 },
    { status: "Processing", count: orders?.filter((o) => o.status === "processing").length || 0 },
    { status: "Shipped", count: orders?.filter((o) => o.status === "shipped").length || 0 },
    { status: "Delivered", count: orders?.filter((o) => o.status === "delivered").length || 0 },
  ];
  const peakIndex = statusData.reduce(
    (best, s, i) => (s.count > statusData[best].count ? i : best),
    0
  );

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
            <span className="text-sm text-muted-foreground hidden sm:inline">
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
        <div className="flex-1 p-6 md:p-8">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold mb-1">Welcome back, {user?.name?.split(" ")[0] || "there"}</h1>
              <p className="text-muted-foreground">
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
              </p>
            </div>
            <Link href="/admin/products">
              <span className="btn-primary inline-flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add Product
              </span>
            </Link>
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

          {/* Top row: hero revenue card + orders trend + status chart */}
          <div className="grid lg:grid-cols-3 gap-6 mb-6">
            {/* Hero revenue card */}
            <Card
              className="p-6 border-0 text-white relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, #B5602B, #7a3f1a)" }}
            >
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                  <p className="text-sm text-white/70">Total Revenue</p>
                  <DollarSign className="w-5 h-5 text-white/50" />
                </div>
                <p className="text-3xl font-bold mb-1 mono">${totalRevenue.toFixed(2)}</p>
                <p className="text-xs text-white/60 mb-6">Across {totalOrders} order{totalOrders !== 1 ? "s" : ""}</p>
                <div className="flex items-center justify-between text-sm border-t border-white/20 pt-4">
                  <div>
                    <p className="text-white/60 text-xs">Products</p>
                    <p className="font-semibold">{totalProducts}</p>
                  </div>
                  <div>
                    <p className="text-white/60 text-xs">Customers</p>
                    <p className="font-semibold">{totalUsers}</p>
                  </div>
                </div>
              </div>
              <div className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full bg-white/10" />
            </Card>

            {/* Orders trend area chart */}
            <Card className="p-6 lg:col-span-2">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-bold">Order Value Trend</h2>
                <span className="text-xs text-muted-foreground">Last 7 orders</span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#B5602B" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#B5602B" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                  <YAxis tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                  <Tooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="#B5602B"
                    strokeWidth={2}
                    fill="url(#revenueGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Order status bar chart */}
          <Card className="p-6 mb-6">
            <h2 className="text-lg font-bold mb-6">Order Status Distribution</h2>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={statusData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="status" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={i === peakIndex ? "#B5602B" : "#DED2B8"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Recent Orders + Low Stock Alert */}
          <div className="grid lg:grid-cols-3 gap-6">
            <Card className="p-6 lg:col-span-2">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold">Recent Orders</h2>
                <Link href="/admin/orders">
                  <span className="text-accent-rose hover:text-accent-rose/80 text-sm font-medium inline-flex items-center gap-1 cursor-pointer">
                    View All <ArrowUpRight className="w-3.5 h-3.5" />
                  </span>
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border">
                    <tr>
                      <th className="text-left py-3 px-2 font-semibold">Customer</th>
                      <th className="text-left py-3 px-2 font-semibold">Order #</th>
                      <th className="text-left py-3 px-2 font-semibold">Status</th>
                      <th className="text-right py-3 px-2 font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders?.slice(0, 6).map((order, i) => {
                      const name = `${order.shippingAddress?.firstName ?? ""} ${order.shippingAddress?.lastName ?? ""}`.trim();
                      return (
                        <tr key={order.id} className="border-b border-border last:border-0 hover:bg-secondary">
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 mono"
                                style={{ backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                              >
                                {initials(name)}
                              </div>
                              <span className="truncate max-w-[140px]">{name || "—"}</span>
                            </div>
                          </td>
                          <td className="py-3 px-2 text-muted-foreground mono text-xs">{order.orderNumber}</td>
                          <td className="py-3 px-2">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium ${
                                order.status === "delivered" || order.status === "paid"
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
                          <td className="py-3 px-2 text-right font-semibold text-accent-rose mono">
                            ${parseFloat(order.totalAmount || "0").toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                    {(!orders || orders.length === 0) && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-muted-foreground">
                          No orders yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Low Stock Alert */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-6">
                <AlertTriangle className="w-4 h-4 text-accent-rose" />
                <h2 className="text-lg font-bold">Low Stock</h2>
              </div>

              {lowStockProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground">All products are well stocked.</p>
              ) : (
                <div className="space-y-4">
                  {lowStockProducts.map((product) => (
                    <Link key={product.id} href="/admin/products">
                      <div className="flex items-center gap-3 cursor-pointer group">
                        <div className="w-10 h-10 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                          {product.imageUrl && (
                            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate group-hover:text-accent-rose transition-colors">
                            {product.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {product.stock === 0 ? "Out of stock" : `${product.stock} left`}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${
                            product.stock === 0 ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {product.stock === 0 ? "Out" : "Low"}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
