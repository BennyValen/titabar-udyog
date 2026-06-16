import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, requireAdmin } from "@/lib/auth";
import { jsonOk, handleApiError } from "@/lib/api";
import { logAudit } from "@/lib/stock";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(10),
  password: z.string().min(4),
  role: z.enum(["ADMIN", "BRANCH_USER"]),
  branchId: z.string().optional().nullable(),
});

export async function GET() {
  try {
    await requireAdmin();
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        branchId: true,
        isActive: true,
        createdAt: true,
        branch: { select: { id: true, name: true, code: true } },
      },
    });
    return jsonOk({ users });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = createSchema.parse(await req.json());

    if (body.role === "BRANCH_USER" && !body.branchId) {
      return handleApiError(new Error("Branch is required for branch users"));
    }

    const passwordHash = await hashPassword(body.password);
    const user = await prisma.user.create({
      data: {
        name: body.name,
        phone: body.phone,
        passwordHash,
        role: body.role,
        branchId: body.role === "ADMIN" ? null : body.branchId,
      },
      include: { branch: true },
    });

    await logAudit(admin.id, "CREATE", "User", user.id, user.branchId ?? undefined);
    const { passwordHash: _hash, ...safe } = user;
    void _hash;
    return jsonOk({ user: safe }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
