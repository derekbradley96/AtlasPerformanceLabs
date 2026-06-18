import { useState, useEffect, useRef, useCallback } from 'react';
import { getSupabase } from '@/lib/supabaseClient';
import {
  CALL_ACTIVE_STATUSES,
  finalizeCallOnHangup,
  markCallInProgress,
} from '@/lib/callRequestState';
import { trackRecoverableError } from '@/services/frictionTracker';

const ICE_SERVERS = [
  {
    urls: [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
    ],
  },
  {
    urls: [
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:443',
      'turns:openrelay.metered.ca:443',
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];
export const ACTIVE_SIGNAL_STATUSES = CALL_ACTIVE_STATUSES;

export function canCalleeUseOfferRow(row) {
  return !!(
    row?.sdp_offer
    && !row?.sdp_answer
    && ACTIVE_SIGNAL_STATUSES.includes(String(row?.status || ''))
  );
}

export function useWebRTC({
  callRequestId,
  role,
  active,
  onEnd,
  displayName,
}) {
  const [connectionState, setConnectionState] = useState('idle');
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [error, setError] = useState(null);

  const pc = useRef(null);
  const channelRef = useRef(null);
  const localStreamRef = useRef(null);
  const onEndRef = useRef(onEnd);
  const displayNameRef = useRef(displayName);
  const iceCandidatesRef = useRef([]);
  const pendingIceRef = useRef([]);
  const restartAttemptsRef = useRef(0);

  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  useEffect(() => {
    displayNameRef.current = displayName;
  }, [displayName]);

  const cleanup = useCallback(() => {
    restartAttemptsRef.current = 0;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    pc.current?.close();
    pc.current = null;
    const supabase = getSupabase();
    if (channelRef.current && supabase) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    setConnectionState('ended');
  }, []);

  const hangUp = useCallback(() => {
    const supabase = getSupabase();
    if (supabase && callRequestId) {
      void finalizeCallOnHangup({
        supabase,
        callRequestId,
        connectionState,
      });
    }
    channelRef.current?.send({
      type: 'broadcast', event: 'hangup', payload: {},
    });
    cleanup();
  }, [cleanup, callRequestId, connectionState]);

  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setMicEnabled((e) => !e);
  }, []);

  const toggleCam = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setCamEnabled((e) => !e);
  }, []);

  async function safeAddCandidate(conn, candidate) {
    if (!conn || !candidate) return;
    if (!conn.remoteDescription) {
      pendingIceRef.current.push(candidate);
      return;
    }
    try {
      await conn.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (_) {}
  }

  async function flushPendingIce(conn) {
    if (!conn?.remoteDescription) return;
    const queued = pendingIceRef.current.splice(0, pendingIceRef.current.length);
    for (const c of queued) {
      try {
        await conn.addIceCandidate(new RTCIceCandidate(c));
      } catch (_) {}
    }
  }

  async function flushStoredIce(conn, supabase, isCaller) {
    if (!conn || !supabase) return;
    const col = isCaller ? 'callee_ice' : 'caller_ice';
    const { data } = await supabase
      .from('checkin_call_requests')
      .select(col)
      .eq('id', callRequestId)
      .maybeSingle();
    const candidates = data?.[col] ?? [];
    for (const c of candidates) {
      await safeAddCandidate(conn, c);
    }
  }

  async function storeIceCandidate(supabase, isCaller, candidate) {
    if (!supabase || !candidate) return;
    const col = isCaller ? 'caller_ice' : 'callee_ice';
    await supabase.rpc('append_ice_candidate', {
      p_id: callRequestId,
      p_column: col,
      p_candidate: candidate,
    }).catch(async () => {
      await supabase
        .from('checkin_call_requests')
        .select(col)
        .eq('id', callRequestId)
        .maybeSingle()
        .then(async ({ data }) => {
          const arr = [...(data?.[col] ?? []), candidate];
          await supabase
            .from('checkin_call_requests')
            .update({ [col]: arr, updated_at: new Date().toISOString() })
            .eq('id', callRequestId);
        });
    });
  }

  useEffect(() => {
    if (!active || !callRequestId) return undefined;
    let cancelled = false;
    const isCaller = role === 'caller';

    async function start() {
      const attemptNonce = Math.random().toString(36).slice(2, 8);
      setConnectionState('connecting');
      setError(null);
      iceCandidatesRef.current = [];
      pendingIceRef.current = [];
      restartAttemptsRef.current = 0;

      try {
        const supabase = getSupabase();
        if (!supabase) throw new Error('No Supabase connection');

        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        setLocalStream(stream);

        const conn = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        pc.current = conn;
        let markedInProgress = false;

        const tryMarkCallInProgress = async () => {
          if (markedInProgress) return;
          markedInProgress = true;
          try {
            await markCallInProgress({
              supabase,
              callRequestId,
            });
          } catch (_) {}
        };

        stream.getTracks().forEach((track) => conn.addTrack(track, stream));

        const remoteMediaStream = new MediaStream();
        setRemoteStream(remoteMediaStream);

        conn.ontrack = (e) => {
          e.streams[0]?.getTracks().forEach((track) => {
            remoteMediaStream.addTrack(track);
          });
        };

        conn.oniceconnectionstatechange = () => {
          if (cancelled) return;
          const s = conn.iceConnectionState;
          if (s === 'connected' || s === 'completed') {
            restartAttemptsRef.current = 0;
            setError(null);
            setConnectionState('connected');
            void tryMarkCallInProgress();
          } else if (s === 'disconnected') {
            // Common transient state. Prefer recovery over hard-fail.
            setConnectionState('connecting');
            if (conn.signalingState === 'stable') {
              try {
                conn.restartIce();
              } catch (_) {}
            }
          } else if (s === 'failed') {
            // Try a few ICE restarts before declaring failure.
            if (
              restartAttemptsRef.current < 3
              && conn.signalingState === 'stable'
            ) {
              restartAttemptsRef.current += 1;
              setConnectionState('connecting');
              try {
                conn.restartIce();
                return;
              } catch (_) {}
            }
            setConnectionState('failed');
            setError('Connection failed. Check your network.');
          } else if (s === 'closed') {
            restartAttemptsRef.current = 0;
          }
        };

        conn.onconnectionstatechange = () => {
          if (cancelled) return;
          if (conn.connectionState === 'connected') {
            setConnectionState('connected');
            void tryMarkCallInProgress();
          }
        };

        if (isCaller) {
          const channel = supabase.channel(`call:${callRequestId}:${attemptNonce}`, {
            config: { broadcast: { self: false } },
          });
          channelRef.current = channel;

          channel.on('broadcast', { event: 'ice' }, async ({ payload }) => {
            if (cancelled) return;
            await safeAddCandidate(pc.current, payload);
          });

          channel.on('broadcast', { event: 'hangup' }, () => {
            if (cancelled) return;
            cleanup();
            onEndRef.current?.();
          });

          const applyAnswerIfPresent = async (row) => {
            if (cancelled || !pc.current) return false;
            if (
              row?.sdp_answer
              && pc.current.signalingState === 'have-local-offer'
            ) {
              try {
                await pc.current.setRemoteDescription(
                  new RTCSessionDescription({
                    type: 'answer',
                    sdp: row.sdp_answer,
                  }),
                );
                await flushStoredIce(pc.current, supabase, true);
                await flushPendingIce(pc.current);
                return true;
              } catch (e) {
                console.error('[WebRTC] setRemoteDescription:', e);
                trackRecoverableError('useWebRTC', 'setRemoteDescription', e);
              }
            }
            return false;
          };

          channel.on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'checkin_call_requests',
              filter: `id=eq.${callRequestId}`,
            },
            async ({ new: row }) => {
              if (cancelled || !pc.current) return;

              if (row.status === 'declined') {
                setConnectionState('declined');
                setError('Call declined.');
                cleanup();
                return;
              }

              await applyAnswerIfPresent(row);

              if (row.callee_ice?.length) {
                for (const c of row.callee_ice) {
                  await safeAddCandidate(pc.current, c);
                }
              }
            },
          );

          conn.onicecandidate = async ({ candidate }) => {
            if (!candidate || cancelled) return;
            const json = candidate.toJSON();
            channel.send({
              type: 'broadcast', event: 'ice', payload: json,
            });
            await storeIceCandidate(supabase, true, json);
          };

          await new Promise((resolve, reject) => {
            const t = setTimeout(() => reject(new Error('Channel subscribe timeout')), 8000);
            channel.subscribe((status) => {
              if (status === 'SUBSCRIBED') {
                clearTimeout(t);
                resolve();
              }
              if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                clearTimeout(t);
                reject(new Error(`Channel: ${status}`));
              }
            });
          });

          // STEP A: wipe stale data from any previous call.
          const { error: resetErr } = await supabase
            .from('checkin_call_requests')
            .update({
              sdp_offer: null,
              sdp_answer: null,
              caller_ice: [],
              callee_ice: [],
              status: 'ringing',
              caller_name: displayNameRef.current ?? 'Your coach',
              caller_role: 'coach',
              call_nonce: attemptNonce,
              updated_at: new Date().toISOString(),
            })
            .eq('id', callRequestId);
          if (resetErr) throw new Error(resetErr.message);

          await new Promise((r) => setTimeout(r, 600));

          // STEP B: create and write fresh offer.
          const offer = await conn.createOffer();
          await conn.setLocalDescription(offer);

          const { error: writeErr } = await supabase
            .from('checkin_call_requests')
            .update({
              sdp_offer: offer.sdp,
              updated_at: new Date().toISOString(),
            })
            .eq('id', callRequestId);

          if (writeErr) throw new Error(writeErr.message);

          // Fallback: poll DB for answer in case postgres_changes is missed.
          // This prevents one-sided "connected/connecting" state.
          for (let i = 0; i < 20; i += 1) {
            if (cancelled || !pc.current) break;
            if (pc.current.remoteDescription) break;
            const { data } = await supabase
              .from('checkin_call_requests')
              .select('sdp_answer, callee_ice, status')
              .eq('id', callRequestId)
              .maybeSingle();
            if (data?.status === 'declined') {
              setConnectionState('declined');
              setError('Call declined.');
              cleanup();
              break;
            }
            const applied = await applyAnswerIfPresent(data);
            if (applied) break;
            await new Promise((r) => setTimeout(r, 500));
          }
        } else {
          let offerSdp = null;
          let callNonce = 'default';

          for (let i = 0; i < 15; i += 1) {
            if (cancelled) return;
            const { data } = await supabase
              .from('checkin_call_requests')
              .select('sdp_offer, sdp_answer, status, call_nonce, updated_at')
              .eq('id', callRequestId)
              .maybeSingle();

            if (canCalleeUseOfferRow(data)) {
              offerSdp = data.sdp_offer;
              callNonce = data.call_nonce ?? 'default';
              break;
            }

            await new Promise((r) => setTimeout(r, 600));
          }

          if (!offerSdp) {
            throw new Error('No offer received after 9 seconds. The coach may still be joining.');
          }

          const channel = supabase.channel(`call:${callRequestId}:${callNonce}`, {
            config: { broadcast: { self: false } },
          });
          channelRef.current = channel;

          channel.on('broadcast', { event: 'ice' }, async ({ payload }) => {
            if (cancelled) return;
            await safeAddCandidate(pc.current, payload);
          });

          channel.on('broadcast', { event: 'hangup' }, () => {
            if (cancelled) return;
            cleanup();
            onEndRef.current?.();
          });

          channel.on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'checkin_call_requests',
              filter: `id=eq.${callRequestId}`,
            },
            async ({ new: row }) => {
              if (cancelled || !pc.current) return;
              if (row.caller_ice?.length) {
                for (const c of row.caller_ice) {
                  await safeAddCandidate(pc.current, c);
                }
              }
            },
          );

          conn.onicecandidate = async ({ candidate }) => {
            if (!candidate || cancelled) return;
            const json = candidate.toJSON();
            channel.send({
              type: 'broadcast', event: 'ice', payload: json,
            });
            await storeIceCandidate(supabase, false, json);
          };

          await new Promise((resolve, reject) => {
            const t = setTimeout(() => reject(new Error('Channel subscribe timeout')), 8000);
            channel.subscribe((status) => {
              if (status === 'SUBSCRIBED') {
                clearTimeout(t);
                resolve();
              }
              if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                clearTimeout(t);
                reject(new Error(`Channel: ${status}`));
              }
            });
          });

          await conn.setRemoteDescription(
            new RTCSessionDescription({
              type: 'offer', sdp: offerSdp,
            }),
          );

          await flushStoredIce(conn, supabase, false);
          await flushPendingIce(conn);

          const answer = await conn.createAnswer();
          await conn.setLocalDescription(answer);

          const { error: ansErr } = await supabase
            .from('checkin_call_requests')
            .update({
              sdp_answer: answer.sdp,
              updated_at: new Date().toISOString(),
            })
            .eq('id', callRequestId);

          if (ansErr) throw new Error(ansErr.message);
        }
      } catch (err) {
        if (cancelled) return;
        setError(String(err?.message || 'Could not start call'));
        setConnectionState('failed');
      }
    }

    start();
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [active, callRequestId, role, cleanup]);

  return {
    localStream,
    remoteStream,
    connectionState,
    micEnabled,
    camEnabled,
    error,
    toggleMic,
    toggleCam,
    hangUp,
  };
}
