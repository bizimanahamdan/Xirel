import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { ShoppingBag, Zap, Shirt, ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";
import { Logo } from "@/components/Logo";

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [featuredProducts, setFeaturedProducts] = useState<any[]>([]);

  const { data: products } = trpc.products.list.useQuery({
    categoryId: undefined,
  });

  useEffect(() => {
    if (products && products.length > 0) {
      setFeaturedProducts(products.slice(0, 6));
    }
  }, [products]);

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
        <div className="container flex items-center justify-between h-16">
          <Link href="/">
            <span className="cursor-pointer">
              <Logo />
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <Link href="/products">
              <span className="text-foreground hover:text-accent-rose transition-colors cursor-pointer">
                Shop
              </span>
            </Link>
            {isAuthenticated && user?.role === "admin" && (
              <Link href="/admin">
                <span className="text-foreground hover:text-accent-rose transition-colors cursor-pointer">
                  Admin
                </span>
              </Link>
            )}
            {isAuthenticated && (
              <>
                <Link href="/cart">
                  <span className="relative text-foreground hover:text-accent-rose transition-colors cursor-pointer">
                    <ShoppingBag className="w-5 h-5" />
                  </span>
                </Link>
                <Link href="/account">
                  <span className="text-foreground hover:text-accent-rose transition-colors cursor-pointer">
                    Account
                  </span>
                </Link>
              </>
            )}
            {!isAuthenticated && (
              <Link href="/login">
                <span className="text-foreground hover:text-accent-rose transition-colors cursor-pointer">
                  Sign In
                </span>
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-white via-accent-rose-light to-white py-20 md:py-32">
        <div className="container">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <h1 className="text-5xl md:text-6xl font-bold text-foreground leading-tight">
                  Discover Premium
                  <span className="gradient-text"> Style & Innovation</span>
                </h1>
                <p className="text-xl text-muted-foreground max-w-lg">
                  Curated collections of electronics and fashion for the discerning taste. Experience luxury redefined.
                </p>
              </div>

              <div className="flex gap-4">
                <Link href="/products">
                  <span className="btn-primary inline-flex items-center gap-2">
                    Start Shopping <ArrowRight className="w-4 h-4" />
                  </span>
                </Link>
                <Link href="/products?category=electronics">
                  <span className="btn-secondary inline-flex items-center gap-2">
                    Explore Electronics
                  </span>
                </Link>
              </div>
            </div>

            <div className="relative h-96 md:h-full flex items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-br from-accent-rose/20 to-transparent rounded-3xl blur-3xl"></div>
              <div className="relative grid grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl p-8 shadow-lg border border-border flex items-center justify-center h-40">
                  <Zap className="w-16 h-16 text-accent-rose" />
                </div>
                <div className="bg-white rounded-2xl p-8 shadow-lg border border-border flex items-center justify-center h-40">
                  <Shirt className="w-16 h-16 text-accent-rose" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-16 md:py-24 bg-white">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Shop by Category</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Explore our carefully curated collections of premium products
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <Link href="/products?category=electronics">
              <span className="group relative overflow-hidden rounded-2xl h-64 md:h-80 cursor-pointer block">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-blue-600 group-hover:scale-110 transition-transform duration-300"></div>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                  <Zap className="w-16 h-16 mb-4 group-hover:scale-125 transition-transform duration-300" />
                  <h3 className="text-3xl font-bold">Electronics</h3>
                  <p className="text-blue-100 mt-2">Cutting-edge technology</p>
                </div>
              </span>
            </Link>

            <Link href="/products?category=outfits">
              <span className="group relative overflow-hidden rounded-2xl h-64 md:h-80 cursor-pointer block">
                <div className="absolute inset-0 bg-gradient-to-br from-accent-rose to-pink-600 group-hover:scale-110 transition-transform duration-300"></div>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                  <Shirt className="w-16 h-16 mb-4 group-hover:scale-125 transition-transform duration-300" />
                  <h3 className="text-3xl font-bold">Outfits</h3>
                  <p className="text-pink-100 mt-2">Premium fashion collection</p>
                </div>
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Products Section */}
      {featuredProducts.length > 0 && (
        <section className="py-16 md:py-24 bg-secondary">
          <div className="container">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-4">Featured Products</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Handpicked selections from our premium collection
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {featuredProducts.map((product) => (
                <Link key={product.id} href={`/products/${product.id}`}>
                  <span className="group cursor-pointer block">
                    <Card className="card-hover overflow-hidden h-full">
                      <div className="aspect-square bg-muted overflow-hidden rounded-lg mb-4">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-accent-rose/20 to-transparent">
                            <ShoppingBag className="w-12 h-12 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <h3 className="font-semibold text-lg line-clamp-2 group-hover:text-accent-rose transition-colors">
                          {product.name}
                        </h3>
                        <p className="text-muted-foreground text-sm line-clamp-2">
                          {product.description}
                        </p>
                        <div className="flex items-center justify-between pt-4">
                          <span className="text-2xl font-bold text-accent-rose">
                            ${parseFloat(product.price).toFixed(2)}
                          </span>
                          <span
                            className={`text-sm font-medium ${
                              product.stock > 0
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {product.stock > 0 ? "In Stock" : "Out of Stock"}
                          </span>
                        </div>
                      </div>
                    </Card>
                  </span>
                </Link>
              ))}
            </div>

            <div className="text-center mt-12">
              <Link href="/products">
                <span className="btn-primary inline-flex items-center gap-2">
                  View All Products <ArrowRight className="w-4 h-4" />
                </span>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Features Section */}
      <section className="py-16 md:py-24 bg-white">
        <div className="container">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShoppingBag className="w-8 h-8 text-accent-rose" />
              </div>
              <h3 className="text-xl font-bold mb-2">Premium Quality</h3>
              <p className="text-muted-foreground">
                Carefully curated products from trusted brands
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-accent-rose" />
              </div>
              <h3 className="text-xl font-bold mb-2">Fast Shipping</h3>
              <p className="text-muted-foreground">
                Quick and reliable delivery to your doorstep
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shirt className="w-8 h-8 text-accent-rose" />
              </div>
              <h3 className="text-xl font-bold mb-2">Secure Checkout</h3>
              <p className="text-muted-foreground">
                Protected payments with industry-leading security
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-foreground text-white py-12 md:py-16">
        <div className="container">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="mb-4">
                <Logo size={32} />
              </div>
              <p className="text-gray-300 text-sm">
                Premium shopping experience for discerning customers
              </p>
            </div>
            <div>
              <h4 className="text-lg font-bold mb-4">Shop</h4>
              <ul className="space-y-2 text-sm text-gray-300">
                <li>
                  <Link href="/products?category=electronics">
                    <span className="hover:text-white transition-colors cursor-pointer">Electronics</span>
                  </Link>
                </li>
                <li>
                  <Link href="/products?category=outfits">
                    <span className="hover:text-white transition-colors cursor-pointer">Outfits</span>
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-bold mb-4">Account</h4>
              <ul className="space-y-2 text-sm text-gray-300">
                <li>
                  <Link href="/account">
                    <span className="hover:text-white transition-colors cursor-pointer">My Account</span>
                  </Link>
                </li>
                <li>
                  <Link href="/orders">
                    <span className="hover:text-white transition-colors cursor-pointer">Orders</span>
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-bold mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-gray-300">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Contact Us
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    FAQ
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-700 pt-8 text-center text-sm text-gray-300">
            <p>&copy; {new Date().getFullYear()} Xirel. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
