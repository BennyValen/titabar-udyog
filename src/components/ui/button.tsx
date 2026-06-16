import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
          size === "sm" ? "h-8 px-3 text-xs" : "h-9 px-4 text-sm",
          variant === "primary" && "bg-primary text-primary-foreground hover:bg-blue-800",
          variant === "secondary" && "border border-border bg-white hover:bg-slate-50",
          variant === "danger" && "bg-danger text-white hover:bg-red-800",
          variant === "ghost" && "hover:bg-slate-100",
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
