import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { jsonOk, jsonError, handleApiError } from "@/lib/api";
import { getCustomerByPhone } from "@/lib/customers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ phone: string }> }
) {
  try {
    await requireAuth();
    const { phone } = await params;
    const decoded = decodeURIComponent(phone);
    const data = await getCustomerByPhone(decoded);
    if (!data) return jsonError("Customer not found", 404);
    return jsonOk(data);
  } catch (error) {
    return handleApiError(error);
  }
}
