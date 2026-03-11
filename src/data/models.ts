/**
 * Single source of truth data model layer.
 * All trainer-critical entities used by atlasRepo and screens.
 */

/** Coach (trainer) record from backend: Stripe Connect, plan tier, profile id. */
export interface Coach {
  id: string;
  user_id: string;
  stripe_account_id?: string;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  plan_tier?: 'basic' | 'pro' | 'elite';
  profile_id?: string;
}

/** Preferred contact method for calls/video (legacy). */
export type PreferredContactMethod =
  | 'whatsapp'
  | 'facetime'
  | 'zoom'
  | 'google_meet'
  | 'phone'
  | 'custom_link'
  | null;

/** Preferred audio call method. */
export type PreferredAudioMethod = 'phone' | 'whatsapp_audio' | 'facetime_audio' | null;

/** Preferred video check-in method. */
export type PreferredVideoMethod =
  | 'facetime'
  | 'whatsapp_video'
  | 'zoom'
  | 'google_meet'
  | 'custom_link'
  | null;

/** Client linked to a trainer. */
export interface Client {
  id: string;
  user_id?: string;
  trainer_id: string;
  full_name: string;
  email?: string;
  phone?: string;
  /** Preferred method for video/external call (legacy). */
  preferredContactMethod?: PreferredContactMethod;
  /** Call link (legacy). Prefer videoLink. */
  contactLink?: string;
  /** Preferred audio call: phone, WhatsApp audio, or FaceTime audio (iOS). */
  preferredAudioMethod?: PreferredAudioMethod | null;
  /** Preferred video check-in: FaceTime, WhatsApp, Zoom, Meet, or custom link. */
  preferredVideoMethod?: PreferredVideoMethod | null;
  /** Single link for Zoom / Google Meet / custom video. */
  videoLink?: string;
  /** Phone for WhatsApp if different from main phone (optional; can reuse phone). */
  whatsappPhone?: string;
  /** Coach-only prep notes (private). Local or Supabase. */
  coachPrepNotes?: string;
  subscription_status?: 'active' | 'past_due' | 'cancelled' | 'pending';
  status?: 'on_track' | 'needs_review' | 'attention';
  payment_overdue?: boolean;
  last_check_in_at?: string | null;
  phase?: string;
  phaseStartedAt?: string;
  baselineWeight?: number;
  baselineStrength?: { squat?: number; bench?: number; deadlift?: number };
  created_date?: string;
  federation?: string | null;
  division?: string | null;
  prepPhase?: string | null;
  showDate?: string | null;
  [key: string]: unknown;
}

/** Lead from join/onboarding or coach profile application. */
export interface Lead {
  id: string;
  trainerUserId?: string;
  trainerId?: string | null;
  trainerSlug?: string;
  name?: string;
  applicantName?: string;
  email: string;
  phone?: string;
  status: 'new' | 'contacted' | 'converted' | 'lost';
  source?: string;
  created_date?: string;
  createdAt?: string;
  updatedAt?: string;
  goal?: string;
  phase?: string;
  notes?: string;
  [key: string]: unknown;
}

/** Intake template (trainer-defined form). */
export interface IntakeTemplate {
  id: string;
  trainer_id: string;
  name: string;
  serviceType?: string;
  sections?: Array<{ id: string; title: string; fields: unknown[] }>;
  created_date?: string;
  updated_date?: string;
}

/** Client intake response (submitted form). */
export interface IntakeResponse {
  id: string;
  template_id: string;
  client_id: string;
  trainer_id: string;
  status: 'draft' | 'submitted';
  answers?: Record<string, unknown>;
  submitted_at?: string | null;
  created_date?: string;
  updated_date?: string;
}

/** Single item in Inbox / Review Center feed. */
export interface ReviewItem {
  id: string;
  type: string;
  clientId: string;
  leadId?: string | null;
  title: string;
  subtitle?: string;
  badge?: { label: string; tone: string };
  badgeLabel?: string;
  badgeTone?: string;
  priorityBadge?: string;
  ageLabel?: string;
  priorityScore: number;
  primaryAction?: { label: string; type: string; checkinId?: string; [key: string]: unknown };
  createdAt?: string;
  status?: string;
  itemKey?: string;
  [key: string]: unknown;
}

/** Program template or assignment (days, exercises). */
export interface Program {
  id: string;
  baseId?: string;
  trainer_id?: string;
  client_id?: string | null;
  name: string;
  goal?: string;
  duration_weeks?: number;
  difficulty?: string;
  description?: string;
  trainer_notes?: string;
  version?: number;
  is_template?: boolean;
  days?: ProgramDay[];
  created_date?: string;
  updated_date?: string;
  days_per_week?: number;
  next_workout_title?: string | null;
}

export interface ProgramDay {
  id: string;
  dayName: string;
  exercises: Array<{ id: string; name: string; sets?: string | number; reps?: string | number; rir?: string | number }>;
}

/** Program version reference (for assignments). */
export interface ProgramVersion {
  programId: string;
  version: number;
  effectiveDate?: string | null;
  updatedAt?: string | null;
}

/** Check-in submission from client. Canonical type for Supabase + local; UI uses created_at/created_date as ISO strings. */
export interface CheckIn {
  id: string;
  client_id: string;
  trainer_id: string;
  /** Present from Supabase; normalized from created_at or checkin_date. */
  created_at?: string;
  /** UI-facing date; normalized to created_at or checkin_date. */
  created_date?: string;
  status?: 'pending' | 'submitted' | string;
  submitted_at?: string | null;
  checkin_date?: string;
  week_start?: string;
  due_date?: string | null;
  previous_checkin_id?: string | null;
  weight_kg?: number | null;
  notes?: string | null;
  steps?: number | null;
  adherence_pct?: number | null;
  adherence?: number | null;
  sleep_hours?: number | null;
  flags?: string[];
  /** Coach reviewed; set when coach marks check-in reviewed. */
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  /** Supabase/local optional fields */
  updated_at?: string | null;
  calories?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fats_g?: number | null;
  cardio_mins?: number | null;
  stress?: number | null;
  soreness?: number | null;
  metrics?: Record<string, number> | null;
}

/** Comp prep profile for a client (federation, division, show date). */
export interface CompPrepProfile {
  clientId: string;
  federation?: string | null;
  division?: string | null;
  prepPhase?: string | null;
  showDate?: string | null;
  [key: string]: unknown;
}

/** Posing submission (photo + pose type) for review. */
export interface PosingSubmission {
  id: string;
  client_id: string;
  media_id?: string;
  pose_type?: string;
  image_url?: string;
  status?: 'pending' | 'approved' | 'changes_requested';
  submitted_at?: string;
  created_date?: string;
}

/** Payment/transaction status. */
export interface PaymentStatus {
  id: string;
  client_id: string;
  trainer_id: string;
  status: 'paid' | 'pending' | 'overdue';
  due_date?: string;
  paid_at?: string | null;
  amount: number;
  clientName?: string;
  date?: string;
}
