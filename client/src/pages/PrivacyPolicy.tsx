import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function PrivacyPolicy() {
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

      <div className="container py-12 max-w-2xl prose prose-sm">
        <Link href="/">
          <span className="inline-flex items-center gap-2 text-accent-rose hover:text-accent-rose/80 mb-8 cursor-pointer no-underline">
            <ArrowLeft className="w-4 h-4" />
            Back Home
          </span>
        </Link>

        <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: {new Date().toLocaleDateString()}</p>

        <div className="space-y-6 text-foreground">
          <section>
            <h2 className="text-xl font-bold mb-2">What we collect</h2>
            <p className="text-muted-foreground">
              When you create an account, we store your email address and name (if provided). When
              you place an order, we store the shipping details and items you provide so we can
              fulfill it. We never store full card numbers or mobile money PINs — payments are
              confirmed manually using the reference you provide.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-2">Site usage data</h2>
            <p className="text-muted-foreground">
              We log anonymous, aggregate information about how the site is used — such as device
              type, browser, and which pages or searches don't return results — so we can improve
              the store. This data isn't tied to your identity beyond your account if you're logged
              in while browsing.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-2">How we use your information</h2>
            <p className="text-muted-foreground">
              Solely to process your orders, provide support, and improve the shopping experience.
              We do not sell or share your personal information with third parties for advertising.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-2">Support chat</h2>
            <p className="text-muted-foreground">
              Messages you send to our chat assistant are processed by a third-party AI service
              (Groq) to generate a response. Avoid sharing sensitive information like full card
              numbers or passwords in chat.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-2">Your rights</h2>
            <p className="text-muted-foreground">
              You can ask us to update or delete your account data at any time by reaching out on
              WhatsApp.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-2">Contact</h2>
            <p className="text-muted-foreground">
              Questions about this policy? Reach us via the{" "}
              <Link href="/support">
                <span className="text-accent-rose hover:underline cursor-pointer">Support page</span>
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
