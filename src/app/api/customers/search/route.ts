import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { jsonOk, handleApiError } from "@/lib/api";
import { searchCustomers } from "@/lib/customers";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const q = new URL(req.url).searchParams.get("q") || "";
    const results = await searchCustomers(q);
    return jsonOk(results);
  } catch (error) {
    return handleApiError(error);
  }
}
