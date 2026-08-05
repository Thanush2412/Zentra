import * as React from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

const Dialog: React.FC<DialogProps> = ({ open, onOpenChange, children }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs font-sans animate-in fade-in duration-150">
      <div
        className="fixed inset-0 cursor-pointer"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative z-10 w-full max-w-2xl bg-white dark:bg-[#131317] rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5 text-slate-800 dark:text-slate-200">
        {children}
      </div>
    </div>
  );
};

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 border-b border-slate-100 dark:border-slate-800 pb-3", className)} {...props} />
);

const DialogTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn("text-sm font-black uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center justify-between", className)} {...props} />
);

const DialogDescription = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("text-[10px] text-slate-400 font-semibold mt-0.5", className)} {...props} />
);

export { Dialog, DialogHeader, DialogTitle, DialogDescription };
