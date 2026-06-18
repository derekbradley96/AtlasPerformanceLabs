/**
 * Coach free-text with local staging; Supabase writes only on explicit confirm.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { deleteSavedTerm, getSavedTerms, saveTerm } from '@/lib/coachSavedTerms';
import { colors, spacing, touchTargetMin } from '@/ui/tokens';

const HINT_KEY = 'atlas_coach_input_hint_seen_v1';

/** @typedef {'supplement'|'nutrition_note'|'programme_note'|'checkin_tag'|'instruction'|'general'} CoachTermCategory */

/**
 * @param {{
 *   category: CoachTermCategory | string;
 *   placeholder: string;
 *   onConfirm: (terms: string[]) => void;
 *   label?: string;
 *   maxTerms?: number;
 *   allowMultiple?: boolean;
 * }} props
 */
export default function CoachFreeTextInput({
  category,
  placeholder,
  onConfirm,
  label,
  maxTerms = 5,
  allowMultiple = true,
}) {
  const { user, isDemoMode } = useAuth();
  const [inputValue, setInputValue] = useState('');
  const [stagedTerms, setStagedTerms] = useState([]);
  const [savedTerms, setSavedTerms] = useState([]);
  const [filteredSaved, setFilteredSaved] = useState([]);
  const [hintDismissed, setHintDismissed] = useState(() => {
    try {
      return typeof window !== 'undefined' && window.localStorage?.getItem(HINT_KEY) === '1';
    } catch {
      return true;
    }
  });

  const supabase = useMemo(() => (hasSupabase ? getSupabase() : null), []);
  const coachId = user?.id ?? null;

  const refreshSaved = useCallback(async () => {
    if (!coachId || !supabase || isDemoMode) {
      setSavedTerms([]);
      return;
    }
    const list = await getSavedTerms(supabase, coachId, category);
    setSavedTerms(list);
  }, [coachId, supabase, category, isDemoMode]);

  useEffect(() => {
    void refreshSaved();
  }, [refreshSaved]);

  useEffect(() => {
    if (!inputValue.trim()) {
      setFilteredSaved(savedTerms.slice(0, 8));
      return;
    }
    const lower = inputValue.toLowerCase();
    setFilteredSaved(
      savedTerms.filter((t) => t.toLowerCase().includes(lower)).slice(0, 6),
    );
  }, [inputValue, savedTerms]);

  const showFirstUseHint = useMemo(
    () =>
      !hintDismissed
      && savedTerms.length === 0
      && !inputValue.trim()
      && stagedTerms.length === 0,
    [hintDismissed, savedTerms.length, inputValue, stagedTerms.length],
  );

  const markHintSeen = useCallback(() => {
    try {
      window.localStorage?.setItem(HINT_KEY, '1');
    } catch {
      /* ignore */
    }
    setHintDismissed(true);
  }, []);

  const canAddMore = stagedTerms.length < maxTerms;

  const handleAddFromInput = useCallback(() => {
    const val = inputValue.trim();
    if (!val) return;
    if (!canAddMore) return;
    if (stagedTerms.includes(val)) {
      setInputValue('');
      return;
    }
    if (!allowMultiple) {
      setStagedTerms([val]);
    } else {
      setStagedTerms((prev) => [...prev, val]);
    }
    setInputValue('');
  }, [inputValue, stagedTerms, allowMultiple, canAddMore]);

  const handleAddSavedTerm = useCallback(
    (term) => {
      if (stagedTerms.includes(term)) return;
      if (!canAddMore) return;
      if (!allowMultiple) {
        setStagedTerms([term]);
        return;
      }
      setStagedTerms((prev) => [...prev, term]);
    },
    [stagedTerms, allowMultiple, canAddMore],
  );

  const handleRemoveStaged = useCallback((term) => {
    setStagedTerms((prev) => prev.filter((t) => t !== term));
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!coachId || !supabase || isDemoMode) return;
    const trimmedInput = inputValue.trim();
    const allTerms =
      trimmedInput && !stagedTerms.includes(trimmedInput)
        ? [...stagedTerms, trimmedInput]
        : [...stagedTerms];
    const unique = [...new Set(allTerms.map((t) => String(t).trim()).filter(Boolean))];
    if (!unique.length) return;

    for (const term of unique) {
      await saveTerm(supabase, coachId, category, term);
    }
    await refreshSaved();
    onConfirm(unique);
    markHintSeen();
    setStagedTerms([]);
    setInputValue('');
  }, [
    coachId,
    supabase,
    isDemoMode,
    inputValue,
    stagedTerms,
    category,
    onConfirm,
    refreshSaved,
    markHintSeen,
  ]);

  const handleDeleteSaved = useCallback(
    async (term, e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!coachId || !supabase || isDemoMode) return;
      await deleteSavedTerm(supabase, coachId, category, term);
      setSavedTerms((prev) => prev.filter((t) => t !== term));
    },
    [coachId, supabase, category, isDemoMode],
  );

  const confirmLabel = useMemo(() => {
    const inputTrim = inputValue.trim();
    const pendingInput = inputTrim && !stagedTerms.includes(inputTrim);
    const total = stagedTerms.length + (pendingInput ? 1 : 0);
    if (total <= 0) return 'Confirm';
    if (total === 1) {
      const only = pendingInput ? inputTrim : stagedTerms[0];
      return `Add "${only}"`;
    }
    return `Add ${total} items`;
  }, [stagedTerms, inputValue]);

  const showConfirm = stagedTerms.length > 0 || inputValue.trim().length > 0;

  if (!coachId || isDemoMode) {
    return (
      <p style={{ fontSize: 12, color: colors.muted, margin: 0 }}>
        Sign in as coach (live mode) to use saved term memory.
      </p>
    );
  }

  return (
    <div style={{ width: '100%' }}>
      {label ? (
        <p
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: colors.muted,
            marginBottom: 6,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {label}
        </p>
      ) : null}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAddFromInput();
            }
            if (e.key === 'Tab' && inputValue.trim()) {
              e.preventDefault();
              handleAddFromInput();
            }
          }}
          placeholder={placeholder}
          style={{
            flex: 1,
            minHeight: touchTargetMin,
            borderRadius: 8,
            border: `1px solid ${colors.border}`,
            background: colors.surface1,
            color: colors.text,
            fontSize: 14,
            padding: '0 12px',
          }}
        />
        {inputValue.trim() ? (
          <button
            type="button"
            onClick={handleAddFromInput}
            disabled={!canAddMore}
            style={{
              minHeight: touchTargetMin,
              padding: '0 12px',
              borderRadius: 8,
              border: `1px solid ${colors.border}`,
              background: colors.surface1,
              color: colors.primary,
              fontSize: 13,
              fontWeight: 500,
              cursor: canAddMore ? 'pointer' : 'not-allowed',
              whiteSpace: 'nowrap',
              opacity: canAddMore ? 1 : 0.45,
            }}
          >
            Add
          </button>
        ) : null}
      </div>

      {showFirstUseHint ? (
        <p style={{ marginTop: spacing[8], fontSize: 12, color: colors.muted, lineHeight: 1.45, marginBottom: 0 }}>
          Start typing — your entries are remembered for next time. Press Enter or tap Add to stage a term, then
          confirm to save.
        </p>
      ) : null}

      {filteredSaved.length > 0 ? (
        <div style={{ marginTop: 10 }}>
          <p style={{ fontSize: 11, color: colors.muted, marginBottom: 5 }}>
            {inputValue.trim() ? 'Matching previous entries' : 'Your previous entries'}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {filteredSaved.map((term) => {
              const isAlreadyStaged = stagedTerms.includes(term);
              return (
                <div
                  key={term}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (!isAlreadyStaged) handleAddSavedTerm(term);
                    }
                  }}
                  onClick={() => !isAlreadyStaged && handleAddSavedTerm(term)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    minHeight: touchTargetMin,
                    padding: '4px 10px',
                    borderRadius: 20,
                    border: `1px solid ${isAlreadyStaged ? colors.primary : colors.border}`,
                    background: isAlreadyStaged ? colors.primarySubtle : colors.surface1,
                    cursor: isAlreadyStaged ? 'default' : 'pointer',
                    fontSize: 13,
                    color: isAlreadyStaged ? colors.primary : colors.text,
                    transition: 'all 150ms',
                    userSelect: 'none',
                  }}
                >
                  {isAlreadyStaged ? (
                    <span style={{ fontSize: 10, color: colors.primary }}>✓</span>
                  ) : null}
                  <span>{term}</span>
                  <button
                    type="button"
                    title="Remove from memory"
                    aria-label={`Remove ${term} from memory`}
                    onClick={(e) => void handleDeleteSaved(term, e)}
                    style={{
                      fontSize: 11,
                      color: colors.muted,
                      cursor: 'pointer',
                      marginLeft: 2,
                      lineHeight: 1,
                      padding: '4px 6px',
                      border: 'none',
                      background: 'transparent',
                      minWidth: touchTargetMin,
                      minHeight: 32,
                    }}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {stagedTerms.length > 0 ? (
        <div style={{ marginTop: 10 }}>
          <p style={{ fontSize: 11, color: colors.muted, marginBottom: 5 }}>Ready to add:</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {stagedTerms.map((term) => (
              <div
                key={term}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  minHeight: touchTargetMin,
                  padding: '4px 10px',
                  borderRadius: 20,
                  border: `1px solid ${colors.warning}`,
                  background: colors.warningSubtle,
                  fontSize: 13,
                  color: colors.warning,
                }}
              >
                {term}
                <button
                  type="button"
                  onClick={() => handleRemoveStaged(term)}
                  aria-label={`Remove ${term} from staged`}
                  style={{
                    fontSize: 11,
                    cursor: 'pointer',
                    color: colors.warning,
                    marginLeft: 2,
                    padding: '4px 6px',
                    border: 'none',
                    background: 'transparent',
                    minWidth: 32,
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {showConfirm ? (
        <button
          type="button"
          onClick={() => void handleConfirm()}
          style={{
            marginTop: 12,
            width: '100%',
            minHeight: touchTargetMin,
            borderRadius: 8,
            border: 'none',
            background: colors.primary,
            color: '#fff',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          {confirmLabel}
        </button>
      ) : null}
    </div>
  );
}
