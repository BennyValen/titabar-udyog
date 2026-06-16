import * as fs from "fs";
import * as path from "path";
import { parseInventoryExcel } from "../src/lib/excel";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: npx tsx scripts/debug-excel-parse.ts <file.xlsx>");
  process.exit(1);
}

const buffer = fs.readFileSync(path.resolve(filePath));
const workbook = require("xlsx").read(buffer, { type: "buffer" });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = require("xlsx").utils.sheet_to_json(sheet, { header: 1, raw: false }) as unknown[][];

console.log("rows[0]:", JSON.stringify(rows[0]));
console.log("rows[1]:", JSON.stringify(rows[1]));
console.log("rows[2]:", JSON.stringify(rows[2]));
console.log("rows[3]:", JSON.stringify(rows[3]));
console.log("rows[4]:", JSON.stringify(rows[4]));
console.log("rows[5]:", JSON.stringify(rows[5]));

for (let i = 0; i < Math.min(6, rows.length); i++) {
  const row = rows[i];
  console.log(`row[${i}] length:`, row ? row.length : 0);
}

const { rows: parsed, errors } = parseInventoryExcel(buffer);
console.log("parsed count:", parsed.length, "errors:", errors.length);
if (parsed[0]) console.log("first parsed:", JSON.stringify(parsed[0]));
if (parsed[1]) console.log("second parsed:", JSON.stringify(parsed[1]));
