/**
 * Trainer Foundation: structured profile, services, policies, schedule, capacity.
 * Used by onboarding and by Capacity, Silent Mode, Retention.
 */

export type FocusType = 'general' | 'bodybuilding' | 'strength' | 'weightloss' | 'sport' | 'other';

/** Portfolio image for trainer public profile. */
export interface TrainerPortfolioItem {
  id: string;
  url: string;
  category: string;
  caption?: string;
}

/** Service offering (plan & billing). */
export interface TrainerProfileService {
  id: string;
  name: string;
  description?: string;
  price?: number; // stored in cents
  includesCheckins?: boolean;
  includesCalls?: boolean;
  includesPosing?: boolean;
  includesPeakWeek?: boolean;
}

export interface TrainerProfile {
  trainerId: string;
  user_id: string;
  focusType: FocusType;
  displayName?: string;
  onboardingComplete: boolean;
  updatedAt: string;
  // Public profile
  profileImage?: string;
  bannerImage?: string;
  username?: string;
  bio?: string;
  specialties?: string[];
  yearsCoaching?: number;
  credentials?: string;
  timezone?: string;
  workingHours?: string;
  responseTime?: string;
  trainerPortfolio?: TrainerPortfolioItem[];
  services?: TrainerProfileService[];
}

export interface TrainerService {
  id: string;
  name: string;
  durationMinutes?: number;
  enabled: boolean;
}

export interface TrainerServices {
  trainerId: string;
  services: TrainerService[];
  updatedAt: string;
}

export interface TrainerPolicies {
  trainerId: string;
  cancellationHours?: number;
  latePolicy?: string;
  paymentTerms?: string;
  updatedAt: string;
}

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday

export interface DayWindow {
  dayOfWeek: DayOfWeek;
  start: string; // "09:00"
  end: string;   // "17:00"
}

export interface TrainerSchedule {
  trainerId: string;
  windows: DayWindow[];
  timezone?: string;
  updatedAt: string;
}

export interface TrainerCapacity {
  trainerId: string;
  maxClients?: number;
  dailyAdminLimitMinutes: number;
  updatedAt: string;
}
