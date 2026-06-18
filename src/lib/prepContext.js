/**
 * Contest-prep timing and phase context for athletes heading to a show.
 * Single shared engine — pages read derived fields from AuthContext.prepContext.
 */

export function getPrepContext(contestPrep) {
  if (!contestPrep?.show_date) return null;
  const showDate = new Date(contestPrep.show_date);
  const now = new Date();
  const daysOut = Math.ceil((showDate - now) / (1000 * 60 * 60 * 24));
  const weeksOut = Math.floor(daysOut / 7);

  const phase =
    daysOut <= 7 ? 'peak_week' :
      daysOut <= 28 ? 'final_push' :
        daysOut <= 56 ? 'mid_prep' :
          'early_prep';

  const phaseLabel =
    phase === 'peak_week' ? 'Peak week' :
      phase === 'final_push' ? 'Final push' :
        phase === 'mid_prep' ? 'Mid prep' :
          'Early prep';

  const urgencyColour =
    daysOut <= 14 ? 'danger' :
      daysOut <= 28 ? 'warning' :
        'info';

  const recoveryAdvice =
    phase === 'peak_week'
      ? 'Prioritise sleep above everything. No new exercises this week.'
      : phase === 'final_push'
        ? 'Keep stress low. Reduce social events this week.'
        : 'Normal recovery protocols apply.';

  const nutritionNote =
    phase === 'peak_week'
      ? 'Follow your peak week protocol exactly as written.'
      : phase === 'final_push'
        ? 'Stay tight on your macros — every day counts now.'
        : 'Hit your macros consistently. Small deficits compound.';

  return {
    daysOut,
    weeksOut,
    phase,
    phaseLabel,
    urgencyColour,
    recoveryAdvice,
    nutritionNote,
    showName: contestPrep.show_name,
    division: contestPrep.division,
    federation: contestPrep.federation,
  };
}
