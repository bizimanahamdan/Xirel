import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export function CJImportPanel({
  categories,
  onImported,
}: {
  categories: Array<{ id: number; name: string }> | undefined;
  onImported: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [importingKey, setImportingKey] = useState<string | null>(null);
  const [importCategoryId, setImportCategoryId] = useState<string>("");
  const [importStock, setImportStock] = useState("50");

  const { data: status } = trpc.integrations.cj.status.useQuery();
  const { data: results, isLoading } = trpc.integrations.cj.searchProducts.useQuery(
    { keyword: searchTerm || undefined, pageNum: 1 },
    { enabled: open && Boolean(status?.configured) }
  );

  const importMutation = trpc.integrations.cj.importProduct.useMutation({
    onSuccess: () => {
      toast.success("Product imported from CJ Dropshipping");
      setImportingKey(null);
      onImported();
    },
    onError: (error) => {
      toast.error("Import failed", { description: error.message });
    },
  });

  if (!status) return null;

  if (!status.configured) {
    return (
      <Card className="p-6 mb-8">
        <h2 className="text-xl font-bold mb-1">CJ Dropshipping</h2>
        <p className="text-sm text-muted-foreground">
          Not connected yet. Set <code className="bg-secondary px-1 rounded">CJ_API_KEY</code> in your
          environment variables (from CJ's Personal Center &gt; API tab) to enable importing products.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold mb-1">CJ Dropshipping</h2>
          <p className="text-sm text-muted-foreground">Search and import a product from CJ.</p>
        </div>
        <Button variant="outline" onClick={() => setOpen(!open)}>
          {open ? "Close" : "Browse Products"}
        </Button>
      </div>

      {open && (
        <>
          <div className="flex gap-3 mb-4">
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Search products (e.g. 'phone case')"
              onKeyDown={(e) => e.key === "Enter" && setSearchTerm(keyword)}
            />
            <Button variant="outline" onClick={() => setSearchTerm(keyword)}>
              Search
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2">Import into category</label>
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

          {isLoading && <p className="text-sm text-muted-foreground">Searching...</p>}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {results?.content.map((p) => {
              const key = `${p.productId}-${p.vid}`;
              return (
                <div key={key} className="border border-border rounded-lg p-2">
                  <img
                    src={p.bigImage}
                    alt={p.nameEn}
                    className="w-full aspect-square object-cover rounded mb-2"
                  />
                  <p className="text-xs font-medium line-clamp-2 mb-1">{p.nameEn}</p>
                  <p className="text-xs text-muted-foreground mb-2">${p.sellPrice}</p>
                  <Button
                    className="w-full"
                    size="sm"
                    disabled={!importCategoryId || importMutation.isPending}
                    onClick={() => {
                      setImportingKey(key);
                      importMutation.mutate({
                        productId: p.productId,
                        vid: p.vid,
                        name: p.nameEn,
                        price: p.sellPrice,
                        imageUrl: p.bigImage,
                        categoryId: Number(importCategoryId),
                        stock: Number(importStock) || 0,
                      });
                    }}
                  >
                    {importMutation.isPending && importingKey === key ? "Importing..." : "Import"}
                  </Button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
}
