import { createPostApi } from "@/api";

declare global {
  namespace ApiTypes {
    interface ProblemMetaDto {
      difficulty?: number;
    }

    interface GetProblemRequestDto {
      hasDifficultyRatings?: boolean;
    }

    interface GetProblemResponseDto {
      hasDifficultyRatings?: boolean;
    }
  }
}

export interface ProblemDifficultyRating {
  score?: number;
  canRate: boolean;
  average?: number;
  difficulty?: number;
}

interface ProblemDifficultyRatingResponse {
  error?: "NO_SUCH_PROBLEM" | "PERMISSION_DENIED";
  rating?: ProblemDifficultyRating;
}

export interface ProblemDifficultyRatingEntry {
  userId: number;
  username: string;
  nickname: string;
  isAdmin: boolean;
  score: number;
  updatedAt: string;
  counted: boolean;
}

interface ProblemDifficultyRatingsResponse {
  error?: "NO_SUCH_PROBLEM" | "PERMISSION_DENIED";
  ratings?: ProblemDifficultyRatingEntry[];
}

export const getProblemDifficultyRating = createPostApi<{ problemId: number }, ProblemDifficultyRatingResponse>(
  "problem/getProblemDifficultyRating",
  false
);

export const setProblemDifficultyRating = createPostApi<
  { problemId: number; score: number },
  ProblemDifficultyRatingResponse
>("problem/setProblemDifficultyRating", false);

export const getProblemDifficultyRatings = createPostApi<{ problemId: number }, ProblemDifficultyRatingsResponse>(
  "problem/getProblemDifficultyRatings",
  false
);

export const DIFFICULTY_NAMES = ["Very Easy", "Easy", "Medium", "Hard", "Very Hard"] as const;

export function getDifficultyName(difficulty?: number): string | null {
  return difficulty && difficulty >= 1 && difficulty <= 5 ? DIFFICULTY_NAMES[difficulty - 1] : null;
}
