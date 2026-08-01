import { useState, useEffect } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Edit2, Trash2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { Logo } from "@/components/Logo";
import { PrintifyImportPanel } from "@/components/PrintifyImportPanel";
import { CJImportPanel } from "@/components/CJImportPanel";

export default function AdminProducts() {
  const { user, logout } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    categoryId: "1",
    stock: "",
    sku: "",
  });
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const { data: products, refetch } = trpc.products.list.useQuery({});
  const { data: categories, refetch: refetchCategories } = trpc.categories.list.useQuery();

  const createCategoryMutation = trpc.categories.create.useMutation({
    onSuccess: () => {
      toast.success("Category created");
      setNewCategoryName("");
      setShowCategoryForm(false);
      refetchCategories();
    },
    onError: (error) => {
      toast.error("Failed to create category", { description: error.message });
    },
  });

  function slugify(name: string) {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCategoryName.trim();
    if (!name) return;
    createCategoryMutation.mutate({ name, slug: slugify(name) });
  };

  // Once real categories exist, point the (new-product) form at a real one
  // instead of the placeholder "1" default, which may not correspond to any
  // actual category.
  useEffect(() => {
    if (!showForm || editingId) return;
    if (!categories?.length) return;
    const isValid = categories.some((c) => c.id.toString() === formData.categoryId);
    if (!isValid) {
      setFormData((prev) => ({ ...prev, categoryId: categories[0].id.toString() }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, showForm, editingId]);

  const createProductMutation = trpc.products.create.useMutation({
    onSuccess: () => {
      toast.success("Product created successfully");
      setFormData({
        name: "",
        description: "",
        price: "",
        categoryId: "1",
        stock: "",
        sku: "",
      });
      setImageFiles([]);
      setShowForm(false);
      refetch();
    },
    onError: (error) => {
      toast.error("Failed to create product", {
        description: error.message,
      });
    },
  });

  const updateProductMutation = trpc.products.update.useMutation({
    onSuccess: () => {
      toast.success("Product updated successfully");
      setEditingId(null);
      setFormData({
        name: "",
        description: "",
        price: "",
        categoryId: "1",
        stock: "",
        sku: "",
      });
      setImageFiles([]);
      refetch();
    },
    onError: (error) => {
      toast.error("Failed to update product", {
        description: error.message,
      });
    },
  });

  const deleteProductMutation = trpc.products.delete.useMutation({
    onSuccess: () => {
      toast.success("Product deleted successfully");
      refetch();
    },
    onError: (error) => {
      toast.error("Failed to delete product", {
        description: error.message,
      });
    },
  });

  const uploadImageMutation = trpc.products.uploadImage.useMutation();

  function readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Strip the "data:...;base64," prefix — the server expects raw base64.
        resolve(result.split(",")[1] ?? "");
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let imageUrl: string | undefined;
    let images: string[] | undefined;

    if (imageFiles.length > 0) {
      try {
        const uploaded: string[] = [];
        for (const file of imageFiles) {
          const base64 = await readFileAsBase64(file);
          const result = await uploadImageMutation.mutateAsync({
            imageData: base64,
            fileName: file.name,
            contentType: file.type || "image/jpeg",
          });
          uploaded.push(result.url);
        }
        images = uploaded;
        imageUrl = uploaded[0];
      } catch (error) {
        toast.error("Failed to upload images");
        return;
      }
    }

    if (editingId) {
      updateProductMutation.mutate({
        id: editingId,
        name: formData.name || undefined,
        description: formData.description || undefined,
        price: formData.price || undefined,
        categoryId: parseInt(formData.categoryId) || undefined,
        stock: parseInt(formData.stock) || undefined,
        sku: formData.sku || undefined,
        ...(imageUrl ? { imageUrl, images } : {}),
      });
    } else {
      createProductMutation.mutate({
        name: formData.name,
        description: formData.description,
        price: formData.price,
        categoryId: parseInt(formData.categoryId),
        stock: parseInt(formData.stock),
        sku: formData.sku,
        ...(imageUrl ? { imageUrl, images } : {}),
      });
    }
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
              <span className="block px-4 py-2 rounded-lg bg-accent text-white font-medium cursor-pointer">
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
              <span className="block px-4 py-2 rounded-lg hover:bg-secondary transition-colors cursor-pointer">
                Payment Settings
              </span>
            </Link>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold mb-2">Products</h1>
              <p className="text-muted-foreground">
                Manage your product catalog
              </p>
            </div>
            <Button
              onClick={() => {
                setEditingId(null);
                setFormData({
                  name: "",
                  description: "",
                  price: "",
                  categoryId: "1",
                  stock: "",
                  sku: "",
                });
                setShowForm(!showForm);
              }}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Product
            </Button>
          </div>

          {/* Printify Integration */}
          <PrintifyImportPanel categories={categories} onImported={refetch} />

          {/* CJ Dropshipping Integration */}
          <CJImportPanel categories={categories} onImported={refetch} />

          {/* Category Management */}
          <Card className="p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold mb-1">Categories</h2>
                <p className="text-sm text-muted-foreground">
                  Products need a category to be created — add one here first if the list below is empty.
                </p>
              </div>
              <Button
                onClick={() => setShowCategoryForm(!showCategoryForm)}
                className="flex items-center gap-2"
                variant="outline"
              >
                <Plus className="w-4 h-4" />
                Add Category
              </Button>
            </div>

            {showCategoryForm && (
              <form onSubmit={handleCreateCategory} className="flex gap-3 mb-4">
                <Input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g. Electronics"
                  required
                />
                <Button type="submit" disabled={createCategoryMutation.isPending}>
                  {createCategoryMutation.isPending ? "Adding..." : "Save"}
                </Button>
              </form>
            )}

            <div className="flex flex-wrap gap-2">
              {categories?.length ? (
                categories.map((cat) => (
                  <span
                    key={cat.id}
                    className="px-3 py-1 rounded-full bg-secondary text-sm font-medium"
                  >
                    {cat.name}
                  </span>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No categories yet — add one above (e.g. "Electronics", "Outfits").
                </p>
              )}
            </div>
          </Card>

          {/* Add/Edit Form */}
          {showForm && (
            <Card className="p-6 mb-8">
              <h2 className="text-2xl font-bold mb-6">
                {editingId ? "Edit Product" : "Add New Product"}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2">
                      Product Name *
                    </label>
                    <Input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="Enter product name"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">
                      Category *
                    </label>
                    <select
                      value={formData.categoryId}
                      onChange={(e) =>
                        setFormData({ ...formData, categoryId: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                      required
                    >
                      {!categories?.length && (
                        <option value="" disabled>
                          Add a category above first
                        </option>
                      )}
                      {categories?.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Enter product description"
                    rows={4}
                    className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Product Images (Optional — first one is the thumbnail)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => setImageFiles(Array.from(e.target.files ?? []))}
                    className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  {imageFiles.length > 0 && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Selected {imageFiles.length} image{imageFiles.length > 1 ? "s" : ""}:{" "}
                      {imageFiles.map((f) => f.name).join(", ")}
                    </p>
                  )}
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2">
                      Price *
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) =>
                        setFormData({ ...formData, price: e.target.value })
                      }
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">
                      Stock *
                    </label>
                    <Input
                      type="number"
                      value={formData.stock}
                      onChange={(e) =>
                        setFormData({ ...formData, stock: e.target.value })
                      }
                      placeholder="0"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">
                      SKU
                    </label>
                    <Input
                      type="text"
                      value={formData.sku}
                      onChange={(e) =>
                        setFormData({ ...formData, sku: e.target.value })
                      }
                      placeholder="SKU"
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button type="submit" className="btn-primary" disabled={uploadImageMutation.isPending}>
                    {uploadImageMutation.isPending
                      ? "Uploading image..."
                      : editingId
                        ? "Update Product"
                        : "Create Product"}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingId(null);
                    }}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* Products Table */}
          <Card className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold">Name</th>
                    <th className="text-left py-3 px-4 font-semibold">
                      Category
                    </th>
                    <th className="text-left py-3 px-4 font-semibold">Price</th>
                    <th className="text-left py-3 px-4 font-semibold">Stock</th>
                    <th className="text-left py-3 px-4 font-semibold">SKU</th>
                    <th className="text-left py-3 px-4 font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {products?.map((product) => (
                    <tr
                      key={product.id}
                      className="border-b border-border hover:bg-secondary"
                    >
                      <td className="py-3 px-4 font-medium">{product.name}</td>
                      <td className="py-3 px-4">
                        {categories?.find((c) => c.id === product.categoryId)
                          ?.name || "Unknown"}
                      </td>
                      <td className="py-3 px-4">
                        ${parseFloat(product.price).toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            product.stock > 0
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {product.stock}
                        </span>
                      </td>
                      <td className="py-3 px-4">{product.sku || "-"}</td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingId(product.id);
                              setFormData({
                                name: product.name,
                                description: product.description || "",
                                price: product.price,
                                categoryId: product.categoryId.toString(),
                                stock: product.stock.toString(),
                                sku: product.sku || "",
                              });
                              setShowForm(true);
                            }}
                            className="text-accent-rose hover:text-accent-rose/80"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() =>
                              deleteProductMutation.mutate({ id: product.id })
                            }
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
