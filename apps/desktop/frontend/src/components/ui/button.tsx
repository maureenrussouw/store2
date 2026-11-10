import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-lg text-[13px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent/20 focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-fg hover:bg-accent-hover",
        secondary: "border border-border bg-surface-2 text-foreground hover:bg-surface-hover",
        ghost: "text-foreground-secondary hover:bg-surface-hover hover:text-foreground",
        danger: "bg-danger text-white hover:bg-danger/90",
      },
      size: {
        sm: "h-8 px-2.5",
        md: "h-9 px-3",
        lg: "h-11 px-4 text-[14px]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
