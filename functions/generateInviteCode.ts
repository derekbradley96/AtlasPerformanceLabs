import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Generate short human-readable code (e.g., FITX-4K9Z)
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code.slice(0, 4) + '-' + code.slice(4);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const trainers = await base44.asServiceRole.entities.TrainerProfile.filter({
      user_id: user.id
    });

    if (!trainers[0]) {
      return Response.json({ error: 'Trainer profile not found' }, { status: 404 });
    }

    // If code exists, return it
    if (trainers[0].invite_code) {
      return Response.json({ code: trainers[0].invite_code });
    }

    // Generate unique code
    let code;
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      code = generateCode();
      const existing = await base44.asServiceRole.entities.TrainerProfile.filter({
        invite_code: code
      });
      isUnique = existing.length === 0;
      attempts++;
    }

    if (!isUnique) {
      return Response.json(
        { error: 'Failed to generate unique code' },
        { status: 500 }
      );
    }

    // Update trainer profile
    await base44.asServiceRole.entities.TrainerProfile.update(trainers[0].id, {
      invite_code: code
    });

    return Response.json({ code });
  } catch (error) {
    console.error('Error generating invite code:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});