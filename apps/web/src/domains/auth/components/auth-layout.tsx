import { Brain, MessageSquare, Zap, ShieldCheck } from "lucide-react";
import Logo from "@/shared/components/logo";

const FEATURES = [
  {
    icon: Brain,
    title: "Embedded AI Assistant",
    desc: "Drop intelligent support directly into your product — no redirects, no friction.",
  },
  {
    icon: Zap,
    title: "Instant, Context-Aware Answers",
    desc: "Trained on your docs and data. Answers that feel native to your product.",
  },
  {
    icon: MessageSquare,
    title: "Seamless Human Handoff",
    desc: "When AI reaches its limit, a real agent steps in — instantly, with full context.",
  },
  {
    icon: ShieldCheck,
    title: "Built for Trust & Scale",
    desc: "Multi-tenant isolation and rate controls built in from day one.",
  },
];

interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-dvh w-full bg-background flex overflow-x-hidden">
      {/* Left — Form Panel */}
      <div className="w-full lg:w-1/2 flex flex-col min-h-dvh overflow-y-auto">
        {/* Mobile logo */}
        <div className="flex lg:hidden items-center gap-2.5 px-6 pt-6 pb-2 shrink-0">
          <Logo size={30} color="var(--color-primary)" />
          <span className="text-base font-extrabold tracking-tight text-foreground">InteraOne</span>
        </div>

        <div className="flex-1 flex items-start lg:items-center justify-center px-5 sm:px-8 md:px-12 py-8 lg:py-10">
          <div className="w-full max-w-lg">{children}</div>
        </div>

        <div className="px-6 pb-5 text-center text-xs text-muted-foreground/40 shrink-0">
          © {new Date().getFullYear()} InteraOne · All rights reserved.
        </div>
      </div>

      {/* Right — Brand Panel */}
      <div className="hidden lg:flex w-1/2 shrink-0 relative flex-col overflow-hidden bg-card border-l border-border/40">
        {/* Dot grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage: "radial-gradient(circle, var(--color-foreground) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        {/* Glow blobs */}
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-primary/6 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-40 -left-20 w-80 h-80 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 flex flex-col h-full p-8 xl:p-12">
          {/* Brand header */}
          <header className="flex items-center gap-3 mb-auto">
            <Logo size={44} color="var(--color-primary)" className="shrink-0" />
            <div>
              <p className="text-lg font-bold tracking-tight text-foreground leading-none">InteraOne</p>
              <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                Turn Any Product Into an Intelligent Product
              </p>
            </div>
          </header>

          {/* Hero copy */}
          <div className="my-8">
            <h2 className="text-3xl xl:text-5xl font-bold tracking-tight text-foreground leading-[1.1] mb-4">
              Turn any product<br />
              <span className="text-primary">intelligent.</span>
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed max-w-md">
              InteraOne lets you embed a fully AI-native support layer into any product in minutes — so your users get answers, not tickets.
            </p>
          </div>

          {/* Features — glass cards */}
          <div className="space-y-3 mb-auto">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="flex items-start gap-4 p-4 rounded-2xl border border-border/30 bg-muted/10 backdrop-blur-sm hover:translate-x-1 hover:border-primary/20 hover:bg-muted/20 transition-all duration-200 group"
                >
                  <div className="w-9 h-9 shrink-0 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{f.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Social proof */}
          <div className="mt-10 pt-8 border-t border-border/30 flex items-center gap-4">
            <div className="flex -space-x-2.5">
              {["A", "B", "C", "D"].map((l, i) => (
                <div
                  key={l}
                  className="h-9 w-9 rounded-full bg-primary/15 border-2 border-card flex items-center justify-center text-xs font-bold text-primary"
                  style={{ zIndex: 4 - i }}
                >
                  {l}
                </div>
              ))}
            </div>
            <div>
              <div className="flex items-center gap-0.5 mb-1">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="h-3 w-3 fill-primary" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Loved by <span className="font-bold text-foreground">product teams</span> shipping faster with AI
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
