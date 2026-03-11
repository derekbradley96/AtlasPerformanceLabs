/**
 * Client energy logging for fatigue detection and recovery insights.
 */
export interface EnergyLog {
  id: string;
  clientId: string;
  date: string;
  energy: number;
  motivation?: number;
  stress?: number;
  sleepHours?: number;
  notes?: string;
}
