import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  variant?: "inline" | "overlay";
}

export function LoadingSpinner({ variant = "inline" }: LoadingSpinnerProps) {
  const spinner = (
    <div className={cn(
      "rounded-full border-2 border-border border-t-bmw-blue animate-spin",
      variant === "inline" ? "h-5 w-5" : "h-8 w-8"
    )} />
  );

  if (variant === "overlay") {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
        {spinner}
      </div>
    );
  }

  return spinner;
}
