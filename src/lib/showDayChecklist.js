/**
 * Default show-day tasks seeded when a prep checklist is first opened (no rows yet).
 */

export const DEFAULT_SHOW_DAY_TASKS = [
  { category: 'registration', name: 'Submit show registration', assigned_to: 'athlete' },
  { category: 'registration', name: 'Pay registration fee', assigned_to: 'athlete' },
  { category: 'registration', name: 'Confirm division entry', assigned_to: 'coach' },
  { category: 'appearance', name: 'Book spray tan appointment', assigned_to: 'athlete' },
  { category: 'appearance', name: 'Confirm competition suit', assigned_to: 'athlete' },
  { category: 'appearance', name: 'Book hair/makeup if needed', assigned_to: 'athlete' },
  { category: 'nutrition', name: 'Confirm peak week protocol', assigned_to: 'coach' },
  { category: 'nutrition', name: 'Pack show day food bag', assigned_to: 'athlete' },
  { category: 'logistics', name: 'Book travel/accommodation', assigned_to: 'athlete' },
  { category: 'logistics', name: 'Confirm check-in time', assigned_to: 'athlete' },
  { category: 'equipment', name: 'Pack posing oil', assigned_to: 'athlete' },
  { category: 'equipment', name: 'Pack pump-up equipment', assigned_to: 'both' },
  { category: 'admin', name: 'Get drug test card signed', assigned_to: 'coach' },
];

export const SHOW_DAY_CATEGORY_ORDER = [
  'registration',
  'logistics',
  'appearance',
  'nutrition',
  'equipment',
  'admin',
];

export const SHOW_DAY_CATEGORY_LABELS = {
  registration: 'Registration',
  logistics: 'Logistics',
  appearance: 'Appearance',
  nutrition: 'Nutrition',
  equipment: 'Equipment',
  admin: 'Admin',
};
