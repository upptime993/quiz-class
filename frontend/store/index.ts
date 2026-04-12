import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  Avatar,
  PlayerState,
  QuizUIState,
  AdminState,
  LeaderboardEntry,
  QuestionResult,
  QuestionStartPayload,
  Participant,
  SessionStatus,
  DuelUIState,
  DuelPlayer,
  DuelStatus,
  DuelResult,
} from "@/types";

// ─── Default Avatar ───────────────────────────────────────────
const defaultAvatar: Avatar = { emoji: "🦊" };

// ─── Player Store ─────────────────────────────────────────────
interface PlayerStore extends PlayerState {
  setUsername: (username: string) => void;
  setToken: (token: string) => void;
  setSessionId: (id: string) => void;
  setAvatar: (avatar: Avatar) => void;
  setScore: (score: number) => void;
  setCurrentAnswer: (answer: string | null) => void;
  setIsAnswered: (v: boolean) => void;
  resetPlayer: () => void;
  logout: () => void;
}

export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set) => ({
      username: "",
      token: "",
      sessionId: "",
      avatar: defaultAvatar,
      score: 0,
      currentAnswer: null,
      isAnswered: false,

      setUsername: (username) => set({ username }),
      setToken: (token) => set({ token }),
      setSessionId: (sessionId) => set({ sessionId }),
      setAvatar: (avatar) => set({ avatar }),
      setScore: (score) => set({ score }),
      setCurrentAnswer: (currentAnswer) => set({ currentAnswer }),
      setIsAnswered: (isAnswered) => set({ isAnswered }),
      resetPlayer: () =>
        set({
          username: "",
          token: "",
          sessionId: "",
          avatar: defaultAvatar,
          score: 0,
          currentAnswer: null,
          isAnswered: false,
        }),
      logout: () =>
        set({
          username: "",
          token: "",
          sessionId: "",
          avatar: defaultAvatar,
          score: 0,
          currentAnswer: null,
          isAnswered: false,
        }),
    }),
    {
      name: "quizclass-player",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// ─── Quiz UI Store ────────────────────────────────────────────
interface QuizStore extends QuizUIState {
  setStatus: (status: SessionStatus) => void;
  setCurrentQuestion: (q: QuestionStartPayload["question"] | null) => void;
  setQuestionIndex: (index: number) => void;
  setCountdown: (count: number | string) => void;
  setParticipantCount: (count: number) => void;
  setAnsweredCount: (count: number) => void;
  setParticipants: (participants: Participant[]) => void;
  updateParticipant: (username: string, data: Partial<Participant>) => void;
  setResult: (result: QuestionResult | null) => void;
  setLeaderboard: (lb: LeaderboardEntry[]) => void;
  setFinalLeaderboard: (lb: LeaderboardEntry[]) => void;
  resetQuiz: () => void;
}

const initialQuizState: QuizUIState = {
  status: "waiting",
  currentQuestion: null,
  questionIndex: 0,
  countdown: 3,
  participantCount: 0,
  answeredCount: 0,
  participants: [],
  result: null,
  leaderboard: [],
  finalLeaderboard: [],
};

export const useQuizStore = create<QuizStore>()(
  persist(
    (set) => ({
      ...initialQuizState,

      setStatus: (status) => set({ status }),
      setCurrentQuestion: (currentQuestion) => set({ currentQuestion }),
      setQuestionIndex: (questionIndex) => set({ questionIndex }),
      setCountdown: (countdown) => set({ countdown }),
      setParticipantCount: (participantCount) => set({ participantCount }),
      setAnsweredCount: (answeredCount) => set({ answeredCount }),
      setParticipants: (participants) => set({ participants }),
      updateParticipant: (username, data) =>
        set((state) => ({
          participants: state.participants.map((p) =>
            p.username === username ? { ...p, ...data } : p
          ),
        })),
      setResult: (result) => set({ result }),
      setLeaderboard: (leaderboard) => set({ leaderboard }),
      setFinalLeaderboard: (finalLeaderboard) => set({ finalLeaderboard }),
      resetQuiz: () => set(initialQuizState),
    }),
    {
      name: "quizclass-quiz",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// ─── Admin Store ──────────────────────────────────────────────
interface AdminStore extends AdminState {
  setAdminAuth: (data: {
    token: string;
    adminId: string;
    username: string;
    className: string;
    role?: string;
  }) => void;
  setClassName: (className: string) => void;
  logoutAdmin: () => void;
}

export const useAdminStore = create<AdminStore>()(
  persist(
    (set) => ({
      isLoggedIn: false,
      token: "",
      adminId: "",
      username: "",
      className: "",
      role: "",

      setAdminAuth: ({ token, adminId, username, className, role }) =>
        set({ isLoggedIn: true, token, adminId, username, className, role: role || "" }),
      setClassName: (className) => set({ className }),
      logoutAdmin: () =>
        set({
          isLoggedIn: false,
          token: "",
          adminId: "",
          username: "",
          className: "",
          role: "",
        }),
    }),
    {
      name: "quizclass-admin",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// ─── Duel Store ───────────────────────────────────────────────
const initialDuelState: DuelUIState = {
  token: "",
  username: "",
  role: null,
  quizTitle: "",
  totalQuestions: 0,
  creator: null,
  opponent: null,
  status: "waiting",
  currentQuestion: null,
  questionIndex: 0,
  countdown: 3,
  result: null,
  winner: null,
  finalCreator: null,
  finalOpponent: null,
};

interface DuelStore extends DuelUIState {
  setToken: (token: string) => void;
  setUsername: (username: string) => void;
  setRole: (role: "creator" | "opponent") => void;
  setQuizInfo: (title: string, total: number) => void;
  setCreator: (p: DuelPlayer | null) => void;
  setOpponent: (p: DuelPlayer | null) => void;
  setStatus: (status: DuelStatus) => void;
  setCurrentQuestion: (q: DuelUIState["currentQuestion"]) => void;
  setQuestionIndex: (i: number) => void;
  setCountdown: (c: number | string) => void;
  setResult: (r: DuelResult | null) => void;
  setFinished: (data: {
    winner: "creator" | "opponent" | "draw";
    finalCreator: DuelPlayer;
    finalOpponent: DuelPlayer | null;
  }) => void;
  resetDuel: () => void;
}

export const useDuelStore = create<DuelStore>()(
  persist(
    (set) => ({
      ...initialDuelState,

      setToken: (token) => set({ token }),
      setUsername: (username) => set({ username }),
      setRole: (role) => set({ role }),
      setQuizInfo: (quizTitle, totalQuestions) => set({ quizTitle, totalQuestions }),
      setCreator: (creator) => set({ creator }),
      setOpponent: (opponent) => set({ opponent }),
      setStatus: (status) => set({ status }),
      setCurrentQuestion: (currentQuestion) => set({ currentQuestion }),
      setQuestionIndex: (questionIndex) => set({ questionIndex }),
      setCountdown: (countdown) => set({ countdown }),
      setResult: (result) => set({ result }),
      setFinished: ({ winner, finalCreator, finalOpponent }) =>
        set({ winner, finalCreator, finalOpponent, status: "finished" }),
      resetDuel: () => set(initialDuelState),
    }),
    {
      name: "quizclass-duel",
      storage: createJSONStorage(() => localStorage),
    }
  )
);