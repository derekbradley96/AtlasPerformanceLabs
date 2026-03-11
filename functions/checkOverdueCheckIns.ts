import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Admin-only automation
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all overdue check-ins
    const allCheckins = await base44.asServiceRole.entities.CheckIn.filter({
      status: 'pending'
    });

    const overdueCheckins = allCheckins.filter(c => {
      const dueDate = new Date(c.due_date);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate < today;
    });

    const remindersSent = [];

    for (const checkin of overdueCheckins) {
      // Get conversation
      const conversations = await base44.asServiceRole.entities.Conversation.filter({
        trainer_id: checkin.trainer_id,
        client_id: checkin.client_id
      });

      if (conversations[0]) {
        const client = await base44.asServiceRole.entities.ClientProfile.get(checkin.client_id);
        const clientUser = await base44.asServiceRole.entities.User.get(client.user_id);

        const message = `Hi ${clientUser.full_name}! ⏰\n\nYour weekly check-in is overdue. Please take a few minutes to submit it so I can review your progress and make any needed adjustments!`;

        await base44.asServiceRole.entities.Message.create({
          conversation_id: conversations[0].id,
          sender_type: 'trainer',
          sender_id: checkin.trainer_id,
          text: message
        });

        await base44.asServiceRole.entities.Conversation.update(conversations[0].id, {
          last_message_at: new Date().toISOString(),
          last_message_preview: message.substring(0, 50)
        });

        remindersSent.push(clientUser.full_name);
      }
    }

    return Response.json({
      overdueFound: overdueCheckins.length,
      remindersSent: remindersSent.length,
      clients: remindersSent
    });
  } catch (error) {
    console.error('Error checking overdue check-ins:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});