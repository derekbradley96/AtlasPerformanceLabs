import React, { useEffect, useMemo, useState } from 'react';
import { Send, X } from 'lucide-react';
import { toast } from 'sonner';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';
import { usePresentationMode } from '@/lib/presentationMode';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
// Fallback only when ensureThreadForClient is missing — prefer Supabase ensure (useData / messagingService).
import { openOrCreateThread as openOrCreateLocalThread } from '@/lib/messaging/messageStore';

const MESSAGE_MAX = 500;

export default function BroadcastMessageSheet({
  open,
  onOpenChange,
  clients = [],
  ensureThreadForClient,
  sendMessage,
  onSent,
  /** When opening from roster nudge, pre-fill composer (still editable). */
  initialMessage = '',
}) {
  const { isDesktopWeb } = usePresentationMode();
  const [selectedClientIds, setSelectedClientIds] = useState([]);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(null);

  const coachClients = useMemo(
    () =>
      (Array.isArray(clients) ? clients : [])
        .filter((c) => c?.id)
        .map((c) => ({
          id: String(c.id),
          name: c?.full_name || c?.name || 'Client',
        })),
    [clients]
  );

  useEffect(() => {
    if (!open) return;
    setSelectedClientIds(coachClients.map((c) => c.id));
    setMessage(String(initialMessage || '').slice(0, MESSAGE_MAX));
    setSendProgress(null);
  }, [open, coachClients, initialMessage]);

  const selectedCount = selectedClientIds.length;
  const allSelected = coachClients.length > 0 && selectedCount === coachClients.length;
  const trimmedMessage = message.trim();
  const canSend =
    !isSending &&
    selectedCount > 0 &&
    trimmedMessage.length > 0 &&
    trimmedMessage.length <= MESSAGE_MAX;

  const toggleSelectAll = () => {
    setSelectedClientIds((prev) =>
      prev.length === coachClients.length ? [] : coachClients.map((c) => c.id)
    );
  };

  const toggleClient = (clientId) => {
    setSelectedClientIds((prev) =>
      prev.includes(clientId)
        ? prev.filter((id) => id !== clientId)
        : [...prev, clientId]
    );
  };

  const handleSend = async () => {
    if (!canSend || typeof sendMessage !== 'function') return;
    const selectedClients = coachClients.filter((c) => selectedClientIds.includes(c.id));
    if (selectedClients.length === 0) return;

    const failures = [];
    setIsSending(true);
    try {
      for (let i = 0; i < selectedClients.length; i += 1) {
        const client = selectedClients[i];
        setSendProgress(`Sending to ${i + 1} of ${selectedClients.length}...`);
        try {
          const thread =
            typeof ensureThreadForClient === 'function'
              ? await ensureThreadForClient(client.id)
              : await openOrCreateLocalThread({ clientId: client.id, clientName: client.name });
          const threadId = thread?.id;
          if (!threadId) throw new Error('Thread not found');
          await sendMessage(threadId, trimmedMessage);
        } catch (error) {
          failures.push(client.name);
        }
      }

      const successCount = selectedClients.length - failures.length;
      if (successCount > 0) {
        toast.success(`Message sent to ${successCount} client${successCount === 1 ? '' : 's'}`);
      }
      if (failures.length > 0) {
        toast.error(`Failed to send to ${failures.length} client${failures.length === 1 ? '' : 's'}`);
      }
      onSent?.({ successCount, failureCount: failures.length, failedClientNames: failures });
      if (successCount > 0) onOpenChange?.(false);
    } finally {
      setIsSending(false);
      setSendProgress(null);
    }
  };

  const body = (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-28">
        <button
          type="button"
          onClick={toggleSelectAll}
          className="w-full mt-2 mb-3 rounded-xl border px-3 py-2 text-left text-sm font-medium"
          style={{
            borderColor: colors.border,
            background: colors.surface1,
            color: colors.text,
          }}
        >
          {allSelected ? 'Deselect all' : 'Select all'} ({selectedCount}/{coachClients.length})
        </button>

        <div className="rounded-xl border overflow-hidden" style={{ borderColor: colors.border }}>
          {coachClients.map((client) => {
            const checked = selectedClientIds.includes(client.id);
            return (
              <label
                key={client.id}
                className="flex items-center gap-3 px-3 py-3 border-b last:border-b-0 cursor-pointer"
                style={{ borderColor: colors.border, background: colors.surface1 }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleClient(client.id)}
                  className="h-4 w-4"
                />
                <span className="text-sm" style={{ color: colors.text }}>
                  {client.name}
                </span>
              </label>
            );
          })}
          {coachClients.length === 0 && (
            <div className="px-3 py-4 text-sm" style={{ color: colors.muted, background: colors.surface1 }}>
              No clients available yet.
            </div>
          )}
        </div>

        <div className="mt-4">
          <textarea
            value={message}
            maxLength={MESSAGE_MAX}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write your broadcast message..."
            className="w-full rounded-xl border p-3 text-sm resize-none outline-none"
            style={{
              minHeight: 120,
              borderColor: colors.border,
              background: colors.surface1,
              color: colors.text,
            }}
          />
          <div className="mt-1 text-xs text-right" style={{ color: colors.muted }}>
            {message.length}/{MESSAGE_MAX}
          </div>
        </div>
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 border-t px-4 py-3"
        style={{
          borderColor: colors.border,
          background: colors.bg,
          paddingBottom: `calc(${spacing[12]}px + env(safe-area-inset-bottom, 0px))`,
        }}
      >
        {isSending && (
          <p className="text-xs mb-2" style={{ color: colors.muted }}>
            {sendProgress}
          </p>
        )}
        <Button
          variant="primary"
          onClick={handleSend}
          disabled={!canSend}
          className="w-full"
          style={{ minHeight: 48 }}
        >
          <span className="inline-flex items-center justify-center gap-2">
            <Send size={16} />
            Send to {selectedCount} client{selectedCount === 1 ? '' : 's'}
          </span>
        </Button>
      </div>
    </div>
  );

  if (isDesktopWeb) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="p-0 border"
          style={{ background: colors.bg, borderColor: colors.border, maxWidth: 680, height: 'min(80vh, 760px)' }}
        >
          <DialogHeader className="px-4 pt-4 pb-2 border-b" style={{ borderColor: colors.border }}>
            <DialogTitle style={{ color: colors.text }}>Broadcast message</DialogTitle>
          </DialogHeader>
          <div className="relative min-h-0 flex-1">{body}</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} dismissible shouldScaleBackground>
      <DrawerContent
        className="border-t rounded-t-2xl flex flex-col"
        style={{
          background: colors.bg,
          borderColor: colors.border,
          height: '100dvh',
          maxHeight: '100dvh',
        }}
      >
        <DrawerHeader className="px-4 pt-0 pb-2 border-b flex-shrink-0" style={{ borderColor: colors.border }}>
          <div className="flex items-center justify-between">
            <DrawerTitle style={{ color: colors.text }}>Broadcast message</DrawerTitle>
            <button
              type="button"
              onClick={() => onOpenChange?.(false)}
              className="p-2 rounded-lg"
              style={{ color: colors.muted, background: 'transparent', border: 'none' }}
              aria-label="Close broadcast"
            >
              <X size={20} />
            </button>
          </div>
        </DrawerHeader>
        <div className="relative min-h-0 flex-1">{body}</div>
      </DrawerContent>
    </Drawer>
  );
}
