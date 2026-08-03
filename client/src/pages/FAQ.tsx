import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQS = [
  {
    question: "What can I buy on Xirel?",
    answer:
      "Xirel offers two categories: Electronics (gadgets, accessories, and devices) and Outfits (clothing and fashion). New products are added regularly.",
  },
  {
    question: "How do I pay for an order?",
    answer:
      "At checkout you'll see payment instructions — currently mobile money (MTN MoMo / Airtel Money) or Mastercard. Send the payment to the details shown, then enter your transaction reference. Our team confirms payment manually and moves your order to processing.",
  },
  {
    question: "How long does payment confirmation take?",
    answer:
      "Usually within a few hours. If it's been longer than a day, message us on WhatsApp with your order number and payment reference and we'll sort it out quickly.",
  },
  {
    question: "How do I track my order?",
    answer:
      'Log in and go to "My Account" > "Order History" to see the status of every order you\'ve placed.',
  },
  {
    question: "Can I return an item?",
    answer:
      "Yes — see our Return Policy page for the return window and conditions. Reach out on WhatsApp to start a return.",
  },
  {
    question: "Do you ship outside Rwanda?",
    answer:
      "Message us on WhatsApp with your location and what you'd like to order — we'll let you know if delivery is available and what it costs.",
  },
  {
    question: "I have a question that's not answered here.",
    answer:
      "Use the chat on our Support page, or message us directly on WhatsApp — we're happy to help.",
  },
];

export default function FAQ() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 bg-card border-b border-border shadow-sm">
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

        <h1 className="text-4xl font-bold mb-2">Frequently Asked Questions</h1>
        <p className="text-muted-foreground mb-8">
          Can't find what you're looking for?{" "}
          <Link href="/support">
            <span className="text-accent-rose hover:underline cursor-pointer">Contact support</span>
          </Link>
          .
        </p>

        <Accordion type="single" collapsible className="w-full">
          {FAQS.map((faq, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger className="text-left font-semibold">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}
