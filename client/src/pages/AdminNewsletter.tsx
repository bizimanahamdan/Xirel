import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut, Copy, Download, Mail } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";

export default function AdminNewsletter() {
  const { user, logout } = useAuth();
  const { data: subscribers, isLoading } = trpc.newsletter.list.useQuery();

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

  const copyEmails = () => {
    if (!subscribers?.length) return;
    const emails = subscribers.map((s) => s.email).join(", ");
    navigator.clipboard.writeText(emails);
    toast.success(`Copied ${subscribers.length} email${subscribers.length !== 1 ? "s" : ""}`);
  };

  const downloadCsv = () => {
    if (!subscribers?.length) return;
    const rows = [
      ["email", "joined"],
      ...subscribers.map((s) => [s.email, new Date(s.createdAt).toISOString()]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `xirel-newsletter-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
      <div className="flex flex-col md:flex-row">
        <div className="w-full md:w-64 bg-card border-b md:border-b-0 md:border-r border-border p-4 md:p-6 md:min-h-screen md:sticky md:top-16">
          <nav className="flex gap-2 overflow-x-auto pb-1 md:pb-0 md:flex-col md:gap-0 md:space-y-2">
            <Link href="/admin">
              <span className="block px-4 py-2 rounded-lg hover:bg-secondary transition-colors cursor-pointer flex-shrink-0 whitespace-nowrap">
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
              <span className="block px-4 py-2 rounded-lg bg-accent text-white font-medium cursor-pointer flex-shrink-0 whitespace-nowrap">
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
          <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-4xl font-bold mb-2">Newsletter</h1>
              <p className="text-muted-foreground">
                Everyone who signed up via the footer email capture
              </p>
            </div>
            {subscribers && subscribers.length > 0 && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={copyEmails}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy All
                </Button>
                <Button variant="outline" onClick={downloadCsv}>
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            )}
          </div>

          <Card className="p-6">
            <p className="text-sm text-muted-foreground mb-4">
              {isLoading ? "Loading..." : `${subscribers?.length ?? 0} subscriber${subscribers?.length !== 1 ? "s" : ""}`}
            </p>

            {!isLoading && (!subscribers || subscribers.length === 0) ? (
              <div className="text-center py-12">
                <Mail className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground">No subscribers yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border">
                    <tr>
                      <th className="text-left py-3 px-4 font-semibold">Email</th>
                      <th className="text-left py-3 px-4 font-semibold">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscribers?.map((s) => (
                      <tr key={s.id} className="border-b border-border last:border-0">
                        <td className="py-3 px-4">{s.email}</td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {new Date(s.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
