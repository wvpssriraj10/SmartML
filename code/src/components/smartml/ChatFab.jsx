import { useEffect, useRef, useState } from "react";
import { Bot, Send, User, X, MessageSquare } from "lucide-react";

export function ChatFab({ messages = [], onSend, onAssistantReply, onAsk }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [unread, setUnread] = useState(0);
  const scrollRef = useRef(null);
  const lastSeenRef = useRef(messages.length);

  useEffect(() => {
    if (open) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      lastSeenRef.current = messages.length;
      setUnread(0);
    } else {
      const newAssistant = messages
        .slice(lastSeenRef.current)
        .filter((m) => m.role === "assistant").length;
      if (newAssistant > 0) setUnread((u) => u + newAssistant);
      lastSeenRef.current = messages.length;
    }
  }, [messages, open]);

  const submit = async () => {
    const text = input.trim();
    if (!text || thinking) return;

    onSend(text);
    setInput("");
    setThinking(true);
    try {
      const reply = await onAsk(text);
      onAssistantReply(reply);
    } catch {
      onAssistantReply("Sorry, I couldn't process that right now.");
    } finally {
      setThinking(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close AI assistant" : "Open AI assistant"}
        className="fixed bottom-6 right-6 z-[9999] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 via-violet-600 to-amber-400 text-white shadow-2xl transition-transform hover:scale-105 active:scale-95"
      >
        {open ? <X className="h-6 w-6 text-white" /> : <MessageSquare className="h-6 w-6 text-white" />}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald px-1 text-[10px] font-bold text-slate-950 ring-2 ring-slate-950">
            {unread}
          </span>
        )}
        {!open && (
          <span className="pointer-events-none absolute inset-0 rounded-full bg-white/20 animate-ping opacity-60" />
        )}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-[9999] w-[min(92vw,380px)]">
          <div className="glass-panel glow-border flex h-[min(70vh,560px)] flex-col overflow-hidden rounded-2xl shadow-2xl">
            <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-[image:var(--gradient-primary)]">
                <Bot className="h-4 w-4 text-white" />
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald ring-2 ring-card" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold">AI Assistant</div>
                <div className="text-[11px] text-muted-foreground">Contextual guidance · always on</div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition"
                aria-label="Minimize"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-2 animate-fade-in-up ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {m.role === "assistant" && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet/20 text-violet">
                      <Bot className="h-4 w-4" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "bg-[image:var(--gradient-primary)] text-white shadow-[var(--glow-primary)]"
                        : "bg-card/70 border border-border/60"
                    }`}
                  >
                    {m.content}
                  </div>
                  {m.role === "user" && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo/20 text-indigo">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              ))}
              {thinking && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet/20 text-violet">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="flex gap-1 rounded-full bg-card/70 border border-border/60 px-3 py-2">
                    <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-violet" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-violet" style={{ animationDelay: "200ms" }} />
                    <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-violet" style={{ animationDelay: "400ms" }} />
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-border/60 p-3">
              <div className="flex items-end gap-2 rounded-xl border border-border/70 bg-background/60 px-3 py-2 focus-within:border-primary/60 transition">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                  rows={1}
                  placeholder="Ask about your dataset, models, metrics…"
                  className="max-h-32 flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                <button
                  onClick={submit}
                  disabled={!input.trim() || thinking}
                  className="flex h-8 w-8 items-center justify-center rounded-lg btn-gradient disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Send"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {["What target should I pick?", "Which model is best?", "Explain the metrics"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="text-[10.5px] rounded-full border border-border/60 px-2 py-0.5 text-muted-foreground hover:text-foreground hover:border-primary/40 transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
