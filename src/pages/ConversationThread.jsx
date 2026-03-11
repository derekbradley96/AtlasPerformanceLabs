import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/lib/emptyApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Send, Image as ImageIcon, Pin, Flag, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import MessageBubble from '@/components/messaging/MessageBubble';
import QuickReplies from '@/components/messaging/QuickReplies';
import { PageLoader } from '@/components/ui/LoadingState';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';

export default function ConversationThread() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const conversationId = searchParams.get('id');
  const prefillText = searchParams.get('prefill');
  const queryClient = useQueryClient();
  
  const [user, setUser] = useState(null);
  const [messageText, setMessageText] = useState(prefillText || '');
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const loadUser = async () => {
      const u = await base44.auth.me();
      setUser(u);
    };
    loadUser();
  }, []);

  const { data: conversation } = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => base44.entities.Conversation.filter({ id: conversationId }).then(c => c[0]),
    enabled: !!conversationId
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => base44.entities.Message.filter({ conversation_id: conversationId }, 'created_date'),
    enabled: !!conversationId
  });

  const { data: trainerProfile } = useQuery({
    queryKey: ['trainer-profile-msg', conversation?.trainer_id],
    queryFn: () => base44.entities.TrainerProfile.filter({ id: conversation.trainer_id }).then(p => p[0]),
    enabled: !!conversation?.trainer_id
  });

  const { data: clientProfile } = useQuery({
    queryKey: ['client-profile-msg', conversation?.client_id],
    queryFn: () => base44.entities.ClientProfile.filter({ id: conversation.client_id }).then(p => p[0]),
    enabled: !!conversation?.client_id
  });

  const { data: trainerUser } = useQuery({
    queryKey: ['trainer-user-msg', trainerProfile?.user_id],
    queryFn: () => base44.entities.User.filter({ id: trainerProfile.user_id }).then(u => u[0]),
    enabled: !!trainerProfile?.user_id
  });

  const { data: clientUser } = useQuery({
    queryKey: ['client-user-msg', clientProfile?.user_id],
    queryFn: () => base44.entities.User.filter({ id: clientProfile.user_id }).then(u => u[0]),
    enabled: !!clientProfile?.user_id
  });

  // Check if client is at risk or has payment issues
  const { data: latestCheckin } = useQuery({
    queryKey: ['latest-checkin', conversation?.client_id],
    queryFn: async () => {
      const checkins = await base44.entities.CheckIn.filter(
        { client_id: conversation.client_id },
        '-created_date',
        1
      );
      const list = Array.isArray(checkins) ? checkins : [];
      return list[0] ?? null;
    },
    enabled: !!conversation?.client_id && user?.user_type === 'trainer'
  });

  const isTrainer = user?.user_type === 'trainer';
  const senderType = isTrainer ? 'trainer' : 'client';
  const otherPartyName = isTrainer ? clientUser?.full_name : trainerUser?.full_name;

  // Mark messages as read when conversation opens
  useEffect(() => {
    if (!user || !conversationId || !messages.length) return;
    
    const unreadMessages = messages.filter(m => !m.read_at && m.sender_id !== user.id);
    if (unreadMessages.length > 0) {
      unreadMessages.forEach(msg => {
        base44.entities.Message.update(msg.id, { read_at: new Date().toISOString() });
      });
      queryClient.invalidateQueries(['messages', conversationId]);
      queryClient.invalidateQueries(['unread-count']);
    }
  }, [conversationId, messages, user]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessageMutation = useMutation({
    mutationFn: async (data) => {
      await base44.entities.Message.create(data);
      await base44.entities.Conversation.update(conversationId, {
        last_message_at: new Date().toISOString(),
        last_message_preview: data.text.substring(0, 50)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['messages', conversationId]);
      queryClient.invalidateQueries(['conversations']);
      setMessageText('');
    }
  });

  const togglePinMutation = useMutation({
    mutationFn: (messageId) => {
      const msg = messages.find(m => m.id === messageId);
      return base44.entities.Message.update(messageId, { pinned: !msg.pinned });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['messages', conversationId]);
      toast.success('Message pinned');
    }
  });

  const toggleActionNeeded = useMutation({
    mutationFn: () => {
      return base44.entities.Conversation.update(conversationId, {
        action_needed: !conversation.action_needed
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['conversation', conversationId]);
      toast.success(conversation.action_needed ? 'Action flag removed' : 'Action needed set');
    }
  });

  const handleSend = () => {
    if (!messageText.trim()) return;
    
    sendMessageMutation.mutate({
      conversation_id: conversationId,
      sender_type: senderType,
      sender_id: user.id,
      text: messageText.trim(),
      attachments: []
    });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      sendMessageMutation.mutate({
        conversation_id: conversationId,
        sender_type: senderType,
        sender_id: user.id,
        text: messageText.trim() || '📷 Photo',
        attachments: [file_url]
      });
    } catch (error) {
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const sendNudge = () => {
    sendMessageMutation.mutate({
      conversation_id: conversationId,
      sender_type: 'trainer',
      sender_id: user.id,
      text: "Hey! Just checking in - how's everything going? 👋"
    });
  };

  if (!user || !conversation) {
    return <PageLoader />;
  }

  const pinnedMessages = messages.filter(m => m.pinned);
  const regularMessages = messages.filter(m => !m.pinned);
  
  // Check for alerts
  const checkinOverdue = latestCheckin && new Date(latestCheckin.due_date) < new Date() && latestCheckin.status === 'pending';
  const paymentIssue = clientProfile?.subscription_status === 'past_due';

  // Group messages by day
  const groupedMessages = regularMessages.reduce((groups, message) => {
    const date = new Date(message.created_date).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    if (!groups[date]) groups[date] = [];
    groups[date].push(message);
    return groups;
  }, {});

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="font-semibold text-white">{otherPartyName}</h2>
              {isTrainer && clientProfile && (
                <p className="text-xs text-slate-400">
                  {clientProfile.subscription_status === 'active' ? 'Active' : 'Inactive'}
                </p>
              )}
            </div>
          </div>
          {isTrainer && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => toggleActionNeeded.mutate()}
              className={conversation.action_needed ? 'text-orange-400' : 'text-slate-400'}
            >
              <Flag className="w-5 h-5" />
            </Button>
          )}
        </div>

        {/* Alert Banners */}
        <div className="px-4 pb-3 space-y-2">
          {/* Client side - payment issue banner */}
          {!isTrainer && clientProfile && (
            <PaymentIssueBanner clientProfile={clientProfile} />
          )}
          
          {/* Trainer side - alerts */}
          {isTrainer && (checkinOverdue || paymentIssue) && (
            <>
              {checkinOverdue && (
                <button
                  onClick={() => navigate(createPageUrl('CheckIns'))}
                  className="w-full bg-orange-500/20 border border-orange-500/30 rounded-lg px-3 py-2 text-sm text-orange-300 hover:bg-orange-500/30 transition-colors flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4" />
                  Check-in overdue - Review now
                </button>
              )}
              {paymentIssue && (
                <div className="w-full bg-red-500/20 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Payment issue - Client subscription past due
                </div>
              )}
            </>
          )}
        </div>

        {/* Pinned Messages */}
        {pinnedMessages.length > 0 && (
          <div className="px-4 pb-3 space-y-2">
            {pinnedMessages.map(msg => (
              <div key={msg.id} className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-3 py-2">
                <div className="flex items-start gap-2">
                  <Pin className="w-4 h-4 text-blue-400 mt-0.5" />
                  <p className="text-sm text-blue-300 flex-1">{msg.text}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {Object.entries(groupedMessages).map(([date, msgs]) => (
          <div key={date}>
            <div className="text-center my-4">
              <span className="text-xs text-slate-500 bg-slate-800/50 px-3 py-1 rounded-full">
                {date}
              </span>
            </div>
            {msgs.map(message => (
              <div
                key={message.id}
                onContextMenu={(e) => { if (isTrainer) { e.preventDefault(); togglePinMutation.mutate(message.id); } }}
                role="article"
              >
                <MessageBubble
                  message={message}
                  isOwn={message.sender_id === user.id}
                />
              </div>
            ))}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Replies (Trainer only) */}
      {isTrainer && <QuickReplies onSelect={setMessageText} />}

      {/* Nudge Button (Trainer only) */}
      {isTrainer && (
        <div className="px-4 pb-2">
          <Button
            variant="outline"
            size="sm"
            onClick={sendNudge}
            className="w-full border-slate-700 text-slate-400"
          >
            Send Nudge 👋
          </Button>
        </div>
      )}

      {/* Input Area */}
      <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur border-t border-slate-800 p-4">
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept="image/*"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="text-slate-400 hover:text-white disabled:opacity-50"
          >
            <ImageIcon className="w-5 h-5" />
          </button>
          <Input
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            className="flex-1 bg-slate-800 border-slate-700 text-white"
          />
          <Button
            onClick={handleSend}
            disabled={!messageText.trim() || sendMessageMutation.isPending}
            className="bg-blue-500 hover:bg-blue-600"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}