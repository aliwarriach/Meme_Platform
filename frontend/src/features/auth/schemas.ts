import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  username: z
    .string()
    .min(3, 'At least 3 characters')
    .max(32, 'At most 32 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers, and underscores only'),
  password: z.string().min(8, 'At least 8 characters'),
});
export type RegisterFormValues = z.infer<typeof registerSchema>;
