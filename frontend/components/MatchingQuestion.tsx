"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { MatchPair } from "@/types";

interface MatchingQuestionProps {
  pairs: MatchPair[];
  onAnswer: (matchingResult: string) => void;
  disabled?: boolean;
}

type MatchState = { [leftIdx: number]: number }; // leftIdx -> rightIdx

// Shuffle an array
const shuffleArray = <T,>(arr: T[]): T[] => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const COLORS = [
  "#6C5CE7", "#00B894", "#FD79A8", "#FDCB6E",
  "#00CEC9", "#E17055", "#74B9FF", "#A29BFE",
];

export default function MatchingQuestion({ pairs, onAnswer, disabled = false }: MatchingQuestionProps) {
  const [shuffledRight, setShuffledRight] = useState<{ text: string; origIdx: number }[]>([]);
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [matches, setMatches] = useState<MatchState>({});
  const [submitted, setSubmitted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const leftRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rightRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const shuffled = shuffleArray(
      pairs.map((p, i) => ({ text: p.right, origIdx: i }))
    );
    setShuffledRight(shuffled);
  }, [pairs]);

  // Force re-render to recompute line positions after layout
  useEffect(() => {
    const timer = setTimeout(() => forceUpdate(n => n + 1), 100);
    return () => clearTimeout(timer);
  }, [matches, shuffledRight]);

  const handleLeftClick = useCallback((idx: number) => {
    if (disabled || submitted) return;
    // If already matched, allow re-selection to reassign
    setSelectedLeft(prev => prev === idx ? null : idx);
  }, [disabled, submitted]);

  const handleRightClick = useCallback((rightShuffledIdx: number) => {
    if (disabled || submitted) return;
    if (selectedLeft === null) return;

    setMatches(prev => {
      const newMatches = { ...prev };
      // Remove any existing match pointing to this right item
      Object.entries(newMatches).forEach(([k, v]) => {
        if (v === rightShuffledIdx) delete newMatches[Number(k)];
      });
      newMatches[selectedLeft] = rightShuffledIdx;
      return newMatches;
    });
    setSelectedLeft(null);
  }, [selectedLeft, disabled, submitted]);

  const handleSubmit = useCallback(() => {
    if (submitted || disabled) return;
    if (Object.keys(matches).length < pairs.length) return;

    setSubmitted(true);

    // Build result string: "leftIdx:rightOrigIdx,leftIdx:rightOrigIdx,..."
    const result = Object.entries(matches).map(([leftIdx, rightShuffledIdx]) => {
      const origRightIdx = shuffledRight[rightShuffledIdx]?.origIdx ?? -1;
      return `${leftIdx}:${origRightIdx}`;
    }).join(",");

    onAnswer(result);
  }, [submitted, disabled, matches, pairs.length, shuffledRight, onAnswer]);

  const handleClearMatch = useCallback((leftIdx: number) => {
    if (disabled || submitted) return;
    setMatches(prev => {
      const next = { ...prev };
      delete next[leftIdx];
      return next;
    });
  }, [disabled, submitted]);

  const allMatched = Object.keys(matches).length === pairs.length;

  // Compute curved SVG lines between matched pairs
  const getLinePoints = (leftIdx: number, rightShuffledIdx: number) => {
    if (!containerRef.current) return null;
    const containerRect = containerRef.current.getBoundingClientRect();
    const leftEl = leftRefs.current[leftIdx];
    const rightEl = rightRefs.current[rightShuffledIdx];
    if (!leftEl || !rightEl) return null;

    const leftRect = leftEl.getBoundingClientRect();
    const rightRect = rightEl.getBoundingClientRect();

    const x1 = leftRect.right - containerRect.left;
    const y1 = leftRect.top + leftRect.height / 2 - containerRect.top;
    const x2 = rightRect.left - containerRect.left;
    const y2 = rightRect.top + rightRect.height / 2 - containerRect.top;

    return { x1, y1, x2, y2 };
  };

  return (
    <div className="animate-slide-up">
      {/* SVG Lines Layer */}
      <div
        ref={containerRef}
        className="relative"
        style={{ position: "relative" }}
      >
        {/* Lines SVG */}
        <svg
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: 10,
            overflow: "visible",
          }}
        >
          {Object.entries(matches).map(([leftIdxStr, rightShuffledIdx]) => {
            const leftIdx = Number(leftIdxStr);
            const color = COLORS[leftIdx % COLORS.length];
            const pts = getLinePoints(leftIdx, rightShuffledIdx);
            if (!pts) return null;
            const { x1, y1, x2, y2 } = pts;

            // Cubic bezier control points for a smooth S-curve
            const cx1 = x1 + (x2 - x1) * 0.5;
            const cy1 = y1;
            const cx2 = x1 + (x2 - x1) * 0.5;
            const cy2 = y2;

            return (
              <path
                key={leftIdx}
                d={`M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`}
                stroke={color}
                strokeWidth={3}
                fill="none"
                strokeDasharray={submitted ? "none" : "6 3"}
                style={{
                  filter: `drop-shadow(0 0 4px ${color}80)`,
                  strokeLinecap: "round",
                }}
              />
            );
          })}

          {/* Preview line from selected left to cursor — optional, skip for simplicity */}
        </svg>

        {/* Left & Right columns */}
        <div className="grid grid-cols-2 gap-4 relative">
          {/* Left Column */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-center mb-2 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Soal
            </p>
            {pairs.map((pair, idx) => {
              const isSelected = selectedLeft === idx;
              const isMatched = matches[idx] !== undefined;
              const color = COLORS[idx % COLORS.length];

              return (
                <div
                  key={idx}
                  ref={el => { leftRefs.current[idx] = el; }}
                  onClick={() => isMatched ? handleClearMatch(idx) : handleLeftClick(idx)}
                  className="px-3 py-3 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-200 select-none"
                  style={{
                    background: isSelected
                      ? `${color}25`
                      : isMatched
                        ? `${color}15`
                        : "var(--bg-elevated)",
                    border: `2px solid ${isSelected || isMatched ? color : "var(--border)"}`,
                    color: "var(--text-primary)",
                    fontFamily: "var(--font-heading)",
                    transform: isSelected ? "scale(1.02)" : "scale(1)",
                    boxShadow: isSelected ? `0 0 12px ${color}50` : "none",
                    textAlign: "center",
                    minHeight: 44,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {pair.left}
                  {isMatched && (
                    <span className="ml-1 text-xs" style={{ color }}>✓</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right Column */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-center mb-2 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Jawaban
            </p>
            {shuffledRight.map((item, shuffledIdx) => {
              const matchedLeftIdx = Object.entries(matches).find(
                ([, v]) => v === shuffledIdx
              )?.[0];
              const isMatchedTo = matchedLeftIdx !== undefined;
              const color = isMatchedTo ? COLORS[Number(matchedLeftIdx) % COLORS.length] : undefined;
              const isHighlighted = selectedLeft !== null && !isMatchedTo;

              return (
                <div
                  key={shuffledIdx}
                  ref={el => { rightRefs.current[shuffledIdx] = el; }}
                  onClick={() => handleRightClick(shuffledIdx)}
                  className="px-3 py-3 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-200 select-none"
                  style={{
                    background: isMatchedTo
                      ? `${color}15`
                      : isHighlighted
                        ? "rgba(108,92,231,0.08)"
                        : "var(--bg-elevated)",
                    border: `2px solid ${
                      isMatchedTo
                        ? color
                        : isHighlighted
                          ? "rgba(108,92,231,0.3)"
                          : "var(--border)"
                    }`,
                    color: "var(--text-primary)",
                    fontFamily: "var(--font-heading)",
                    transform: isHighlighted ? "scale(1.02)" : "scale(1)",
                    textAlign: "center",
                    minHeight: 44,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {item.text}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Instructions */}
      {!submitted && (
        <p className="text-center text-xs mt-3" style={{ color: "var(--text-muted)" }}>
          {selectedLeft !== null
            ? "👉 Sekarang pilih pasangan di kolom kanan"
            : "👈 Pilih item di kiri dulu, lalu pasangkan ke kanan"
          }
        </p>
      )}

      {/* Progress */}
      <div className="flex items-center justify-between mt-3 mb-2">
        <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
          {Object.keys(matches).length}/{pairs.length} terjodohkan
        </p>
        <div
          className="rounded-full overflow-hidden"
          style={{ width: 80, height: 4, background: "var(--border)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${(Object.keys(matches).length / pairs.length) * 100}%`,
              background: "var(--accent-purple)",
            }}
          />
        </div>
      </div>

      {/* Submit Button */}
      {!submitted && (
        <button
          onClick={handleSubmit}
          disabled={!allMatched || disabled}
          className="w-full py-3 rounded-xl font-bold text-sm transition-all mt-2"
          style={{
            background: allMatched && !disabled
              ? "var(--accent-green)"
              : "var(--bg-elevated)",
            color: allMatched && !disabled ? "white" : "var(--text-muted)",
            border: `2px solid ${allMatched && !disabled ? "var(--accent-green)" : "var(--border)"}`,
            opacity: disabled ? 0.6 : 1,
            cursor: allMatched && !disabled ? "pointer" : "not-allowed",
          }}
        >
          {allMatched ? "🔗 Kirim Jawaban Penjodohan!" : `Jodohkan semua dulu (${Object.keys(matches).length}/${pairs.length})`}
        </button>
      )}

      {submitted && (
        <div
          className="w-full py-3 rounded-xl font-bold text-sm text-center"
          style={{
            background: "rgba(0,184,148,0.1)",
            color: "var(--accent-green)",
            border: "2px solid rgba(0,184,148,0.3)",
          }}
        >
          ✅ Jawaban Terkirim!
        </div>
      )}
    </div>
  );
}
