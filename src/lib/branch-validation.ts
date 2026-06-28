import { z } from "zod";
import { normalizePhone } from "./phone";

const emptyToUndefined = (val: unknown) => {
  if (val === undefined || val === null) return undefined;
  if (typeof val === "string" && val.trim() === "") return undefined;
  return val;
};

export const normalizedPhoneSchema = z
  .string()
  .min(1, "Phone is required")
  .transform((v) => normalizePhone(v.trim()))
  .refine((v) => v.length >= 10, "Phone must be at least 10 digits");

export const optionalNormalizedPhoneSchema = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .transform((v) => normalizePhone(v.trim()))
    .refine((v) => v.length >= 10, "Phone must be at least 10 digits")
    .optional()
);

export const optionalPasswordSchema = z.preprocess(
  emptyToUndefined,
  z.string().min(4, "Password must be at least 4 characters").optional()
);

export const branchCreateSchema = z.object({
  name: z.string().trim().min(1, "Branch name is required"),
  code: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .min(2, "Branch code must be at least 2 characters")
      .max(10)
      .optional()
  ),
  phone: normalizedPhoneSchema,
  username: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  password: z.string().min(4, "Password must be at least 4 characters"),
});

export const branchUpdateSchema = z.object({
  name: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  code: z.preprocess(
    emptyToUndefined,
    z.string().trim().min(2).max(10).optional()
  ),
  phone: optionalNormalizedPhoneSchema,
  isActive: z.boolean().optional(),
  username: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  password: optionalPasswordSchema,
});

export const userUpdateSchema = z.object({
  name: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  phone: optionalNormalizedPhoneSchema,
  password: optionalPasswordSchema,
  role: z.enum(["ADMIN", "BRANCH_USER"]).optional(),
  branchId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export function formatZodError(error: z.ZodError): string {
  const first = error.errors[0];
  if (!first) return "Validation failed";
  return first.message;
}
