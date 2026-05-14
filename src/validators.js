import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(100),
  role: z.enum(["admin", "member"]).default("member")
});

export const loginSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1)
});

export const projectSchema = z.object({
  name: z.string().trim().min(2).max(140),
  description: z.string().trim().max(1000).optional().default("")
});

export const memberSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase())
});

export const taskSchema = z.object({
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(1500).optional().default(""),
  assigneeId: z.string().uuid().nullable().optional(),
  status: z.enum(["todo", "in_progress", "done"]).optional().default("todo"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional()
});

export const taskUpdateSchema = z.object({
  title: z.string().trim().min(2).max(180).optional(),
  description: z.string().trim().max(1500).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  status: z.enum(["todo", "in_progress", "done"]).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional()
});

export function parseBody(schema) {
  return (req, res, next) => {
    req.validated = schema.parse(req.body);
    next();
  };
}
