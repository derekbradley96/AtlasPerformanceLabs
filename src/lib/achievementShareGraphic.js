/**
 * Canvas achievement card for share / download (dark theme, no emoji).
 */

function drawTrophy(ctx, cx, cy, scale) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#EAB308';
  ctx.strokeStyle = '#CA8A04';
  ctx.lineWidth = 2;
  // Cup
  ctx.beginPath();
  ctx.moveTo(-22, 8);
  ctx.lineTo(-18, -18);
  ctx.lineTo(18, -18);
  ctx.lineTo(22, 8);
  ctx.quadraticCurveTo(0, 18, -22, 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Handles
  ctx.beginPath();
  ctx.arc(-26, -4, 7, Math.PI * 0.55, Math.PI * 1.45, false);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(26, -4, 7, Math.PI * 1.55, Math.PI * 0.45, true);
  ctx.stroke();
  // Stem
  ctx.fillRect(-4, 8, 8, 14);
  ctx.strokeRect(-4, 8, 8, 14);
  // Base
  ctx.fillRect(-18, 22, 36, 6);
  ctx.strokeRect(-18, 22, 36, 6);
  ctx.restore();
}

/**
 * @param {{ clientFirstName: string, milestoneDescription: string, achievedDateLabel: string }} opts
 * @returns {Promise<Blob | null>}
 */
export async function renderAchievementShareBlob(opts) {
  const clientFirstName = String(opts?.clientFirstName || 'Athlete').trim() || 'Athlete';
  const milestoneDescription = String(opts?.milestoneDescription || 'New milestone').trim();
  const achievedDateLabel = String(opts?.achievedDateLabel || '').trim();

  const W = 1080;
  const H = 1350;
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (!canvas) return null;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const grd = ctx.createLinearGradient(0, 0, W, H);
  grd.addColorStop(0, '#0f172a');
  grd.addColorStop(1, '#020617');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);

  drawTrophy(ctx, W / 2, 280, 3.2);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 64px system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(clientFirstName, W / 2, 520);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '36px system-ui, -apple-system, Segoe UI, sans-serif';
  const words = milestoneDescription.split(/\s+/);
  let line = '';
  let y = 620;
  const maxW = W - 120;
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, W / 2, y);
      y += 48;
      line = words[i];
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, W / 2, y);

  if (achievedDateLabel) {
    ctx.fillStyle = '#64748b';
    ctx.font = '28px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillText(achievedDateLabel, W / 2, y + 80);
  }

  ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
  ctx.font = '24px system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.fillText('Atlas Performance Labs', W / 2, H - 80);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob || null), 'image/png', 0.92);
  });
}

/** @param {string} milestoneId */
export function isSignificantShareableMilestone(milestoneId) {
  const id = String(milestoneId || '');
  if (!id) return false;
  if (id === 'weight_5' || id === 'weight_10' || id === 'weight_cut_5' || id === 'weight_bulk_5' || id === 'show_weight_target_reached') return true;
  if (id.startsWith('strength_')) {
    const m = id.match(/_(\d+(?:\.\d+)?)kg$/);
    if (m && Number(m[1]) >= 5) return true;
  }
  return false;
}
