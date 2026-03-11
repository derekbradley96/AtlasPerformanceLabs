import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // This is admin-only (scheduled automation)
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Get all active clients
    const clients = await base44.asServiceRole.entities.ClientProfile.filter({
      subscription_status: 'active'
    });

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const nudgesSent = [];

    for (const client of clients) {
      // Check last workout
      const workouts = await base44.asServiceRole.entities.Workout.filter(
        { user_id: client.user_id, status: 'completed' },
        '-completed_at',
        1
      );

      const lastWorkout = workouts[0];
      const needsNudge = !lastWorkout || new Date(lastWorkout.completed_at) < threeDaysAgo;

      if (needsNudge) {
        // Get or create conversation
        const conversations = await base44.asServiceRole.entities.Conversation.filter({
          trainer_id: client.trainer_id,
          client_id: client.id
        });

        let conversation;
        if (conversations[0]) {
          conversation = conversations[0];
        } else {
          conversation = await base44.asServiceRole.entities.Conversation.create({
            trainer_id: client.trainer_id,
            client_id: client.id
          });
        }

        // Get client user
        const users = await base44.asServiceRole.entities.User.filter({ id: client.user_id });
        const clientUser = users[0];

        // Send nudge message
        const message = `Hi ${clientUser.full_name}! 👋\n\nI noticed it's been a few days since your last workout. Everything okay? Let me know if you need any support or adjustments to your program!`;

        await base44.asServiceRole.entities.Message.create({
          conversation_id: conversation.id,
          sender_type: 'trainer',
          sender_id: client.trainer_id,
          text: message
        });

        await base44.asServiceRole.entities.Conversation.update(conversation.id, {
          last_message_at: new Date().toISOString(),
          last_message_preview: message.substring(0, 50)
        });

        nudgesSent.push(clientUser.full_name);
      }
    }

    return Response.json({
      checked: clients.length,
      nudgesSent: nudgesSent.length,
      clients: nudgesSent
    });
  } catch (error) {
    console.error('Error checking client activity:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});