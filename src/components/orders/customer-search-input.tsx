"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { api } from "@/lib/fetcher";

export interface CustomerSuggestion {
  id: string;
  name: string;
  phone: string;
  address: string;
  lastOrderDate: string;
}

interface CustomerSearchInputProps {
  field: "name" | "phone";
  value: string;
  onChange: (value: string) => void;
  onSelect: (customer: CustomerSuggestion) => void;
  activeField: "name" | "phone" | null;
  onActivate: (field: "name" | "phone") => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onEnterNext?: () => void;
  onEscape?: () => void;
  onGoBack?: () => void;
  className?: string;
}

const DEBOUNCE_MS = 300;
const cache = new Map<string, CustomerSuggestion[]>();

function phoneDigits(phone: string) {
  return phone.replace(/\D/g, "");
}

export function CustomerSearchInput({
  field,
  value,
  onChange,
  onSelect,
  activeField,
  onActivate,
  inputRef,
  onEnterNext,
  onEscape,
  onGoBack,
  className,
}: CustomerSearchInputProps) {
  const internalRef = useRef<HTMLInputElement>(null);
  const ref = inputRef || internalRef;
  const [suggestions, setSuggestions] = useState<CustomerSuggestion[]>([]);
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [picked, setPicked] = useState(false);

  const showDropdown =
    focused && activeField === field && value.trim().length >= 1 && !picked && searched;

  const pick = useCallback(
    (customer: CustomerSuggestion) => {
      setPicked(true);
      onSelect(customer);
      onChange(field === "name" ? customer.name : customer.phone);
      setSuggestions([]);
      setSearched(false);
      setHighlight(-1);
    },
    [field, onChange, onSelect]
  );

  const tryAutoPickPhone = useCallback(
    (term: string, results: CustomerSuggestion[]) => {
      if (field !== "phone" || results.length !== 1) return;
      const typed = phoneDigits(term);
      const matched = phoneDigits(results[0].phone);
      if (typed.length >= 10 && matched.endsWith(typed.slice(-10))) {
        pick(results[0]);
      }
    },
    [field, pick]
  );

  const runSearch = useCallback(
    async (term: string) => {
      if (term.length < 1) {
        setSuggestions([]);
        setSearched(false);
        return;
      }
      if (cache.has(term)) {
        const results = cache.get(term)!;
        setSuggestions(results);
        setSearched(true);
        setHighlight(-1);
        tryAutoPickPhone(term, results);
        return;
      }
      setLoading(true);
      try {
        const results = await api<CustomerSuggestion[]>(
          `/api/customers/search?q=${encodeURIComponent(term)}`
        );
        cache.set(term, results);
        setSuggestions(results);
        setSearched(true);
        setHighlight(-1);
        tryAutoPickPhone(term, results);
      } catch {
        setSuggestions([]);
        setSearched(true);
      } finally {
        setLoading(false);
      }
    },
    [tryAutoPickPhone]
  );

  useEffect(() => {
    if (picked) {
      setSuggestions([]);
      setSearched(false);
      return;
    }
    const term = value.trim();
    if (term.length < 1) {
      setSuggestions([]);
      setSearched(false);
      return;
    }
    const timer = setTimeout(() => runSearch(term), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value, picked, runSearch]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (suggestions.length > 0) {
        setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
      }
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (showDropdown && highlight >= 0 && suggestions[highlight]) {
        pick(suggestions[highlight]);
        return;
      }
      if (showDropdown && suggestions.length === 1) {
        pick(suggestions[0]);
        return;
      }
      onEnterNext?.();
      return;
    }
    if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      setSearched(false);
      setHighlight(-1);
      onGoBack?.();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      if (showDropdown) {
        setSearched(false);
        setHighlight(-1);
        return;
      }
      if (value) {
        onChange("");
        setPicked(false);
        return;
      }
      onEscape?.();
    }
  };

  return (
    <div className="relative min-w-0">
      <Input
        ref={ref}
        value={value}
        onChange={(e) => {
          setPicked(false);
          onChange(e.target.value);
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          setFocused(true);
          onActivate(field);
        }}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        className={className}
        autoComplete="off"
      />
      {showDropdown && (
        <ul className="absolute z-20 mt-0.5 max-h-48 w-full overflow-auto rounded-md border border-border bg-white py-1 shadow-lg">
          {loading && <li className="px-3 py-2 text-sm text-muted">Searching...</li>}
          {!loading && suggestions.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted">No customers found</li>
          )}
          {!loading &&
            suggestions.map((c, i) => (
              <li
                key={c.id}
                className={cn(
                  "cursor-pointer px-3 py-1.5 text-sm",
                  i === highlight ? "bg-slate-100" : "hover:bg-slate-50"
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(c);
                }}
              >
                <span className="font-medium">{c.name}</span>
                <span className="ml-2 text-muted">{c.phone}</span>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
