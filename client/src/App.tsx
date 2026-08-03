import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import Home from "@/pages/Home";
import Products from "@/pages/Products";
import ProductDetail from "@/pages/ProductDetail";
import Cart from "@/pages/Cart";
import Checkout from "@/pages/Checkout";
import { Route, Switch, useLocation } from "wouter";
import { useEffect } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminProducts from "@/pages/AdminProducts";
import AdminOrders from "@/pages/AdminOrders";
import AdminUsers from "@/pages/AdminUsers";
import AdminPaymentSettings from "@/pages/AdminPaymentSettings";
import AdminAnalytics from "@/pages/AdminAnalytics";
import Orders from "@/pages/Orders";
import Login from "@/pages/Login";
import Account from "@/pages/Account";
import FAQ from "@/pages/FAQ";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import ReturnPolicy from "@/pages/ReturnPolicy";
import Support from "@/pages/Support";
import { useAnalyticsTracker } from "@/_core/hooks/useAnalyticsTracker";

/** Fires a page_view analytics event on every route change. Rendered once,
 * inside the router, so it sees every navigation without each page needing
 * to remember to track itself. */
function PageViewTracker() {
  const [location] = useLocation();
  const { trackPageView } = useAnalyticsTracker();

  useEffect(() => {
    trackPageView(location);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  return null;
}

function Router() {
  return (
    <>
      <PageViewTracker />
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/products"} component={Products} />
        <Route path={"/products/:id"} component={ProductDetail} />
        <Route path={"/cart"} component={Cart} />
        <Route path={"/checkout"} component={Checkout} />
        <Route path={"/orders"} component={Orders} />
        <Route path={"/login"} component={Login} />
        <Route path={"/account"} component={Account} />
        <Route path={"/faq"} component={FAQ} />
        <Route path={"/privacy-policy"} component={PrivacyPolicy} />
        <Route path={"/returns"} component={ReturnPolicy} />
        <Route path={"/support"} component={Support} />
        <Route path={"/admin"} component={AdminDashboard} />
        <Route path={"/admin/products"} component={AdminProducts} />
        <Route path={"/admin/orders"} component={AdminOrders} />
        <Route path={"/admin/users"} component={AdminUsers} />
        <Route path={"/admin/payment-settings"} component={AdminPaymentSettings} />
        <Route path={"/admin/analytics"} component={AdminAnalytics} />
        <Route path={"/404"} component={NotFound} />
        {/* Final fallback route */}
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
