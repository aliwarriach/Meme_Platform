import { z } from 'zod';

const baseCreatorFields = {
  topText: z.string().max(80, 'Keep top text under 80 characters').optional(),
  bottomText: z.string().max(80, 'Keep bottom text under 80 characters').optional(),
  caption: z.string().max(500, 'At most 500 characters').optional(),
  audiences: z.array(z.enum(['public', 'friends'])),
};

// Audience is only required in the generic (Public/Friends) posting flow — a
// community post's audience is fully automatic (derived from the community's
// privacy), so the `audiences` field exists on the form but isn't validated or
// shown when posting from inside a community.
export function buildCreatorSchema(requireAudience: boolean) {
  return z.object(baseCreatorFields).refine((data) => !requireAudience || data.audiences.length > 0, {
    message: 'Choose at least one audience',
    path: ['audiences'],
  });
}
export type CreatorFormValues = z.infer<ReturnType<typeof buildCreatorSchema>>;

export const templateUploadSchema = z.object({
  name: z.string().min(1, 'Name your template').max(100, 'At most 100 characters'),
});
export type TemplateUploadFormValues = z.infer<typeof templateUploadSchema>;
