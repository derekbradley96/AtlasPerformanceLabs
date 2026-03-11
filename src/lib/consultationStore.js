/**
 * Solo "Request consultation" requests. Trainer sees list and can Accept/Decline.
 * Also creates a Lead so request appears in Trainer Inbox.
 * localStorage-backed.
 */
import { createLead } from '@/lib/leadsStore';

const KEY = 'atlas_consultation_requests';

function safeParse(fallback) {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function safeSet(value) {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch (e) {}
}

function nextId() {
  return `cons-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Create a consultation request (solo user). Also creates a Lead so it appears in Trainer Inbox. */
export function createConsultationRequest({ userId, userName, userEmail, goal, phase, gymName, availability, notes }) {
  const list = safeParse([]);
  const record = {
    id: nextId(),
    userId,
    userName: userName || 'Personal',
    userEmail: userEmail || '',
    goal: goal || '',
    phase: phase || '',
    gymName: gymName || '',
    availability: availability || '',
    notes: notes || '',
    status: 'pending',
    created_date: new Date().toISOString(),
    resolved_at: null,
    resolved_by: null,
  };
  list.unshift(record);
  safeSet(list);
  createLead({
    trainerId: null,
    name: record.userName,
    email: record.userEmail,
    goal: record.goal,
    phase: record.phase || '',
    gymName: record.gymName || '',
    availability: record.availability || '',
    notes: record.notes || '',
    source: 'consultation',
  });
  return record;
}

/** Get all requests for trainer (all) or for solo user (by userId). */
export function getConsultationRequests(trainerIdOrUserId, options = {}) {
  const list = safeParse([]);
  if (options.byUser) return list.filter((r) => r.userId === trainerIdOrUserId);
  return list;
}

/** Get pending only. */
export function getPendingConsultations() {
  return safeParse([]).filter((r) => r.status === 'pending');
}

export function acceptConsultation(id, trainerId) {
  const list = safeParse([]);
  const idx = list.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  list[idx] = {
    ...list[idx],
    status: 'accepted',
    resolved_at: new Date().toISOString(),
    resolved_by: trainerId,
  };
  safeSet(list);
  return list[idx];
}

export function declineConsultation(id, trainerId) {
  const list = safeParse([]);
  const idx = list.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  list[idx] = {
    ...list[idx],
    status: 'declined',
    resolved_at: new Date().toISOString(),
    resolved_by: trainerId,
  };
  safeSet(list);
  return list[idx];
}
