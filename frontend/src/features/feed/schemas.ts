import { z } from 'zod';

export const commentSchema = z.object({
  body: z.string().min(1, 'Say something').max(500, 'At most 500 characters'),
});
export type CommentFormValues = z.infer<typeof commentSchema>;
