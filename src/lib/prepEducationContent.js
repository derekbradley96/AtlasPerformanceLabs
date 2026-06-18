/** Coach-tagged explanations for common prep prescription changes. */
export const PREP_EDUCATION = {
  reduce_carbs: {
    title: 'Why lower carbs now?',
    explanation:
      'Reducing carbohydrates depletes muscle glycogen stores. This creates a "depletion" state that makes your muscles super-compensate and fill out more dramatically when carbs are reintroduced during peak week loading.',
  },
  reduce_sodium: {
    title: 'Why cut sodium?',
    explanation:
      'Sodium causes your body to retain water under the skin. Reducing it in the final days allows your body to flush this subcutaneous water, making your conditioning appear sharper on stage.',
  },
  no_leg_day: {
    title: 'Why no legs this week?',
    explanation:
      'Legs hold the most water and swell most after training. Avoiding heavy leg work in peak week prevents them from appearing full/smooth on show day.',
  },
  increase_protein: {
    title: 'Why more protein during a cut?',
    explanation:
      'Higher protein intake during a calorie deficit preserves muscle mass. As calories drop, your body can catabolise muscle for fuel — adequate protein prevents this.',
  },
  carb_load: {
    title: 'Why load carbs now?',
    explanation:
      'After glycogen depletion, muscles absorb carbohydrates super-compensatorily — filling them with glycogen and water. This creates the full, round, "3D" look that judges score highly.',
  },
  increase_water: {
    title: 'Why drink more water?',
    explanation:
      'Counter-intuitively, drinking more water signals your kidneys to excrete water. This "flushing" effect helps eliminate subcutaneous water retention when you taper water in the final days.',
  },
};

export const PREP_EDUCATION_OPTIONS = Object.keys(PREP_EDUCATION);

/** Short phase cards for Today / onboarding surfaces. */
export const PREP_PHASE_EDUCATION = {
  peak_week: {
    title: 'Why this week matters',
    body:
      'Peak week is where weeks of consistency show up. Glycogen, water, and sodium are choreographed — trust the process, avoid last-minute experiments, and communicate daily with your coach.',
  },
  final_push: {
    title: 'Why this week matters',
    body:
      'The final weeks are about precision: small misses in training, steps, or macros compound. Stay boring, consistent, and execution-focused.',
  },
  mid_prep: {
    title: 'Why this block matters',
    body:
      'Mid-prep is where rate of change and recovery are balanced. Momentum is built through repeatable weeks — not heroics.',
  },
  early_prep: {
    title: 'Building the base',
    body:
      'Early prep is about habits, adherence, and sustainable pace. Nail the basics now so later phases do not require drastic corrections.',
  },
};

export function getPrepEducationEntry(key) {
  if (!key || typeof key !== 'string') return null;
  return PREP_EDUCATION[key] ?? null;
}
