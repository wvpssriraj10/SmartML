import { Check } from "lucide-react";

export function WorkflowStepper({ steps, currentKey }) {
  const currentIdx = steps.findIndex((s) => s.key === currentKey);

  return (
    <div className="mb-8 flex items-center gap-2 overflow-x-auto overflow-y-hidden pb-1">
      {steps.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={s.key} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${
              active ? "border-primary/60 bg-primary/15 text-foreground" :
              done ? "border-emerald/40 bg-emerald/10 text-emerald" :
              "border-border/60 text-muted-foreground"
            }`}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                active ? "bg-[image:var(--gradient-primary)] text-white" :
                done ? "bg-emerald text-background" :
                "bg-muted text-muted-foreground"
              }`}>
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className="font-medium">{s.label}</span>
            </div>
            {i < steps.length - 1 && <span className={`h-px w-6 ${i < currentIdx ? "bg-emerald/50" : "bg-border"}`} />}
          </div>
        );
      })}
    </div>
  );
}