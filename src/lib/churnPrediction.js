export function getChurnRiskClients(clients, retentionData) {
  return (clients || [])
    .map((client) => {
      const retention = (retentionData || []).find((r) => r.clientId === client.id);
      return { ...client, churnRisk: retention };
    })
    .filter((c) => c.churnRisk?.risk === 'high')
    .sort((a, b) => (b.churnRisk?.score0to100 ?? 0) - (a.churnRisk?.score0to100 ?? 0));
}

export function getChurnInterventionAction(client, risk) {
  const reasons = risk?.reasons || [];
  if (reasons.includes('payment_overdue')) {
    return {
      label: 'Chase payment',
      description: 'Payment overdue — send a warm reminder',
      navigateTo: `/clients/${client.id}/billing`,
      urgency: 'high',
    };
  }
  if (reasons.includes('no_checkin')) {
    return {
      label: 'Send a nudge',
      description: `${client.name || 'Client'} hasn't checked in for 10+ days`,
      navigateTo: '/messages',
      messagePreFill: `Hey ${(client.name || 'there').split(' ')[0]}, just checking in — how's everything going this week?`,
      urgency: 'high',
    };
  }
  if (reasons.includes('low_adherence')) {
    return {
      label: 'Book a check-in call',
      description: 'Adherence has dropped 3 weeks running',
      navigateTo: `/clients/${client.id}`,
      urgency: 'medium',
    };
  }
  return {
    label: 'Review client',
    description: 'Multiple retention risk signals detected',
    navigateTo: `/clients/${client.id}`,
    urgency: 'medium',
  };
}
