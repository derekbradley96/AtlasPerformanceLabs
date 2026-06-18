/**
 * Vercel serverless: XML sitemap for public coach profile URLs (/coach/:slug).
 * Slugs come from coach_marketplace_profiles (is_public + non-null slug), matching AppRoutes.
 */
import { createClient } from '@supabase/supabase-js';

const BASE = 'https://atlasperformancelabs.co.uk';

function xmlEscape(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default async function handler(_req, res) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    res.status(503).setHeader('Content-Type', 'application/xml');
    res.send(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`,
    );
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: rows, error } = await supabase
    .from('coach_marketplace_profiles')
    .select('slug, updated_at')
    .eq('is_public', true)
    .not('slug', 'is', null)
    .limit(5000);

  if (error) {
    console.error('[sitemap-coaches]', error.message);
    res.status(500).setHeader('Content-Type', 'application/xml');
    res.send(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`,
    );
    return;
  }

  const fallbackLastmod = new Date().toISOString().split('T')[0];
  const urls = (rows || [])
    .map((row) => {
      const slug = row.slug;
      if (!slug) return '';
      const lastmod = (row.updated_at || fallbackLastmod).split('T')[0];
      const loc = `${BASE}/coach/${encodeURIComponent(slug)}`;
      return `
  <url>
    <loc>${xmlEscape(loc)}</loc>
    <lastmod>${xmlEscape(lastmod)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`;
    })
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}
</urlset>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
  res.status(200).send(xml);
}
