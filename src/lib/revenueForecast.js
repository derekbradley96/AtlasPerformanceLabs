export function buildRevenueForecast({
  activeClients,
  churnRiskClients,
  overdueClients,
  monthlyRevenue,
  daysInMonth,
  dayOfMonth,
}) {
  const safeDay = Math.max(1, Number(dayOfMonth) || 1);
  const safeDays = Math.max(safeDay, Number(daysInMonth) || safeDay);
  const projectedMTD = (Number(monthlyRevenue || 0) / safeDay) * safeDays;

  const atRiskMonthly = (churnRiskClients || []).reduce(
    (sum, c) => sum + Number(c.monthly_price || 0),
    0
  );
  const overdueTotal = (overdueClients || []).reduce(
    (sum, c) => sum + Number(c.monthly_price || 0),
    0
  );

  const conservativeNext = projectedMTD - atRiskMonthly * 0.5;
  const optimisticNext = projectedMTD;

  return {
    projectedMTD: Math.round(projectedMTD),
    atRiskMonthly: Math.round(atRiskMonthly),
    overdueTotal: Math.round(overdueTotal),
    nextMonthRange: {
      low: Math.round(conservativeNext),
      high: Math.round(optimisticNext),
    },
    churnRiskCount: (churnRiskClients || []).length,
  };
}
