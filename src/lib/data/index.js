/**
 * Data layer: single source of truth for CoachProfile, Lead, Client, IntakeForm, IntakeSubmission.
 * UI should import from here; no ad-hoc objects. Mock repos can be swapped for API later.
 *
 * To extend to real Stripe/billing: replace coachProfileRepo and plan checks with API;
 * keep same get/set interfaces. For Leads, add paymentStatus webhook and run auto-convert in backend.
 */

export {
  getCoachProfile,
  setCoachProfile,
  isCoachOnboardingComplete,
  isCoachOnboardingSkipped,
  migrateLegacyOnboarding,
} from './coachProfileRepo';

export {
  getLeadsForTrainer,
  getLeadById,
  createLead,
  createLeadFromApplication,
  updateLead,
  updateLeadStatus,
} from '@/lib/leadsStore';

/** Async Supabase-backed (see atlasRepo); pass isDemoMode + trainerId for getClientById when scoped to coach. */
export { getClients, getClientById } from '@/data/repos/atlasRepo';
export { createClientStub, getStubClients } from '@/lib/clientStubStore';
