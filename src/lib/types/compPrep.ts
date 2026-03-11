/**
 * Comp prep models – comp_prep_clients, posing_submissions.
 */
export interface CompPrepClient {
  clientId: string;
  federation?: string | null;
  sex?: 'MALE' | 'FEMALE' | null;
  division?: string | null;
  prepPhase?: string | null;
  showDate?: string | null;
  coachNotes?: string | null;
  updatedAt?: string | null;
}

export interface PosingSubmission {
  id: string;
  clientId: string;
  mediaType: 'photo' | 'video';
  category: 'posing' | 'progress' | 'checkin';
  poseId?: string | null;
  uri?: string | null;
  notes?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  trainerComment?: string | null;
}
