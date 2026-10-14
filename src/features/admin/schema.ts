import { z } from "zod";

export const ACCESS_STATES = ["trial", "trial_ended", "paid", "suspended"] as const;
export type AccessState = (typeof ACCESS_STATES)[number];

export const activatePlanSchema = z.object({
  businessId: z.uuid(),
  note: z.string().trim().max(500),
});

export const EXTEND_DAYS = [7, 14, 30] as const;
export const extendTrialSchema = z.object({
  businessId: z.uuid(),
  days: z.union(EXTEND_DAYS.map((d) => z.literal(d))),
  note: z.string().trim().max(500),
});

export const setStatusSchema = z
  .object({
    businessId: z.uuid(),
    status: z.enum(["active", "suspended"]),
    reason: z.string().trim().max(500),
  })
  .refine((v) => v.status === "active" || v.reason.length > 0, { path: ["reason"] });
