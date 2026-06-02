export function getContestStatus(contest: ApiTypes.ContestMetaDto): "pending" | "running" | "ended" {
  const now = Date.now();
  if (now < new Date(contest.startTime).getTime()) return "pending";
  if (now < new Date(contest.endTime).getTime()) return "running";
  return "ended";
}

export function getContestUrl(contestId: number): string {
  return `/c/${contestId}`;
}
