import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Logo } from "@/components/Logo";

const shippingAddressSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(10, "Valid phone number is required"),
  street: z.string().min(1, "Street address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zipCode: z.string().min(5, "Valid zip code is required"),
  country: z.string().min(1, "Country is required"),
});

type ShippingAddress = z.infer<typeof shippingAddressSchema>;

export default function Checkout() {
  const [formData, setFormData] = useState<ShippingAddress>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    street: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<any>(null);

  const { data: cartItems } = trpc.cart.get.useQuery();
  const createOrderMutation = trpc.orders.create.useMutation({
    onSuccess: (order) => {
      setConfirmedOrder(order);
      setOrderConfirmed(true);
      toast.success("Order placed successfully!");
    },
    onError: (error) => {
      toast.error("Failed to place order", {
        description: error.message,
      });
      setIsProcessing(false);
    },
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      shippingAddressSchema.parse(formData);
      setErrors({});

      setIsProcessing(true);
      await createOrderMutation.mutateAsync({
        shippingAddress: formData,
        paymentMethod: "stripe",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.issues.forEach((issue: any) => {
          const path = issue.path[0];
          if (path) {
            newErrors[path as string] = issue.message;
          }
        });
        setErrors(newErrors);
      } else {
        toast.error("An error occurred", {
          description: "Please try again",
        });
      }
      setIsProcessing(false);
    }
  };

  if (orderConfirmed && confirmedOrder) {
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
          </div>
        </nav>

        <div className="container py-12">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-12">
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-green-100 rounded-full animate-pulse"></div>
                  <CheckCircle className="w-20 h-20 text-green-600 relative" />
                </div>
              </div>
              <h1 className="text-4xl font-bold mb-4">Order Confirmed!</h1>
              <p className="text-lg text-muted-foreground mb-8">
                Thank you for your purchase. Your order has been placed successfully.
              </p>
            </div>

            {/* Order Details */}
            <Card className="p-8 space-y-6 mb-8">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Order Number</p>
                <p className="text-2xl font-bold text-accent-rose">
                  {confirmedOrder.orderNumber}
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6 py-6 border-y border-border">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Order Date</p>
                  <p className="font-semibold">
                    {new Date(confirmedOrder.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Amount</p>
                  <p className="text-2xl font-bold text-accent-rose">
                    ${parseFloat(confirmedOrder.totalAmount).toFixed(2)}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-3">Shipping Address</p>
                <div className="bg-secondary p-4 rounded-lg">
                  <p className="font-semibold">
                    {confirmedOrder.shippingAddress.firstName}{" "}
                    {confirmedOrder.shippingAddress.lastName}
                  </p>
                  <p className="text-muted-foreground">
                    {confirmedOrder.shippingAddress.street}
                  </p>
                  <p className="text-muted-foreground">
                    {confirmedOrder.shippingAddress.city},{" "}
                    {confirmedOrder.shippingAddress.state}{" "}
                    {confirmedOrder.shippingAddress.zipCode}
                  </p>
                  <p className="text-muted-foreground">
                    {confirmedOrder.shippingAddress.country}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-3">Order Items</p>
                <div className="space-y-2">
                  {confirmedOrder.items.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>
                        {item.name} x {item.quantity}
                      </span>
                      <span className="font-semibold">
                        ${(parseFloat(item.price) * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Next Steps */}
            <Card className="p-6 bg-accent-light mb-8">
              <h3 className="font-semibold mb-3">What's Next?</h3>
              <ul className="space-y-2 text-sm">
                <li>✓ You'll receive a confirmation email shortly</li>
                <li>✓ Your order will be processed and shipped within 2-3 business days</li>
                <li>✓ You can track your order status in your account</li>
              </ul>
            </Card>

            {/* Actions */}
            <div className="flex gap-4">
              <Link href="/orders">
                <a className="btn-primary flex-1 text-center">View Orders</a>
              </Link>
              <Link href="/products">
                <a className="btn-secondary flex-1 text-center">Continue Shopping</a>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
        </div>
      </nav>

      <div className="container py-12">
        <Link href="/cart">
          <a className="inline-flex items-center gap-2 text-accent-rose hover:text-accent-rose/80 mb-8">
            <ArrowLeft className="w-4 h-4" />
            Back to Cart
          </a>
        </Link>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Checkout Form */}
          <div className="lg:col-span-2">
            <Card className="p-8">
              <h1 className="text-3xl font-bold mb-8">Shipping Information</h1>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Name Row */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2">
                      First Name *
                    </label>
                    <Input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      placeholder="John"
                      className={errors.firstName ? "border-red-500" : ""}
                    />
                    {errors.firstName && (
                      <p className="text-red-600 text-sm mt-1">{errors.firstName}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">
                      Last Name *
                    </label>
                    <Input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      placeholder="Doe"
                      className={errors.lastName ? "border-red-500" : ""}
                    />
                    {errors.lastName && (
                      <p className="text-red-600 text-sm mt-1">{errors.lastName}</p>
                    )}
                  </div>
                </div>

                {/* Email and Phone */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2">
                      Email *
                    </label>
                    <Input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="john@example.com"
                      className={errors.email ? "border-red-500" : ""}
                    />
                    {errors.email && (
                      <p className="text-red-600 text-sm mt-1">{errors.email}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">
                      Phone *
                    </label>
                    <Input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="+1 (555) 000-0000"
                      className={errors.phone ? "border-red-500" : ""}
                    />
                    {errors.phone && (
                      <p className="text-red-600 text-sm mt-1">{errors.phone}</p>
                    )}
                  </div>
                </div>

                {/* Street Address */}
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Street Address *
                  </label>
                  <Input
                    type="text"
                    name="street"
                    value={formData.street}
                    onChange={handleInputChange}
                    placeholder="123 Main Street"
                    className={errors.street ? "border-red-500" : ""}
                  />
                  {errors.street && (
                    <p className="text-red-600 text-sm mt-1">{errors.street}</p>
                  )}
                </div>

                {/* City, State, Zip */}
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2">
                      City *
                    </label>
                    <Input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      placeholder="New York"
                      className={errors.city ? "border-red-500" : ""}
                    />
                    {errors.city && (
                      <p className="text-red-600 text-sm mt-1">{errors.city}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">
                      State *
                    </label>
                    <Input
                      type="text"
                      name="state"
                      value={formData.state}
                      onChange={handleInputChange}
                      placeholder="NY"
                      className={errors.state ? "border-red-500" : ""}
                    />
                    {errors.state && (
                      <p className="text-red-600 text-sm mt-1">{errors.state}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">
                      Zip Code *
                    </label>
                    <Input
                      type="text"
                      name="zipCode"
                      value={formData.zipCode}
                      onChange={handleInputChange}
                      placeholder="10001"
                      className={errors.zipCode ? "border-red-500" : ""}
                    />
                    {errors.zipCode && (
                      <p className="text-red-600 text-sm mt-1">{errors.zipCode}</p>
                    )}
                  </div>
                </div>

                {/* Country */}
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Country *
                  </label>
                  <Input
                    type="text"
                    name="country"
                    value={formData.country}
                    onChange={handleInputChange}
                    placeholder="United States"
                    className={errors.country ? "border-red-500" : ""}
                  />
                  {errors.country && (
                    <p className="text-red-600 text-sm mt-1">{errors.country}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isProcessing}
                  className="btn-primary w-full py-3 text-lg"
                >
                  {isProcessing ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    "Place Order"
                  )}
                </Button>
              </form>
            </Card>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="p-6 sticky top-24 space-y-6">
              <h2 className="text-2xl font-bold">Order Summary</h2>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {cartItems?.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <div>
                      <p className="font-medium">{item.product?.name}</p>
                      <p className="text-muted-foreground">Qty: {item.quantity}</p>
                    </div>
                    <p className="font-semibold">
                      ${(
                        parseFloat(item.product?.price || "0") * item.quantity
                      ).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="border-t border-border pt-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-semibold">
                    ${(
                      cartItems?.reduce(
                        (sum, item) =>
                          sum +
                          parseFloat(item.product?.price || "0") * item.quantity,
                        0
                      ) || 0
                    ).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax (10%)</span>
                  <span className="font-semibold">
                    ${(
                      (cartItems?.reduce(
                        (sum, item) =>
                          sum +
                          parseFloat(item.product?.price || "0") * item.quantity,
                        0
                      ) || 0) * 0.1
                    ).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="font-semibold">Free</span>
                </div>
              </div>

              <div className="flex justify-between text-xl font-bold border-t border-border pt-4">
                <span>Total</span>
                <span className="text-accent-rose">
                  ${(
                    (cartItems?.reduce(
                      (sum, item) =>
                        sum +
                        parseFloat(item.product?.price || "0") * item.quantity,
                      0
                    ) || 0) * 1.1
                  ).toFixed(2)}
                </span>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
