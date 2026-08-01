import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { LogOut, Smartphone, CheckCircle2, XCircle } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Logo } from "@/components/Logo";

export default function AdminPaymentSettings() {
  const { user, logout } = useAuth();
  const { data: momoStatus } = trpc.payments.momo.status.useQuery();
  const { data: printifyStatus } = trpc.integrations.printify.status.useQuery();
  const { data: cjStatus } = trpc.integrations.cj.status.useQuery();

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
              <span className="block px-4 py-2 rounded-lg hover:bg-secondary transition-colors cursor-pointer">
                Orders
              </span>
            </Link>
            <Link href="/admin/users">
              <span className="block px-4 py-2 rounded-lg hover:bg-secondary transition-colors cursor-pointer">
                Users
              </span>
            </Link>
            <Link href="/admin/analytics">
              <span className="block px-4 py-2 rounded-lg hover:bg-secondary transition-colors cursor-pointer">
                Analytics
              </span>
            </Link>
            <Link href="/admin/payment-settings">
              <span className="block px-4 py-2 rounded-lg bg-accent text-white font-medium cursor-pointer">
                Payment Settings
              </span>
            </Link>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Payment Settings</h1>
            <p className="text-muted-foreground">
              These are configured via environment variables on your host (Render), not from this
              page — this shows what's currently active.
            </p>
          </div>

          <div className="max-w-2xl space-y-6">
            {/* MTN MoMo */}
            <Card className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-[#FFCC00]/20 flex items-center justify-center flex-shrink-0">
                  <Smartphone className="w-6 h-6 text-[#FFCC00]" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-xl font-bold">MTN Mobile Money</h2>
                    {momoStatus?.configured ? (
                      <span className="inline-flex items-center gap-1 text-green-700 text-sm font-medium">
                        <CheckCircle2 className="w-4 h-4" /> Connected
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-yellow-700 text-sm font-medium">
                        <XCircle className="w-4 h-4" /> Not connected
                      </span>
                    )}
                  </div>
                  {momoStatus?.configured ? (
                    <p className="text-sm text-muted-foreground">
                      Environment: <span className="font-mono">{momoStatus.targetEnvironment}</span> ·
                      Currency: <span className="font-mono">{momoStatus.currency}</span>
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Checkout falls back to creating a pending order for manual payment
                      confirmation until this is connected. Set{" "}
                      <code className="bg-secondary px-1 rounded">MOMO_API_USER</code>,{" "}
                      <code className="bg-secondary px-1 rounded">MOMO_API_KEY</code>, and{" "}
                      <code className="bg-secondary px-1 rounded">MOMO_SUBSCRIPTION_KEY</code> in
                      your environment variables (from momodeveloper.mtn.co.rw).
                    </p>
                  )}
                </div>
              </div>
            </Card>

            {/* Printify */}
            <Card className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 font-bold text-lg">
                  P
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-xl font-bold">Printify</h2>
                    {printifyStatus?.tokenConfigured && printifyStatus?.shopIdConfigured ? (
                      <span className="inline-flex items-center gap-1 text-green-700 text-sm font-medium">
                        <CheckCircle2 className="w-4 h-4" /> Connected
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-yellow-700 text-sm font-medium">
                        <XCircle className="w-4 h-4" /> Not connected
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Manage this from{" "}
                    <Link href="/admin/products">
                      <span className="text-accent-rose hover:underline cursor-pointer">Products</span>
                    </Link>
                    , where you can browse and import Printify products directly.
                  </p>
                </div>
              </div>
            </Card>

            {/* CJ Dropshipping */}
            <Card className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 font-bold text-lg">
                  CJ
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-xl font-bold">CJ Dropshipping</h2>
                    {cjStatus?.configured ? (
                      <span className="inline-flex items-center gap-1 text-green-700 text-sm font-medium">
                        <CheckCircle2 className="w-4 h-4" /> Connected
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-yellow-700 text-sm font-medium">
                        <XCircle className="w-4 h-4" /> Not connected
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Manage this from{" "}
                    <Link href="/admin/products">
                      <span className="text-accent-rose hover:underline cursor-pointer">Products</span>
                    </Link>
                    , where you can search and import CJ products directly.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-accent-light">
              <h3 className="font-semibold mb-2">Why no keys entered here?</h3>
              <p className="text-sm">
                All of these credentials live as environment variables on your hosting provider
                (Render), not in this database — that keeps secrets out of your app's data and off
                any admin screen. This page just reflects what's currently active.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
