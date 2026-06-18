-- Drops only Supabase-linted exact duplicate indexes.
-- Keep the pre-existing canonical indexes and remove redundant idx_fkcover_* copies.
-- Safe/idempotent: each statement uses IF EXISTS.

DROP INDEX IF EXISTS public.idx_fkcover_beta_feedback_e194ce83c1b4;
DROP INDEX IF EXISTS public.idx_fkcover_beta_support_requests_619ac54259af;
DROP INDEX IF EXISTS public.idx_fkcover_bug_reports_2dc74e13c0e0;
DROP INDEX IF EXISTS public.idx_fkcover_client_habits_fe06632db73c;
DROP INDEX IF EXISTS public.idx_fkcover_client_milestones_85a5793f61d8;
DROP INDEX IF EXISTS public.idx_fkcover_client_milestones_f2d6b817d258;
DROP INDEX IF EXISTS public.idx_fkcover_client_phases_7743f2f43008;
DROP INDEX IF EXISTS public.idx_fkcover_client_phases_1aef3a3a6609;
DROP INDEX IF EXISTS public.idx_fkcover_client_result_stories_b171ca505f10;
DROP INDEX IF EXISTS public.idx_fkcover_coach_inquiries_3fdcdd1005e5;
DROP INDEX IF EXISTS public.idx_fkcover_coach_inquiries_1f1210c4830a;
DROP INDEX IF EXISTS public.idx_fkcover_coach_public_enquiries_17862a8c8e76;
DROP INDEX IF EXISTS public.idx_fkcover_coach_referral_codes_6500ffbcd6a4;
DROP INDEX IF EXISTS public.idx_fkcover_coach_referrals_89e3f0b5350b;
DROP INDEX IF EXISTS public.idx_fkcover_coach_sessions_85d5a68a022b;
DROP INDEX IF EXISTS public.idx_fkcover_device_tokens_bb55839c1368;
DROP INDEX IF EXISTS public.idx_fkcover_exercise_performance_35b654fd77b0;
DROP INDEX IF EXISTS public.idx_fkcover_exercise_performance_89c535d6c9c9;
DROP INDEX IF EXISTS public.idx_fkcover_message_messages_17f8c1ab3494;
DROP INDEX IF EXISTS public.idx_fkcover_peak_weeks_3ea10fc9941b;
DROP INDEX IF EXISTS public.idx_fkcover_personal_2acdf1f59ff9;
DROP INDEX IF EXISTS public.idx_fkcover_personal_program_assignments_77dca0924106;
DROP INDEX IF EXISTS public.idx_fkcover_personal_program_assignments_aad4e217dc43;
DROP INDEX IF EXISTS public.idx_fkcover_platform_usage_events_1f8290b75456;
DROP INDEX IF EXISTS public.idx_fkcover_prep_outcomes_655ea990f4a8;
DROP INDEX IF EXISTS public.idx_fkcover_program_block_assignments_dcbde607218e;
DROP INDEX IF EXISTS public.idx_fkcover_program_block_assignments_ea394f633dd8;
DROP INDEX IF EXISTS public.idx_fkcover_program_days_500d015e2be8;
DROP INDEX IF EXISTS public.idx_fkcover_program_exercises_225791376f2d;
DROP INDEX IF EXISTS public.idx_fkcover_program_weeks_c90a9293c445;
DROP INDEX IF EXISTS public.idx_fkcover_result_story_metrics_1f51a03818e3;
DROP INDEX IF EXISTS public.idx_fkcover_security_audit_logs_0641b1d05da3;
DROP INDEX IF EXISTS public.idx_fkcover_user_feedback_afd85c9f86f6;
DROP INDEX IF EXISTS public.idx_fkcover_workout_session_sets_a6fa8e01a427;
DROP INDEX IF EXISTS public.idx_fkcover_workout_session_sets_93544b0f94b2;
DROP INDEX IF EXISTS public.idx_fkcover_workout_sessions_c733d012068c;
DROP INDEX IF EXISTS public.idx_fkcover_workout_sessions_b3d3cf632dd6;
