import { cn } from "@/lib/utils";

interface AvatarProps {
  src?: string;
  alt?: string;
  fallback?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "h-7 w-7 text-[11px]",
  md: "h-9 w-9 text-[13px]",
  lg: "h-12 w-12 text-[15px]",
};

export function Avatar({ src, alt, fallback, size = "md", className }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={cn("rounded-full object-cover", sizeClasses[size], className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full bg-accent/20 flex items-center justify-center font-medium text-accent",
        sizeClasses[size],
        className
      )}
    >
      {fallback?.charAt(0)?.toUpperCase() || "?"}
    </div>
  );
}
