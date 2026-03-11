import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { code } = body;

    if (!code || typeof code !== 'string') {
      return Response.json({ error: 'Invalid code' }, { status: 400 });
    }

    const trainers = await base44.asServiceRole.entities.TrainerProfile.filter({
      invite_code: code.toUpperCase()
    });

    if (!trainers[0]) {
      return Response.json({ valid: false });
    }

    const trainer = trainers[0];

    // Check if trainer has Stripe Connect setup
    if (!trainer.stripe_connected) {
      return Response.json({
        valid: false,
        error: 'Trainer has not completed payment setup yet'
      });
    }

    return Response.json({
      valid: true,
      trainer: {
        id: trainer.id,
        name: trainer.display_name,
        niche: trainer.niche,
        monthlyRate: trainer.monthly_rate || 10000 // £100 default
      }
    });
  } catch (error) {
    console.error('Error validating invite code:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});