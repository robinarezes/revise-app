import { callBackend } from "./backendClient";

export type LeaderboardEntry = {
  rank: number;
  username: string | null;
  points: number;
  isMe: boolean;
};

export type LeaderboardResponse = {
  ranking: LeaderboardEntry[];
  me: { rank: number; username: string | null; points: number } | null;
};

export function getLeaderboard(): Promise<LeaderboardResponse> {
  return callBackend<LeaderboardResponse>("/api/ai", { action: "leaderboard" });
}
