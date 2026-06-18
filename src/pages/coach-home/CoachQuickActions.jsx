import React from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import { colors, spacing } from '@/ui/tokens';
import { sectionLabel, sectionGap } from '@/ui/pageLayout';
import { hapticLight } from '@/lib/haptics';
import { buildReviewQueueUrl } from '@/lib/coachReviewRoutes';
import { ClipboardCheck, UserPlus, MessageSquare, UtensilsCrossed, Layers, Link2, Users, ChevronDown } from 'lucide-react';

export default function CoachQuickActions({ cardStyle, showOperationsMore, setShowOperationsMore }) {
  const navigate = useNavigate();
  return (
        <section style={{ marginBottom: sectionGap }}>
          <div style={{ marginBottom: spacing[8] }}>
            <span style={sectionLabel}>Client operations</span>
            <p className="text-xs mt-1" style={{ color: colors.muted }}>
              Daily coaching actions first. Setup and growth tools stay in a secondary section below.
            </p>
          </div>
          <Card style={{ ...cardStyle, padding: spacing[12] }}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Button type="button" variant="outline" className="w-full font-medium min-h-[40px] text-[12px]" onClick={() => { hapticLight(); navigate('/get-clients'); }}>
                <span className="inline-flex items-center justify-center gap-1.5"><UserPlus size={15} />Invite clients</span>
              </Button>
              <Button type="button" variant="outline" className="w-full font-medium min-h-[40px] text-[12px]" onClick={() => { hapticLight(); navigate('/clients'); }}>
                <span className="inline-flex items-center justify-center gap-1.5"><ClipboardCheck size={15} />Clients</span>
              </Button>
              <Button type="button" variant="outline" className="w-full font-medium min-h-[40px] text-[12px]" onClick={() => { hapticLight(); navigate('/messages'); }}>
                <span className="inline-flex items-center justify-center gap-1.5"><MessageSquare size={15} />Message client</span>
              </Button>
              <Button type="button" variant="outline" className="w-full font-medium min-h-[40px] text-[12px]" onClick={() => { hapticLight(); navigate(buildReviewQueueUrl({ filter: 'checkins' })); }}>
                <span className="inline-flex items-center justify-center gap-1.5"><ClipboardCheck size={15} />Request check-in</span>
              </Button>
            </div>
            <button
              type="button"
              onClick={() => setShowOperationsMore((v) => !v)}
              className="mt-3 w-full flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold"
              style={{ border: `1px solid ${colors.border}`, color: colors.primary, background: colors.surface1 }}
            >
              {showOperationsMore ? 'Show fewer operational tools' : 'See more operational tools'}
              <ChevronDown
                size={14}
                style={{ transform: showOperationsMore ? 'rotate(180deg)' : 'none', transition: 'transform 140ms ease' }}
              />
            </button>
            {showOperationsMore ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                <Button type="button" variant="outline" className="w-full font-medium min-h-[40px] text-[12px]" onClick={() => { hapticLight(); navigate('/program-builder'); }}>
                  <span className="inline-flex items-center justify-center gap-1.5"><Layers size={15} />Program Builder</span>
                </Button>
                <Button type="button" variant="outline" className="w-full font-medium min-h-[40px] text-[12px]" onClick={() => { hapticLight(); navigate('/nutrition-builder'); }}>
                  <span className="inline-flex items-center justify-center gap-1.5"><UtensilsCrossed size={15} />Nutrition Builder</span>
                </Button>
                <Button type="button" variant="outline" className="w-full font-medium min-h-[40px] text-[12px]" onClick={() => { hapticLight(); navigate('/program-assignments'); }}>
                  <span className="inline-flex items-center justify-center gap-1.5"><Link2 size={15} />Assign program</span>
                </Button>
                <Button type="button" variant="outline" className="w-full font-medium min-h-[40px] text-[12px]" onClick={() => { hapticLight(); navigate('/coach/nutrition'); }}>
                  <span className="inline-flex items-center justify-center gap-1.5"><Users size={15} />Nutrition list</span>
                </Button>
              </div>
            ) : null}
          </Card>
        </section>
  );
}
