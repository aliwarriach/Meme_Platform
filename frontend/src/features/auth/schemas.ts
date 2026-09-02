import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

// SecurityFeatures.md F-13 — mirrors the backend's own 13+ check (services/auth.py's
// register_user) so a too-young signup gets a clear inline error before it ever reaches
// the server; the server-side check is still the one that actually enforces it.
const MINIMUM_AGE_YEARS = 13;

function isAtLeast13(dateOfBirth: string): boolean {
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return false;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const hadBirthdayThisYear =
    today.getMonth() > dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
  if (!hadBirthdayThisYear) age -= 1;
  return age >= MINIMUM_AGE_YEARS;
}

export const forgotPasswordRequestSchema = z.object({
  email: z.string().email('Enter a valid email address'),
});
export type ForgotPasswordRequestFormValues = z.infer<typeof forgotPasswordRequestSchema>;

// Mirrors registerSchema's password rule (min 8) so the two "set a password" flows in this
// app enforce the same strength requirement — see registerSchema's own MINIMUM_AGE_YEARS
// comment above for why client-side checks here still defer to the server as the real gate.
export const resetPasswordConfirmSchema = z
  .object({
    code: z.string().length(6, 'Enter the 6-digit code'),
    newPassword: z.string().min(8, 'At least 8 characters'),
    confirmPassword: z.string().min(1, 'Re-enter your new password'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type ResetPasswordConfirmFormValues = z.infer<typeof resetPasswordConfirmSchema>;

export const registerSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  username: z
    .string()
    .min(3, 'At least 3 characters')
    .max(32, 'At most 32 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers, and underscores only'),
  password: z.string().min(8, 'At least 8 characters'),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
    .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Enter a valid date')
    .refine(isAtLeast13, `You must be ${MINIMUM_AGE_YEARS} or older to sign up`),
});
export type RegisterFormValues = z.infer<typeof registerSchema>;
