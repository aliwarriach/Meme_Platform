import { z } from 'zod';

export const sendFriendRequestSchema = z.object({
  username: z
    .string()
    .min(3, 'At least 3 characters')
    .max(32, 'At most 32 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers, and underscores only'),
});
export type SendFriendRequestFormValues = z.infer<typeof sendFriendRequestSchema>;
