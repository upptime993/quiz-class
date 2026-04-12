"use client";

import { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Avatar,
  AvatarEmoji,
  AVATAR_EMOJIS,
  getEmojiKitchenUrl,
  EMOJI_KITCHEN_DATES,
} from "@/types";

// ─── Emoji Kitchen Avatar Renderer ───────────────────────────
interface AvatarRendererProps {
  avatar: Avatar;
  size?: number;
  animate?: "idle" | "dance" | "none";
  className?: string;
  onClick?: () => void;
  selected?: boolean;
}

export const AvatarRenderer = ({
  avatar,
  size = 60,
  animate = "none",
  className,
  onClick,
  selected = false,
}: AvatarRendererProps) => {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const safeAvatar = avatar || { emoji: "🦊", mixEmoji: null, mixImageUrl: null };

  const animClass = {
    idle: "animate-bounce-idle",
    dance: "animate-dance",
    none: "",
  }[animate];

  // If mixImageUrl is provided and no error, show kitchen image
  const showKitchenImage = safeAvatar.mixImageUrl && !imgError;

  return (
    <div
      className={cn("avatar-container", animClass, className)}
      style={{ width: size, height: size, cursor: onClick ? "pointer" : "default" }}
      onClick={onClick}
    >
      <div
        className={cn("avatar-emoji", selected && "selected")}
        style={{
          width: size,
          height: size,
          fontSize: size * 0.55,
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {showKitchenImage ? (
          <>
            {/* Show base emoji until image loads */}
            {!imgLoaded && (
              <span style={{ fontSize: size * 0.55 }}>{safeAvatar.emoji}</span>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={safeAvatar.mixImageUrl!}
              alt={`${safeAvatar.emoji}+${safeAvatar.mixEmoji}`}
              style={{
                width: size * 0.9,
                height: size * 0.9,
                objectFit: "contain",
                display: imgLoaded ? "block" : "none",
              }}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
              draggable={false}
            />
          </>
        ) : (
          <span style={{ fontSize: size * 0.55 }}>{safeAvatar.emoji || "🦊"}</span>
        )}
      </div>
    </div>
  );
};

// ─── Emoji Kitchen Picker ─────────────────────────────────────
interface EmojiKitchenPickerProps {
  avatar: Avatar;
  onChange: (avatar: Avatar) => void;
}

// Try multiple dates to find a valid combination  
const tryKitchenDates = async (emoji1: string, emoji2: string): Promise<string | null> => {
  for (const date of EMOJI_KITCHEN_DATES) {
    const url = getEmojiKitchenUrl(emoji1, emoji2, date);
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok) return url;
    } catch {}
  }
  // Also try reversed order
  for (const date of EMOJI_KITCHEN_DATES) {
    const url = getEmojiKitchenUrl(emoji2, emoji1, date);
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok) return url;
    } catch {}
  }
  return null;
};

export const EmojiKitchenPicker = ({ avatar, onChange }: EmojiKitchenPickerProps) => {
  const [tab, setTab] = useState<"base" | "mix">("base");
  const [mixLoading, setMixLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(avatar.mixImageUrl || null);
  const [previewError, setPreviewError] = useState(false);
  const [selectedMix, setSelectedMix] = useState<string>(avatar.mixEmoji || "");

  const handleBaseSelect = useCallback((emoji: string) => {
    onChange({ emoji, mixEmoji: undefined, mixImageUrl: undefined });
    setPreviewUrl(null);
    setSelectedMix("");
    setPreviewError(false);
  }, [onChange]);

  const handleMixSelect = useCallback(async (mixEmoji: string) => {
    if (mixEmoji === avatar.emoji) return;
    setSelectedMix(mixEmoji);
    setMixLoading(true);
    setPreviewError(false);
    setPreviewUrl(null);

    try {
      const url = await tryKitchenDates(avatar.emoji, mixEmoji);
      if (url) {
        setPreviewUrl(url);
        onChange({ ...avatar, mixEmoji, mixImageUrl: url });
      } else {
        setPreviewError(true);
        // Still update with mixEmoji but no image URL
        onChange({ ...avatar, mixEmoji, mixImageUrl: undefined });
      }
    } catch {
      setPreviewError(true);
    } finally {
      setMixLoading(false);
    }
  }, [avatar, onChange]);

  const handleClearMix = useCallback(() => {
    setSelectedMix("");
    setPreviewUrl(null);
    setPreviewError(false);
    onChange({ emoji: avatar.emoji });
  }, [avatar.emoji, onChange]);

  const randomize = useCallback(async () => {
    const randomBase = AVATAR_EMOJIS[Math.floor(Math.random() * AVATAR_EMOJIS.length)];
    const randomMix = AVATAR_EMOJIS.filter(e => e !== randomBase)[
      Math.floor(Math.random() * (AVATAR_EMOJIS.length - 1))
    ];
    onChange({ emoji: randomBase });
    setSelectedMix("");
    setPreviewUrl(null);
    setPreviewError(false);
    // Optionally auto-mix
    setTimeout(() => handleMixSelectExternal(randomBase, randomMix), 50);
  }, []);

  // Non-hook version for internal calls
  const handleMixSelectExternal = async (base: string, mix: string) => {
    setSelectedMix(mix);
    setMixLoading(true);
    setPreviewError(false);
    try {
      const url = await tryKitchenDates(base, mix);
      if (url) {
        setPreviewUrl(url);
        onChange({ emoji: base, mixEmoji: mix, mixImageUrl: url });
      } else {
        setPreviewError(true);
        onChange({ emoji: base, mixEmoji: mix });
      }
    } catch {
      setPreviewError(true);
    } finally {
      setMixLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          🍳 Emoji Kitchen
        </p>
        <button
          onClick={randomize}
          className="text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1 transition-transform hover:scale-105 active:scale-95"
          style={{
            background: "linear-gradient(135deg, rgba(108,92,231,0.2), rgba(0,206,201,0.2))",
            color: "var(--accent-purple-light)",
            border: "1px solid rgba(108,92,231,0.3)"
          }}
        >
          🎲 Acak
        </button>
      </div>

      {/* Live Preview */}
      <div
        className="flex items-center justify-center mb-3 rounded-2xl p-3"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", minHeight: 80 }}
      >
        {mixLoading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Mencampur emoji...</p>
          </div>
        ) : previewUrl && !previewError ? (
          <div className="flex flex-col items-center gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Emoji mix" style={{ width: 56, height: 56, objectFit: "contain" }} />
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {avatar.emoji} + {selectedMix}
            </p>
          </div>
        ) : previewError ? (
          <div className="flex flex-col items-center gap-1 text-center">
            <span style={{ fontSize: 36 }}>{avatar.emoji}</span>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Kombinasi ini tidak tersedia 😅<br/>Coba emoji lain!
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <span style={{ fontSize: 48 }}>{avatar.emoji}</span>
            {selectedMix ? (
              <p className="text-xs" style={{ color: "var(--accent-purple-light)" }}>
                {avatar.emoji} + {selectedMix}
              </p>
            ) : (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Pilih emoji dan campur!
              </p>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex p-1 mb-3 rounded-xl" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
        {[
          { id: "base", label: "🎭 Emoji Utama" },
          { id: "mix", label: "🍳 Mix Kitchen" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as "base" | "mix")}
            className="flex-1 py-2 text-xs font-bold rounded-lg transition-all"
            style={{
              background: tab === t.id ? "var(--accent-purple)" : "transparent",
              color: tab === t.id ? "white" : "var(--text-muted)",
              boxShadow: tab === t.id ? "var(--shadow-purple)" : "none",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto" style={{ maxHeight: 220 }}>
        {tab === "base" && (
          <div className="grid grid-cols-5 gap-2 p-1 animate-slide-up">
            {AVATAR_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleBaseSelect(emoji)}
                className="flex items-center justify-center rounded-xl transition-all duration-150 hover:scale-110 active:scale-95"
                style={{
                  width: 48,
                  height: 48,
                  fontSize: 26,
                  margin: "0 auto",
                  background: avatar.emoji === emoji ? "rgba(108,92,231,0.2)" : "var(--bg-elevated)",
                  border: `2px solid ${avatar.emoji === emoji ? "var(--accent-purple)" : "var(--border)"}`,
                  borderRadius: 12,
                }}
                aria-label={`Pilih emoji ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {tab === "mix" && (
          <div className="animate-slide-up">
            <p className="text-xs mb-2 px-1" style={{ color: "var(--text-muted)" }}>
              Pilih emoji kedua untuk dicampur dengan <strong>{avatar.emoji}</strong>
            </p>
            {selectedMix && (
              <button
                onClick={handleClearMix}
                className="w-full mb-2 py-2 rounded-xl text-xs font-bold transition-all"
                style={{
                  background: "rgba(255,107,107,0.1)",
                  color: "var(--accent-red)",
                  border: "1px dashed rgba(255,107,107,0.3)",
                }}
              >
                ✕ Hapus Mix
              </button>
            )}
            <div className="grid grid-cols-5 gap-2 p-1">
              {AVATAR_EMOJIS.filter(e => e !== avatar.emoji).map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleMixSelect(emoji)}
                  disabled={mixLoading}
                  className="flex items-center justify-center rounded-xl transition-all duration-150 hover:scale-110 active:scale-95"
                  style={{
                    width: 48,
                    height: 48,
                    fontSize: 26,
                    margin: "0 auto",
                    background: selectedMix === emoji ? "rgba(0,206,201,0.2)" : "var(--bg-elevated)",
                    border: `2px solid ${selectedMix === emoji ? "var(--accent-teal, #00cec9)" : "var(--border)"}`,
                    borderRadius: 12,
                    opacity: mixLoading && selectedMix !== emoji ? 0.5 : 1,
                  }}
                  aria-label={`Mix dengan ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Avatar Customizer (backwards compat wrapper) ─────────────
interface AvatarCustomizerProps {
  avatar: Avatar;
  onChange: (avatar: Avatar) => void;
}

export const AvatarCustomizer = ({ avatar, onChange }: AvatarCustomizerProps) => (
  <EmojiKitchenPicker avatar={avatar} onChange={onChange} />
);

// ─── Lobby Avatar Card ────────────────────────────────────────
interface LobbyAvatarCardProps {
  username: string;
  avatar: Avatar;
  isConnected?: boolean;
  isMe?: boolean;
}

export const LobbyAvatarCard = ({
  username,
  avatar,
  isConnected = true,
  isMe = false,
}: LobbyAvatarCardProps) => (
  <div
    className="flex flex-col items-center gap-1.5 animate-pop-in"
    style={{ opacity: isConnected ? 1 : 0.4 }}
  >
    <div className="relative">
      <AvatarRenderer
        avatar={avatar}
        size={52}
        animate="idle"
      />
      {isMe && (
        <div
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
          style={{ background: "var(--accent-purple)", fontSize: 8 }}
        >
          ⭐
        </div>
      )}
      {!isConnected && (
        <div
          className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
          style={{ background: "var(--accent-red)", fontSize: 8 }}
        >
          ✕
        </div>
      )}
    </div>
    <p
      className="text-center font-bold leading-tight"
      style={{
        color: isMe ? "var(--accent-purple-light)" : "var(--text-primary)",
        fontFamily: "var(--font-heading)",
        fontSize: 11,
        maxWidth: 60,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {username}
      {isMe ? " (Kamu)" : ""}
    </p>
  </div>
);

// ─── Floating Reactions Display ───────────────────────────────
interface FloatingReactionItemProps {
  id: string;
  emoji: string;
  username: string;
  x: number;
}

export const FloatingReactionItem = ({
  emoji,
  username,
  x,
}: FloatingReactionItemProps) => (
  <div
    className="floating-reaction flex flex-col items-center gap-1"
    style={{ left: `${x}%` }}
  >
    <span style={{ fontSize: 28 }}>{emoji}</span>
    <span
      className="text-xs px-2 py-0.5 rounded-full"
      style={{
        background: "rgba(0,0,0,0.6)",
        color: "var(--text-secondary)",
        fontFamily: "var(--font-body)",
        fontSize: 9,
        backdropFilter: "blur(4px)",
      }}
    >
      {username}
    </span>
  </div>
);