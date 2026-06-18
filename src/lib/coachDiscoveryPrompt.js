/**
 * One-time coach discovery surface for solo prep users in the final runway window.
 */

export function shouldShowCoachDiscovery({ weeksOut, hasCoach, hasSeenPrompt }) {
  return (
    !hasCoach
    && !hasSeenPrompt
    && weeksOut !== null
    && weeksOut <= 10
    && weeksOut >= 6
  );
}
