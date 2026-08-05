import { useState } from "react";
import { Link, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ShoppingBag, ArrowLeft, Check, AlertCircle, ChevronLeft, ChevronRight, PlayCircle, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { useCart } from "@/_core/hooks/useCart";

export default function ProductDetail() {
  const [match, params] = useRoute("/products/:id");
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [showVideo, setShowVideo] = useState(false);

  const productId = params?.id ? parseInt(params.id) : null;

  const { data: product, isLoading } = trpc.products.getById.useQuery(
    { id: productId! },
    { enabled: !!productId }
  );
  const { data: categories } = trpc.categories.list.useQuery();
  const categoryName = categories?.find((c) => c.id === product?.categoryId)?.name ?? "—";

  const cart = useCart();

  const handleAddToCart = () => {
    if (!product) return;

    setIsAdding(true);
    try {
      cart.add(product.id, quantity);
      toast.success("Added to cart!", {
        description: `${quantity} item${quantity > 1 ? "s" : ""} added successfully`,
      });
      setQuantity(1);
    } catch (error) {
      toast.error("Failed to add to cart");
    } finally {
      setIsAdding(false);
    }
  };

  if (!match) return null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-rose mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading product...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container py-12">
          <Link href="/products">
            <a className="inline-flex items-center gap-2 text-accent-rose hover:text-accent-rose/80 mb-8">
              <ArrowLeft className="w-4 h-4" />
              Back to Products
            </a>
          </Link>
          <div className="text-center py-20">
            <h1 className="text-2xl font-bold mb-2">Product not found</h1>
            <p className="text-muted-foreground mb-6">
              The product you're looking for doesn't exist or has been removed.
            </p>
            <Link href="/products">
              <a className="btn-primary inline-block">Browse Products</a>
            </Link>
          </div>
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

      <div className="container py-12">
        {/* Back Button */}
        <Link href="/products">
          <a className="inline-flex items-center gap-2 text-accent-rose hover:text-accent-rose/80 mb-8">
            <ArrowLeft className="w-4 h-4" />
            Back to Products
          </a>
        </Link>

        {/* Product Details */}
        <div className="grid md:grid-cols-2 gap-12">
          {/* Image Section */}
          <div>
            {product.showcaseVideoUrl && (
              <button
                onClick={() => setShowVideo(!showVideo)}
                className="mb-3 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-rose text-white text-sm font-semibold hover:bg-accent-rose/90 transition-colors"
              >
                {showVideo ? (
                  <>
                    <ImageIcon className="w-4 h-4" /> View Photos
                  </>
                ) : (
                  <>
                    <PlayCircle className="w-4 h-4" /> Watch Showcase
                  </>
                )}
              </button>
            )}

            {showVideo && product.showcaseVideoUrl ? (
              <Card className="overflow-hidden bg-muted rounded-2xl">
                <div className="aspect-square w-full">
                  <video
                    src={product.showcaseVideoUrl}
                    className="w-full h-full object-cover"
                    autoPlay
                    loop
                    muted
                    playsInline
                    controls
                  />
                </div>
              </Card>
            ) : (
              (() => {
              const gallery =
                product.images && product.images.length > 0
                  ? product.images
                  : product.imageUrl
                    ? [product.imageUrl]
                    : [];

              if (gallery.length === 0) {
                return (
                  <Card className="overflow-hidden bg-muted rounded-2xl">
                    <div className="aspect-square w-full flex items-center justify-center bg-gradient-to-br from-accent-rose/20 to-transparent">
                      <ShoppingBag className="w-24 h-24 text-muted-foreground" />
                    </div>
                  </Card>
                );
              }

              const goTo = (index: number) => {
                setActiveImage((index + gallery.length) % gallery.length);
              };

              return (
                <div>
                  <Card className="overflow-hidden bg-muted rounded-2xl relative">
                    <div className="aspect-square w-full flex items-center justify-center">
                      <img
                        src={gallery[activeImage]}
                        alt={`${product.name} — image ${activeImage + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {gallery.length > 1 && (
                      <>
                        <button
                          onClick={() => goTo(activeImage - 1)}
                          aria-label="Previous image"
                          className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-card/90 shadow flex items-center justify-center hover:bg-card transition-colors"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => goTo(activeImage + 1)}
                          aria-label="Next image"
                          className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-card/90 shadow flex items-center justify-center hover:bg-card transition-colors"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>

                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                          {gallery.map((_, i) => (
                            <button
                              key={i}
                              onClick={() => goTo(i)}
                              aria-label={`Go to image ${i + 1}`}
                              className={`w-2 h-2 rounded-full transition-colors ${
                                i === activeImage ? "bg-accent-rose" : "bg-card/70"
                              }`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </Card>

                  {gallery.length > 1 && (
                    <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                      {gallery.map((src, i) => (
                        <button
                          key={i}
                          onClick={() => goTo(i)}
                          className={`w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-colors ${
                            i === activeImage ? "border-accent-rose" : "border-transparent"
                          }`}
                        >
                          <img src={src} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()
            )}
          </div>

          {/* Details Section */}
          <div className="space-y-8">
            {/* Header */}
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-4">
                {product.name}
              </h1>
              <div className="flex items-center gap-4 mb-4">
                <span className="text-4xl font-bold text-accent-rose">
                  ${parseFloat(product.price).toFixed(2)}
                </span>
                <span
                  className={`px-4 py-2 rounded-full text-sm font-medium ${
                    product.stock > 0
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {product.stock > 0
                    ? `${product.stock} in stock`
                    : "Out of stock"}
                </span>
              </div>
            </div>

            {/* Description */}
            <div>
              <h2 className="text-lg font-semibold mb-3">Description</h2>
              <p className="text-muted-foreground leading-relaxed">
                {product.description || "No description available"}
              </p>
            </div>

            {/* Product Info */}
            <div className="grid grid-cols-2 gap-4 p-6 bg-secondary rounded-xl">
              <div>
                <p className="text-sm text-muted-foreground">SKU</p>
                <p className="font-semibold">{product.sku || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Category</p>
                <p className="font-semibold">{categoryName}</p>
              </div>
            </div>

            {/* Add to Cart Section */}
            {product.stock > 0 ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Quantity
                  </label>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors"
                    >
                      −
                    </button>
                    <Input
                      type="number"
                      min="1"
                      max={product.stock}
                      value={quantity}
                      onChange={(e) =>
                        setQuantity(
                          Math.max(1, Math.min(product.stock, parseInt(e.target.value) || 1))
                        )
                      }
                      className="w-20 text-center"
                    />
                    <button
                      onClick={() =>
                        setQuantity(Math.min(product.stock, quantity + 1))
                      }
                      className="px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>

                <Button
                  onClick={handleAddToCart}
                  disabled={isAdding}
                  className="btn-primary w-full text-lg py-6"
                >
                  {isAdding ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Adding to cart...
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-5 h-5 mr-2" />
                      Add to Cart
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <p className="text-red-800 font-medium">Out of stock</p>
              </div>
            )}

            {/* Features */}
            <div className="space-y-3 pt-6 border-t border-border">
              <div className="flex items-center gap-3">
                <Check className="w-5 h-5 text-green-600" />
                <span className="text-muted-foreground">Free shipping on orders over $100</span>
              </div>
              <div className="flex items-center gap-3">
                <Check className="w-5 h-5 text-green-600" />
                <span className="text-muted-foreground">30-day money-back guarantee</span>
              </div>
              <div className="flex items-center gap-3">
                <Check className="w-5 h-5 text-green-600" />
                <span className="text-muted-foreground">Secure checkout with SSL encryption</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
