import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
  {
    variants: {
      variant: {
        default: "bg-accent/10 text-accent",
        success: "bg-success/10 text-success",
        warning: "bg-warning/10 text-warning",
        danger: "bg-danger/10 text-danger",
        muted: "bg-surface-2 text-foreground-secondary",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
