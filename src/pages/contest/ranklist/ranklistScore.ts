export interface ContestRanklistScoreDetail {
  score?: number;
  submissionId?: number;
  status?: string;
  submissions?: Record<
    string,
    {
      submissionId: number;
      score?: number;
      accepted?: boolean;
      compiled?: boolean;
      time: string;
      status?: string;
      contestPhase?: "official" | "post_contest";
    }
  >;
  accepted?: boolean;
  unacceptedCount?: number;
  acceptedTime?: string;
  weightedScore?: number;
}

export function getScoreDetail(
  row: ApiTypes.ContestRanklistRowDto,
  problemId: number
): ContestRanklistScoreDetail | undefined {
  return (row.scoreDetails as Record<string, ContestRanklistScoreDetail>)[problemId];
}

export function getSubmissionTime(detail: ContestRanklistScoreDetail | undefined): string | undefined {
  if (!detail?.submissionId) return undefined;
  return detail.submissions?.[detail.submissionId]?.time;
}

export function getFirstSolvedRows(
  contest: ApiTypes.ContestMetaDto,
  problems: ApiTypes.ContestProblemDto[],
  rows: ApiTypes.ContestRanklistRowDto[]
): Record<number, number> {
  const result: Record<number, number> = {};
  for (const problem of problems) {
    let bestRowIndex = -1;
    let bestTime = Infinity;
    let bestSubmissionId = Infinity;
    let bestUserId = Infinity;
    rows.forEach((row, rowIndex) => {
      const detail = getScoreDetail(row, problem.meta.id);
      const solved = contest.type === "acm" ? detail?.accepted : detail?.score === 100;
      const submittedAt = contest.type === "acm" ? detail?.acceptedTime : getSubmissionTime(detail);
      if (!solved || !submittedAt) return;
      const time = new Date(submittedAt).getTime();
      if (!Number.isFinite(time)) return;
      const submissionId = detail.submissionId ?? Infinity;
      // Match the backend's submission order, independent of the overall ranking.
      const earlier =
        time < bestTime ||
        (time === bestTime &&
          (submissionId < bestSubmissionId || (submissionId === bestSubmissionId && row.user.id < bestUserId)));
      if (earlier) {
        bestTime = time;
        bestSubmissionId = submissionId;
        bestUserId = row.user.id;
        bestRowIndex = rowIndex;
      }
    });
    result[problem.meta.id] = bestRowIndex;
  }
  return result;
}
