/**
 * Comp Prep repository: localStorage persistence. Swap to Supabase later.
 */
import type {
  ClientCompProfile,
  CompMediaLog,
  PrepPhase,
  PhotoGuideUnderstood,
} from '@/lib/models/compPrep';

const LS_KEY_PROFILES = 'comp_prep_profiles';
const LS_KEY_MEDIA = 'comp_prep_media';
const LS_KEY_PHOTO_GUIDE = 'comp_prep_photo_guide';

let profiles: Record<string, ClientCompProfile> = {};
let mediaLogs: CompMediaLog[] = [];
let photoGuideUnderstood: PhotoGuideUnderstood[] = [];

function loadProfiles(): Record<string, ClientCompProfile> {
  if (typeof localStorage === 'undefined') return profiles;
  try {
    const raw = localStorage.getItem(LS_KEY_PROFILES);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, ClientCompProfile>;
      profiles = { ...profiles, ...parsed };
    }
  } catch (_) {}
  return profiles;
}

function saveProfiles(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LS_KEY_PROFILES, JSON.stringify(profiles));
  } catch (_) {}
}

function loadMedia(): CompMediaLog[] {
  if (typeof localStorage === 'undefined') return mediaLogs;
  try {
    const raw = localStorage.getItem(LS_KEY_MEDIA);
    if (raw) {
      const parsed = JSON.parse(raw) as CompMediaLog[];
      mediaLogs = Array.isArray(parsed) ? parsed : [];
    }
  } catch (_) {}
  return mediaLogs;
}

function saveMedia(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LS_KEY_MEDIA, JSON.stringify(mediaLogs));
  } catch (_) {}
}

function loadPhotoGuide(): PhotoGuideUnderstood[] {
  if (typeof localStorage === 'undefined') return photoGuideUnderstood;
  try {
    const raw = localStorage.getItem(LS_KEY_PHOTO_GUIDE);
    if (raw) {
      const parsed = JSON.parse(raw) as PhotoGuideUnderstood[];
      photoGuideUnderstood = Array.isArray(parsed) ? parsed : [];
    }
  } catch (_) {}
  return photoGuideUnderstood;
}

function savePhotoGuide(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LS_KEY_PHOTO_GUIDE, JSON.stringify(photoGuideUnderstood));
  } catch (_) {}
}

// --- Seed: 2 competing clients ---
const SEED_PROFILES: Record<string, ClientCompProfile> = {
  'client-1': {
    clientId: 'client-1',
    federation: 'PCA',
    sex: 'FEMALE',
    division: 'BIKINI',
    prepPhase: 'PREP',
    showDate: '2025-06-14',
    coachNotes: undefined,
    updatedAt: '2025-02-01T00:00:00Z',
  },
  'client-2': {
    clientId: 'client-2',
    federation: '2BROS',
    sex: 'MALE',
    division: 'PHYSIQUE',
    prepPhase: 'PEAK_WEEK',
    showDate: '2025-03-22',
    coachNotes: undefined,
    updatedAt: '2025-02-10T00:00:00Z',
  },
};

let profilesInitialized = false;
function ensureProfiles(): void {
  if (profilesInitialized) return;
  loadProfiles();
  if (Object.keys(profiles).length === 0) {
    profiles = { ...SEED_PROFILES };
    saveProfiles();
  }
  profilesInitialized = true;
}

let mediaInitialized = false;
function ensureMedia(): void {
  if (mediaInitialized) return;
  loadMedia();
  if (mediaLogs.length === 0) {
    mediaLogs = [
      {
        id: 'media-1',
        clientId: 'client-1',
        mediaType: 'photo',
        category: 'posing',
        poseId: 'female_bikini_front',
        uri: 'https://placehold.co/400x600/1e293b/94a3b8?text=Pose',
        notes: 'Week 4',
        createdAt: '2025-02-10T14:00:00Z',
        reviewedAt: '2025-02-11T09:00:00Z',
        trainerComment: 'Good angle. Try relaxing the shoulder a bit next time.',
      },
      {
        id: 'media-2',
        clientId: 'client-2',
        mediaType: 'photo',
        category: 'posing',
        poseId: 'male_side_chest',
        uri: 'https://placehold.co/400x600/1e293b/94a3b8?text=Pose',
        notes: 'Peak week',
        createdAt: '2025-02-12T10:00:00Z',
        reviewedAt: undefined,
        trainerComment: undefined,
      },
    ];
    saveMedia();
  }
  mediaInitialized = true;
}

export function getClientCompProfile(clientId: string): ClientCompProfile | null {
  ensureProfiles();
  loadProfiles();
  return profiles[clientId] ?? null;
}

export function upsertClientCompProfile(profile: ClientCompProfile): void {
  ensureProfiles();
  profiles[profile.clientId] = {
    ...profile,
    updatedAt: new Date().toISOString(),
  };
  saveProfiles();
}

/** List competing clients for trainer. Mock: return all with a comp profile; trainerId can filter by linked clients later. */
export function listCompClientsForTrainer(_trainerId?: string): ClientCompProfile[] {
  ensureProfiles();
  loadProfiles();
  return Object.values(profiles);
}

export interface ListMediaFilters {
  category?: 'posing' | 'progress' | 'checkin';
  poseId?: string;
}

export function listMedia(clientId: string, filters?: ListMediaFilters): CompMediaLog[] {
  ensureMedia();
  loadMedia();
  let list = mediaLogs.filter((m) => m.clientId === clientId);
  if (filters?.category) list = list.filter((m) => m.category === filters.category);
  if (filters?.poseId) list = list.filter((m) => m.poseId === filters.poseId);
  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return list;
}

/** All media logs for the given client IDs (e.g. for inbox aggregation). */
export function getMediaLogsForClients(clientIds: string[]): CompMediaLog[] {
  ensureMedia();
  loadMedia();
  const set = new Set(clientIds);
  return mediaLogs.filter((m) => set.has(m.clientId));
}

export function addMedia(log: Omit<CompMediaLog, 'id' | 'createdAt'>): CompMediaLog {
  ensureMedia();
  const entry: CompMediaLog = {
    ...log,
    id: `media-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: new Date().toISOString(),
  };
  mediaLogs.push(entry);
  saveMedia();
  return entry;
}

export function markMediaReviewed(id: string, trainerComment?: string): CompMediaLog | null {
  loadMedia();
  const idx = mediaLogs.findIndex((m) => m.id === id);
  if (idx === -1) return null;
  mediaLogs[idx] = {
    ...mediaLogs[idx],
    reviewedAt: new Date().toISOString(),
    trainerComment: trainerComment ?? mediaLogs[idx].trainerComment,
  };
  saveMedia();
  return mediaLogs[idx];
}

export function getCompMediaById(id: string): CompMediaLog | null {
  ensureMedia();
  loadMedia();
  return mediaLogs.find((m) => m.id === id) ?? null;
}

// --- Photo guide understood (per client + phase) ---
export function getPhotoGuideUnderstood(clientId: string, phase: PrepPhase | null): PhotoGuideUnderstood | null {
  loadPhotoGuide();
  return photoGuideUnderstood.find((u) => u.clientId === clientId && u.phase === phase) ?? null;
}

export function setPhotoGuideUnderstood(clientId: string, phase: PrepPhase | null): void {
  loadPhotoGuide();
  const existing = photoGuideUnderstood.findIndex((u) => u.clientId === clientId && u.phase === phase);
  const entry: PhotoGuideUnderstood = {
    clientId,
    phase,
    understoodAt: new Date().toISOString(),
  };
  if (existing >= 0) photoGuideUnderstood[existing] = entry;
  else photoGuideUnderstood.push(entry);
  savePhotoGuide();
}
