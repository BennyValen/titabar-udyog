"use client";

import { useCallback, useEffect, useRef, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CustomerSearchInput,
  type CustomerSuggestion,
} from "@/components/orders/customer-search-input";
import {
  ItemSearchInput,
  type InventorySearchItem,
} from "@/components/orders/item-search-input";
import { api, ApiError } from "@/lib/fetcher";
import { cn, formatQty, formatUnit } from "@/lib/utils";

interface OrderLine {
  inventoryItemId?: string;
  name: string;
  unit: string;
  category: string;
  quantity: number;
  unverified: boolean;
  savedName: string;
  savedQty: number;
  savedInventoryItemId?: string;
  savedUnverified: boolean;
}

interface OrderStockWarning {
  inventoryItemId: string;
  itemName: string;
  availableQty: number;
  requestedQty: number;
  moq: number;
  exceedsStock: boolean;
  lowStock: boolean;
}

const focusInput = "h-8 text-sm";

export default function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);
  const itemRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const rowNameRefs = useRef<(HTMLInputElement | null)[]>([]);
  const rowQtyRefs = useRef<(HTMLInputElement | null)[]>([]);
  const addRef = useRef<HTMLButtonElement>(null);
  const stockPopupRef = useRef<HTMLDivElement>(null);
  const stockWarningModalRef = useRef<HTMLDivElement>(null);
  const itemNotFoundModalRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [orderNumber, setOrderNumber] = useState("");
  const [branchId, setBranchId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [remarks, setRemarks] = useState("");
  const [activeCustomerField, setActiveCustomerField] = useState<"name" | "phone" | null>(null);

  const [lines, setLines] = useState<OrderLine[]>([]);
  const [itemQuery, setItemQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<InventorySearchItem | null>(null);
  const [unverified, setUnverified] = useState(false);
  const [qty, setQty] = useState("");

  const [stockWarnings, setStockWarnings] = useState<OrderStockWarning[]>([]);
  const [showStockPopup, setShowStockPopup] = useState(false);
  const [lineWarnings, setLineWarnings] = useState<Record<number, { lowStock: boolean }>>({});
  const [stockWarning, setStockWarning] = useState<{
    lineIndex: number;
    itemName: string;
    requested: number;
    available: number;
    isAddRow?: boolean;
  } | null>(null);
  const [itemNotFound, setItemNotFound] = useState<{ lineIndex: number; name: string } | null>(
    null
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api<{ order: Record<string, unknown> }>(`/api/orders/${id}`)
      .then((d) => {
        const o = d.order;
        const status = o.status as string;
        if (!["PENDING", "DRAFT"].includes(status)) {
          router.replace(`/orders/${id}`);
          return;
        }
        setOrderNumber(o.orderNumber as string);
        setBranchId(o.branchId as string);
        setCustomerName((o.customerName as string) || "");
        setCustomerPhone((o.customerPhone as string) || "");
        setCustomerAddress((o.customerAddress as string) || "");
        setRemarks((o.remarks as string) || "");
        const items = o.items as Array<Record<string, unknown>>;
        setLines(
          items.map((item) => {
            const name = item.itemNameSnapshot as string;
            const quantity = Number(item.quantity);
            const inventoryItemId = item.inventoryItemId as string | undefined;
            return {
              inventoryItemId,
              name,
              unit: (item.unitSnapshot as string) || "",
              category: item.category as string,
              quantity,
              unverified: false,
              savedName: name,
              savedQty: quantity,
              savedInventoryItemId: inventoryItemId,
              savedUnverified: false,
            };
          })
        );
      })
      .catch(() => router.replace("/orders"))
      .finally(() => setLoading(false));
  }, [id, router]);

  const onCustomerSelect = (c: CustomerSuggestion) => {
    setActiveCustomerField(null);
    setCustomerName(c.name);
    setCustomerPhone(c.phone);
    setCustomerAddress(c.address);
  };

  const activeCategory = selectedItem?.category ?? (unverified ? "TRADING_ITEM" : "");
  const activeUnit = selectedItem?.unit ?? null;
  const activeUnitLabel = formatUnit(activeUnit);

  const focus = (ref: React.RefObject<HTMLElement | null>) => ref.current?.focus();

  const onFieldKeyDown = (
    e: React.KeyboardEvent,
    opts: {
      value: string;
      onClear: () => void;
      next?: React.RefObject<HTMLElement | null>;
      prev?: React.RefObject<HTMLElement | null>;
    }
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (opts.next) focus(opts.next);
    }
    if (e.key === "Escape") {
      e.preventDefault();
      if (opts.value) opts.onClear();
      else if (opts.prev) focus(opts.prev);
    }
  };

  const clearAddRow = () => {
    setItemQuery("");
    setSelectedItem(null);
    setUnverified(false);
    setQty("");
  };

  const resetActiveRow = () => {
    clearAddRow();
    setTimeout(() => itemRef.current?.focus(), 0);
  };

  const focusAddress = () => addressRef.current?.focus();

  const focusFirstItem = () => {
    if (lines.length > 0) rowNameRefs.current[0]?.focus();
    else itemRef.current?.focus();
  };

  const focusLastLineQty = () => {
    if (lines.length > 0) rowQtyRefs.current[lines.length - 1]?.focus();
    else focusAddress();
  };

  const tryStockWarning = async (
    lineIndex: number,
    inventoryItemId: string | undefined,
    itemName: string,
    quantity: number,
    isAddRow = false
  ): Promise<boolean> => {
    if (!branchId || !inventoryItemId || quantity <= 0) return true;
    try {
      const data = await api<{ availability: Record<string, number> }>(
        "/api/orders/stock-warnings",
        {
          method: "POST",
          body: JSON.stringify({
            branchId,
            orderId: id,
            items: [{ inventoryItemId, quantity, itemName }],
          }),
        }
      );
      const available = data.availability?.[inventoryItemId] ?? 0;
      if (quantity > available) {
        setStockWarning({ lineIndex, itemName, requested: quantity, available, isAddRow });
        return false;
      }
    } catch {
      /* proceed */
    }
    return true;
  };

  const onItemsHomeEnd = (e: React.KeyboardEvent) => {
    if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      addressRef.current?.focus();
    }
  };

  const updateLine = (index: number, patch: Partial<OrderLine>) => {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const removeLine = (index: number) => {
    setLines((prev) => {
      const next = prev.filter((_, i) => i !== index);
      setTimeout(() => {
        if (next.length === 0) itemRef.current?.focus();
        else if (index > 0) rowQtyRefs.current[Math.min(index - 1, next.length - 1)]?.focus();
        else rowNameRefs.current[0]?.focus();
      }, 0);
      return next;
    });
  };

  const handleLineQtyChange = (index: number, rawValue: string) => {
    if (rawValue !== "" && !/^\d+$/.test(rawValue)) return;
    updateLine(index, { quantity: rawValue === "" ? 0 : parseInt(rawValue, 10) });
  };

  const validateRowItemOnEnter = async (index: number): Promise<boolean> => {
    const line = lines[index];
    const name = line.name.trim();
    if (!name) {
      setItemNotFound({ lineIndex: index, name: "" });
      return false;
    }
    if (line.name === line.savedName && line.inventoryItemId && !line.unverified) return true;
    try {
      const data = await api<{ results: InventorySearchItem[] }>(
        `/api/inventory/search?q=${encodeURIComponent(name)}&categories=FINISHED_GOOD,TRADING_ITEM`
      );
      const exact = data.results.find((r) => r.name.toLowerCase() === name.toLowerCase());
      if (exact) {
        updateLine(index, {
          name: exact.name,
          inventoryItemId: exact.id,
          unit: exact.unit ?? "",
          category: exact.category,
          unverified: false,
        });
        return true;
      }
      setItemNotFound({ lineIndex: index, name });
      return false;
    } catch {
      setItemNotFound({ lineIndex: index, name });
      return false;
    }
  };

  const dismissStockWarning = () => {
    if (!stockWarning) return;
    const { lineIndex, isAddRow } = stockWarning;
    if (!isAddRow) {
      const saved = lines[lineIndex]?.savedQty;
      if (saved !== undefined) updateLine(lineIndex, { quantity: saved });
    }
    setStockWarning(null);
    setTimeout(() => {
      if (isAddRow) qtyRef.current?.focus();
      else rowQtyRefs.current[lineIndex]?.focus();
    }, 0);
  };

  const useMaxStock = () => {
    if (!stockWarning) return;
    const { lineIndex, available, isAddRow } = stockWarning;
    setStockWarning(null);
    if (isAddRow) {
      addLine(available);
      setTimeout(() => itemRef.current?.focus(), 0);
    } else {
      updateLine(lineIndex, { quantity: available, savedQty: available });
      setTimeout(() => rowQtyRefs.current[lineIndex]?.focus(), 0);
    }
  };

  const stockCheckItems = useCallback(
    () =>
      lines
        .filter((l) => l.inventoryItemId)
        .map((l) => ({
          inventoryItemId: l.inventoryItemId!,
          quantity: l.quantity,
          itemName: l.name,
        })),
    [lines]
  );

  useEffect(() => {
    if (!branchId) {
      setLineWarnings({});
      return;
    }
    const items = stockCheckItems();
    if (items.length === 0) {
      setLineWarnings({});
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const data = await api<{
          warnings: OrderStockWarning[];
        }>("/api/orders/stock-warnings", {
          method: "POST",
          body: JSON.stringify({ branchId, orderId: id, items }),
        });
        const byId = new Map(data.warnings.map((w) => [w.inventoryItemId, w]));
        const mapped: Record<number, { lowStock: boolean }> = {};
        lines.forEach((l, i) => {
          if (l.inventoryItemId && byId.has(l.inventoryItemId)) {
            const w = byId.get(l.inventoryItemId)!;
            if (w.lowStock) mapped[i] = { lowStock: true };
          }
        });
        setLineWarnings(mapped);
      } catch {
        setLineWarnings({});
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [branchId, lines, stockCheckItems]);

  useEffect(() => {
    if (!stockWarning) return;
    const warning = stockWarning;
    const savedQty = lines[warning.lineIndex]?.savedQty;
    setTimeout(() => stockWarningModalRef.current?.focus(), 0);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        setStockWarning(null);
        if (warning.isAddRow) {
          addLine(warning.available);
          setTimeout(() => itemRef.current?.focus(), 0);
        } else {
          updateLine(warning.lineIndex, {
            quantity: warning.available,
            savedQty: warning.available,
          });
          setTimeout(() => rowQtyRefs.current[warning.lineIndex]?.focus(), 0);
        }
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setStockWarning(null);
        if (!warning.isAddRow && savedQty !== undefined) {
          updateLine(warning.lineIndex, { quantity: savedQty });
        }
        setTimeout(() => {
          if (warning.isAddRow) qtyRef.current?.focus();
          else rowQtyRefs.current[warning.lineIndex]?.focus();
        }, 0);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [stockWarning, lines]);

  useEffect(() => {
    if (!itemNotFound) return;
    const idx = itemNotFound.lineIndex;
    setTimeout(() => itemNotFoundModalRef.current?.focus(), 0);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === "Escape") {
        e.preventDefault();
        setItemNotFound(null);
        setTimeout(() => rowNameRefs.current[idx]?.focus(), 0);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [itemNotFound]);

  const addLine = (overrideQty?: number) => {
    const name = selectedItem?.name ?? itemQuery.trim();
    const quantity = overrideQty ?? parseFloat(qty);
    if (!name || !quantity || quantity <= 0) {
      setFormError("Enter item name and quantity");
      return;
    }
    const isUnverified = unverified || !selectedItem;
    setLines((prev) => [
      ...prev,
      {
        inventoryItemId: selectedItem?.id,
        name,
        unit: activeUnit ?? "",
        category: activeCategory || "TRADING_ITEM",
        quantity,
        unverified: isUnverified,
        savedName: name,
        savedQty: quantity,
        savedInventoryItemId: selectedItem?.id,
        savedUnverified: isUnverified,
      },
    ]);
    setFormError(null);
    resetActiveRow();
  };

  const saveOrder = async (forceUpdate = false) => {
    setSubmitting(true);
    try {
      await api(`/api/orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          customerName,
          customerPhone,
          customerAddress,
          remarks,
          forceUpdate,
          items: lines.map((l) => ({
            inventoryItemId: l.inventoryItemId,
            itemName: l.unverified || !l.inventoryItemId ? l.name : undefined,
            category: l.category,
            quantity: l.quantity,
          })),
        }),
      });
      router.push(`/orders/${id}`);
    } catch (err) {
      if (err instanceof ApiError) setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSave = async () => {
    setFormError(null);
    setShowStockPopup(false);
    if (!customerName.trim()) {
      setFormError("Customer name is required");
      focus(nameRef);
      return;
    }
    if (customerPhone.trim().length < 10) {
      setFormError("Valid phone number is required");
      focus(phoneRef);
      return;
    }
    if (lines.length === 0) {
      setFormError("Add at least one item");
      focus(itemRef);
      return;
    }
    const items = stockCheckItems();
    if (items.length > 0 && branchId) {
      try {
        const data = await api<{ warnings: OrderStockWarning[] }>(
          "/api/orders/stock-warnings",
          { method: "POST", body: JSON.stringify({ branchId, orderId: id, items }) }
        );
        if (data.warnings.length > 0) {
          setStockWarnings(data.warnings);
          setShowStockPopup(true);
          setTimeout(() => stockPopupRef.current?.focus(), 0);
          return;
        }
      } catch {
        /* proceed */
      }
    }
    await saveOrder(false);
  };

  if (loading) return <p className="text-sm text-muted">Loading order...</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Edit Order</h1>
          <p className="text-xs text-muted">{orderNumber} · Enter → next · Esc → back</p>
        </div>
        <Link href={`/orders/${id}`}>
          <Button variant="secondary" size="sm">
            Cancel
          </Button>
        </Link>
      </div>

      {itemNotFound && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
          <div
            ref={itemNotFoundModalRef}
            tabIndex={-1}
            className="w-[380px] rounded-xl bg-white p-7 shadow-2xl outline-none"
          >
            <h3 className="mb-2 text-center text-[17px] font-bold">Item Not Found</h3>
            <p className="mb-5 text-center text-sm text-gray-500">
              {itemNotFound.name ? (
                <>
                  <strong>{itemNotFound.name}</strong> was not found in the master list.
                </>
              ) : (
                "Please enter an item name."
              )}
            </p>
            <button
              type="button"
              autoFocus
              onClick={() => {
                const idx = itemNotFound.lineIndex;
                setItemNotFound(null);
                setTimeout(() => rowNameRefs.current[idx]?.focus(), 0);
              }}
              className="w-full rounded-lg bg-blue-600 px-2.5 py-2.5 text-[13px] font-semibold text-white"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {stockWarning && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
          <div
            ref={stockWarningModalRef}
            tabIndex={-1}
            className="w-[380px] rounded-xl bg-white p-7 shadow-2xl outline-none"
          >
            <h3 className="mb-2 text-center text-[17px] font-bold">Stock Exceeded</h3>
            <p className="mb-5 text-center text-sm text-gray-500">
              Requested <strong>{formatQty(stockWarning.requested)}</strong> of{" "}
              <strong>{stockWarning.itemName}</strong>, but only{" "}
              <strong>{formatQty(stockWarning.available)}</strong> available.
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={dismissStockWarning}
                className="flex-1 rounded-lg border px-2.5 py-2.5 text-[13px] font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                autoFocus
                onClick={useMaxStock}
                className="flex-1 rounded-lg bg-blue-600 px-2.5 py-2.5 text-[13px] font-semibold text-white"
              >
                Use Max ({formatQty(stockWarning.available)})
              </button>
            </div>
            <p className="mt-3 text-center text-[11px] text-gray-400">
              Enter = Use Max · Esc = Cancel
            </p>
          </div>
        </div>
      )}

      {formError && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {formError}
        </p>
      )}

      {showStockPopup && stockWarnings.length > 0 && (
        <div
          ref={stockPopupRef}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              setShowStockPopup(false);
              void saveOrder(true);
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setShowStockPopup(false);
            }
          }}
          className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm outline-none ring-2 ring-amber-400"
        >
          <p className="font-semibold">⚠️ STOCK WARNING</p>
          <ol className="mt-2 list-decimal space-y-2 pl-5">
            {stockWarnings.map((w) => (
              <li key={w.inventoryItemId}>
                <span className="font-medium">{w.itemName}</span>
                <span className="ml-2 text-xs">
                  Avail {formatQty(w.availableQty)}
                  {w.exceedsStock && ` · Requested ${formatQty(w.requestedQty)}`}
                  {w.lowStock && " · LOW STOCK"}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 font-medium">Save anyway?</p>
          <p className="text-xs text-muted">Enter = Yes · Esc = No</p>
        </div>
      )}

      <Card title="Customer">
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label className="mb-0.5 block text-xs font-medium text-muted">Customer Name</label>
            <CustomerSearchInput
              field="name"
              value={customerName}
              onChange={setCustomerName}
              onSelect={onCustomerSelect}
              activeField={activeCustomerField}
              onActivate={setActiveCustomerField}
              inputRef={nameRef}
              onEnterNext={() => phoneRef.current?.focus()}
              onEscape={() => nameRef.current?.blur()}
              onGoBack={() => nameRef.current?.focus()}
              className={focusInput}
            />
          </div>
          <div>
            <label className="mb-0.5 block text-xs font-medium text-muted">WhatsApp / Phone</label>
            <CustomerSearchInput
              field="phone"
              value={customerPhone}
              onChange={setCustomerPhone}
              onSelect={onCustomerSelect}
              activeField={activeCustomerField}
              onActivate={setActiveCustomerField}
              inputRef={phoneRef}
              onEnterNext={() => addressRef.current?.focus()}
              onEscape={() => nameRef.current?.focus()}
              onGoBack={() => nameRef.current?.focus()}
              className={focusInput}
            />
          </div>
          <div>
            <label className="mb-0.5 block text-xs font-medium text-muted">Address</label>
            <Input
              ref={addressRef}
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  focusFirstItem();
                  return;
                }
                onFieldKeyDown(e, {
                  value: customerAddress,
                  onClear: () => setCustomerAddress(""),
                  prev: phoneRef,
                });
              }}
              className={focusInput}
            />
          </div>
        </div>
      </Card>

      <Card title="Items">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted">
              <th className="w-8 py-1 pr-2">#</th>
              <th className="py-1 pr-2">Item</th>
              <th className="w-14 py-1 pr-2">Unit</th>
              <th className="w-32 py-1 pr-2">Category</th>
              <th className="w-20 py-1 pr-2 text-right">Qty</th>
              <th className="w-28 py-1 pr-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b border-border/60">
                <td className="py-1 pr-2 text-muted">{i + 1}</td>
                <td className="py-1 pr-2">
                  <Input
                    ref={(el) => {
                      rowNameRefs.current[i] = el;
                    }}
                    value={l.name}
                    onChange={(e) =>
                      updateLine(i, {
                        name: e.target.value,
                        inventoryItemId: undefined,
                        unverified: true,
                      })
                    }
                    onKeyDown={(e) => {
                      onItemsHomeEnd(e);
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void validateRowItemOnEnter(i).then((ok) => {
                          if (ok) rowQtyRefs.current[i]?.focus();
                        });
                        return;
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        if (i === 0) addressRef.current?.focus();
                        else rowQtyRefs.current[i - 1]?.focus();
                      }
                    }}
                    className="h-7 text-sm"
                  />
                </td>
                <td className="py-1 pr-2 text-sm text-muted">{formatUnit(l.unit)}</td>
                <td className="py-1 pr-2">
                  <Badge status={l.category} />
                </td>
                <td className="py-1 text-right">
                  <Input
                    ref={(el) => {
                      rowQtyRefs.current[i] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    value={l.quantity > 0 ? String(l.quantity) : ""}
                    onChange={(e) => handleLineQtyChange(i, e.target.value)}
                    onKeyDown={(e) => {
                      onItemsHomeEnd(e);
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.stopPropagation();
                        const raw = e.currentTarget.value;
                        if (raw !== "" && !/^\d+$/.test(raw)) return;
                        const quantity = raw === "" ? 0 : parseInt(raw, 10);
                        updateLine(i, { quantity, savedQty: quantity });
                        void (async () => {
                          const itemId =
                            l.inventoryItemId ??
                            (l.name === l.savedName ? l.savedInventoryItemId : undefined);
                          const ok = await tryStockWarning(i, itemId, l.name, quantity, false);
                          if (!ok) return;
                          setTimeout(() => {
                            if (i < lines.length - 1) rowNameRefs.current[i + 1]?.focus();
                            else itemRef.current?.focus();
                          }, 0);
                        })();
                        return;
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        rowNameRefs.current[i]?.focus();
                      }
                    }}
                    className="ml-auto h-7 w-20 text-right text-sm"
                  />
                </td>
                <td className="py-1 pr-2 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {lineWarnings[i]?.lowStock && (
                      <span className="font-medium text-amber-700">LOW STOCK</span>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-muted hover:text-red-600"
                      onClick={() => removeLine(i)}
                    >
                      Remove
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            <tr className="border-b border-border/60">
              <td className="py-1 pr-2 text-muted">{lines.length + 1}</td>
              <td className="py-1 pr-2">
                <ItemSearchInput
                  value={itemQuery}
                  selected={selectedItem}
                  unverified={unverified}
                  onQueryChange={setItemQuery}
                  onSelect={setSelectedItem}
                  onUnverifiedChange={setUnverified}
                  inputRef={itemRef}
                  onEnterNext={() => qtyRef.current?.focus()}
                  categories={["FINISHED_GOOD", "TRADING_ITEM"]}
                  onGoBack={focusAddress}
                  onEscape={focusLastLineQty}
                />
              </td>
              <td className="py-1 pr-2 text-sm text-muted">{activeUnitLabel}</td>
              <td className="py-1 pr-2">
                {activeCategory ? <Badge status={activeCategory} /> : null}
              </td>
              <td className="py-1 text-right">
                <Input
                  ref={qtyRef}
                  type="text"
                  inputMode="numeric"
                  placeholder="Qty"
                  value={qty}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "" || /^\d+$/.test(v)) setQty(v);
                  }}
                  onKeyDown={(e) => {
                    onItemsHomeEnd(e);
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.stopPropagation();
                      const name = selectedItem?.name ?? itemQuery.trim();
                      const quantity = parseInt(e.currentTarget.value || qty, 10);
                      if (!name || !quantity || quantity <= 0) {
                        itemRef.current?.focus();
                        return;
                      }
                      void (async () => {
                        const ok = await tryStockWarning(
                          lines.length,
                          selectedItem?.id,
                          name,
                          quantity,
                          true
                        );
                        if (!ok) return;
                        addLine(quantity);
                      })();
                      return;
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      itemRef.current?.focus();
                    }
                  }}
                  className="ml-auto h-7 w-20 text-right text-sm"
                />
              </td>
              <td className="py-1 pr-2 text-right">
                <Button
                  ref={addRef}
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-7"
                  onClick={() => addLine()}
                >
                  Add
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </Card>

      <div className="flex justify-end gap-2">
        <Button onClick={() => void handleSave()} disabled={submitting || lines.length === 0}>
          {submitting ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
