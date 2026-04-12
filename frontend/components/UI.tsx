"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// ─── Particles Background ─────────────────────────────────────
export const ParticleBackground = () => {
  const particles = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    size: Math.random() * 6 + 3,
    left: Math.random() * 100,
    delay: Math.random() * 8,
    duration: Math.random() * 10 + 15,
    color: i % 3 === 0
      ? "rgba(108,92,231,0.4)"
      : i % 3 === 1
      ? "rgba(78,205,196,0.3)"
      : "rgba(253,203,110,0.3)",
  }));

  return (
    <div className="particles-container" aria-hidden>
      {particles.map((p) => (
        <div
          key={p.id}
          className="particle"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.left}%`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
};

// ─── Glass Card ───────────────────────────────────────────────
interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  animate?: boolean;
  style?: React.CSSProperties;
}

export const GlassCard = ({
  children,
  className,
  onClick,
  animate = false,
  style,
}: GlassCardProps) => (
  <div
    onClick={onClick}
    style={style}
    className={cn(
      "glass-card",
      animate && "animate-slide-up",
      onClick && "cursor-pointer",
      className
    )}
  >
    {children}
  </div>
);

// ─── Purple Button ────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "green" | "red" | "purple";
  loading?: boolean;
  className?: string;
}

export const Button = ({
  children,
  variant = "primary",
  loading = false,
  className,
  disabled,
  ...props
}: ButtonProps) => {
  const variantClass = {
    primary: "btn-primary",
    secondary: "btn-secondary",
    green: "btn-primary btn-green",
    red: "btn-primary btn-red",
    purple: "btn-primary",
  }[variant];

  return (
    <button
      className={cn(variantClass, className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <LoadingSpinner size={18} />
          <span>Loading...</span>
        </>
      ) : (
        children
      )}
    </button>
  );
};

// ─── Input Field ──────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: React.ReactNode;
  error?: string;
}

export const InputField = ({
  label,
  icon,
  error,
  className,
  ...props
}: InputProps) => (
  <div className="w-full">
    {label && (
      <label
        className="block text-sm font-semibold mb-2"
        style={{ color: "var(--text-secondary)", fontFamily: "var(--font-body)" }}
      >
        {label}
      </label>
    )}
    <div className="relative">
      {icon && (
        <div
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center w-8"
          style={{ color: "var(--text-muted)", zIndex: 1 }}
        >
          {icon}
        </div>
      )}
      <input
        className={cn(
          "input-field",
          icon && "!pl-11",
          error && "border-red-500 focus:border-red-500",
          className
        )}
        {...props}
      />
    </div>
    {error && (
      <p className="text-xs mt-1" style={{ color: "var(--accent-red)" }}>
        {error}
      </p>
    )}
  </div>
);

// ─── Loading Spinner ──────────────────────────────────────────
export const LoadingSpinner = ({
  size = 24,
  color = "white",
}: {
  size?: number;
  color?: string;
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2.5}
    strokeLinecap="round"
    className="animate-spin"
    style={{ flexShrink: 0 }}
  >
    <circle cx="12" cy="12" r="10" opacity={0.25} />
    <path d="M12 2a10 10 0 0 1 10 10" />
  </svg>
);

// ─── Loading Screen ───────────────────────────────────────────
export const LoadingScreen = ({ message = "Loading..." }: { message?: string }) => (
  <div
    className="fixed inset-0 flex flex-col items-center justify-center gradient-bg"
    style={{ zIndex: 999 }}
  >
    <div className="text-5xl mb-6 animate-bounce-idle">🎮</div>
    <LoadingSpinner size={36} color="var(--accent-purple-light)" />
    <p
      className="mt-4 text-sm font-semibold"
      style={{
        color: "var(--text-secondary)",
        fontFamily: "var(--font-heading)",
      }}
    >
      {message}
    </p>
    <p
      className="mt-2 text-xs"
      style={{ color: "var(--text-muted)" }}
    >
      QuizClass — by Ikbal x RPL
    </p>
  </div>
);

// ─── Animated Number ──────────────────────────────────────────
export const AnimatedNumber = ({
  value,
  className,
}: {
  value: number;
  className?: string;
}) => {
  const [displayed, setDisplayed] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    prevRef.current = value;

    if (from === to) return;

    const steps = 20;
    const diff = to - from;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      setDisplayed(Math.round(from + (diff * step) / steps));
      if (step >= steps) clearInterval(timer);
    }, 30);

    return () => clearInterval(timer);
  }, [value]);

  return (
    <span className={cn("font-score", className)}>
      {displayed.toLocaleString("id-ID")}
    </span>
  );
};

// ─── Score Badge ──────────────────────────────────────────────
export const ScoreBadge = ({
  points,
  isCorrect,
}: {
  points: number;
  isCorrect: boolean;
}) => (
  <div
    className="animate-pop-in inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold"
    style={{
      background: isCorrect
        ? "rgba(0,184,148,0.2)"
        : "rgba(255,107,107,0.2)",
      color: isCorrect ? "var(--accent-green)" : "var(--accent-red)",
      border: `1px solid ${isCorrect ? "rgba(0,184,148,0.4)" : "rgba(255,107,107,0.4)"}`,
      fontFamily: "var(--font-score)",
    }}
  >
    {isCorrect ? "+" : ""}{points.toLocaleString("id-ID")} poin
  </div>
);

// ─── Progress Bar ─────────────────────────────────────────────
export const ProgressBar = ({
  value,
  max,
  color = "var(--accent-purple)",
  className,
}: {
  value: number;
  max: number;
  color?: string;
  className?: string;
}) => {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={cn("progress-bar-container", className)}>
      <div
        className="progress-bar-fill"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
};

// ─── Badge ────────────────────────────────────────────────────
export const Badge = ({
  children,
  variant = "purple",
  className,
}: {
  children: React.ReactNode;
  variant?: "purple" | "green" | "red" | "yellow";
  className?: string;
}) => (
  <span className={cn(`badge badge-${variant}`, className)}>{children}</span>
);

// ─── Stat Card (Admin) ────────────────────────────────────────
export const StatCard = ({
  label,
  value,
  icon,
  color = "var(--accent-purple)",
  sub,
}: {
  label: string;
  value: string | number;
  icon: string;
  color?: string;
  sub?: string;
}) => (
  <div
    className="stat-card gradient-card flex-1"
    style={{ minWidth: 0 }}
  >
    <div className="flex items-start justify-between mb-3">
      <p
        className="text-xs font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </p>
      <span className="text-xl">{icon}</span>
    </div>
    <p
      className="text-2xl font-bold"
      style={{
        fontFamily: "var(--font-score)",
        color,
      }}
    >
      {typeof value === "number" ? value.toLocaleString("id-ID") : value}
    </p>
    {sub && (
      <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
        {sub}
      </p>
    )}
  </div>
);

// ─── Empty State ──────────────────────────────────────────────
export const EmptyState = ({
  emoji,
  title,
  subtitle,
  action,
}: {
  emoji: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) => (
  <div className="flex flex-col items-center justify-center py-12 text-center px-6">
    <div className="text-5xl mb-4">{emoji}</div>
    <h3
      className="text-lg font-bold mb-2"
      style={{ fontFamily: "var(--font-heading)", color: "var(--text-primary)" }}
    >
      {title}
    </h3>
    {subtitle && (
      <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
        {subtitle}
      </p>
    )}
    {action}
  </div>
);

// ─── Section Header ───────────────────────────────────────────
export const SectionHeader = ({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) => (
  <div className="flex items-start justify-between mb-4">
    <div>
      <h2
        className="text-lg font-extrabold"
        style={{ fontFamily: "var(--font-heading)", color: "var(--text-primary)" }}
      >
        {title}
      </h2>
      {subtitle && (
        <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
          {subtitle}
        </p>
      )}
    </div>
    {right && <div className="flex-shrink-0">{right}</div>}
  </div>
);

// ─── Credit Footer ────────────────────────────────────────────
export const CreditFooter = () => (
  <p
    className="text-center text-xs py-4"
    style={{ color: "var(--text-muted)" }}
  >
    🎮 QuizClass —{" "}
    <span style={{ color: "var(--accent-purple-light)" }}>
      by Ikbal x RPL
    </span>
  </p>
);

// ─── Toast Notification ───────────────────────────────────────
interface ToastProps {
  message: string;
  type?: "success" | "error" | "info";
  visible: boolean;
}

export const Toast = ({ message, type = "info", visible }: ToastProps) => {
  const colors = {
    success: { bg: "rgba(0,184,148,0.15)", border: "var(--accent-green)", icon: "✅" },
    error: { bg: "rgba(255,107,107,0.15)", border: "var(--accent-red)", icon: "❌" },
    info: { bg: "rgba(108,92,231,0.15)", border: "var(--accent-purple)", icon: "ℹ️" },
  }[type];

  return (
    <div
      className="fixed top-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300"
      style={{
        opacity: visible ? 1 : 0,
        transform: `translateX(-50%) translateY(${visible ? "0" : "-20px"})`,
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <div
        className="flex items-center gap-3 px-5 py-3 rounded-2xl text-sm font-semibold shadow-lg"
        style={{
          background: colors.bg,
          border: `1px solid ${colors.border}`,
          color: "var(--text-primary)",
          fontFamily: "var(--font-heading)",
          backdropFilter: "blur(12px)",
          minWidth: "200px",
          maxWidth: "320px",
        }}
      >
        <span>{colors.icon}</span>
        <span>{message}</span>
      </div>
    </div>
  );
};

// ─── useToast Hook ────────────────────────────────────────────
export const useToast = () => {
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
    visible: boolean;
  }>({ message: "", type: "info", visible: false });

  const showToast = (
    message: string,
    type: "success" | "error" | "info" = "info"
  ) => {
    setToast({ message, type, visible: true });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 3000);
  };

  const ToastComponent = () => (
    <Toast
      message={toast.message}
      type={toast.type}
      visible={toast.visible}
    />
  );

  return { showToast, ToastComponent };
};