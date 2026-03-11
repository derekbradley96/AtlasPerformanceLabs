import { z } from 'zod';
import { portfolioItemSchema } from './portfolioItem';
import { serviceOfferingSchema } from './serviceOffering';

export const trainerProfileSchema = z.object({
  id: z.string(),
  userId: z.string(),
  displayName: z.string(),
  username: z.string(),
  bio: z.string().optional(),
  profileImageUrl: z.string().optional(),
  bannerImageUrl: z.string().optional(),
  specialties: z.array(z.string()),
  yearsCoaching: z.number().optional(),
  credentials: z.string().optional(),
  timezone: z.string().optional(),
  workingHours: z.string().optional(),
  responseTime: z.string().optional(),
  portfolio: z.array(portfolioItemSchema),
  services: z.array(serviceOfferingSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TrainerProfile = z.infer<typeof trainerProfileSchema>;
