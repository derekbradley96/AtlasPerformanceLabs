import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getClientByUserId } from '@/data/selectors';
import { getAllPoses } from '@/lib/repos/poseLibraryRepo';
import { listMedia } from '@/lib/repos/compPrepRepo';
import { getClientCompProfile } from '@/lib/repos/compPrepRepo';
import { impactLight } from '@/lib/haptics';
import Card from '@/ui/Card';
import { colors, spacing } from '@/ui/tokens';

const FEDERATIONS = ['PCA', '2BROS', 'OTHER'];
const SEX_OPTIONS = [{ value: '', label: 'All' }, { value: 'MALE', label: 'Male' }, { value: 'FEMALE', label: 'Female' }];
const DIVISIONS = ['BODYBUILDING', 'CLASSIC', 'PHYSIQUE', 'BIKINI', 'FIGURE', 'WELLNESS'];

export default function PoseLibrary() {
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const [federation, setFederation] = useState('');
  const [sex, setSex] = useState('');
  const [division, setDivision] = useState('');
  const [mandatoryOnly, setMandatoryOnly] = useState(false);

  const clientId = useMemo(() => {
    if (role !== 'client' || !user?.id) return null;
    const c = getClientByUserId(user.id);
    return c?.id ?? null;
  }, [role, user?.id]);

  const profile = useMemo(() => (clientId ? getClientCompProfile(clientId) : null), [clientId]);
  const effectiveFederation = federation || profile?.federation || '';
  const effectiveDivision = division || profile?.division || '';
  const effectiveSex = sex || (profile?.sex ?? '');

  const allPoses = useMemo(() => getAllPoses(), []);

  const filteredPoses = useMemo(() => {
    let list = allPoses;
    if (effectiveSex) list = list.filter((p) => p.sex === effectiveSex);
    if (effectiveDivision) list = list.filter((p) => p.divisions.includes(effectiveDivision));
    if (effectiveFederation) list = list.filter((p) => p.judgeNotes.some((j) => j.federation === effectiveFederation));
    if (mandatoryOnly) list = list.filter((p) => p.isMandatory);
    return [...list].sort((a, b) => (a.isMandatory === b.isMandatory ? 0 : a.isMandatory ? -1 : 1));
  }, [allPoses, effectiveSex, effectiveDivision, effectiveFederation, mandatoryOnly]);

  const mediaByPose = useMemo(() => {
    if (!clientId) return {};
    const list = listMedia(clientId);
    const byPose = {};
    list.forEach((m) => {
      if (m.poseId && (!byPose[m.poseId] || new Date(m.createdAt) > new Date(byPose[m.poseId].createdAt))) {
        byPose[m.poseId] = m;
      }
    });
    return byPose;
  }, [clientId]);

  const handlePose = (poseId) => {
    impactLight();
    navigate(`/comp-prep/poses/${poseId}`);
  };

  return (
    <div
      className="app-screen min-w-0 max-w-full overflow-x-hidden"
      style={{
        minHeight: '100%',
        background: colors.bg,
        color: colors.text,
        paddingLeft: spacing[16],
        paddingRight: spacing[16],
        paddingBottom: `calc(${spacing[16]} + env(safe-area-inset-bottom, 0px))`,
      }}
    >
      <h1 className="text-lg font-semibold mb-1">Pose Library</h1>
      <p className="text-sm mb-4" style={{ color: colors.muted }}>
        Filter by federation, sex, division. Mandatory poses first.
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={federation}
          onChange={(e) => setFederation(e.target.value)}
          className="rounded-lg border bg-slate-800 text-white text-sm"
          style={{ padding: '8px 12px', borderColor: colors.border }}
        >
          <option value="">Federation</option>
          {FEDERATIONS.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <select
          value={sex}
          onChange={(e) => setSex(e.target.value)}
          className="rounded-lg border bg-slate-800 text-white text-sm"
          style={{ padding: '8px 12px', borderColor: colors.border }}
        >
          {SEX_OPTIONS.map((o) => (
            <option key={o.value || 'all'} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={division}
          onChange={(e) => setDivision(e.target.value)}
          className="rounded-lg border bg-slate-800 text-white text-sm"
          style={{ padding: '8px 12px', borderColor: colors.border }}
        >
          <option value="">Division</option>
          {DIVISIONS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm" style={{ color: colors.muted }}>
          <input
            type="checkbox"
            checked={mandatoryOnly}
            onChange={(e) => setMandatoryOnly(e.target.checked)}
            className="rounded border-slate-600"
          />
          Mandatory only
        </label>
      </div>

      {filteredPoses.length === 0 ? (
        <Card style={{ padding: spacing[24], textAlign: 'center' }}>
          <p className="text-sm" style={{ color: colors.muted }}>
            No poses match the filter. Try changing federation, sex, or division.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredPoses.map((pose) => {
            const lastLog = mediaByPose[pose.id];
            return (
              <Card
                key={pose.id}
                style={{ padding: spacing[16], cursor: 'pointer' }}
                onClick={() => handlePose(pose.id)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{pose.name}</span>
                      {pose.isMandatory && (
                        <span
                          className="px-2 py-0.5 rounded text-xs font-medium"
                          style={{ background: 'rgba(37, 99, 235, 0.2)', color: colors.accent }}
                        >
                          Mandatory
                        </span>
                      )}
                    </div>
                    {lastLog && (
                      <p className="text-xs mt-1" style={{ color: colors.muted }}>
                        Last submitted {new Date(lastLog.createdAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <span style={{ color: colors.muted }}>›</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
