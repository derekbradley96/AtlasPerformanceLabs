/**
 * Book an in-person (or hybrid) session into coach_sessions.
 * Fields: client, date, time, duration, location, notes.
 */
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { colors, spacing } from '@/ui/tokens';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { impactLight } from '@/lib/haptics';
import { toast } from 'sonner';

async function fetchCoachClients() {
  if (!hasSupabase) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return [];
  const { data, error } = await supabase
    .from('clients')
    .select('id, full_name, name')
    .or(`coach_id.eq.${user.id},trainer_id.eq.${user.id}`)
    .order('full_name');
  if (error) return [];
  return (data || []).map((c) => ({
    id: c.id,
    name: c.full_name || c.name || 'Client',
  }));
}

/**
 * @param {{ open: boolean; onOpenChange: (open: boolean) => void; defaultClientId?: string | null }}
 */
export default function SessionBookingModal({ open, onOpenChange, defaultClientId = null }) {
  const queryClient = useQueryClient();
  const [clientId, setClientId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(() => {
    const d = new Date();
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  });
  const [duration, setDuration] = useState('60');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  const { data: clients = [] } = useQuery({
    queryKey: ['coach_clients_for_booking'],
    queryFn: fetchCoachClients,
    enabled: open && hasSupabase,
  });

  useEffect(() => {
    if (open && defaultClientId) {
      setClientId(defaultClientId);
    }
    if (!open) {
      setNotes('');
      setLocation('');
    }
  }, [open, defaultClientId]);

  const insertMutation = useMutation({
    mutationFn: async () => {
      const supabase = getSupabase();
      if (!supabase) throw new Error('No supabase');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error('Not signed in');
      if (!clientId) throw new Error('Select a client');

      const sessionDate = new Date(`${date}T${time}:00`);
      if (Number.isNaN(sessionDate.getTime())) throw new Error('Invalid date/time');

      const durationMinutes = parseInt(duration, 10);
      const payload = {
        coach_id: user.id,
        client_id: clientId,
        session_type: 'in_person',
        session_date: sessionDate.toISOString(),
        duration_minutes: Number.isNaN(durationMinutes) ? null : durationMinutes,
        location: location.trim() || null,
        notes: notes.trim() || null,
        status: 'scheduled',
      };

      const { error } = await supabase.from('coach_sessions').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach_sessions'] });
      toast.success('Session booked');
      onOpenChange(false);
      impactLight();
    },
    onError: (e) => {
      toast.error(e?.message || 'Could not book session');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!clientId) {
      toast.error('Select a client');
      return;
    }
    insertMutation.mutate();
  };

  const inputStyle = {
    width: '100%',
    marginTop: 4,
    padding: `${spacing[10]}px ${spacing[12]}px`,
    borderRadius: 8,
    border: `1px solid ${colors.border}`,
    background: colors.surface1,
    color: colors.text,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md max-h-[90vh] overflow-y-auto"
        style={{ background: colors.card, borderColor: colors.border }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: colors.text }}>Book in-person session</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-medium" style={{ color: colors.muted }}>
            Client
            <select
              required
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              style={inputStyle}
            >
              <option value="">Select client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium" style={{ color: colors.muted }}>
              Date
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={inputStyle}
              />
            </label>
            <label className="block text-sm font-medium" style={{ color: colors.muted }}>
              Time
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                style={inputStyle}
              />
            </label>
          </div>

          <label className="block text-sm font-medium" style={{ color: colors.muted }}>
            Duration (minutes)
            <input
              type="number"
              min={15}
              step={15}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              style={inputStyle}
            />
          </label>

          <label className="block text-sm font-medium" style={{ color: colors.muted }}>
            Location
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Gym address, studio"
              style={inputStyle}
            />
          </label>

          <label className="block text-sm font-medium" style={{ color: colors.muted }}>
            Notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Optional"
              style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
            />
          </label>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={insertMutation.isPending}>
              {insertMutation.isPending ? 'Saving…' : 'Book session'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
