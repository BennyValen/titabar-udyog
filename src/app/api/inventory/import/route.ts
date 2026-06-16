import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { jsonError, handleApiError } from "@/lib/api";
import { parseInventoryExcel, type ImportRow } from "@/lib/excel";
import { logAudit } from "@/lib/stock";
import { StockCategory } from "@prisma/client";

const CHUNK_SIZE = 50;

type ImportError = { rowNumber: number; message: string; itemName?: string };

async function clearMasterList() {
  await prisma.$transaction(async (tx) => {
    await tx.orderStockReservation.deleteMany();
    await tx.stockMovement.deleteMany();
    await tx.stockBalance.deleteMany();

    const used = await tx.orderItem.findMany({
      select: { inventoryItemId: true },
      distinct: ["inventoryItemId"],
    });
    const usedIds = used.map((r) => r.inventoryItemId);

    if (usedIds.length > 0) {
      await tx.inventoryItem.deleteMany({ where: { id: { notIn: usedIds } } });
      await tx.inventoryItem.updateMany({
        where: { id: { in: usedIds } },
        data: { isActive: false },
      });
    } else {
      await tx.inventoryItem.deleteMany();
    }
  });
}

async function upsertRow(row: ImportRow): Promise<void> {
  const existing = await prisma.inventoryItem.findFirst({
    where: { name: row.name, category: row.category },
  });

  if (existing) {
    await prisma.inventoryItem.update({
      where: { id: existing.id },
      data: {
        subHeading: row.subHeading,
        unit: row.unit,
        moq: 0,
        isActive: true,
      },
    });
  } else {
    await prisma.inventoryItem.create({
      data: {
        name: row.name,
        category: row.category,
        subHeading: row.subHeading,
        unit: row.unit,
        moq: 0,
        isActive: true,
      },
    });
  }
}

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const mode = (formData.get("mode") as string) || "replace";
    const branchId = (formData.get("branchId") as string) || undefined;
    const stream = formData.get("stream") === "true";

    if (!file) return jsonError("No file uploaded");

    const buffer = Buffer.from(await file.arrayBuffer());
    const { rows, errors: parseErrors, debug } = parseInventoryExcel(buffer);

    if (process.env.NODE_ENV === "development") {
      console.log("Import debug preview:", JSON.stringify(debug?.preview));
      console.log("Data starts at row index:", debug?.dataStartIndex);
      console.log("Row 2 raw:", JSON.stringify(debug?.preview?.[2]));
      console.log("Row 3 raw:", JSON.stringify(debug?.preview?.[3]));
      if (rows[0]) console.log("First parsed row:", JSON.stringify(rows[0]));
    }

    if (rows.length === 0) {
      return jsonError(parseErrors[0]?.message || "No valid rows in file");
    }

    if (!stream) {
      return jsonError("Use stream=true for import");
    }

    const encoder = new TextEncoder();
    const body = new ReadableStream({
      async start(controller) {
        const send = (data: object) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          if (mode === "replace") await clearMasterList();

          const importErrors: ImportError[] = [...parseErrors];
          let successRows = 0;
          const total = rows.length;

          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            try {
              await upsertRow(row);
              successRows++;
            } catch (err) {
              const message = errMsg(err);
              if (importErrors.length === 0) {
                console.error("First import row error:", message, row);
              }
              importErrors.push({
                rowNumber: row.rowNumber,
                itemName: row.name,
                message,
              });
            }

            if ((i + 1) % CHUNK_SIZE === 0 || i === rows.length - 1) {
              send({
                current: i + 1,
                total,
                percent: Math.round(((i + 1) / total) * 100),
              });
            }
          }

          const batchCategory: StockCategory = rows[0]?.category ?? "TRADING_ITEM";
          const batch = await prisma.inventoryImportBatch.create({
            data: {
              category: batchCategory,
              fileName: file.name,
              importedByUserId: user.id,
              branchId,
              totalRows: rows.length,
              successRows,
              failedRows: importErrors.length,
            },
          });

          await logAudit(user.id, "IMPORT", "InventoryImportBatch", batch.id, branchId, {
            fileName: file.name,
            successRows,
            failedRows: importErrors.length,
            mode,
          });

          send({
            done: true,
            successRows,
            failedRows: importErrors.length,
            errors: importErrors,
            batch,
          });
        } catch (err) {
          send({ error: errMsg(err) });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
