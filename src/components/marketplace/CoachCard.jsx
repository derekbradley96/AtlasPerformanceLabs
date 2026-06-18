import React, { useState, useEffect, useCallback } from 'react';
import Button from '@/ui/Button';
import { colors, spacing, shell, radii, touchTargetMin } from '@/ui/tokens';
import { ChevronRight, Bookmark, MessageCircle } from 'lucide-react';
import { coachInitials, isMarketplaceCoachSavedId, setMarketplaceCoachSaved } from '@/lib/marketplaceCoachCardModel';
import { isEliteTier } from '@/config/plans';
import { COACH_CARD_ACTION_STATE } from '@/lib/marketplaceCoachCardModel';
import PillarRating from '@/components/marketplace/PillarRating';

const VARIANT_SURFACE = {
  standard: {
    border: '1px solid rgba(255,255,255,0.1)',
    shadow: '0 4px 24px rgba(0,0,0,0.16)',
    glow: 'none',
  },
  best_match: {
    border: '1px solid rgba(59, 130, 246, 0.45)',
    shadow: '0 6px 32px rgba(37, 99, 235, 0.14)',
    glow: '0 0 0 1px rgba(59, 130, 246, 0.12)',
  },
  prep_focus: {
    border: '1px solid rgba(192, 132, 252, 0.32)',
    shadow: '0 4px 26px rgba(0,0,0,0.18)',
    glow: 'none',
  },
  accountability: {
    border: '1px solid rgba(52, 211, 153, 0.28)',
    shadow: '0 4px 24px rgba(0,0,0,0.16)',
    glow: 'none',
  },
  advanced_refinement: {
    border: '1px solid rgba(129, 140, 248, 0.32)',
    shadow: '0 4px 26px rgba(0,0,0,0.17)',
    glow: 'none',
  },
};

function TagPill({ children }) {
  return (
    <span
      className="inline-block text-[11px] font-semibold"
      style={{
        padding: '4px 10px',
        borderRadius: radii.pill,
        background: 'rgba(255,255,255,0.05)',
        border: `1px solid ${colors.border}`,
        color: colors.muted,
      }}
    >
      {children}
    </span>
  );
}

function CoachAvatar({ url, name, size }) {
  const [broken, setBroken] = useState(false);
  const initials = coachInitials(name);
  const showImg = url && !broken;

  return (
    <div
      className="shrink-0 overflow-hidden flex items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: 18,
        background: colors.surface2,
        border: `1px solid ${colors.border}`,
      }}
    >
      {showImg ? (
        <img
          src={url}
          alt=""
          className="w-full h-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="text-sm font-bold" style={{ color: colors.muted }}>
          {initials}
        </span>
      )}
    </div>
  );
}

/**
 * High-converting marketplace coach tile — web (horizontal) vs app (stacked) layout.
 *
 * @param {Object} props
 * @param {string} props.coachId
 * @param {'standard'|'best_match'|'prep_focus'|'accountability'|'advanced_refinement'} props.variant
 * @param {boolean} props.showBestMatchBadge
 * @param {string} props.coachName
 * @param {string} props.coachHeadline
 * @param {string|null} props.coachAvatarUrl
 * @param {string|null} [props.planTier] - profiles.plan_tier for Elite badge
 * @param {string[]} props.tags
 * @param {string|null} props.matchReason
 * @param {{ label: string }[]} props.trustItems
 * @param {string} props.pricingDisplay
 * @param {'listed'|'contact'} props.pricingMode
 * @param {boolean} props.isWideWeb website shell vs app shell
 * @param {() => void} props.onViewProfile
 * @param {boolean} [props.showSave]
 * @param {boolean} [props.showMessage]
 * @param {() => void} [props.onMessage]
 * @param {'view_profile_primary'|'message_primary'|'apply_primary'} [props.actionState]
 */
export default function CoachCard({
  coachId,
  variant = 'standard',
  showBestMatchBadge = false,
  coachName,
  coachHeadline,
  coachAvatarUrl,
  avgPillars = null,
  reviewCount = 0,
  planTier = null,
  tags = [],
  matchReason,
  trustItems = [],
  pricingDisplay,
  pricingMode = 'contact',
  isWideWeb = false,
  onViewProfile,
  showSave = true,
  showMessage = false,
  onMessage,
  actionState = COACH_CARD_ACTION_STATE.VIEW_PROFILE_PRIMARY,
}) {
  const surface = VARIANT_SURFACE[variant] || VARIANT_SURFACE.standard;
  const [hover, setHover] = useState(false);
  const [saved, setSaved] = useState(() => isMarketplaceCoachSavedId(coachId));

  useEffect(() => {
    setSaved(isMarketplaceCoachSavedId(coachId));
  }, [coachId]);

  const toggleSave = useCallback(() => {
    const next = !saved;
    setSaved(next);
    setMarketplaceCoachSaved(coachId, next);
  }, [coachId, saved]);

  const avatarSize = isWideWeb ? 64 : 56;
  const lift =
    isWideWeb && hover
      ? { transform: 'translateY(-2px)', boxShadow: '0 14px 40px rgba(0,0,0,0.28)' }
      : { transform: 'none', boxShadow: surface.shadow };

  const trustVisible = (trustItems || []).slice(0, 3);
  const tagRow = (tags || []).slice(0, 4);
  const primaryAction = (() => {
    if (actionState === COACH_CARD_ACTION_STATE.MESSAGE_PRIMARY) {
      return {
        label: 'Message coach',
        onClick: typeof onMessage === 'function' ? onMessage : onViewProfile,
      };
    }
    if (actionState === COACH_CARD_ACTION_STATE.APPLY_PRIMARY) {
      return {
        label: 'Apply to coach',
        onClick: onViewProfile,
      };
    }
    return { label: 'View profile', onClick: onViewProfile };
  })();
  const showViewSecondary = actionState !== COACH_CARD_ACTION_STATE.VIEW_PROFILE_PRIMARY;
  const showMessageSecondary =
    showMessage &&
    typeof onMessage === 'function' &&
    actionState !== COACH_CARD_ACTION_STATE.MESSAGE_PRIMARY;

  const bodyBlock = (
    <>
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <h3
          className="m-0 font-extrabold tracking-tight truncate"
          style={{
            fontSize: isWideWeb ? 19 : 18,
            color: colors.text,
            lineHeight: 1.2,
            maxWidth: '100%',
          }}
        >
          {coachName}
        </h3>
        {showBestMatchBadge ? (
          <span
            className="shrink-0 text-[10px] font-bold uppercase tracking-wider"
            style={{
              padding: '3px 8px',
              borderRadius: radii.pill,
              background: 'rgba(37, 99, 235, 0.2)',
              color: colors.primary,
              border: '1px solid rgba(59, 130, 246, 0.35)',
            }}
          >
            Best match
          </span>
        ) : null}
        {isEliteTier(planTier) ? (
          <span
            className="shrink-0 text-[10px] font-bold uppercase tracking-wider"
            style={{
              padding: '3px 8px',
              borderRadius: radii.pill,
              background: 'rgba(245, 158, 11, 0.22)',
              color: '#B45309',
              border: '1px solid rgba(217, 119, 6, 0.45)',
            }}
          >
            ⚡ Elite
          </span>
        ) : null}
      </div>

      <p
        className="m-0 font-semibold leading-snug"
        style={{
          marginTop: spacing[6],
          fontSize: 14,
          color: colors.text,
          opacity: 0.88,
        }}
      >
        {coachHeadline}
      </p>
      <div style={{ marginTop: spacing[8] }}>
        <PillarRating
          pillars={avgPillars ?? null}
          reviewCount={reviewCount ?? 0}
          size="sm"
          showNumber={!!(avgPillars && reviewCount > 0)}
          showCount={true}
        />
      </div>

      {tagRow.length > 0 ? (
        <div className="flex flex-wrap" style={{ marginTop: spacing[10], gap: spacing[6] }}>
          {tagRow.map((t) => (
            <TagPill key={t}>{t}</TagPill>
          ))}
        </div>
      ) : null}

      {matchReason ? (
        <p
          className="m-0 text-[13px] leading-relaxed"
          style={{
            marginTop: spacing[10],
            color: colors.muted,
          }}
        >
          {matchReason}
        </p>
      ) : null}

      {trustVisible.length > 0 ? (
        <p
          className="m-0 text-[11px] font-medium leading-normal"
          style={{
            marginTop: spacing[10],
            color: colors.muted,
            opacity: 0.85,
          }}
        >
          {trustVisible.map((t, i) => (
            <span key={`${t.label}-${i}`}>
              {i > 0 ? <span style={{ opacity: 0.45 }}> · </span> : null}
              {t.label}
            </span>
          ))}
        </p>
      ) : null}

      <p
        className="m-0"
        style={{
          marginTop: spacing[12],
          fontSize: 15,
          fontWeight: 700,
          color: pricingMode === 'contact' ? colors.primary : colors.text,
          letterSpacing: '-0.01em',
        }}
      >
        {pricingDisplay}
      </p>

      <div
        style={{
          marginTop: spacing[14],
          display: 'flex',
          flexDirection: isWideWeb ? 'row' : 'column',
          gap: spacing[8],
          alignItems: isWideWeb ? 'center' : 'stretch',
        }}
      >
        <Button
          variant="primary"
          onClick={primaryAction.onClick}
          className="justify-center"
          style={{
            flex: isWideWeb ? 1 : undefined,
            minHeight: touchTargetMin + 2,
            fontWeight: 700,
            width: isWideWeb ? undefined : '100%',
          }}
        >
          {primaryAction.label}
          <ChevronRight size={17} className="ml-1 inline" strokeWidth={2.25} />
        </Button>
        {showViewSecondary ? (
          <button
            type="button"
            onClick={onViewProfile}
            className="inline-flex items-center justify-center gap-2 font-semibold text-sm"
            style={{
              minHeight: touchTargetMin,
              padding: `0 ${spacing[10]}px`,
              color: colors.primary,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            View profile
          </button>
        ) : null}
        {showSave ? (
          <button
            type="button"
            onClick={toggleSave}
            className="inline-flex items-center justify-center gap-2 font-semibold text-sm rounded-xl border"
            style={{
              minHeight: touchTargetMin + 2,
              padding: `0 ${spacing[14]}px`,
              borderColor: saved ? colors.primary : colors.border,
              background: saved ? colors.primarySubtle : colors.surface2,
              color: saved ? colors.primary : colors.text,
              flexShrink: 0,
            }}
            aria-pressed={saved}
          >
            <Bookmark size={17} fill={saved ? 'currentColor' : 'none'} aria-hidden />
            {saved ? 'Saved' : 'Save'}
          </button>
        ) : null}
        {showMessageSecondary ? (
          <button
            type="button"
            onClick={onMessage}
            className="inline-flex items-center justify-center gap-2 font-semibold text-sm"
            style={{
              minHeight: touchTargetMin,
              padding: `0 ${spacing[10]}px`,
              color: colors.primary,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <MessageCircle size={17} aria-hidden />
            Message
          </button>
        ) : null}
      </div>
    </>
  );

  return (
    <article
      onMouseEnter={() => isWideWeb && setHover(true)}
      onMouseLeave={() => isWideWeb && setHover(false)}
      style={{
        borderRadius: shell.cardRadius,
        border: surface.border,
        background: colors.surface1,
        padding: isWideWeb ? spacing[18] : spacing[16],
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        boxShadow: lift.boxShadow,
        transform: lift.transform,
        outline: surface.glow,
      }}
    >
      {isWideWeb ? (
        <div className="flex gap-4" style={{ alignItems: 'flex-start' }}>
          <CoachAvatar url={coachAvatarUrl} name={coachName} size={avatarSize} />
          <div className="min-w-0 flex-1">{bodyBlock}</div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex gap-3" style={{ alignItems: 'center' }}>
            <CoachAvatar url={coachAvatarUrl} name={coachName} size={avatarSize} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3
                  className="m-0 font-extrabold truncate"
                  style={{ fontSize: 18, color: colors.text, lineHeight: 1.2 }}
                >
                  {coachName}
                </h3>
                {showBestMatchBadge ? (
                  <span
                    className="shrink-0 text-[10px] font-bold uppercase tracking-wider"
                    style={{
                      padding: '3px 8px',
                      borderRadius: radii.pill,
                      background: 'rgba(37, 99, 235, 0.2)',
                      color: colors.primary,
                      border: '1px solid rgba(59, 130, 246, 0.35)',
                    }}
                  >
                    Best match
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="min-w-0">
            <p
              className="m-0 font-semibold leading-snug"
              style={{ fontSize: 14, color: colors.text, opacity: 0.88 }}
            >
              {coachHeadline}
            </p>
            <div style={{ marginTop: spacing[8] }}>
              <PillarRating
                pillars={avgPillars ?? null}
                reviewCount={reviewCount ?? 0}
                size="sm"
                showNumber={!!(avgPillars && reviewCount > 0)}
                showCount={true}
              />
            </div>
            {tagRow.length > 0 ? (
              <div className="flex flex-wrap" style={{ marginTop: spacing[10], gap: spacing[6] }}>
                {tagRow.map((t) => (
                  <TagPill key={t}>{t}</TagPill>
                ))}
              </div>
            ) : null}
            {matchReason ? (
              <p className="m-0 text-[13px] leading-relaxed" style={{ marginTop: spacing[10], color: colors.muted }}>
                {matchReason}
              </p>
            ) : null}
            {trustVisible.length > 0 ? (
              <p
                className="m-0 text-[11px] font-medium"
                style={{ marginTop: spacing[10], color: colors.muted, opacity: 0.85 }}
              >
                {trustVisible.map((t, i) => (
                  <span key={`${t.label}-${i}`}>
                    {i > 0 ? <span style={{ opacity: 0.45 }}> · </span> : null}
                    {t.label}
                  </span>
                ))}
              </p>
            ) : null}
            <p
              className="m-0"
              style={{
                marginTop: spacing[12],
                fontSize: 15,
                fontWeight: 700,
                color: pricingMode === 'contact' ? colors.primary : colors.text,
              }}
            >
              {pricingDisplay}
            </p>
            <div
              style={{
                marginTop: spacing[14],
                display: 'flex',
                flexDirection: 'column',
                gap: spacing[8],
              }}
            >
              <Button variant="primary" onClick={onViewProfile} className="justify-center w-full" style={{ minHeight: touchTargetMin + 2, fontWeight: 700 }}>
                {primaryAction.label}
                <ChevronRight size={17} className="ml-1 inline" strokeWidth={2.25} />
              </Button>
              <div className="flex flex-wrap gap-2">
                {showViewSecondary ? (
                  <button
                    type="button"
                    onClick={onViewProfile}
                    className="inline-flex flex-1 items-center justify-center gap-2 font-semibold text-sm min-h-[48px] rounded-xl border"
                    style={{
                      borderColor: colors.border,
                      background: colors.surface2,
                      color: colors.primary,
                    }}
                  >
                    View profile
                  </button>
                ) : null}
                {showSave ? (
                  <button
                    type="button"
                    onClick={toggleSave}
                    className="inline-flex flex-1 items-center justify-center gap-2 font-semibold text-sm rounded-xl border min-h-[48px]"
                    style={{
                      borderColor: saved ? colors.primary : colors.border,
                      background: saved ? colors.primarySubtle : colors.surface2,
                      color: saved ? colors.primary : colors.text,
                      minWidth: 120,
                    }}
                    aria-pressed={saved}
                  >
                    <Bookmark size={17} fill={saved ? 'currentColor' : 'none'} aria-hidden />
                    {saved ? 'Saved' : 'Save'}
                  </button>
                ) : null}
                {showMessageSecondary ? (
                  <button
                    type="button"
                    onClick={onMessage}
                    className="inline-flex flex-1 items-center justify-center gap-2 font-semibold text-sm min-h-[48px] rounded-xl border"
                    style={{
                      borderColor: colors.border,
                      background: colors.surface2,
                      color: colors.primary,
                    }}
                  >
                    <MessageCircle size={17} aria-hidden />
                    Message
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
