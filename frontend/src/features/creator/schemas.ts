import { z } from 'zod';

export const creatorSchema = z.object({
  topText: z.string().max(80, 'Keep top text under 80 characters').optional(),
  bottomText: z.string().max(80, 'Keep bottom text under 80 characters').optional(),
  caption: z.string().max(500, 'At most 500 characters').optional(),
  audiences: z.array(z.enum(['public', 'friends'])).min(1, 'Choose at least one audience'),
});
export type CreatorFormValues = z.infer<typeof creatorSchema>;

export const templateUploadSchema = z.object({
  name: z.string().min(1, 'Name your template').max(100, 'At most 100 characters'),
});
export type TemplateUploadFormValues = z.infer<typeof templateUploadSchema>;
