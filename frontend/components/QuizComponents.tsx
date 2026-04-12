"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./UI";
import { AvatarRenderer } from "./Avatar";
import { Option, LeaderboardEntry, Avatar } from "@/types";
import { getRankEmoji, formatScore } from "@/lib/utils";

// ─── Timer Circle ─────────────────────────────────────────────
interface TimerCircleProps {
  remaining: number;
  total: number;
  size?: number;
}

export const TimerCircle = ({
  remaining,
  total,
  size = 72,
}: TimerCircleProps) => {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? remaining / total : 0;
  const dashOffset = circumference * (1 - progress);
  const isLow = remaining <= 5;
  const isCritical = remaining <= 3;

  const trackColor = "rgba(255,255,255,0.08)";
  const fillColor = isCritical
    ? "var(--accent-red)"
    : isLow
    ? "var(--accent-yellow)"
    : "var(--accent-purple)";

  return (
    <div
      className={cn("timer-circle", isCritical && "animate-timer-pulse")}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={6}
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={fillColor}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 0.9s linear, stroke 0.3s ease" }}
        />
      </svg>
      <span
        className="timer-text"
        style={{
          color: isCritical ? "var(--accent-red)" : "var(--text-primary)",
          fontSize: size < 60 ? 12 : 18,
          fontWeight: 700,
        }}
      >
        {remaining}
      </span>
    </div>
  );
};

// ─── Question Card ────────────────────────────────────────────
interface QuestionCardProps {
  questionNumber: number;
  totalQuestions: number;
  text: string;
  imageUrl?: string | null;
}

export const QuestionCard = ({
  questionNumber,
  totalQuestions,
  text,
  imageUrl,
}: QuestionCardProps) => (
  <div 
    className="animate-slide-down rounded-[1.5rem] p-6 relative overflow-hidden backdrop-blur-xl mb-4"
    style={{
      background: "linear-gradient(145deg, rgba(30,30,40,0.8), rgba(20,20,25,0.9))",
      border: "1px solid rgba(255,255,255,0.08)",
      boxShadow: "0 10px 40px rgba(0,0,0,0.3)"
    }}
  >
    {/* Background glowing orb */}
    <div 
      className="absolute -right-20 -top-20 w-48 h-48 rounded-full blur-3xl opacity-20"
      style={{ background: "var(--accent-purple)", pointerEvents: "none" }}
    />

    {/* Image if any */}
    {imageUrl && (
      <div className="mb-5 rounded-2xl overflow-hidden shadow-lg border border-white/5 relative z-10 group">
        <img
          src={imageUrl}
          alt="Gambar soal"
          className="w-full object-cover max-h-56 transform transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
      </div>
    )}

    {/* Question text */}
    <div className="relative z-10">
      <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3 text-xl bg-white/5 border border-white/10 shadow-inner">
        🤔
      </div>
      <p
        className="text-xl md:text-2xl leading-relaxed font-bold"
        style={{
          color: "white",
          fontFamily: "var(--font-heading)",
          lineHeight: 1.6,
          textShadow: "0 2px 10px rgba(0,0,0,0.5)"
        }}
      >
        {text}
      </p>
    </div>
  </div>
);

// ─── Answer Option ────────────────────────────────────────────
interface AnswerOptionProps {
  option: Option;
  state?: "default" | "selected" | "correct" | "wrong" | "disabled";
  onClick?: () => void;
}

export const AnswerOption = ({
  option,
  state = "default",
  onClick,
}: AnswerOptionProps) => {
  const isSelected = state === "selected";
  const isDisabled = state === "disabled";
  
  const bgStyles = {
    default: "rgba(255,255,255,0.05)",
    selected: "linear-gradient(135deg, rgba(108,92,231,0.3), rgba(108,92,231,0.1))",
    correct: "rgba(0,184,148,0.2)",
    wrong: "rgba(214,48,49,0.2)",
    disabled: "rgba(255,255,255,0.02)",
  };

  const borderStyles = {
    default: "1px solid rgba(255,255,255,0.1)",
    selected: "1px solid var(--accent-purple)",
    correct: "1px solid var(--accent-green)",
    wrong: "1px solid var(--accent-red)",
    disabled: "1px solid rgba(255,255,255,0.05)",
  };

  return (
    <button
      className={cn(
        "w-full rounded-2xl p-4 flex items-center gap-4 transition-all duration-300 relative overflow-hidden group",
        isDisabled ? "opacity-60 cursor-not-allowed grayscale-[30%]" : "hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
      )}
      style={{
        background: bgStyles[state],
        border: borderStyles[state],
        boxShadow: isSelected ? "0 8px 25px rgba(108,92,231,0.25)" : "0 4px 15px rgba(0,0,0,0.2)",
      }}
      onClick={state === "default" ? onClick : undefined}
      disabled={state === "disabled"}
    >
      {/* Glow effect on hover */}
      {!isDisabled && state === "default" && (
        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 transform -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
      )}
      
      {/* Label indicator */}
      <div
        className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg shrink-0 transition-colors duration-300 shadow-inner",
          isSelected ? "bg-purple-500 text-white" : "bg-white/10 text-white/70"
        )}
      >
        {isSelected ? "✨" : option.label}
      </div>
      
      <span 
        className={cn(
          "flex-1 text-left font-semibold text-lg line-clamp-3",
          isSelected ? "text-white" : "text-white/80"
        )}
      >
        {option.text}
      </span>
      
      {/* Selected Checkmark */}
      {isSelected && (
        <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center animate-pop-in shrink-0">
          <span className="text-white text-xs">✓</span>
        </div>
      )}
    </button>
  );
};

// ─── Confirm Modal ────────────────────────────────────────────
interface ConfirmModalProps {
  isOpen: boolean;
  selectedAnswer: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal = ({
  isOpen,
  selectedAnswer,
  onConfirm,
  onCancel,
}: ConfirmModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal-card animate-pop-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Emoji */}
        <div className="text-center mb-4">
          <span className="text-5xl">😏</span>
        </div>

        {/* Title */}
        <h3
          className="text-xl font-extrabold text-center mb-2"
          style={{ fontFamily: "var(--font-heading)", color: "var(--text-primary)" }}
        >
          Yakin nih udah bener?
        </h3>

        {/* Selected answer preview */}
        <div
          className="text-center mb-6 px-4 py-2 rounded-xl"
          style={{
            background: "rgba(0,184,148,0.1)",
            border: "1px solid rgba(0,184,148,0.3)",
          }}
        >
          <p
            className="text-sm"
            style={{ color: "var(--text-secondary)", fontFamily: "var(--font-body)" }}
          >
            Jawaban kamu:
          </p>
          <p
            className="text-lg font-bold mt-1"
            style={{ color: "var(--accent-green)", fontFamily: "var(--font-heading)" }}
          >
            Pilihan {selectedAnswer}
          </p>
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-3">
          <Button
            variant="green"
            onClick={onConfirm}
            className="text-base"
          >
            Yakin lah ✅
          </Button>
          <Button
            variant="secondary"
            onClick={onCancel}
            className="text-base"
          >
            Belom ❌
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── Countdown Overlay ────────────────────────────────────────
interface CountdownOverlayProps {
  count: number | string;
  visible: boolean;
}

export const CountdownOverlay = ({ count, visible }: CountdownOverlayProps) => {
  if (!visible) return null;

  const isGo = count === "GO!" || count === "GO";

  return (
    <div className="countdown-overlay animate-fade-in">
      {/* Background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: Math.random() * 80 + 40,
              height: Math.random() * 80 + 40,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              background: `rgba(108,92,231,${Math.random() * 0.1 + 0.05})`,
              filter: "blur(20px)",
            }}
          />
        ))}
      </div>

      {isGo ? (
        <div className="text-center relative z-10">
          <div
            className="animate-winner"
            style={{
              fontSize: "clamp(48px, 15vw, 96px)",
              fontFamily: "var(--font-heading)",
              fontWeight: 900,
              background:
                "linear-gradient(135deg, var(--accent-green), var(--accent-blue))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              lineHeight: 1.1,
            }}
          >
            LET&apos;S GOOO!!! 🚀
          </div>
          <p
            className="mt-4 text-lg font-bold animate-fade-in delay-300"
            style={{ color: "var(--text-secondary)", fontFamily: "var(--font-heading)" }}
          >
            Quiz dimulai sekarang!
          </p>
        </div>
      ) : (
        <div className="text-center relative z-10">
          <div
            key={count}
            className="countdown-number animate-pop-in"
          >
            {count}
          </div>
          <p
            className="mt-4 text-base font-semibold"
            style={{ color: "var(--text-secondary)", fontFamily: "var(--font-heading)" }}
          >
            {count === 3
              ? "Bersiap-siap... 🎯"
              : count === 2
              ? "Sudah siap? 🧠"
              : "Ayo semangat! 💪"}
          </p>
        </div>
      )}
    </div>
  );
};

// ─── Answered Waiting Screen ──────────────────────────────────
interface WaitingAnswerProps {
  answeredCount: number;
  totalCount: number;
  remaining: number;
  total: number;
}

export const WaitingAnswerScreen = ({
  answeredCount,
  totalCount,
  remaining,
  total,
}: WaitingAnswerProps) => (
  <div className="flex flex-col items-center justify-center min-h-screen px-6 gradient-bg">
    <div className="text-center animate-slide-up w-full max-w-sm">
      {/* Icon */}
      <div className="text-6xl mb-4 animate-bounce-idle">🍿</div>

      {/* Message */}
      <h2
        className="text-2xl font-extrabold mb-2"
        style={{ fontFamily: "var(--font-heading)", color: "var(--text-primary)" }}
      >
        Oke deh kalo udah yakin!
      </h2>
      <p
        className="text-base mb-8"
        style={{ color: "var(--text-secondary)", fontFamily: "var(--font-body)" }}
      >
        Nunggu jawaban yang lain dulu... 😄
      </p>

      {/* Timer */}
      <div className="flex justify-center mb-6">
        <TimerCircle remaining={remaining} total={total} size={88} />
      </div>

      {/* Count */}
      <div
        className="glass-card p-5 mb-4"
        style={{ borderColor: "rgba(108,92,231,0.2)" }}
      >
        <p
          className="text-sm font-semibold mb-1"
          style={{ color: "var(--text-secondary)" }}
        >
          Sudah menjawab
        </p>
        <div className="flex items-end gap-2 justify-center">
          <span
            className="text-4xl font-black"
            style={{
              fontFamily: "var(--font-score)",
              color: "var(--accent-purple-light)",
            }}
          >
            {answeredCount}
          </span>
          <span
            className="text-xl font-bold mb-1"
            style={{ color: "var(--text-muted)" }}
          >
            / {totalCount}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-3 progress-bar-container" style={{ height: 8 }}>
          <div
            className="progress-bar-fill"
            style={{
              width: `${totalCount > 0 ? (answeredCount / totalCount) * 100 : 0}%`,
              height: "100%",
              transition: "width 0.4s ease",
            }}
          />
        </div>

        <p
          className="text-xs mt-2"
          style={{ color: "var(--text-muted)" }}
        >
          {totalCount - answeredCount} orang belum menjawab
        </p>
      </div>
    </div>
  </div>
);

// ─── Leaderboard Row ──────────────────────────────────────────
interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  isMe?: boolean;
  animated?: boolean;
  delay?: number;
}

export const LeaderboardRow = ({
  entry,
  isMe = false,
  animated = true,
  delay = 0,
}: LeaderboardRowProps) => {
  const rankColors: Record<number, string> = {
    1: "var(--accent-yellow)",
    2: "#C0C0C0",
    3: "#CD7F32",
  };

  return (
    <div
      className={cn(
        "leaderboard-row",
        isMe && "highlight",
        animated && "animate-slide-up"
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Rank */}
      <div
        className={cn(
          "rank-badge",
          entry.rank <= 3 ? `rank-${entry.rank}` : "rank-other"
        )}
        style={{
          fontSize: entry.rank <= 3 ? 16 : 13,
        }}
      >
        {entry.rank <= 3 ? getRankEmoji(entry.rank) : entry.rank}
      </div>

      {/* Avatar */}
      <AvatarRenderer
        avatar={entry.avatar}
        size={40}
        animate={isMe ? "idle" : "none"}
        showAccessories
      />

      {/* Name */}
      <div className="flex-1 min-w-0">
        <p
          className="font-bold truncate"
          style={{
            color: isMe ? "var(--accent-purple-light)" : "var(--text-primary)",
            fontFamily: "var(--font-heading)",
            fontSize: 14,
          }}
        >
          {entry.username}
          {isMe && (
            <span
              className="ml-1 text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              (Kamu)
            </span>
          )}
        </p>
        {/* Detail statistics inline */}
        {entry.answers && entry.answers.length > 0 && (
          <div className="flex gap-2 mt-0.5 text-[10px] sm:text-xs font-bold">
            <span style={{ color: "var(--accent-green)" }}>
              ✓ Benar: {entry.answers.filter(a => a.isCorrect).length}
            </span>
            <span style={{ color: "var(--accent-red)" }}>
              ✕ Salah/Kosong: {entry.answers.length - entry.answers.filter(a => a.isCorrect).length}
            </span>
          </div>
        )}
        {entry.pointsEarned !== undefined && (
          <p
            className="text-xs font-semibold"
            style={{
              color:
                entry.isCorrect ? "var(--accent-green)" : "var(--accent-red)",
              fontFamily: "var(--font-body)",
            }}
          >
            {entry.isCorrect
              ? `+${entry.pointsEarned?.toLocaleString("id-ID")} poin`
              : "Tidak menjawab"}
          </p>
        )}
      </div>

      {/* Score */}
      <div className="text-right flex-shrink-0">
        <p
          className="font-black text-base"
          style={{
            fontFamily: "var(--font-score)",
            color: rankColors[entry.rank] || "var(--text-primary)",
          }}
        >
          {formatScore(entry.score)}
        </p>
        <p
          className="text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          poin
        </p>
      </div>
    </div>
  );
};

// ─── Podium Card (Winner) ─────────────────────────────────────
interface PodiumCardProps {
  entry: LeaderboardEntry;
  delay?: number;
}

export const PodiumCard = ({ entry, delay = 0 }: PodiumCardProps) => {
  const configs: Record<
    number,
    {
      emoji: string;
      label: string;
      color: string;
      glow: string;
      height: number;
    }
  > = {
    1: {
      emoji: "🥇",
      label: "Juara Pertama",
      color: "#FFD700",
      glow: "rgba(255,215,0,0.3)",
      height: 140,
    },
    2: {
      emoji: "🥈",
      label: "Juara Kedua",
      color: "#C0C0C0",
      glow: "rgba(192,192,192,0.3)",
      height: 110,
    },
    3: {
      emoji: "🥉",
      label: "Juara Ketiga",
      color: "#CD7F32",
      glow: "rgba(205,127,50,0.3)",
      height: 90,
    },
  };

  const config = configs[entry.rank];
  if (!config) return null;

  return (
    <div
      className="flex flex-col items-center animate-winner"
      style={{ animationDelay: `${delay}ms`, opacity: 0 }}
    >
      {/* Avatar */}
      <div
        className="animate-dance"
        style={{
          filter: `drop-shadow(0 0 20px ${config.glow})`,
          marginBottom: 8,
        }}
      >
        <AvatarRenderer
          avatar={entry.avatar}
          size={entry.rank === 1 ? 90 : 70}
          animate="dance"
          showAccessories
        />
      </div>

      {/* Username */}
      <p
        className="font-black text-center mb-1"
        style={{
          fontFamily: "var(--font-heading)",
          color: config.color,
          fontSize: entry.rank === 1 ? 18 : 14,
          textShadow: `0 0 20px ${config.glow}`,
          maxWidth: 100,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {entry.username}
      </p>

      {/* Rank label */}
      <p
        className="text-xs font-bold mb-2"
        style={{ color: config.color, fontFamily: "var(--font-heading)" }}
      >
        {config.emoji} {config.label}
      </p>

      {/* Score */}
      <p
        className="text-sm font-black px-3 py-1 rounded-full"
        style={{
          fontFamily: "var(--font-score)",
          color: config.color,
          background: `rgba(${entry.rank === 1 ? "255,215,0" : entry.rank === 2 ? "192,192,192" : "205,127,50"},0.1)`,
          border: `1px solid ${config.color}40`,
        }}
      >
        {formatScore(entry.score)} poin
      </p>

      {/* Podium base */}
      <div
        className="mt-3 rounded-t-xl w-20 flex items-center justify-center"
        style={{
          height: config.height,
          background: `linear-gradient(180deg, ${config.color}30, ${config.color}10)`,
          border: `1px solid ${config.color}40`,
          borderBottom: "none",
        }}
      >
        <span
          style={{
            fontSize: 32,
            opacity: 0.4,
            fontFamily: "var(--font-score)",
            fontWeight: 700,
          }}
        >
          {entry.rank}
        </span>
      </div>
    </div>
  );
};