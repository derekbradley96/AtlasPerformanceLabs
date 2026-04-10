-- Atlas exercise tag dictionary: normalize existing rows, then enforce CHECK constraints on allowed vocabularies.

-- ---------------------------------------------------------------------------
-- Helpers (kept for introspection / future migrations; not used by CHECKs)
-- ---------------------------------------------------------------------------
create or replace function public._atlas_normalize_muscle_token(input text)
returns text
language sql
immutable
as $$
  select case lower(trim(input))
    when 'chest' then 'chest'
    when 'pecs' then 'chest'
    when 'pec' then 'chest'
    when 'back' then 'back'
    when 'lats' then 'back'
    when 'shoulders' then 'shoulders'
    when 'shoulder' then 'shoulders'
    when 'delts' then 'shoulders'
    when 'deltoids' then 'shoulders'
    when 'quads' then 'quads'
    when 'quadriceps' then 'quads'
    when 'hamstrings' then 'hamstrings'
    when 'glutes' then 'glutes'
    when 'hip' then 'glutes'
    when 'hips' then 'glutes'
    when 'calves' then 'calves'
    when 'calf' then 'calves'
    when 'biceps' then 'biceps'
    when 'triceps' then 'triceps'
    when 'tricep' then 'triceps'
    when 'forearms' then 'forearms'
    when 'core' then 'core'
    when 'abs' then 'core'
    when 'traps' then 'traps'
    when 'neck' then 'neck'
    when 'full_body' then 'full_body'
    when 'full body' then 'full_body'
    else null
  end;
$$;

create or replace function public._atlas_normalize_movement_token(input text)
returns text
language sql
immutable
as $$
  select case lower(trim(input))
    when 'push' then 'push'
    when 'pull' then 'pull'
    when 'squat' then 'squat'
    when 'hinge' then 'hinge'
    when 'lunge' then 'lunge'
    when 'carry' then 'carry'
    when 'isolation' then 'isolation'
    when 'plyometric' then 'plyometric'
    when 'plyo' then 'plyometric'
    when 'rotation' then 'rotation'
    when 'rotational' then 'rotation'
    when 'other' then 'other'
    else null
  end;
$$;

create or replace function public._atlas_normalize_equipment_token(input text)
returns text
language sql
immutable
as $$
  select case lower(trim(replace(input, '_', ' ')))
    when 'barbell' then 'barbell'
    when 'dumbbell' then 'dumbbell'
    when 'kettlebell' then 'kettlebell'
    when 'cable' then 'cable'
    when 'machine' then 'machine'
    when 'bodyweight' then 'bodyweight'
    when 'band' then 'band'
    when 'bands' then 'band'
    when 'trx' then 'trx'
    when 'suspension' then 'trx'
    when 'medicine ball' then 'medicine_ball'
    when 'medicine_ball' then 'medicine_ball'
    when 'med ball' then 'medicine_ball'
    when 'ez bar' then 'ez_bar'
    when 'ez_bar' then 'ez_bar'
    when 'smith machine' then 'smith_machine'
    when 'smith_machine' then 'smith_machine'
    when 'smith' then 'smith_machine'
    when 'other' then 'other'
    else null
  end;
$$;

-- ---------------------------------------------------------------------------
-- Normalize existing exercise_library rows
-- ---------------------------------------------------------------------------
update public.exercise_library
set primary_muscle = coalesce(public._atlas_normalize_muscle_token(primary_muscle), 'full_body')
where primary_muscle is not null;

update public.exercise_library
set movement_pattern = case
  when movement_pattern is null then null
  else coalesce(public._atlas_normalize_movement_token(movement_pattern), 'other')
end;

update public.exercise_library
set primary_muscles = coalesce((
  select array_agg(x.m order by x.m)
  from (
    select distinct public._atlas_normalize_muscle_token(u) as m
    from unnest(primary_muscles) as u
  ) x
  where x.m is not null
), '{}');

update public.exercise_library
set secondary_muscles = coalesce((
  select array_agg(x.m order by x.m)
  from (
    select distinct public._atlas_normalize_muscle_token(u) as m
    from unnest(secondary_muscles) as u
  ) x
  where x.m is not null
), '{}');

update public.exercise_library
set stabilizer_muscles = coalesce((
  select array_agg(x.m order by x.m)
  from (
    select distinct public._atlas_normalize_muscle_token(u) as m
    from unnest(stabilizer_muscles) as u
  ) x
  where x.m is not null
), '{}');

update public.exercise_library
set equipment = coalesce((
  select array_agg(s.e2 order by s.e2)
  from (
    select distinct public._atlas_normalize_equipment_token(e) as e2
    from unnest(equipment) as e
  ) s
  where s.e2 is not null
), '{}');

update public.exercise_library
set equipment_primary = coalesce(
  public._atlas_normalize_equipment_token(equipment_primary),
  (
    select public._atlas_normalize_equipment_token(e)
    from unnest(equipment) as e
    where public._atlas_normalize_equipment_token(e) is not null
    limit 1
  ),
  'other'
);

update public.exercise_library
set equipment_secondary = coalesce((
  select array_agg(x.e order by x.e)
  from (
    select distinct public._atlas_normalize_equipment_token(u) as e
    from unnest(equipment_secondary) as u
  ) x
  where x.e is not null and x.e <> equipment_primary
), '{}');

update public.exercise_library
set equipment_category = case equipment_primary
  when 'bodyweight' then 'bodyweight'
  when 'barbell' then 'free_weights'
  when 'dumbbell' then 'free_weights'
  when 'kettlebell' then 'free_weights'
  when 'ez_bar' then 'free_weights'
  when 'smith_machine' then 'free_weights'
  when 'medicine_ball' then 'free_weights'
  when 'cable' then 'cable'
  when 'machine' then 'machine'
  when 'band' then 'bands'
  when 'trx' then 'suspension'
  else 'mixed'
end;

update public.exercise_library
set equipment_primary = 'other'
where equipment_primary is null;

update public.exercise_substitutions
set relation_type = 'broad'
where relation_type is not null
  and relation_type not in ('close', 'broad', 'regression', 'progression');

update public.exercise_library
set tags = coalesce((
  select array_agg(distinct t order by t)
  from unnest(tags) as raw
  cross join lateral (
    select case lower(trim(raw::text))
      when 'compound' then 'compound'
      when 'isolation' then 'isolation'
      when 'unilateral' then 'unilateral'
      when 'bilateral' then 'bilateral'
      when 'machine_preferred' then 'machine_preferred'
      when 'time_efficient' then 'time_efficient'
      when 'skill_intensive' then 'skill_intensive'
      else null
    end as t
  ) m
  where m.t is not null
), '{}');

update public.exercise_library
set program_roles = coalesce((
  select array_agg(distinct t order by t)
  from unnest(program_roles) as raw
  cross join lateral (
    select case lower(trim(replace(raw::text, ' ', '_')))
      when 'main_lift' then 'main_lift'
      when 'secondary' then 'secondary'
      when 'accessory' then 'accessory'
      when 'warmup' then 'warmup'
      when 'warm-up' then 'warmup'
      when 'finisher' then 'finisher'
      when 'cardio' then 'cardio'
      when 'mobility' then 'mobility'
      when 'prep' then 'prep'
      when 'recovery' then 'recovery'
      else null
    end as t
  ) m
  where m.t is not null
), '{}');

update public.exercise_library
set best_for_goals = coalesce((
  select array_agg(distinct t order by t)
  from unnest(best_for_goals) as raw
  cross join lateral (
    select case lower(trim(replace(raw::text, ' ', '_')))
      when 'fat_loss' then 'fat_loss'
      when 'muscle_gain' then 'muscle_gain'
      when 'hypertrophy' then 'hypertrophy'
      when 'strength' then 'strength'
      when 'power' then 'power'
      when 'endurance' then 'endurance'
      when 'mobility' then 'mobility'
      when 'general_fitness' then 'general_fitness'
      when 'sport_specific' then 'sport_specific'
      when 'competition_prep' then 'competition_prep'
      else null
    end as t
  ) m
  where m.t is not null
), '{}');

update public.exercise_library
set best_in_session_window = coalesce((
  select array_agg(distinct t order by t)
  from unnest(best_in_session_window) as raw
  cross join lateral (
    select case lower(trim(raw::text))
      when 'main' then 'main'
      when 'secondary' then 'secondary'
      when 'warmup' then 'warmup'
      when 'finisher' then 'finisher'
      when 'cooldown' then 'cooldown'
      else null
    end as t
  ) m
  where m.t is not null
), '{}');

update public.exercise_library
set gym_context_tags = coalesce((
  select array_agg(distinct t order by t)
  from unnest(gym_context_tags) as raw
  cross join lateral (
    select case lower(trim(replace(raw::text, ' ', '_')))
      when 'home_gym' then 'home_gym'
      when 'commercial_gym' then 'commercial_gym'
      when 'outdoor' then 'outdoor'
      when 'minimal_equipment' then 'minimal_equipment'
      else null
    end as t
  ) m
  where m.t is not null
), '{}');

update public.exercise_library
set body_context_tags = coalesce((
  select array_agg(distinct t order by t)
  from unnest(body_context_tags) as raw
  cross join lateral (
    select case lower(trim(replace(raw::text, ' ', '_')))
      when 'beginner_friendly' then 'beginner_friendly'
      when 'intermediate' then 'intermediate'
      when 'advanced' then 'advanced'
      when 'injury_friendly' then 'injury_friendly'
      else null
    end as t
  ) m
  where m.t is not null
), '{}');

update public.exercise_library
set prep_context_tags = coalesce((
  select array_agg(distinct t order by t)
  from unnest(prep_context_tags) as raw
  cross join lateral (
    select case lower(trim(replace(raw::text, ' ', '_')))
      when 'off_season' then 'off_season'
      when 'pre_contest' then 'pre_contest'
      when 'peak_week' then 'peak_week'
      else null
    end as t
  ) m
  where m.t is not null
), '{}');

-- ---------------------------------------------------------------------------
-- CHECK constraints (drop if re-run)
-- ---------------------------------------------------------------------------
alter table public.exercise_library drop constraint if exists exercise_library_movement_pattern_check;
alter table public.exercise_library add constraint exercise_library_movement_pattern_check
  check (
    movement_pattern is null
    or movement_pattern = any (array[
      'push','pull','squat','hinge','lunge','carry','isolation','plyometric','rotation','other'
    ]::text[])
  );

alter table public.exercise_library drop constraint if exists exercise_library_primary_muscle_check;
alter table public.exercise_library add constraint exercise_library_primary_muscle_check
  check (
    primary_muscle is null
    or primary_muscle = any (array[
      'chest','back','shoulders','biceps','triceps','forearms','quads','hamstrings','glutes','calves','core','traps','neck','full_body'
    ]::text[])
  );

alter table public.exercise_library drop constraint if exists exercise_library_primary_muscles_check;
alter table public.exercise_library add constraint exercise_library_primary_muscles_check
  check (
    primary_muscles <@ array[
      'chest','back','shoulders','biceps','triceps','forearms','quads','hamstrings','glutes','calves','core','traps','neck','full_body'
    ]::text[]
  );

alter table public.exercise_library drop constraint if exists exercise_library_secondary_muscles_check;
alter table public.exercise_library add constraint exercise_library_secondary_muscles_check
  check (
    secondary_muscles <@ array[
      'chest','back','shoulders','biceps','triceps','forearms','quads','hamstrings','glutes','calves','core','traps','neck','full_body'
    ]::text[]
  );

alter table public.exercise_library drop constraint if exists exercise_library_stabilizer_muscles_check;
alter table public.exercise_library add constraint exercise_library_stabilizer_muscles_check
  check (
    stabilizer_muscles <@ array[
      'chest','back','shoulders','biceps','triceps','forearms','quads','hamstrings','glutes','calves','core','traps','neck','full_body'
    ]::text[]
  );

alter table public.exercise_library drop constraint if exists exercise_library_equipment_primary_check;
alter table public.exercise_library add constraint exercise_library_equipment_primary_check
  check (
    equipment_primary is null
    or equipment_primary = any (array[
      'barbell','dumbbell','kettlebell','cable','machine','bodyweight','band','trx','medicine_ball','ez_bar','smith_machine','other'
    ]::text[])
  );

alter table public.exercise_library drop constraint if exists exercise_library_equipment_category_check;
alter table public.exercise_library add constraint exercise_library_equipment_category_check
  check (
    equipment_category is null
    or equipment_category = any (array[
      'bodyweight','free_weights','cable','machine','bands','suspension','mixed','other'
    ]::text[])
  );

alter table public.exercise_library drop constraint if exists exercise_library_tags_check;
alter table public.exercise_library add constraint exercise_library_tags_check
  check (
    tags <@ array[
      'compound','isolation','unilateral','bilateral','machine_preferred','time_efficient','skill_intensive'
    ]::text[]
  );

alter table public.exercise_library drop constraint if exists exercise_library_program_roles_check;
alter table public.exercise_library add constraint exercise_library_program_roles_check
  check (
    program_roles <@ array[
      'main_lift','secondary','accessory','warmup','finisher','cardio','mobility','prep','recovery'
    ]::text[]
  );

alter table public.exercise_library drop constraint if exists exercise_library_best_for_goals_check;
alter table public.exercise_library add constraint exercise_library_best_for_goals_check
  check (
    best_for_goals <@ array[
      'fat_loss','muscle_gain','hypertrophy','strength','power','endurance','mobility','general_fitness','sport_specific','competition_prep'
    ]::text[]
  );

alter table public.exercise_library drop constraint if exists exercise_library_best_in_session_window_check;
alter table public.exercise_library add constraint exercise_library_best_in_session_window_check
  check (
    best_in_session_window <@ array[
      'main','secondary','warmup','finisher','cooldown'
    ]::text[]
  );

alter table public.exercise_library drop constraint if exists exercise_library_gym_context_tags_check;
alter table public.exercise_library add constraint exercise_library_gym_context_tags_check
  check (
    gym_context_tags <@ array[
      'home_gym','commercial_gym','outdoor','minimal_equipment'
    ]::text[]
  );

alter table public.exercise_library drop constraint if exists exercise_library_body_context_tags_check;
alter table public.exercise_library add constraint exercise_library_body_context_tags_check
  check (
    body_context_tags <@ array[
      'beginner_friendly','intermediate','advanced','injury_friendly'
    ]::text[]
  );

alter table public.exercise_library drop constraint if exists exercise_library_prep_context_tags_check;
alter table public.exercise_library add constraint exercise_library_prep_context_tags_check
  check (
    prep_context_tags <@ array[
      'off_season','pre_contest','peak_week'
    ]::text[]
  );

alter table public.exercise_substitutions drop constraint if exists exercise_substitutions_relation_type_check;
alter table public.exercise_substitutions add constraint exercise_substitutions_relation_type_check
  check (relation_type = any (array['close','broad','regression','progression']::text[]));
