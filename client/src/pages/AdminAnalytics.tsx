import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { LogOut } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Logo } from "@/components/Logo";

function StatBar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {count} ({pct}%)
        </span>
      </div>
      <div className="w-full bg-secondary rounded-full h-2">
        <div className="bg-accent-rose h-2 rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function AdminAnalytics() {
  const { user, logout } = useAuth();
  const { data: summary, isLoading: summaryLoading } = trpc.analytics.summary.useQuery({ days: 30 });
  const { data: emptyResults, isLoading: emptyLoading } = trpc.analytics.emptyResults.useQuery({
    days: 30,
  });

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

  const deviceTotal = summary?.byDevice.reduce((sum, d) => sum + d.count, 0) ?? 0;
  const browserTotal = summary?.byBrowser.reduce((sum, b) => sum + b.count, 0) ?? 0;
  const osTotal = summary?.byOs.reduce((sum, o) => sum + o.count, 0) ?? 0;

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
              <span className="block px-4 py-2 rounded-lg bg-accent text-white font-medium cursor-pointer flex-shrink-0 whitespace-nowrap">
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
            <h1 className="text-4xl font-bold mb-2">Analytics</h1>
            <p className="text-muted-foreground">
              Visitor devices/browsers and searches or categories that came up empty — last 30 days
            </p>
          </div>

          {summaryLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : (
            <>
              <div className="grid md:grid-cols-4 gap-6 mb-8">
                <Card className="p-6">
                  <p className="text-sm text-muted-foreground mb-1">Page Views</p>
                  <p className="text-3xl font-bold">{summary?.totalViews ?? 0}</p>
                </Card>
              </div>

              <div className="grid md:grid-cols-3 gap-6 mb-8">
                <Card className="p-6">
                  <h3 className="font-bold mb-4">Device</h3>
                  {summary?.byDevice.length ? (
                    summary.byDevice.map((d) => (
                      <StatBar key={d.device} label={d.device} count={d.count} total={deviceTotal} />
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No data yet</p>
                  )}
                </Card>

                <Card className="p-6">
                  <h3 className="font-bold mb-4">Browser</h3>
                  {summary?.byBrowser.length ? (
                    summary.byBrowser.map((b) => (
                      <StatBar key={b.browser} label={b.browser} count={b.count} total={browserTotal} />
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No data yet</p>
                  )}
                </Card>

                <Card className="p-6">
                  <h3 className="font-bold mb-4">Operating System</h3>
                  {summary?.byOs.length ? (
                    summary.byOs.map((o) => (
                      <StatBar key={o.os} label={o.os} count={o.count} total={osTotal} />
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No data yet</p>
                  )}
                </Card>
              </div>

              <Card className="p-6 mb-8">
                <h3 className="font-bold mb-4">Most Visited Pages</h3>
                {summary?.topPaths.length ? (
                  <table className="w-full text-sm">
                    <tbody>
                      {summary.topPaths.map((p) => (
                        <tr key={p.path} className="border-b border-border last:border-0">
                          <td className="py-2 px-2 font-mono text-xs">{p.path}</td>
                          <td className="py-2 px-2 text-right">{p.count} views</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-muted-foreground">No data yet</p>
                )}
              </Card>
            </>
          )}

          <div className="mb-4">
            <h2 className="text-2xl font-bold mb-1">Zero-Result Events</h2>
            <p className="text-muted-foreground text-sm">
              Things customers searched for or browsed that turned up nothing — good candidates for new
              products or category coverage.
            </p>
          </div>

          {emptyLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="font-bold mb-4">Searches With No Results</h3>
                {emptyResults?.emptySearches.length ? (
                  <table className="w-full text-sm">
                    <thead className="border-b border-border">
                      <tr>
                        <th className="text-left py-2 px-2 font-semibold">Search term</th>
                        <th className="text-right py-2 px-2 font-semibold">Times</th>
                      </tr>
                    </thead>
                    <tbody>
                      {emptyResults.emptySearches.map((s) => (
                        <tr key={s.query} className="border-b border-border last:border-0">
                          <td className="py-2 px-2">{s.query}</td>
                          <td className="py-2 px-2 text-right">{s.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-muted-foreground">No empty searches recorded</p>
                )}
              </Card>

              <Card className="p-6">
                <h3 className="font-bold mb-4">Categories Viewed With No Products</h3>
                {emptyResults?.emptyCategoryViews.length ? (
                  <table className="w-full text-sm">
                    <thead className="border-b border-border">
                      <tr>
                        <th className="text-left py-2 px-2 font-semibold">Category</th>
                        <th className="text-right py-2 px-2 font-semibold">Times</th>
                      </tr>
                    </thead>
                    <tbody>
                      {emptyResults.emptyCategoryViews.map((c) => (
                        <tr key={c.categorySlug} className="border-b border-border last:border-0">
                          <td className="py-2 px-2">{c.categorySlug}</td>
                          <td className="py-2 px-2 text-right">{c.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-muted-foreground">No empty category views recorded</p>
                )}
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
