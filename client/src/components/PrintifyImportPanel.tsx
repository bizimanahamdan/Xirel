import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function PrintifyImportPanel({
  categories,
  onImported,
}: {
  categories: Array<{ id: number; name: string }> | undefined;
  onImported: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);
  const [importCategoryId, setImportCategoryId] = useState<string>("");
  const [importStock, setImportStock] = useState("50");

  const { data: status } = trpc.integrations.printify.status.useQuery();
  const { data: shops } = trpc.integrations.printify.listShops.useQuery(undefined, {
    enabled: Boolean(status?.tokenConfigured && !status?.shopIdConfigured),
  });
  const { data: products, isLoading: productsLoading } = trpc.integrations.printify.listProducts.useQuery(
    undefined,
    { enabled: open && Boolean(status?.tokenConfigured && status?.shopIdConfigured) }
  );
  const { data: productDetail } = trpc.integrations.printify.getProduct.useQuery(
    { productId: selectedProductId! },
    { enabled: Boolean(selectedProductId) }
  );

  const importMutation = trpc.integrations.printify.importProduct.useMutation({
    onSuccess: () => {
      toast.success("Product imported from Printify");
      setSelectedProductId(null);
      setSelectedVariantId(null);
      onImported();
    },
    onError: (error) => {
      toast.error("Import failed", { description: error.message });
    },
  });

  if (!status) return null;

  if (!status.tokenConfigured) {
    return (
      <Card className="p-6 mb-8">
        <h2 className="text-xl font-bold mb-1">Printify</h2>
        <p className="text-sm text-muted-foreground">
          Not connected yet. Set <code className="bg-secondary px-1 rounded">PRINTIFY_API_TOKEN</code>{" "}
          in your environment variables to enable importing products.
        </p>
      </Card>
    );
  }

  if (!status.shopIdConfigured) {
    return (
      <Card className="p-6 mb-8">
        <h2 className="text-xl font-bold mb-1">Printify</h2>
        <p className="text-sm text-muted-foreground mb-3">
          Token connected — now set{" "}
          <code className="bg-secondary px-1 rounded">PRINTIFY_SHOP_ID</code> to one of your shop IDs
          below:
        </p>
        {shops?.length ? (
          <ul className="space-y-1">
            {shops.map((shop) => (
              <li key={shop.id} className="text-sm">
                <span className="font-mono bg-secondary px-1.5 py-0.5 rounded">{shop.id}</span> —{" "}
                {shop.title} ({shop.sales_channel})
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Loading your shops...</p>
        )}
      </Card>
    );
  }

  return (
    <Card className="p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold mb-1">Printify</h2>
          <p className="text-sm text-muted-foreground">
            Import a product (and one variant) from your connected Printify shop.
          </p>
        </div>
        <Button variant="outline" onClick={() => setOpen(!open)}>
          {open ? "Close" : "Browse Products"}
        </Button>
      </div>

      {open && (
        <>
          {productsLoading && <p className="text-sm text-muted-foreground">Loading products...</p>}

          {!selectedProductId && products && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {products.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProductId(p.id)}
                  className="text-left border border-border rounded-lg p-2 hover:shadow-md transition-shadow"
                >
                  <img
                    src={p.images?.[0]?.src}
                    alt={p.title}
                    className="w-full aspect-square object-cover rounded mb-2"
                  />
                  <p className="text-xs font-medium line-clamp-2">{p.title}</p>
                </button>
              ))}
            </div>
          )}

          {selectedProductId && productDetail && (
            <div>
              <button
                onClick={() => {
                  setSelectedProductId(null);
                  setSelectedVariantId(null);
                }}
                className="text-sm text-accent-rose mb-3"
              >
                ← Back to products
              </button>

              <h3 className="font-bold mb-3">{productDetail.title}</h3>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Choose a variant</label>
                <select
                  value={selectedVariantId ?? ""}
                  onChange={(e) => setSelectedVariantId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg"
                >
                  <option value="" disabled>
                    Select a variant
                  </option>
                  {productDetail.variants
                    .filter((v) => v.is_enabled)
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.title} — ${(v.price / 100).toFixed(2)}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Category</label>
                  <select
                    value={importCategoryId}
                    onChange={(e) => setImportCategoryId(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg"
                  >
                    <option value="" disabled>
                      Select a category
                    </option>
                    {categories?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Stock</label>
                  <input
                    type="number"
                    value={importStock}
                    onChange={(e) => setImportStock(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg"
                    min={0}
                  />
                </div>
              </div>

              <Button
                onClick={() =>
                  importMutation.mutate({
                    productId: selectedProductId,
                    variantId: selectedVariantId!,
                    categoryId: Number(importCategoryId),
                    stock: Number(importStock) || 0,
                  })
                }
                disabled={!selectedVariantId || !importCategoryId || importMutation.isPending}
              >
                {importMutation.isPending ? "Importing..." : "Import This Variant"}
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
