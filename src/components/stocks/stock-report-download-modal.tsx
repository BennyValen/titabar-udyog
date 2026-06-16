"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { DateFilterState, DateFilterType, ReportCategory } from "@/lib/stock-report-pdf";

const CATEGORIES: { key: ReportCategory; label: string }[] = [
  { key: "ALL", label: "All Items" },
  { key: "RAW_MATERIAL", label: "Raw Materials" },
  { key: "FINISHED_GOOD", label: "Finished Goods" },
  { key: "TRADING_ITEM", label: "Trading Items" },
];

const DATE_TYPES: { key: DateFilterType; label: string }[] = [
  { key: "ALL_TIME", label: "All Time" },
  { key: "SINGLE_DAY", label: "Single Day" },
  { key: "MONTH", label: "Month" },
  { key: "YEAR", label: "Year" },
  { key: "CUSTOM_RANGE", label: "Custom Range" },
];

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-full border px-2 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-white"
          : "border-border bg-white text-slate-600 hover:bg-slate-50"
      )}
    >
      {children}
    </button>
  );
}

function SectionCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 rounded-lg bg-[#f8f9fa] p-4">
      <p className="mb-3 text-[10px] font-semibold tracking-wider text-slate-500">{label}</p>
      {children}
    </div>
  );
}

export function StockReportDownloadModal({
  open,
  onClose,
  stockCategory,
  onStockCategoryChange,
  dateFilter,
  onDateFilterChange,
  includeMovements,
  onIncludeMovementsChange,
  movementCategory,
  onMovementCategoryChange,
  onDownload,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  stockCategory: ReportCategory;
  onStockCategoryChange: (c: ReportCategory) => void;
  dateFilter: DateFilterState;
  onDateFilterChange: (f: DateFilterState) => void;
  includeMovements: boolean;
  onIncludeMovementsChange: (v: boolean) => void;
  movementCategory: ReportCategory;
  onMovementCategoryChange: (c: ReportCategory) => void;
  onDownload: () => void;
  loading: boolean;
}) {
  if (!open) return null;

  const setDateType = (type: DateFilterType) =>
    onDateFilterChange({ ...dateFilter, type });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-[520px] rounded-xl bg-white p-7 shadow-xl">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">Download Stock Report</h2>
            <p className="text-[13px] text-muted">Choose what to include in your PDF</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-lg text-muted hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <SectionCard label="STOCK STATUS">
          <div className="flex gap-1.5">
            {CATEGORIES.map((c) => (
              <Pill
                key={c.key}
                active={stockCategory === c.key}
                onClick={() => onStockCategoryChange(c.key)}
              >
                {c.label}
              </Pill>
            ))}
          </div>
        </SectionCard>

        <SectionCard label="DATE FILTER">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {DATE_TYPES.map((d) => (
              <Pill
                key={d.key}
                active={dateFilter.type === d.key}
                onClick={() => setDateType(d.key)}
              >
                {d.label}
              </Pill>
            ))}
          </div>
          {dateFilter.type === "SINGLE_DAY" && (
            <Input
              type="date"
              value={dateFilter.singleDay}
              onChange={(e) => onDateFilterChange({ ...dateFilter, singleDay: e.target.value })}
            />
          )}
          {dateFilter.type === "MONTH" && (
            <div className="flex gap-2">
              <Select
                value={dateFilter.month}
                onChange={(e) => onDateFilterChange({ ...dateFilter, month: e.target.value })}
                className="flex-1"
              >
                <option value="">Month</option>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={String(i + 1)}>
                    {new Date(2000, i).toLocaleString("en", { month: "long" })}
                  </option>
                ))}
              </Select>
              <Input
                type="number"
                placeholder="Year"
                value={dateFilter.year}
                onChange={(e) => onDateFilterChange({ ...dateFilter, year: e.target.value })}
                className="w-24"
              />
            </div>
          )}
          {dateFilter.type === "YEAR" && (
            <Input
              type="number"
              placeholder="Year"
              value={dateFilter.year}
              onChange={(e) => onDateFilterChange({ ...dateFilter, year: e.target.value })}
            />
          )}
          {dateFilter.type === "CUSTOM_RANGE" && (
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-muted">From</label>
                <Input
                  type="date"
                  value={dateFilter.fromDate}
                  onChange={(e) => onDateFilterChange({ ...dateFilter, fromDate: e.target.value })}
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs text-muted">To</label>
                <Input
                  type="date"
                  value={dateFilter.toDate}
                  onChange={(e) => onDateFilterChange({ ...dateFilter, toDate: e.target.value })}
                />
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard label="RECENT MOVEMENTS">
          <label className="mb-3 flex cursor-pointer items-center justify-between">
            <span className="text-sm">Include recent movements</span>
            <button
              type="button"
              role="switch"
              aria-checked={includeMovements}
              onClick={() => onIncludeMovementsChange(!includeMovements)}
              className={cn(
                "relative h-6 w-11 rounded-full transition-colors",
                includeMovements ? "bg-primary" : "bg-slate-300"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                  includeMovements && "translate-x-5"
                )}
              />
            </button>
          </label>
          {includeMovements && (
            <div className="flex gap-1.5">
              {CATEGORIES.map((c) => (
                <Pill
                  key={c.key}
                  active={movementCategory === c.key}
                  onClick={() => onMovementCategoryChange(c.key)}
                >
                  {c.label}
                </Pill>
              ))}
            </div>
          )}
        </SectionCard>

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onDownload} disabled={loading} className="gap-1.5">
            <Download size={16} />
            {loading ? "Generating..." : "Download PDF"}
          </Button>
        </div>
      </div>
    </div>
  );
}
