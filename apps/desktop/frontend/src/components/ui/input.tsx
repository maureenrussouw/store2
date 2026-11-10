import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        "w-full h-10 rounded-lg border border-border bg-surface-2 px-3 text-[14px] text-foreground placeholder:text-foreground-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-colors",
        className
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";
