import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import {
  getConsultationRequests,
  acceptConsultation,
  declineConsultation,
} from '@/lib/consultationStore';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';
import { Check, X, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { safeDate } from '@/lib/format';

function formatDate(iso) {
  const d = safeDate(iso);
  if (!d) return '—';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Consultations() {
  const navigate = useNavigate();
  const { role, isDemoMode, user } = useAuth();
  const trainerId = isDemoMode ? 'demo-trainer' : user?.id ?? 'trainer-1';
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('pending'); // pending | all

  useEffect(() => {
    const all = getConsultationRequests(trainerId);
    setRequests(all);
  }, [trainerId, filter]);

  const pending = requests.filter((r) => r.status === 'pending');
  const list = filter === 'pending' ? pending : requests;

  const handleAccept = (id) => {
    const updated = acceptConsultation(id, trainerId);
    if (updated) {
      setRequests(getConsultationRequests(trainerId));
      toast.success('Consultation accepted');
    }
  };

  const handleDecline = (id) => {
    const updated = declineConsultation(id, trainerId);
    if (updated) {
      setRequests(getConsultationRequests(trainerId));
      toast.success('Declined');
    }
  };

  if (role !== 'trainer') {
    return (
      <div className="app-screen min-w-0 max-w-full p-4" style={{ color: colors.muted }}>
        <p>Only trainers can view consultations.</p>
      </div>
    );
  }

  return (
    <div
      className="app-screen min-w-0 max-w-full overflow-x-hidden"
      style={{
        paddingBottom: `calc(${spacing[16]} + env(safe-area-inset-bottom, 0px))`,
      }}
    >
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setFilter('pending')}
          className="px-4 py-2 rounded-xl text-sm font-medium"
          style={{
            background: filter === 'pending' ? colors.accent : 'rgba(255,255,255,0.06)',
            color: filter === 'pending' ? colors.bg : colors.text,
          }}
        >
          Pending ({pending.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('all')}
          className="px-4 py-2 rounded-xl text-sm font-medium"
          style={{
            background: filter === 'all' ? colors.accent : 'rgba(255,255,255,0.06)',
            color: filter === 'all' ? colors.bg : colors.text,
          }}
        >
          All
        </button>
      </div>

      {list.length === 0 ? (
        <Card style={{ padding: spacing[24], textAlign: 'center' }}>
          <MessageSquare size={40} style={{ color: colors.muted, margin: '0 auto 12px' }} />
          <p className="text-sm" style={{ color: colors.muted }}>
            {filter === 'pending' ? 'No pending consultation requests.' : 'No consultation requests yet.'}
          </p>
        </Card>
      ) : (
        list.map((req) => (
          <Card key={req.id} style={{ marginBottom: spacing[12], padding: spacing[16] }}>
            <p className="text-[15px] font-semibold" style={{ color: colors.text }}>{req.userName}</p>
            {req.userEmail && (
              <p className="text-xs mt-0.5" style={{ color: colors.muted }}>{req.userEmail}</p>
            )}
            {req.goal && (
              <p className="text-sm mt-2" style={{ color: colors.text }}><strong>Goal:</strong> {req.goal}</p>
            )}
            {req.availability && (
              <p className="text-sm mt-1" style={{ color: colors.muted }}><strong>Availability:</strong> {req.availability}</p>
            )}
            {req.notes && (
              <p className="text-sm mt-1" style={{ color: colors.muted }}>{req.notes}</p>
            )}
            <p className="text-xs mt-2" style={{ color: colors.muted }}>{formatDate(req.created_date)}</p>
            <div className="flex items-center gap-2 mt-3">
              {req.status === 'pending' && (
                <>
                  <Button variant="primary" onClick={() => handleAccept(req.id)} style={{ flex: 1 }}>
                    <Check size={18} style={{ marginRight: 6 }} /> Accept
                  </Button>
                  <Button variant="secondary" onClick={() => handleDecline(req.id)} style={{ flex: 1 }}>
                    <X size={18} style={{ marginRight: 6 }} /> Decline
                  </Button>
                </>
              )}
              {req.status !== 'pending' && (
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                  style={{
                    background: req.status === 'accepted' ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.1)',
                    color: req.status === 'accepted' ? colors.success : colors.muted,
                  }}
                >
                  {req.status === 'accepted' ? 'Accepted' : 'Declined'}
                </span>
              )}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
