import { useState, useEffect } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogOut, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { Logo } from "@/components/Logo";

export default function AdminPaymentSettings() {
  const { user, logout } = useAuth();
  const [showKeys, setShowKeys] = useState(false);
  const [formData, setFormData] = useState({
    stripePublishableKey: "",
    stripeSecretKey: "",
    stripeEnabled: false,
    paypalEnabled: false,
  });

  const { data: settings } = trpc.paymentSettings.get.useQuery();
  const updateSettingsMutation = trpc.paymentSettings.update.useMutation({
    onSuccess: () => {
      toast.success("Payment settings updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update payment settings", {
        description: error.message,
      });
    },
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        stripePublishableKey: settings.stripePublishableKey || "",
        stripeSecretKey: settings.stripeSecretKey || "",
        stripeEnabled: settings.stripeEnabled || false,
        paypalEnabled: settings.paypalEnabled || false,
      });
    }
  }, [settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettingsMutation.mutate({
      stripePublishableKey: formData.stripePublishableKey || undefined,
      stripeSecretKey: formData.stripeSecretKey || undefined,
      stripeEnabled: formData.stripeEnabled,
      paypalEnabled: formData.paypalEnabled,
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
              <span className="block px-4 py-2 rounded-lg hover:bg-secondary transition-colors cursor-pointer">
                Orders
              </span>
            </Link>
            <Link href="/admin/users">
              <span className="block px-4 py-2 rounded-lg hover:bg-secondary transition-colors cursor-pointer">
                Users
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
              Configure payment methods and API keys
            </p>
          </div>

          <div className="max-w-2xl">
            <Card className="p-8">
              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Stripe Configuration */}
                <div className="border-b border-border pb-8">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-2xl font-bold">Stripe Payment</h2>
                      <p className="text-muted-foreground mt-1">
                        Enable Stripe to accept credit card payments
                      </p>
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.stripeEnabled}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            stripeEnabled: e.target.checked,
                          })
                        }
                        className="w-5 h-5 rounded border-border cursor-pointer"
                      />
                      <span className="text-sm font-medium">
                        {formData.stripeEnabled ? "Enabled" : "Disabled"}
                      </span>
                    </label>
                  </div>

                  {formData.stripeEnabled && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold mb-2">
                          Stripe Publishable Key
                        </label>
                        <div className="relative">
                          <Input
                            type={showKeys ? "text" : "password"}
                            value={formData.stripePublishableKey}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                stripePublishableKey: e.target.value,
                              })
                            }
                            placeholder="pk_live_..."
                          />
                          <button
                            type="button"
                            onClick={() => setShowKeys(!showKeys)}
                            className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                          >
                            {showKeys ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Found in your Stripe Dashboard under Developers &gt;
                          API keys
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold mb-2">
                          Stripe Secret Key
                        </label>
                        <div className="relative">
                          <Input
                            type={showKeys ? "text" : "password"}
                            value={formData.stripeSecretKey}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                stripeSecretKey: e.target.value,
                              })
                            }
                            placeholder="sk_live_..."
                          />
                          <button
                            type="button"
                            onClick={() => setShowKeys(!showKeys)}
                            className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                          >
                            {showKeys ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Keep this key secret and never share it publicly
                        </p>
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm text-blue-800">
                          <strong>How to get your Stripe keys:</strong>
                        </p>
                        <ol className="text-sm text-blue-800 list-decimal list-inside mt-2 space-y-1">
                          <li>Go to stripe.com and sign in to your account</li>
                          <li>
                            Navigate to Developers &gt; API keys in the sidebar
                          </li>
                          <li>Copy your Publishable and Secret keys</li>
                          <li>Paste them in the fields above</li>
                        </ol>
                      </div>
                    </div>
                  )}
                </div>

                {/* PayPal Configuration */}
                <div className="pb-8">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-2xl font-bold">PayPal Payment</h2>
                      <p className="text-muted-foreground mt-1">
                        Enable PayPal for customer payments
                      </p>
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.paypalEnabled}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            paypalEnabled: e.target.checked,
                          })
                        }
                        className="w-5 h-5 rounded border-border cursor-pointer"
                        disabled
                      />
                      <span className="text-sm font-medium">
                        {formData.paypalEnabled ? "Enabled" : "Disabled"}
                      </span>
                    </label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    PayPal integration coming soon
                  </p>
                </div>

                {/* Submit Button */}
                <div className="flex gap-4">
                  <Button
                    type="submit"
                    disabled={updateSettingsMutation.isPending}
                    className="btn-primary"
                  >
                    {updateSettingsMutation.isPending
                      ? "Saving..."
                      : "Save Settings"}
                  </Button>
                </div>
              </form>
            </Card>

            {/* Info Box */}
            <Card className="p-6 mt-8 bg-accent-light">
              <h3 className="font-semibold mb-2">Security Notice</h3>
              <p className="text-sm">
                Your payment credentials are encrypted and stored securely. Never
                share your Stripe Secret Key with anyone. Always use HTTPS for
                your website.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
