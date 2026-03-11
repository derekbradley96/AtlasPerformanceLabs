import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Backend function to calculate exercise performance trends per week
 * Runs nightly to populate ExercisePerformanceTrend records
 * 
 * Metrics:
 * - total volume (weight × reps × sets) per exercise per week
 * - trend classification: improving (+3%), stable (-2% to +2%), declining (<-2%)
 * - flags: plateau (3+ weeks stable), regression (2 weeks declining)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only admins or the system can call this
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get all users with completed workouts
    const allUsers = await base44.asServiceRole.entities.User.list();
    let processed = 0;
    let errors = [];

    for (const u of allUsers) {
      try {
        // Get completed workouts for this user
        const workouts = await base44.asServiceRole.entities.Workout.filter({
          user_id: u.id,
          status: 'completed'
        });

        if (workouts.length === 0) continue;

        // Group workouts by week
        const weekMap = {};
        workouts.forEach(w => {
          const date = new Date(w.completed_at);
          const monday = new Date(date);
          monday.setDate(monday.getDate() - monday.getDay() + 1);
          const weekKey = monday.toISOString().split('T')[0];

          if (!weekMap[weekKey]) {
            weekMap[weekKey] = [];
          }
          weekMap[weekKey].push(w);
        });

        // Process each week
        for (const [weekStart, weekWorkouts] of Object.entries(weekMap)) {
          // Get all sets for this week
          const sets = [];
          for (const w of weekWorkouts) {
            const workoutSets = await base44.asServiceRole.entities.WorkoutSet.filter({
              workout_id: w.id
            });
            sets.push(...workoutSets);
          }

          // Group by exercise
          const exerciseMap = {};
          sets.forEach(s => {
            if (!exerciseMap[s.exercise_id]) {
              exerciseMap[s.exercise_id] = {
                name: s.exercise_name,
                sets: []
              };
            }
            exerciseMap[s.exercise_id].sets.push(s);
          });

          // Calculate metrics per exercise
          for (const [exerciseId, data] of Object.entries(exerciseMap)) {
            const totalVolume = data.sets.reduce((sum, s) => {
              return sum + ((s.weight || 0) * (s.reps || 0));
            }, 0);

            const totalSets = data.sets.length;
            const avgWeight = totalSets > 0
              ? data.sets.reduce((sum, s) => sum + (s.weight || 0), 0) / totalSets
              : 0;

            const avgReps = totalSets > 0
              ? data.sets.reduce((sum, s) => sum + (s.reps || 0), 0) / totalSets
              : 0;

            // Get previous week's data
            const prevWeekDate = new Date(weekStart);
            prevWeekDate.setDate(prevWeekDate.getDate() - 7);
            const prevWeekKey = prevWeekDate.toISOString().split('T')[0];

            const prevTrend = (await base44.asServiceRole.entities.ExercisePerformanceTrend.filter({
              user_id: u.id,
              exercise_id: exerciseId,
              week_start_date: prevWeekKey
            }))[0];

            // Calculate week-over-week change
            let weekOverWeekChange = 0;
            if (prevTrend?.total_volume && prevTrend.total_volume > 0) {
              weekOverWeekChange = ((totalVolume - prevTrend.total_volume) / prevTrend.total_volume) * 100;
            }

            // Classify trend
            let trend = 'stable';
            if (weekOverWeekChange >= 3) {
              trend = 'improving';
            } else if (weekOverWeekChange <= -2) {
              trend = 'regressing';
            }

            // Check for plateau (3+ weeks stable)
            let needsAttention = false;
            let attentionReason = null;

            if (trend === 'stable') {
              // Count consecutive stable weeks
              let stableWeeks = 1;
              let checkDate = new Date(weekStart);
              for (let i = 0; i < 3; i++) {
                checkDate.setDate(checkDate.getDate() - 7);
                const checkKey = checkDate.toISOString().split('T')[0];
                const checkTrend = (await base44.asServiceRole.entities.ExercisePerformanceTrend.filter({
                  user_id: u.id,
                  exercise_id: exerciseId,
                  week_start_date: checkKey
                }))[0];

                if (checkTrend?.trend === 'stable') {
                  stableWeeks++;
                } else {
                  break;
                }
              }

              if (stableWeeks >= 3) {
                trend = 'plateauing';
                needsAttention = true;
                attentionReason = 'Plateau detected (3+ weeks stable)';
              }
            }

            // Check for back-to-back regression
            if (trend === 'regressing' && prevTrend?.trend === 'regressing') {
              needsAttention = true;
              attentionReason = 'Regression: 2 weeks declining';
            }

            // Create or update trend record
            const existingTrend = (await base44.asServiceRole.entities.ExercisePerformanceTrend.filter({
              user_id: u.id,
              exercise_id: exerciseId,
              week_start_date: weekStart
            }))[0];

            const trendData = {
              user_id: u.id,
              exercise_id: exerciseId,
              exercise_name: data.name,
              week_start_date: weekStart,
              avg_weight: avgWeight,
              avg_reps: avgReps,
              total_volume: totalVolume,
              total_sets: totalSets,
              week_over_week_change: weekOverWeekChange,
              four_week_avg: totalVolume, // Simplified; would need more history
              trend,
              needs_attention: needsAttention,
              attention_reason: attentionReason
            };

            if (existingTrend) {
              await base44.asServiceRole.entities.ExercisePerformanceTrend.update(existingTrend.id, trendData);
            } else {
              await base44.asServiceRole.entities.ExercisePerformanceTrend.create(trendData);
            }
          }
        }

        processed++;
      } catch (userError) {
        errors.push({ userId: u.id, error: userError.message });
      }
    }

    return Response.json({
      success: true,
      processed,
      errors: errors.length > 0 ? errors : null
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});