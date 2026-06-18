import React, { useEffect, useRef } from 'react';
import { useWebRTC } from '@/hooks/useWebRTC';
import { createRingbackPlayer } from '@/lib/callSounds';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';

function VideoStream({
  stream, mirror = false, objectFit = 'contain', style = {},
}) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={mirror}
      style={{
        width: '100%',
        height: '100%',
        objectFit,
        transform: mirror ? 'scaleX(-1)' : 'none',
        ...style,
      }}
    />
  );
}

export default function AtlasVideoCall({
  callRequestId,
  role,
  myName,
  theirName,
  onEnd,
}) {
  const [callSeconds, setCallSeconds] = React.useState(0);
  const ringbackRef = React.useRef(null);

  const {
    localStream,
    remoteStream,
    connectionState,
    micEnabled,
    camEnabled,
    error,
    toggleMic,
    toggleCam,
    hangUp,
  } = useWebRTC({
    callRequestId,
    role,
    active: true,
    onEnd,
    displayName: myName,
  });

  React.useEffect(() => {
    if (connectionState !== 'connected') return undefined;
    const t = setInterval(() => setCallSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [connectionState]);

  React.useEffect(() => {
    const shouldPlayRingback = role === 'caller' && connectionState === 'connecting';
    if (!shouldPlayRingback) {
      ringbackRef.current?.stop?.();
      return undefined;
    }
    if (!ringbackRef.current) {
      ringbackRef.current = createRingbackPlayer();
    }
    void ringbackRef.current.start?.();
    return () => {
      ringbackRef.current?.stop?.();
    };
  }, [role, connectionState]);

  const formatDuration = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const handleEnd = () => {
    hangUp();
    onEnd?.();
  };

  const statusText = {
    connecting: 'Connecting...',
    connected: formatDuration(callSeconds),
    declined: 'Call declined',
    failed: 'Connection failed',
    ended: 'Call ended',
  }[connectionState] ?? '';

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 2000,
      background: '#080c14',
      display: 'flex',
      flexDirection: 'column',
    }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 20px',
        paddingTop: 'max(14px, env(safe-area-inset-top, 14px))',
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(8px)',
        flexShrink: 0,
        zIndex: 10,
      }}
      >
        <div>
          <p style={{
            fontSize: 15,
            fontWeight: 700,
            color: '#fff',
            margin: 0,
          }}
          >
            {theirName || 'Participant'}
          </p>
          <p style={{
            fontSize: 12,
            margin: '2px 0 0',
            color: connectionState === 'connected'
              ? '#22c55e'
              : connectionState === 'failed'
                ? '#ef4444'
                : 'rgba(255,255,255,0.5)',
          }}
          >
            {statusText}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: connectionState === 'connected'
              ? '#22c55e'
              : connectionState === 'connecting'
                ? '#f59e0b'
                : '#ef4444',
          }}
          />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
            {myName ? `Atlas · ${myName}` : 'Atlas'}
          </span>
        </div>
      </div>

      <div style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        background: '#0f172a',
      }}
      >
        {remoteStream ? (
          <VideoStream
            stream={remoteStream}
            objectFit="contain"
            style={{ position: 'absolute', inset: 0 }}
          />
        ) : connectionState === 'connecting' && role === 'caller' ? (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          >
            <div style={{ position: 'relative', marginBottom: 24 }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 80 + (i * 40),
                    height: 80 + (i * 40),
                    borderRadius: '50%',
                    border: '1px solid rgba(99,102,241,0.3)',
                    animation: `ringExpand 2s ease-out ${i * 0.5}s infinite`,
                  }}
                />
              ))}
              <div style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'rgba(99,102,241,0.2)',
                border: '2px solid rgba(99,102,241,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 32,
                position: 'relative',
              }}
              >
                👤
              </div>
            </div>
            <p style={{
              color: '#fff',
              fontSize: 18,
              fontWeight: 600,
              margin: 0,
            }}
            >
              {theirName || 'Participant'}
            </p>
            <p style={{
              color: 'rgba(255,255,255,0.5)',
              fontSize: 14,
              marginTop: 8,
            }}
            >
              Calling...
            </p>
            <style>{`
              @keyframes ringExpand {
                0% { opacity: 0.8; transform: translate(-50%,-50%) scale(1); }
                100% { opacity: 0; transform: translate(-50%,-50%) scale(1.5); }
              }
            `}</style>
          </div>
        ) : (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          >
            <div style={{
              width: 96,
              height: 96,
              borderRadius: '50%',
              background: 'rgba(99,102,241,0.2)',
              border: '2px solid rgba(99,102,241,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              fontSize: 36,
            }}
            >
              👤
            </div>
            <p style={{
              color: 'rgba(255,255,255,0.7)',
              fontSize: 16,
              fontWeight: 500,
              margin: 0,
            }}
            >
              Waiting for {theirName || 'participant'}
            </p>
          </div>
        )}

        {connectionState === 'declined' && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.85)',
          }}
          >
            <p style={{
              fontSize: 18,
              color: '#ef4444',
              fontWeight: 600,
              margin: 0,
            }}
            >
              {theirName || 'Participant'} declined the call
            </p>
            <button
              type="button"
              onClick={onEnd}
              style={{
                marginTop: 20,
                padding: '10px 24px',
                borderRadius: 10,
                border: 'none',
                background: 'rgba(255,255,255,0.1)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 15,
              }}
            >
              Close
            </button>
          </div>
        )}

        {error && connectionState !== 'declined' && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.8)',
          }}
          >
            <p style={{
              color: '#ef4444',
              fontSize: 15,
              fontWeight: 600,
              margin: 0,
            }}
            >
              {error}
            </p>
            <button
              type="button"
              onClick={handleEnd}
              style={{
                marginTop: 16,
                padding: '10px 20px',
                borderRadius: 10,
                border: 'none',
                background: '#ef4444',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Close
            </button>
          </div>
        )}

        <div style={{
          position: 'absolute',
          bottom: 12,
          right: 12,
          width: 90,
          height: 130,
          borderRadius: 14,
          overflow: 'hidden',
          border: '2px solid rgba(255,255,255,0.2)',
          background: '#1a1a2e',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        }}
        >
          {localStream ? (
            <VideoStream stream={localStream} mirror objectFit="cover" />
          ) : (
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#1a1a2e',
            }}
            >
              <VideoOff size={20} color="rgba(255,255,255,0.3)" />
            </div>
          )}
          {!camEnabled && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: '#0f1729',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            >
              <VideoOff size={18} color="rgba(255,255,255,0.4)" />
            </div>
          )}
        </div>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        padding: '24px 20px',
        paddingBottom: 'max(28px, env(safe-area-inset-bottom, 28px))',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(16px)',
        flexShrink: 0,
      }}
      >
        <ControlBtn
          label={micEnabled ? 'Mute' : 'Unmute'}
          icon={micEnabled ? <Mic size={22} /> : <MicOff size={22} />}
          active={!micEnabled}
          onClick={toggleMic}
        />

        <button
          type="button"
          onClick={handleEnd}
          aria-label="End call"
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            border: 'none',
            background: '#ef4444',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 0 8px rgba(239,68,68,0.2)',
          }}
        >
          <PhoneOff size={28} />
        </button>

        <ControlBtn
          label={camEnabled ? 'Camera off' : 'Camera on'}
          icon={camEnabled ? <Video size={22} /> : <VideoOff size={22} />}
          active={!camEnabled}
          onClick={toggleCam}
        />
      </div>
    </div>
  );
}

function ControlBtn({ label, icon, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        width: 58,
        height: 58,
        borderRadius: '50%',
        border: 'none',
        background: active
          ? 'rgba(239,68,68,0.8)'
          : 'rgba(255,255,255,0.12)',
        color: '#fff',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(4px)',
        transition: 'background 0.2s',
      }}
    >
      {icon}
    </button>
  );
}
