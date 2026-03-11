/**
 * White-label PDF exports. Uses trainer branding; clean layout, white background, accent header.
 */
import { jsPDF } from 'jspdf';
import { getBranding } from '@/lib/branding/brandingRepo';

function hexToRgb(hex) {
  const m = (hex || '').replace(/^#/, '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [37, 99, 235];
}

function setHeaderFill(doc, hex) {
  const [r, g, b] = hexToRgb(hex);
  doc.setFillColor(r, g, b);
}
import { getClientById, getClientCheckIns, getPaymentsForClient } from '@/data/selectors';
import { getClientPhase } from '@/lib/clientPhaseStore';
import { getClientHealthScore } from '@/lib/healthScoreService';
import { getClientPerformanceSnapshot } from '@/lib/performanceService';
import { getAchievementsList } from '@/lib/milestonesStore';
import { getClientCompProfile, listMedia } from '@/lib/repos/compPrepRepo';
import { getActionLogForClient } from '@/lib/timeline/actionLogRepo';
import { getClientTimeline } from '@/lib/timeline/buildTimeline';

const MARGIN = 20;
const HEADER_H = 28;
const FOOTER_H = 18;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - MARGIN * 2;
const CONTENT_TOP = MARGIN + HEADER_H + 14;
const CONTENT_BOTTOM = PAGE_H - FOOTER_H - MARGIN;

/**
 * Flatten a transparent logo onto a solid background so jsPDF doesn't render transparency as black.
 * Returns a data URL (PNG) with the given background color behind the logo.
 */
function flattenLogoWithBackground(logoDataUrl, backgroundColorHex) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const [r, g, b] = (backgroundColorHex || '#3B82F6').replace(/^#/, '').match(/.{2}/g).map((x) => parseInt(x, 16));
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error('Logo failed to load'));
    img.src = logoDataUrl;
  });
}

function addReportHeader(doc, branding, title, clientName) {
  setHeaderFill(doc, branding.accentColor);
  doc.rect(0, 0, PAGE_W, HEADER_H, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  let x = MARGIN;
  if (branding.logoUrl) {
    try {
      const format = (branding.logoUrl || '').includes('jpeg') || (branding.logoUrl || '').includes('jpg') ? 'JPEG' : 'PNG';
      doc.addImage(branding.logoUrl, format, MARGIN, 4, 20, 20);
      x = MARGIN + 24;
    } catch (_) {}
  }
  doc.text(clientName || 'Client', x, 12);
  doc.setFontSize(9);
  doc.text(title, x, 19);
  doc.setTextColor(0, 0, 0);
}

function addReportFooter(doc, branding, pageNum, totalPages) {
  const y = PAGE_H - 10;
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  const footerStr = branding.footerText ? `${branding.footerText}  |  Page ${pageNum} of ${totalPages}` : `Page ${pageNum} of ${totalPages}`;
  doc.text(footerStr, MARGIN, y, { maxWidth: CONTENT_W });
}

function sectionTitle(doc, y, text) {
  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text(text, MARGIN, y);
  doc.setFont(undefined, 'normal');
  return y + 6;
}

function bodyLine(doc, y, label, value) {
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text(`${label}  ${value || '—'}`, MARGIN, y);
  return y + 5;
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Generate Progress Report PDF. Returns Blob.
 */
export async function generateProgressReport(clientId, trainerId) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let branding = getBranding(trainerId);
  if (branding.logoUrl && !/jpe?g/i.test(branding.logoUrl)) {
    try {
      branding = { ...branding, logoUrl: await flattenLogoWithBackground(branding.logoUrl, branding.accentColor) };
    } catch (_) {}
  }
  const client = getClientById(clientId);
  const clientName = client?.full_name ?? 'Client';

  addReportHeader(doc, branding, 'Progress Report', clientName);

  const health = getClientHealthScore(clientId);
  const snapshot = getClientPerformanceSnapshot(clientId);
  const phase = clientId ? getClientPhase(clientId, client) : '—';
  const achievements = getAchievementsList(clientId, { byUser: false }).slice(0, 8);
  const checkIns = getClientCheckIns(clientId)
    .filter((c) => c.status === 'submitted')
    .sort((a, b) => new Date(b.submitted_at || b.created_date) - new Date(a.submitted_at || a.created_date))
    .slice(0, 4);

  let y = CONTENT_TOP;

  y = sectionTitle(doc, y, 'Phase & status');
  y = bodyLine(doc, y, 'Phase:', phase);
  y = bodyLine(doc, y, 'Health score:', health?.score != null ? String(health.score) : '—');
  y = bodyLine(doc, y, 'Status:', health?.statusLabel ?? '—');
  y += 4;

  y = sectionTitle(doc, y, 'Key metrics');
  y = bodyLine(doc, y, 'Weeks with coach:', snapshot?.weeksWithTrainer != null ? String(snapshot.weeksWithTrainer) : '—');
  y = bodyLine(doc, y, 'Adherence:', snapshot?.adherencePct != null ? `${snapshot.adherencePct}%` : '—');
  const wDelta = snapshot?.weightDelta;
  y = bodyLine(doc, y, 'Weight trend:', wDelta != null ? `${wDelta > 0 ? '+' : ''}${wDelta} kg` : '—');
  y += 4;

  if (achievements.length > 0) {
    y = sectionTitle(doc, y, 'Milestones');
    achievements.forEach((a) => {
      if (y > CONTENT_BOTTOM) return;
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text(`• ${a.title ?? a.milestoneId}`, MARGIN + 2, y);
      y += 5;
    });
    y += 4;
  }

  if (checkIns.length > 0) {
    y = sectionTitle(doc, y, 'Last check-ins');
    checkIns.forEach((c) => {
      if (y > CONTENT_BOTTOM) return;
      const date = formatDate(c.submitted_at || c.created_date);
      const detail = [c.weight_kg != null ? `${c.weight_kg} kg` : null, c.adherence_pct != null ? `${c.adherence_pct}% adherence` : null].filter(Boolean).join(' · ') || 'Submitted';
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text(`${date}: ${detail}`, MARGIN + 2, y);
      y += 5;
    });
  }

  addReportFooter(doc, branding, 1, 1);
  return doc.output('blob');
}

/**
 * Generate Comp Prep Report PDF. Returns Blob.
 */
export async function generateCompPrepReport(clientId, trainerId) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let branding = getBranding(trainerId);
  if (branding.logoUrl && !/jpe?g/i.test(branding.logoUrl)) {
    try {
      branding = { ...branding, logoUrl: await flattenLogoWithBackground(branding.logoUrl, branding.accentColor) };
    } catch (_) {}
  }
  const client = getClientById(clientId);
  const clientName = client?.full_name ?? 'Client';
  const profile = getClientCompProfile(clientId);
  const posingMedia = listMedia(clientId, { category: 'posing' });

  addReportHeader(doc, branding, 'Comp Prep Report', clientName);

  let y = CONTENT_TOP;

  y = sectionTitle(doc, y, 'Division & show');
  y = bodyLine(doc, y, 'Division:', profile?.division ?? client?.division ?? '—');
  y = bodyLine(doc, y, 'Federation:', profile?.federation ?? client?.federation ?? '—');
  y = bodyLine(doc, y, 'Show date:', profile?.showDate ?? client?.showDate ?? '—');
  if (profile?.showDate) {
    const daysOut = Math.ceil((new Date(profile.showDate) - new Date()) / (24 * 60 * 60 * 1000));
    y = bodyLine(doc, y, 'Days out:', daysOut > 0 ? `${daysOut}` : 'Past');
  }
  y = bodyLine(doc, y, 'Phase:', profile?.prepPhase ?? client?.prepPhase ?? '—');
  y += 4;

  y = sectionTitle(doc, y, 'Posing');
  const reviewed = posingMedia.filter((m) => m.reviewedAt);
  y = bodyLine(doc, y, 'Submissions:', String(posingMedia.length));
  y = bodyLine(doc, y, 'Reviewed:', String(reviewed.length));
  const lastReviewed = reviewed[0];
  if (lastReviewed?.trainerComment) {
    y += 2;
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    const lines = doc.splitTextToSize(`Last review: ${lastReviewed.trainerComment}`, CONTENT_W - 4);
    doc.text(lines, MARGIN + 2, y);
    y += lines.length * 5 + 4;
  } else {
    y += 4;
  }

  if (profile?.coachNotes) {
    y = sectionTitle(doc, y, 'Coach notes');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    const lines = doc.splitTextToSize(profile.coachNotes, CONTENT_W - 4);
    doc.text(lines, MARGIN, y);
    y += lines.length * 5 + 4;
  }

  addReportFooter(doc, branding, 1, 1);
  return doc.output('blob');
}

/**
 * Generate Payment Summary PDF. Returns Blob.
 */
export async function generatePaymentSummary(clientId, trainerId) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let branding = getBranding(trainerId);
  if (branding.logoUrl && !/jpe?g/i.test(branding.logoUrl)) {
    try {
      branding = { ...branding, logoUrl: await flattenLogoWithBackground(branding.logoUrl, branding.accentColor) };
    } catch (_) {}
  }
  const client = getClientById(clientId);
  const clientName = client?.full_name ?? 'Client';
  const payments = getPaymentsForClient(clientId);
  const actionLog = getActionLogForClient(clientId);
  const reminderCount = actionLog.filter((a) => a.action === 'payment_reminder_sent').length;

  addReportHeader(doc, branding, 'Payment Summary', clientName);

  let y = CONTENT_TOP;

  y = sectionTitle(doc, y, 'Summary');
  const paid = payments.filter((p) => p.status === 'paid');
  const overdue = payments.filter((p) => (p.status || '').toLowerCase() === 'overdue');
  const totalPaid = paid.reduce((s, p) => s + (p.amount ?? 0), 0);
  const monthlyFee = payments[0]?.amount ?? 0;
  y = bodyLine(doc, y, 'Payments received:', `${paid.length} (${monthlyFee ? `£${totalPaid}` : '—'})`);
  y = bodyLine(doc, y, 'Overdue:', overdue.length > 0 ? `${overdue.length}` : 'None');
  y = bodyLine(doc, y, 'Reminders sent:', String(reminderCount));
  y += 6;

  if (overdue.length > 0) {
    const outstanding = overdue.reduce((s, p) => s + (p.amount ?? 0), 0);
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(180, 0, 0);
    doc.text(`Outstanding: £${outstanding}`, MARGIN, y);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(0, 0, 0);
    y += 8;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(60, 100, 60);
    doc.text('All up to date', MARGIN, y);
    y += 8;
  }

  y = sectionTitle(doc, y, 'Recent payments');
  payments.slice(0, 10).forEach((p) => {
    if (y > CONTENT_BOTTOM) return;
    const status = (p.status || '').toLowerCase();
    const line = `${formatDate(p.paid_at || p.due_date)}  ${p.amount != null ? `£${p.amount}` : ''}  ${status}`;
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(line, MARGIN + 2, y);
    y += 5;
  });

  addReportFooter(doc, branding, 1, 1);
  return doc.output('blob');
}

/**
 * Generate Timeline Summary PDF (last 30 days). Returns Blob.
 */
export async function generateTimelineReport(clientId, trainerId) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let branding = getBranding(trainerId);
  if (branding.logoUrl && !/jpe?g/i.test(branding.logoUrl)) {
    try {
      branding = { ...branding, logoUrl: await flattenLogoWithBackground(branding.logoUrl, branding.accentColor) };
    } catch (_) {}
  }
  const client = getClientById(clientId);
  const clientName = client?.full_name ?? 'Client';

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const allEvents = await getClientTimeline(clientId, new Date());
  const events = allEvents.filter((e) => new Date(e.occurredAt) >= thirtyDaysAgo);

  addReportHeader(doc, branding, 'Timeline Summary', clientName);

  let y = CONTENT_TOP;

  y = sectionTitle(doc, y, 'Activity (last 30 days)');
  if (events.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text('No events in this period.', MARGIN, y);
    addReportFooter(doc, branding, 1, 1);
    return doc.output('blob');
  }

  let currentDate = '';
  events.forEach((e) => {
    if (y > CONTENT_BOTTOM) return;
    const d = new Date(e.occurredAt);
    const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    if (dateStr !== currentDate) {
      currentDate = dateStr;
      y += 3;
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(50, 50, 50);
      doc.text(dateStr, MARGIN, y);
      doc.setFont(undefined, 'normal');
      y += 5;
    }
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    const line = (e.subtitle ? `${e.title} – ${e.subtitle}` : e.title).slice(0, 80);
    doc.text(`• ${line}`, MARGIN + 2, y);
    y += 5;
  });

  addReportFooter(doc, branding, 1, 1);
  return doc.output('blob');
}
