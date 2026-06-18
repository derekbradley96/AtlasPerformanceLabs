/**
 * Placeholder marketing testimonials — replace with real quotes, names, and photos
 * (see docs/TESTIMONIALS_TODO.md).
 */

export const MARKETING_HOME_TESTIMONIALS = [
  {
    quote:
      "I stopped juggling five tools and started coaching faster. Atlas shows me exactly who needs action each day — I haven't missed a check-in follow-up in 3 months.",
    name: 'Sarah C.',
    role: 'Online transformation coach — 18 clients',
    pillars: 5,
    result: '+8 clients in 6 weeks',
    photo: null,
  },
  {
    quote:
      'The peak week protocol builder is the thing. I used to send it manually by WhatsApp. Now my athletes get it automatically, day by day. They actually follow it properly.',
    name: 'Marcus T.',
    role: 'Competition prep coach — PCA specialist',
    pillars: 5,
    result: 'Saves 4h/week',
    photo: null,
  },
  {
    quote:
      "Free barcode scanner sealed it for me. MFP charging for that was the final straw. Atlas does it better and it's just included.",
    name: 'Jade L.',
    role: 'Personal user — 12-week transformation',
    pillars: 5,
    result: '-9.2kg in 14 weeks',
    photo: null,
  },
];

/** Coach-focused marketing pages (subset of home). */
export const FOR_COACHES_TESTIMONIALS = MARKETING_HOME_TESTIMONIALS.slice(0, 2);

export const FOR_CLIENTS_TESTIMONIALS = [
  {
    quote:
      'I finally know what today looks like. I log sets with RIR, scan food, hit submit on my check-in — my coach sees everything in one place.',
    name: 'Alex R.',
    role: 'Coached athlete — transformation client',
    pillars: 5,
    result: null,
    photo: null,
  },
];

export const PERSONAL_MARKETING_TESTIMONIALS = [
  {
    quote: 'I finally stopped winging it. I open Atlas, do the work, and stay on track.',
    name: 'Jordan K.',
    role: 'Personal Basic — building consistency first',
    pillars: 5,
    result: null,
    photo: null,
  },
];
