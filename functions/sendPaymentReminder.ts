import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.user_type !== 'trainer') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { clientId } = body;

    if (!clientId) {
      return Response.json({ error: 'Missing clientId' }, { status: 400 });
    }

    // Get client profile
    const client = await base44.asServiceRole.entities.ClientProfile.get(clientId);
    if (!client) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    // Get client user
    const clientUser = await base44.asServiceRole.entities.User.get(client.user_id);

    // Get or create conversation
    const conversations = await base44.asServiceRole.entities.Conversation.filter({
      trainer_id: user.id,
      client_id: clientId
    });

    let conversation;
    if (conversations[0]) {
      conversation = conversations[0];
    } else {
      // This shouldn't happen but handle it
      return Response.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Send payment reminder message
    const message = `Hi ${clientUser.full_name},\n\nIt looks like there was an issue processing your payment. To continue your coaching, please update your payment method.\n\nLet me know if you need any help!`;

    await base44.asServiceRole.entities.Message.create({
      conversation_id: conversation.id,
      sender_type: 'trainer',
      sender_id: user.id,
      text: message
    });

    // Update conversation
    await base44.asServiceRole.entities.Conversation.update(conversation.id, {
      last_message_at: new Date().toISOString(),
      last_message_preview: message
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error sending payment reminder:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});