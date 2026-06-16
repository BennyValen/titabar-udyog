export function LowStockIndicator({
  available,
  moq,
}: {
  available: number;
  moq: number;
}) {
  if (available > moq) return null;

  return (
    <div className="flex items-center gap-1.5">
      <div className="low-stock-pulse h-2 w-2 shrink-0 rounded-full bg-red-600" />
      <span className="text-xs font-semibold text-red-600">Low</span>
    </div>
  );
}
