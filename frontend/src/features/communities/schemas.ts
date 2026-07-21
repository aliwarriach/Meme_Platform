import { z } from 'zod';

export const createCommunitySchema = z.object({
  name: z.string().min(1, 'Name your community').max(100, 'At most 100 characters'),
  description: z.string().max(500, 'At most 500 characters').optional(),
  privacy: z.enum(['open', 'invite_only']),
});
export type CreateCommunityFormValues = z.infer<typeof createCommunitySchema>;
