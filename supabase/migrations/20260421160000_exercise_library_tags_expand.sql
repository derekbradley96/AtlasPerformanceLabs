-- Allow expanded exercise_library.tags vocabulary (bodybuilding, conditioning, posing, mobility, etc.)

alter table public.exercise_library drop constraint if exists exercise_library_tags_check;

alter table public.exercise_library add constraint exercise_library_tags_check
  check (
    tags <@ array[
      'compound',
      'isolation',
      'unilateral',
      'bilateral',
      'machine_preferred',
      'time_efficient',
      'skill_intensive',
      'bodybuilding',
      'strength',
      'cardio',
      'conditioning',
      'posing_conditioning',
      'mobility',
      'flexibility',
      'recovery',
      'comp_prep'
    ]::text[]
  );
