import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft, MessageCircle, Send } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { WHATSAPP_URL } from "@/const";

type ChatMessage = { role: "user" | "assistant"; content: string };

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12.004 2C6.478 2 2 6.477 2 12c0 1.802.475 3.55 1.377 5.088L2.06 22l4.99-1.308A9.96 9.96 0 0 0 12.004 22C17.53 22 22 17.523 22 12S17.53 2 12.004 2zm0 18.16a8.14 8.14 0 0 1-4.152-1.136l-.298-.177-2.964.777.79-2.887-.194-.297A8.15 8.15 0 1 1 20.16 12a8.16 8.16 0 0 1-8.156 8.16z" />
    </svg>
  );
}

export default function Support() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Hi! I'm the Xirel support assistant. Ask me about orders, payment, or returns.",
    },
  ]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatMutation = trpc.support.chat.useMutation();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || chatMutation.isPending) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");

    try {
      const { reply } = await chatMutation.mutateAsync({ messages: nextMessages });
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Please try WhatsApp instead." },
      ]);
    }
  };

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

        <h1 className="text-4xl font-bold mb-2">Support</h1>
        <p className="text-muted-foreground mb-8">
          Chat with us below, or reach out directly on WhatsApp.
        </p>

        {/* WhatsApp CTA */}
        <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
          <Card className="p-5 mb-8 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer bg-[#25D366]/10 border-[#25D366]/30">
            <div className="w-12 h-12 rounded-full bg-[#25D366] flex items-center justify-center text-white flex-shrink-0">
              <WhatsAppIcon />
            </div>
            <div>
              <p className="font-bold">Chat on WhatsApp</p>
              <p className="text-sm text-muted-foreground">Usually replies within a few hours</p>
            </div>
          </Card>
        </a>

        {/* Chat widget */}
        <Card className="p-0 overflow-hidden mb-8">
          <div className="bg-accent-rose text-white px-5 py-3 flex items-center gap-2 font-bold">
            <MessageCircle className="w-5 h-5" />
            Chat with Xirel Assistant
          </div>

          <div ref={scrollRef} className="h-96 overflow-y-auto p-4 space-y-3 bg-secondary/30">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${
                    m.role === "user"
                      ? "bg-accent-rose text-white rounded-br-sm"
                      : "bg-white border border-border rounded-bl-sm"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {chatMutation.isPending && (
              <div className="flex justify-start">
                <div className="max-w-[80%] px-4 py-2 rounded-2xl rounded-bl-sm text-sm bg-white border border-border text-muted-foreground">
                  Typing...
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSend} className="flex gap-2 p-3 border-t border-border">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about orders, payment, returns..."
              disabled={chatMutation.isPending}
            />
            <Button type="submit" disabled={chatMutation.isPending || !input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </Card>

        {/* Helpful links */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/faq">
            <Card className="p-4 text-center hover:shadow-md transition-shadow cursor-pointer">
              <p className="font-semibold">FAQ</p>
            </Card>
          </Link>
          <Link href="/returns">
            <Card className="p-4 text-center hover:shadow-md transition-shadow cursor-pointer">
              <p className="font-semibold">Return Policy</p>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
