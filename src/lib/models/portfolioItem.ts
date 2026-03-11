import { z } from 'zod';

export const portfolioCategoryEnum = z.enum(['fatloss', 'hypertrophy', 'comp_prep', 'lifestyle', 'other']);
export type PortfolioCategory = z.infer<typeof portfolioCategoryEnum>;

export const portfolioItemSchema = z.object({
  id: z.string(),
  url: z.string(),
  category: portfolioCategoryEnum,
  caption: z.string().optional(),
  createdAt: z.string(),
});
export type PortfolioItem = z.infer<typeof portfolioItemSchema>;
