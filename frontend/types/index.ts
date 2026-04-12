// ─── Avatar Types (Emoji Kitchen System) ─────────────────────
export const AVATAR_EMOJIS = [
  "🦊", "🐨", "🐭", "🦁", "🐻", "🐼", "🐸", "🐣", "🐻‍❄️", "👻", "👽", "🤖", "🐙", "🦖", "🐢", "🐶", "🐱", "🐰", "🐷", "🐵", "🦄", "🦇", "🦉", "🦋", "🍄", "🌵", "🐯", "🐧", "🦆", "🦅", "🐬", "🐳", "🦈", "🐊", "🦎", "🐍", "🦜", "🐝", "🐞", "🐠", "🐡", "🦞", "🦀", "🐚",
  "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😭", "😉", "😗", "😙", "😚", "😘", "🥰", "😍", "🤩", "🥳", "🫠", "🙃", "🙂", "🥹", "😊", "🥲", "☺️", "🤤", "😌", "😏", "😋", "😛", "😐", "😑", "😬", "🥺", "😔", "🤪", "😜", "😝", "😶", "🫥", "🤐", "🫡", "🤔", "🤫", "🫢", "😒", "🧐", "🤭", "🤨", "😱", "🥱", "🫣", "🤗", "😓", "🤯", "🤧", "😞", "😳", "🫨", "😪", "🫤", "😲", "😴", "😵", "😡", "🙄", "😤", "😥", "😨", "😯", "😮", "😧", "😢", "😩", "😖", "😣", "😫", "🥵", "🥶", "🤢", "🤓", "🤑", "🤠", "😇", "🤥", "🤒", "😷", "😎", "🤡", "🥸", "🤕", "☠️", "👹", "⛄", "👺", "👾", "😹", "🙈", "😾", "😽", "🙀", "😼", "🌚", "🌝", "🌞", "🌛", "🌜", "😺", "⚡", "💥", "💢", "🙊", "💤", "🫂", "🦶", "👀", "👁️", "🫦", "👅", "👄", "👃", "🦴", "💦", "🦷", "🫀", "👤", "👥", "👣", "🗣️", "🙏", "🙇", "🙋", "💁", "🙆", "🙅", "🤦", "🪂", "⛷️", "🤼", "🧟", "🧙", "🧛", "🚴", "🧒", "🧔", "👼"
] as const;

export type AvatarEmoji = typeof AVATAR_EMOJIS[number];

// New Avatar: supports Emoji Kitchen mix
export interface Avatar {
  emoji: string;           // Base emoji (e.g., "🦊")
  mixEmoji?: string;       // Second emoji to mix with (optional)
  mixImageUrl?: string;    // Resulting Kitchen image URL (optional)
}

// ─── Emoji Kitchen URL Helper ─────────────────────────────────
// Emoji Kitchen images are served from Google's CDN
// Format: https://www.gstatic.com/android/keyboard/emojikitchen/{date}/{code1}/{code1}_{code2}.png
export const EMOJI_KITCHEN_BASE = "https://www.gstatic.com/android/keyboard/emojikitchen";

// Known working date codes for emoji kitchen combinations
export const EMOJI_KITCHEN_DATES = [
  "20230301", "20221101", "20220506", "20210831",
  "20201001", "20230803", "20240213",
];

export const getEmojiCodepoint = (emoji: string): string => {
  const codePoints: string[] = [];
  for (const char of emoji) {
    const cp = char.codePointAt(0);
    if (cp !== undefined && cp !== 0xFE0F) { // skip variation selector
      codePoints.push(cp.toString(16));
    }
  }
  return codePoints.join("-");
};

export const getEmojiKitchenUrl = (emoji1: string, emoji2: string, dateCode: string = "20230301"): string => {
  const code1 = getEmojiCodepoint(emoji1);
  const code2 = getEmojiCodepoint(emoji2);
  return `${EMOJI_KITCHEN_BASE}/${dateCode}/u${code1}/u${code1}_u${code2}.png`;
};

// ─── Quiz Types ───────────────────────────────────────────────
export interface Option {
  label: "A" | "B" | "C" | "D";
  text: string;
}

export interface MatchPair {
  left: string;
  right: string;
}

export interface Question {
  _id?: string;
  order: number;
  text: string;
  imageUrl?: string | null;
  duration: number;
  answerType: "multiple_choice" | "text" | "matching";
  options: Option[];
  correctAnswer: string;
  acceptedAnswers?: string[]; // For text mode: list of accepted correct answers
  matchPairs?: MatchPair[];   // For matching mode: pairs to match
  points: number;
}

export interface Quiz {
  _id: string;
  adminId: string;
  title: string;
  description: string;
  defaultDuration: number;
  questions: Question[];
  totalQuestions: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Session Types ────────────────────────────────────────────
export type SessionStatus =
  | "waiting"
  | "countdown"
  | "active"
  | "between"
  | "showing_result"
  | "finished"
  | "canceled";

export interface Participant {
  socketId: string;
  username: string;
  avatar: Avatar;
  score: number;
  answers: AnswerRecord[];
  joinedAt: string;
  isConnected: boolean;
}

export interface AnswerRecord {
  questionIndex: number;
  answer: string;
  isCorrect: boolean;
  responseTime: number;
  pointsEarned: number;
}

export interface Session {
  _id: string;
  quizId: string;
  adminId: string;
  name?: string;
  token: string;
  status: SessionStatus;
  currentQuestion: number;
  participants: Participant[];
  startedAt?: string;
  finishedAt?: string;
}

// ─── Socket Event Types ───────────────────────────────────────
export interface LeaderboardEntry {
  username: string;
  avatar: Avatar;
  score: number;
  rank: number;
  pointsEarned?: number;
  isCorrect?: boolean;
  isConnected?: boolean;
  answers?: AnswerRecord[];
}

export interface QuestionResult {
  correctAnswer: string;
  answerType?: "multiple_choice" | "text" | "matching";
  acceptedAnswers?: string[];
  matchPairs?: MatchPair[];
  leaderboard: LeaderboardEntry[];
  myAnswer?: string;
  myIsCorrect?: boolean;
  myPointsEarned?: number;
  myResponseTime?: number;
}

export interface QuestionStartPayload {
  question: {
    order: number;
    text: string;
    imageUrl?: string | null;
    answerType: "multiple_choice" | "text" | "matching";
    options: Option[];
    matchPairs?: MatchPair[];
    duration: number;
    totalQuestions: number;
  };
  questionIndex: number;
}

// ─── Store Types ──────────────────────────────────────────────
export interface PlayerState {
  username: string;
  token: string;
  sessionId: string;
  avatar: Avatar;
  score: number;
  currentAnswer: string | null;
  isAnswered: boolean;
}

export interface QuizUIState {
  status: SessionStatus;
  currentQuestion: QuestionStartPayload["question"] | null;
  questionIndex: number;
  countdown: number | string;
  participantCount: number;
  answeredCount: number;
  participants: Participant[];
  result: QuestionResult | null;
  leaderboard: LeaderboardEntry[];
  finalLeaderboard: LeaderboardEntry[];
}

export interface AdminState {
  isLoggedIn: boolean;
  token: string;
  adminId: string;
  username: string;
  className: string;
  role?: string;
}

// ─── API Response Types ───────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface LoginResponse {
  token: string;
  admin: {
    _id: string;
    username: string;
    className: string;
    role: string;
  };
}

// ─── Emoji Reaction Types ─────────────────────────────────────
export const REACTION_EMOJIS = ["😀", "😍", "🤪", "😜", "🥰", "🎉", "🔥", "👏"] as const;
export type ReactionEmoji = typeof REACTION_EMOJIS[number];

export interface FloatingReaction {
  id: string;
  emoji: string;
  username: string;
  x: number;
}

// ─── Duel 1v1 Types ───────────────────────────────────────────
export type DuelStatus =
  | "waiting"
  | "countdown"
  | "active"
  | "showing_result"
  | "between"
  | "finished"
  | "canceled";

export interface DuelPlayer {
  username: string;
  avatar: Avatar;
  score: number;
  isConnected: boolean;
}

export interface DuelRoom {
  token: string;
  quizTitle: string;
  totalQuestions: number;
  creator: DuelPlayer | null;
  opponent: DuelPlayer | null;
  status: DuelStatus;
}

export interface DuelQuiz {
  _id: string;
  title: string;
  description: string;
  totalQuestions: number;
  defaultDuration: number;
  allow1v1?: boolean;
}

export interface DuelResult {
  isCorrect: boolean;
  pointsEarned: number;
  myAnswer: string | null;
  correctAnswer: string;
  answerType: string;
  matchPairs?: MatchPair[];
  responseTime: number;
  creatorScore: number;
  opponentScore: number;
}

export interface DuelUIState {
  // Room
  token: string;
  username: string;
  role: "creator" | "opponent" | null;
  quizTitle: string;
  totalQuestions: number;

  // Players
  creator: DuelPlayer | null;
  opponent: DuelPlayer | null;

  // Game
  status: DuelStatus;
  currentQuestion: QuestionStartPayload["question"] | null;
  questionIndex: number;
  countdown: number | string;
  result: DuelResult | null;

  // Final
  winner: "creator" | "opponent" | "draw" | null;
  finalCreator: DuelPlayer | null;
  finalOpponent: DuelPlayer | null;
}