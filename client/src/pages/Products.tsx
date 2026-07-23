import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShoppingBag, Search, ArrowRight } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function Products() {
  const [location] = useLocation();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>();
  const [minPrice, setMinPrice] = useState<number | undefined>();
  const [maxPrice, setMaxPrice] = useState<number | undefined>();
  const [sortBy, setSortBy] = useState("newest");

  // Get URL params
  const params = new URLSearchParams(location.split("?")[1] || "");
  const categoryParam = params.get("category");

  const { data: categories } = trpc.categories.list.useQuery();
  const { data: products, isLoading } = trpc.products.list.useQuery({
    categoryId: selectedCategory,
    search: search || undefined,
    minPrice: minPrice,
    maxPrice: maxPrice,
  });

  // Set category from URL param
  const categoryId = useMemo(() => {
    if (categoryParam && categories) {
      const cat = categories.find((c) => c.slug === categoryParam);
      return cat?.id;
    }
    return selectedCategory;
  }, [categoryParam, categories, selectedCategory]);

  const sortedProducts = useMemo(() => {
    if (!products) return [];

    let sorted = [...products];
    if (sortBy === "price-low") {
      sorted.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
    } else if (sortBy === "price-high") {
      sorted.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
    } else if (sortBy === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
    return sorted;
  }, [products, sortBy]);

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
        <div className="container flex items-center justify-between h-16">
          <Link href="/">
            <a className="cursor-pointer">
                <Logo />
              </a>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/cart">
              <a className="text-foreground hover:text-accent-rose transition-colors">
                <ShoppingBag className="w-5 h-5" />
              </a>
            </Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="bg-gradient-to-br from-white via-accent-rose-light to-white py-12">
        <div className="container">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Shop All Products</h1>
          <p className="text-lg text-muted-foreground">
            Discover our premium collection of electronics and fashion
          </p>
        </div>
      </section>

      {/* Main Content */}
      <div className="container py-12">
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Sidebar - Filters */}
          <div className="lg:col-span-1">
            <div className="space-y-6 sticky top-24">
              {/* Search */}
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search products..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Categories */}
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Category
                </label>
                <Select
                  value={selectedCategory?.toString() || "all"}
                  onValueChange={(val) =>
                    setSelectedCategory(val === "all" ? undefined : parseInt(val))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Price Range */}
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Price Range
                </label>
                <div className="space-y-2">
                  <Input
                    type="number"
                    placeholder="Min price"
                    value={minPrice || ""}
                    onChange={(e) =>
                      setMinPrice(e.target.value ? parseInt(e.target.value) : undefined)
                    }
                  />
                  <Input
                    type="number"
                    placeholder="Max price"
                    value={maxPrice || ""}
                    onChange={(e) =>
                      setMaxPrice(e.target.value ? parseInt(e.target.value) : undefined)
                    }
                  />
                </div>
              </div>

              {/* Sort */}
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Sort By
                </label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="price-low">Price: Low to High</SelectItem>
                    <SelectItem value="price-high">Price: High to Low</SelectItem>
                    <SelectItem value="name">Name: A to Z</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Clear Filters */}
              {(search || selectedCategory || minPrice || maxPrice) && (
                <Button
                  onClick={() => {
                    setSearch("");
                    setSelectedCategory(undefined);
                    setMinPrice(undefined);
                    setMaxPrice(undefined);
                  }}
                  variant="outline"
                  className="w-full"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </div>

          {/* Products Grid */}
          <div className="lg:col-span-3">
            {isLoading ? (
              <div className="flex items-center justify-center h-96">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-rose mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading products...</p>
                </div>
              </div>
            ) : sortedProducts.length === 0 ? (
              <div className="flex items-center justify-center h-96">
                <div className="text-center">
                  <ShoppingBag className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <h3 className="text-xl font-semibold mb-2">No products found</h3>
                  <p className="text-muted-foreground">
                    Try adjusting your filters or search terms
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-6 flex items-center justify-between">
                  <p className="text-muted-foreground">
                    Showing {sortedProducts.length} product
                    {sortedProducts.length !== 1 ? "s" : ""}
                  </p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sortedProducts.map((product) => (
                    <Link key={product.id} href={`/products/${product.id}`}>
                      <a className="group cursor-pointer">
                        <Card className="card-hover overflow-hidden h-full flex flex-col">
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
                          <div className="flex-1 space-y-2">
                            <h3 className="font-semibold text-lg line-clamp-2 group-hover:text-accent-rose transition-colors">
                              {product.name}
                            </h3>
                            <p className="text-muted-foreground text-sm line-clamp-2">
                              {product.description}
                            </p>
                          </div>
                          <div className="flex items-center justify-between pt-4 mt-auto">
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
                              {product.stock > 0 ? "In Stock" : "Out"}
                            </span>
                          </div>
                        </Card>
                      </a>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
