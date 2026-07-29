import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";
import { WHATSAPP_URL } from "@/const";

export default function ReturnPolicy() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
        <div className="container flex items-center justify-between h-16">
          <Link href="/">
            <span className="cursor-pointer">
              <Logo />
            </span>
          </Link>
        </div>
      </nav>

      <div className="container py-12 max-w-2xl">
        <Link href="/">
          <span className="inline-flex items-center gap-2 text-accent-rose hover:text-accent-rose/80 mb-8 cursor-pointer">
            <ArrowLeft className="w-4 h-4" />
            Back Home
          </span>
        </Link>

        <h1 className="text-4xl font-bold mb-2">Return Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: {new Date().toLocaleDateString()}</p>

        <div className="space-y-6">
          <section>
            <h2 className="text-xl font-bold mb-2">Return window</h2>
            <p className="text-muted-foreground">
              You can request a return within 7 days of receiving your order, as long as the item is
              unused, in its original condition, and in its original packaging.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-2">How to start a return</h2>
            <p className="text-muted-foreground">
              Message us on WhatsApp with your order number and the reason for the return. We'll
              confirm the details and arrange the next steps with you directly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-2">Refunds</h2>
            <p className="text-muted-foreground">
              Once we receive and inspect the returned item, we'll refund you using the same payment
              method you used to pay (mobile money or card), or offer a replacement/exchange if you
              prefer.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-2">Non-returnable items</h2>
            <p className="text-muted-foreground">
              Items marked as final sale, and any item that shows signs of use or is missing its
              original packaging, cannot be returned.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-2">Damaged or wrong item</h2>
            <p className="text-muted-foreground">
              If your order arrived damaged or isn't what you ordered, message us on WhatsApp right
              away with a photo — we'll fix it at no extra cost.
            </p>
          </section>
        </div>

        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary inline-block mt-8"
        >
          Start a Return on WhatsApp
        </a>
      </div>
    </div>
  );
}
