import React, { useEffect, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { ChevronRight, User, Users, Dumbbell } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { createPageUrl } from "@/utils";

import AtlasLogo from '@/components/Brand/AtlasLogo';

import { colors as atlasColors } from '@/ui/tokens';
const BG = atlasColors.bg;
const CARD = atlasColors.surface1;
const BADGE = "#111C33";
const ACCENT = atlasColors.primary;
const TEXT = atlasColors.text;
const MUTED = "rgba(229,231,235,0.65)";
const SEPARATOR = "rgba(255,255,255,0.06)";

async function lightHaptic() {
  try {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Light });
      return;
    }
  } catch (e) {
    // ignore
  }
  if (navigator.vibrate) navigator.vibrate(10);
}

function RoleRow({ icon, title, onPress, isLast }) {
  return (
    <button
      type="button"
      onClick={onPress}
      className="w-full text-left"
      style={{
        height: 64,
        borderRadius: 0,
        padding: 16,
        background: CARD,
        border: "none",
        borderBottom: isLast ? "none" : `1px solid ${SEPARATOR}`,
        display: "flex",
        alignItems: "center",
        gap: 12,
        WebkitTapHighlightColor: "transparent",
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = "scale(0.99)";
        e.currentTarget.style.background = "#111C33";
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = "scale(1)";
        e.currentTarget.style.background = CARD;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
        e.currentTarget.style.background = CARD;
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 14,
          background: BADGE,
          display: "grid",
          placeItems: "center",
          flex: "0 0 auto",
        }}
      >
        {icon}
      </div>

      <div style={{ flex: 1, color: TEXT, fontWeight: 600, fontSize: 16 }}>
        {title}
      </div>

      <ChevronRight size={20} color={MUTED} />
    </button>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const { role, isDemoMode, setRole, exitDemo, isHydratingAppState } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  if (isDemoMode) {
    return <Navigate to={createPageUrl("Home")} replace />;
  }

  if (!isHydratingAppState && role) {
    if (role === "client") {
      return <Navigate to={createPageUrl("MyProgram")} replace />;
    }
    return <Navigate to={createPageUrl("Home")} replace />;
  }

  const pickRole = async (roleKey) => {
    await lightHaptic();
    setRole(roleKey);
    if (roleKey === "trainer" || roleKey === "solo") navigate(createPageUrl("Home"));
    if (roleKey === "client") navigate(createPageUrl("MyProgram"));
  };

  const handleExitDemo = async () => {
    await lightHaptic();
    exitDemo();
    navigate(createPageUrl("Login"));
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: BG,
        color: TEXT,
        display: "flex",
        flexDirection: "column",
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: "max(24px, env(safe-area-inset-top))",
        paddingBottom: "max(24px, env(safe-area-inset-bottom))",
      }}
    >
      <div
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0px)" : "translateY(6px)",
          transition: "opacity 240ms ease-out, transform 240ms ease-out",
        }}
      >
        <div style={{ marginTop: 24 }}>
          <AtlasLogo variant="auth" />
        </div>
        <p style={{ marginTop: 12, color: MUTED, fontSize: 15 }}>Choose your login</p>
        <div
          style={{
            marginTop: 16,
            overflow: "hidden",
            borderRadius: 16,
            background: CARD,
          }}
        >
            <RoleRow
              title="Trainer"
              icon={<Dumbbell size={20} color={ACCENT} />}
              onPress={() => pickRole("trainer")}
              isLast={false}
            />
            <RoleRow
              title="Client"
              icon={<Users size={20} color={ACCENT} />}
              onPress={() => pickRole("client")}
              isLast={false}
            />
            <RoleRow
              title="Personal"
              icon={<User size={20} color={ACCENT} />}
              onPress={() => pickRole("solo")}
              isLast
            />
          </div>

        {isDemoMode === true && (
          <button
            type="button"
            onClick={handleExitDemo}
            style={{
              marginTop: 16,
              width: "100%",
              background: "transparent",
              border: "none",
              color: MUTED,
              padding: 12,
              fontSize: 14,
            }}
          >
            Exit Demo
          </button>
        )}
      </div>
    </div>
  );
}
