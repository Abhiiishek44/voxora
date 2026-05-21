import { CheckCircle2 } from "lucide-react";
import { SignupForm } from "../../components/signup-form";
import Logo from "@/shared/components/logo";

export default function SetupPage() {
  return (
    <div className="min-h-screen w-full bg-background flex flex-col items-center justify-start lg:justify-center p-4 sm:p-6 lg:p-8 overflow-y-auto relative selection:bg-primary/30">
      <style dangerouslySetInnerHTML={{ __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
      
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
      </div>

      <div className="flex flex-col md:flex-row w-full max-w-[1100px] relative z-10 no-scrollbar">
        <div className="w-full md:w-1/2 p-5 sm:p-8 lg:p-12 flex flex-col">
          <SignupForm />
        </div>
        
        <div className="hidden md:flex w-full md:w-1/2 bg-muted/20 flex-col justify-center p-8 lg:p-12 border-l border-border/40 relative overflow-hidden">
          {/* Subtle decoration for the right panel */}
          <div className="absolute top-0 right-0 w-full h-full opacity-30 pointer-events-none">
            <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] bg-primary/10 rounded-full blur-[100px]" />
          </div>

          <div className="max-w-md mx-auto relative z-10">
            <div className="flex items-center gap-4 mb-8">
              <Logo size={60} />
              <h2 className="text-4xl font-extrabold tracking-tighter text-foreground">
                InteraOne
              </h2>
            </div>
            
            <p className="text-lg text-muted-foreground mb-8 font-medium leading-relaxed">
              The complete platform for intelligent conversations at scale. Connect with your customers faster and smarter.
            </p>
            
            <div className="space-y-4">
              {[
                "AI-powered intelligent routing",
                "Real-time analytics and reporting",
                "Multi-channel support integrations",
                "Scalable team management",
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-4 group">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20 transition-colors group-hover:bg-primary/20">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-base text-foreground/90 font-medium">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-6 pb-4 text-center text-sm text-muted-foreground/60">
        © {new Date().getFullYear()} InteraOne. All rights reserved.
      </div>
    </div>
  );
}
