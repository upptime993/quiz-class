"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Socket } from "socket.io-client";
import {
  getPlayerSocket,
  disconnectPlayerSocket,
  soundManager,
} from "@/lib/utils";
import { usePlayerStore } from "@/store";
import { useQuizStore } from "@/store";
import { Avatar, FloatingReaction, REACTION_EMOJIS } from "@/types";

// ─── useSocket Hook ───────────────────────────────────────────
export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    socketRef.current = getPlayerSocket();
    return () => {};
  }, []);

  return socketRef.current;
};

// ─── useTimer Hook ────────────────────────────────────────────
// Timer ini sekarang bersifat DISPLAY-ONLY: server adalah sumber kebenaran.
// Frontend timer bergerak secara lokal untuk tampilan mulus (smooth display),
// tapi di-SYNC dari server setiap detik via session:timerUpdate event.
export const useTimer = (
  duration: number,
  onTick?: (remaining: number) => void,
  onEnd?: () => void
) => {
  const [remaining, setRemaining] = useState(duration);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  // Gunakan ref untuk callback terbaru (mencegah stale closures)
  const onTickRef = useRef(onTick);
  const onEndRef = useRef(onEnd);
  const durationRef = useRef(duration);
  // Track last server-synced time
  const serverSyncRef = useRef<number | null>(null);

  useEffect(() => { onTickRef.current = onTick; }, [onTick]);
  useEffect(() => { onEndRef.current = onEnd; }, [onEnd]);
  useEffect(() => { durationRef.current = duration; }, [duration]);

  const start = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const dur = durationRef.current;
    setRemaining(dur);
    setIsRunning(true);
    startTimeRef.current = Date.now();
    serverSyncRef.current = null;

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        // Jika ada sync dari server, pakai nilai server sebagai patokan
        if (serverSyncRef.current !== null) {
          const serverVal = serverSyncRef.current;
          serverSyncRef.current = null; // Reset setelah dipakai
          onTickRef.current?.(serverVal);
          if (serverVal <= 5 && serverVal > 0) soundManager.playTickBeep();
          if (serverVal <= 0) {
            setIsRunning(false);
            if (intervalRef.current) clearInterval(intervalRef.current);
            onEndRef.current?.();
          }
          return serverVal;
        }

        // Kalau belum ada sync, dekremen lokal
        const left = Math.max(0, prev - 1);
        onTickRef.current?.(left);
        if (left <= 5 && left > 0) soundManager.playTickBeep();
        if (left === 0) {
          setIsRunning(false);
          if (intervalRef.current) clearInterval(intervalRef.current);
          onEndRef.current?.();
        }
        return left;
      });
    }, 1000);
  }, []);

  // Method khusus untuk sync dari server
  const syncFromServer = useCallback((serverRemaining: number) => {
    serverSyncRef.current = serverRemaining;
    // Langsung update tampilan agar tidak ada lag satu detik
    setRemaining(serverRemaining);
  }, []);

  const stop = useCallback(() => {
    setIsRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    serverSyncRef.current = null;
  }, []);

  const reset = useCallback(() => {
    stop();
    setRemaining(durationRef.current);
  }, [stop]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const progress = duration > 0 ? remaining / duration : 0;
  const isLow = remaining <= 5;

  return { remaining, isRunning, progress, isLow, start, stop, reset, syncFromServer };
};

// ─── useCountdown Hook ────────────────────────────────────────
export const useCountdown = (
  from: number,
  onComplete?: () => void,
  autoStart = false
) => {
  const [count, setCount] = useState<number | string>(from);
  const [isDone, setIsDone] = useState(false);

  const start = useCallback(() => {
    let current = from;
    setCount(from);
    setIsDone(false);

    const tick = () => {
      soundManager.playCountdownBeep(current);

      if (current > 0) {
        setTimeout(() => {
          current--;
          setCount(current);
          if (current === 0) {
            setTimeout(() => {
              setCount("GO!");
              setIsDone(true);
              soundManager.playCountdownBeep(0);
              onComplete?.();
            }, 800);
          } else {
            tick();
          }
        }, 1000);
      }
    };

    tick();
  }, [from, onComplete]);

  useEffect(() => {
    if (autoStart) start();
  }, [autoStart, start]);

  return { count, isDone, start };
};

// ─── useFloatingReactions Hook ────────────────────────────────
export const useFloatingReactions = () => {
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);

  const addReaction = useCallback((emoji: string, username: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    const x = 10 + Math.random() * 80;

    setReactions((prev) => [...prev, { id, emoji, username, x }]);

    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id));
    }, 2500);
  }, []);

  return { reactions, addReaction };
};

// ─── useQuizSocket Hook (Main) ────────────────────────────────
export const useQuizSocket = () => {
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);
  const answerTimeRef = useRef<number>(0);

  const { username, token, avatar, setCurrentAnswer, setIsAnswered } =
    usePlayerStore();

  const {
    setStatus,
    setCurrentQuestion,
    setQuestionIndex,
    setCountdown,
    setParticipantCount,
    setAnsweredCount,
    setParticipants,
    updateParticipant,
    setResult,
    setLeaderboard,
    setFinalLeaderboard,
    resetQuiz,
  } = useQuizStore();

  // Connect & setup listeners
  useEffect(() => {
    if (!username || !token) {
      router.push("/");
      return;
    }

    const socket = getPlayerSocket();
    socketRef.current = socket;

    // Join session
    socket.emit("player:join", { token, username });

    // ─── Socket Listeners ──────────────────────────────
    socket.on("session:joined", (data) => {
      setParticipants(data.participants);
      setParticipantCount(data.participants.length);
      setStatus("waiting");
    });

    socket.on("session:playerJoined", (data) => {
      setParticipantCount(data.participantCount);
    });

    socket.on("session:avatarUpdated", (data) => {
      updateParticipant(data.username, { avatar: data.avatar });
    });

    socket.on("session:countdown", (data) => {
      setCountdown(data.count);
      setStatus("countdown");
      if (data.count === "GO") {
        setTimeout(() => setStatus("active"), 800);
      }
    });

    socket.on("session:questionStart", (data) => {
      setCurrentQuestion(data.question);
      setQuestionIndex(data.questionIndex);
      setStatus("active");
      setCurrentAnswer(null);
      setIsAnswered(false);
      setAnsweredCount(0);
      setResult(null);
      answerTimeRef.current = Date.now();
    });

    socket.on("session:playerAnswered", (data) => {
      setAnsweredCount(data.answeredCount);
    });

    socket.on("session:questionEnd", (data) => {
      setLeaderboard(data.leaderboard);
    });

    socket.on("session:myResult", (data) => {
      setResult({
        correctAnswer: data.correctAnswer,
        leaderboard: [],
        myAnswer: data.myAnswer,
        myIsCorrect: data.isCorrect,
        myPointsEarned: data.pointsEarned,
        myResponseTime: data.responseTime,
      });
      setStatus("showing_result");
      router.push("/result");
    });

    socket.on("session:nextQuestion", () => {
      setStatus("between");
    });

    socket.on("session:finished", (data) => {
      setFinalLeaderboard(data.finalLeaderboard);
      setStatus("finished");
      router.push("/winner");
    });

    socket.on("session:error", (data) => {
      alert(data.message);
      router.push("/");
    });

    socket.on("session:playerLeft", (data) => {
      setParticipantCount(data.participantCount);
    });

    return () => {
      socket.off("session:joined");
      socket.off("session:playerJoined");
      socket.off("session:avatarUpdated");
      socket.off("session:countdown");
      socket.off("session:questionStart");
      socket.off("session:playerAnswered");
      socket.off("session:questionEnd");
      socket.off("session:myResult");
      socket.off("session:nextQuestion");
      socket.off("session:finished");
      socket.off("session:error");
      socket.off("session:playerLeft");
    };
  }, [username, token]);

  // ─── Actions ────────────────────────────────────────
  const sendAvatar = useCallback(
    (newAvatar: Avatar) => {
      socketRef.current?.emit("player:setAvatar", {
        emoji: newAvatar.emoji,
        accessories: newAvatar.accessories,
      });
    },
    []
  );

  const sendReaction = useCallback((emoji: string) => {
    socketRef.current?.emit("player:reaction", { emoji });
  }, []);

  const submitAnswer = useCallback(
    (questionIndex: number, answer: string) => {
      const responseTime = Date.now() - answerTimeRef.current;
      socketRef.current?.emit("player:answer", {
        questionIndex,
        answer,
        responseTime,
      });
      setCurrentAnswer(answer);
      setIsAnswered(true);
    },
    [setCurrentAnswer, setIsAnswered]
  );

  const disconnect = useCallback(() => {
    disconnectPlayerSocket();
    resetQuiz();
  }, [resetQuiz]);

  return {
    sendAvatar,
    sendReaction,
    submitAnswer,
    disconnect,
  };
};