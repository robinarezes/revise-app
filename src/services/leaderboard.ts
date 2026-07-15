import { callBackend } from "./backendClient";

export type LeaderboardEntry = {
  userId: string;
  rank: number;
  username: string;
  points: number;
  isMe: boolean;
};

export type LeaderboardResponse = {
  ranking: LeaderboardEntry[];
  me: { rank: number | null; points: number; needsUsername: boolean };
  weekStart: string;
};

export function getLeaderboard(): Promise<LeaderboardResponse> {
  return callBackend<LeaderboardResponse>("/api/ai", { action: "leaderboard" });
}
