import * as XLSX from "xlsx";
import { StockCategory } from "@prisma/client";

export interface ImportRow {
  category: StockCategory;
  subHeading: string;
  name: string;
  unit: string | null;
  rowNumber: number;
}

export interface ImportResult {
  rows: ImportRow[];
  errors: { rowNumber: number; message: string; itemName?: string }[];
  debug?: {
    preview: unknown[][];
    dataStartIndex: number;
  };
}

export function headingToCategory(heading: string): StockCategory {
  const v = heading.toUpperCase().replace(/[\s-]/g, "_");
  if (v.includes("RAW")) return "RAW_MATERIAL";
  if (v.includes("FINISHED")) return "FINISHED_GOOD";
  if (v.includes("TRADING")) return "TRADING_ITEM";
  return "TRADING_ITEM";
}

export function categoryFromString(value: string): StockCategory | null {
  const v = value.toUpperCase().replace(/[\s-]/g, "_");
  if (v === "RAW_MATERIAL" || v === "RAWMATERIAL" || v === "RAW_MATERIALS") return "RAW_MATERIAL";
  if (v === "FINISHED_GOOD" || v === "FINISHEDGOOD" || v === "FINISHED_GOODS") return "FINISHED_GOOD";
  if (v === "TRADING_ITEM" || v === "TRADINGITEM" || v === "TRADING_ITEMS") return "TRADING_ITEM";
  return null;
}

function cell(row: unknown[] | undefined, index: number): string {
  if (!row || index >= row.length) return "";
  const v = row[index];
  return v == null ? "" : String(v).trim();
}

function findDataStartRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i];
    if (!row) continue;
    const col0 = cell(row, 0).toUpperCase();
    const name = cell(row, 4);
    if (col0 === "HEADING" || col0.includes("ITEM NAME")) continue;
    if (name && name.toUpperCase() !== "ITEM NAME") return i;
  }
  return 2;
}

export function parseInventoryExcel(buffer: Buffer): ImportResult {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: "",
  }) as unknown[][];

  const dataStartIndex = findDataStartRow(rows);
  const parsed: ImportRow[] = [];
  const errors: ImportResult["errors"] = [];
  let lastHeading = "";

  for (let i = dataStartIndex; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const rowNumber = i + 1;
    let heading = cell(row, 0);
    const subHeading = cell(row, 2);
    const name = cell(row, 4);
    const unitRaw = cell(row, 6);

    if (!name) continue;
    if (heading) lastHeading = heading;
    else heading = lastHeading;

    parsed.push({
      category: heading ? headingToCategory(heading) : "TRADING_ITEM",
      subHeading: subHeading || "GENERAL",
      name,
      unit: unitRaw || null,
      rowNumber,
    });
  }

  if (parsed.length === 0) {
    errors.push({ rowNumber: 0, message: "No valid rows found in Excel file" });
  }

  return {
    rows: parsed,
    errors,
    debug: { preview: rows.slice(0, 6), dataStartIndex },
  };
}
