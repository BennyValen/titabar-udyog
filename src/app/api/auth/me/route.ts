import { getSession } from "@/lib/auth";
import { jsonOk, jsonError, handleApiError } from "@/lib/api";

export async function GET() {
  try {
    const user = await getSession();
    if (!user) return jsonError("Unauthorized", 401);
    return jsonOk({ user });
  } catch (error) {
    return handleApiError(error);
  }
}
