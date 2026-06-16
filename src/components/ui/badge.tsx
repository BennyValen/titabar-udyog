import { cn } from "@/lib/utils";

const variants: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  SUBMITTED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
  DRAFT: "bg-slate-100 text-slate-700",
  ACTIVE: "bg-blue-100 text-blue-800",
  RAW_MATERIAL: "bg-orange-100 text-orange-800",
  FINISHED_GOOD: "bg-emerald-100 text-emerald-800",
  TRADING_ITEM: "bg-violet-100 text-violet-800",
};

export function Badge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
        variants[status] || "bg-slate-100 text-slate-700",
        className
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
