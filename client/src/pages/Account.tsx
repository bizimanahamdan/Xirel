import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { ShoppingBag, ArrowLeft, User, Package, LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Logo } from "@/components/Logo";

export default function Account() {
  const { user, isAuthenticated, logout } = useAuth();

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <nav className="sticky top-0 z-50 bg-card border-b border-border shadow-sm">
          <div className="container flex items-center justify-between h-16">
            <Link href="/">
              <span className="cursor-pointer">
                <Logo />
              </span>
            </Link>
          </div>
        </nav>

        <div className="container py-12 flex items-center justify-center min-h-96">
          <Card className="p-8 text-center">
            <h1 className="text-2xl font-bold mb-4">Sign In Required</h1>
            <p className="text-muted-foreground mb-6">Please sign in to view your account</p>
            <Link href="/login">
              <span className="btn-primary inline-block">Sign In</span>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-card border-b border-border shadow-sm">
        <div className="container flex items-center justify-between h-16">
          <Link href="/">
            <span className="cursor-pointer">
              <Logo />
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/cart">
              <span className="text-foreground hover:text-accent-rose transition-colors cursor-pointer">
                <ShoppingBag className="w-5 h-5" />
              </span>
            </Link>
          </div>
        </div>
      </nav>

      <div className="container py-12 max-w-2xl">
        <Link href="/">
          <span className="inline-flex items-center gap-2 text-accent-rose hover:text-accent-rose/80 mb-8 cursor-pointer">
            <ArrowLeft className="w-4 h-4" />
            Back Home
          </span>
        </Link>

        <h1 className="text-4xl font-bold mb-8">My Account</h1>

        {/* Profile */}
        <Card className="p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-full bg-accent-rose-light flex items-center justify-center flex-shrink-0">
              <User className="w-6 h-6 text-accent-rose" />
            </div>
            <div>
              <p className="text-xl font-bold">{user?.name || "Welcome"}</p>
              <p className="text-muted-foreground text-sm">{user?.email}</p>
            </div>
            {user?.role === "admin" && (
              <span className="ml-auto inline-flex items-center gap-1 px-3 py-1 rounded-full bg-accent-rose-light text-accent-rose text-xs font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                Admin
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
          </p>
        </Card>

        {/* Quick links */}
        <div className="space-y-3">
          <Link href="/orders">
            <Card className="p-4 flex items-center gap-3 hover:shadow-md transition-shadow cursor-pointer">
              <Package className="w-5 h-5 text-accent-rose" />
              <div className="flex-1">
                <p className="font-semibold">Order History</p>
                <p className="text-sm text-muted-foreground">View your past orders</p>
              </div>
            </Card>
          </Link>

          {user?.role === "admin" && (
            <Link href="/admin">
              <Card className="p-4 flex items-center gap-3 hover:shadow-md transition-shadow cursor-pointer">
                <ShieldCheck className="w-5 h-5 text-accent-rose" />
                <div className="flex-1">
                  <p className="font-semibold">Admin Dashboard</p>
                  <p className="text-sm text-muted-foreground">Manage products, orders, and settings</p>
                </div>
              </Card>
            </Link>
          )}

          <button onClick={() => logout()} className="w-full text-left">
            <Card className="p-4 flex items-center gap-3 hover:shadow-md transition-shadow cursor-pointer">
              <LogOut className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="font-semibold">Sign Out</p>
              </div>
            </Card>
          </button>
        </div>
      </div>
    </div>
  );
}
