export function generateWarmupSets(workingWeightKg) {
  if (!workingWeightKg || workingWeightKg <= 20) return [];

  const round = (n) => Math.round(n / 2.5) * 2.5;

  return [
    {
      setNumber: 'W1',
      weight_kg: round(workingWeightKg * 0.5),
      reps: 8,
      label: '50% - bar speed focus',
      isWarmup: true,
    },
    {
      setNumber: 'W2',
      weight_kg: round(workingWeightKg * 0.75),
      reps: 5,
      label: '75% - feel the movement',
      isWarmup: true,
    },
    {
      setNumber: 'W3',
      weight_kg: round(workingWeightKg * 0.9),
      reps: 2,
      label: '90% - activate and prime',
      isWarmup: true,
    },
  ].filter((s) => s.weight_kg >= 20);
}

export function generateWarmupSetsForWeight(workingWeightKg) {
  if (!workingWeightKg || workingWeightKg <= 0) return [];
  if (workingWeightKg <= 40) {
    const round = (n) => Math.round(n / 2.5) * 2.5;
    return [{
      setNumber: 'W1',
      weight_kg: round(workingWeightKg * 0.6),
      reps: 8,
      label: '60% - warm-up',
      isWarmup: true,
    }];
  }
  return generateWarmupSets(workingWeightKg);
}
