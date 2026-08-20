import React, { useEffect } from "react";
import { Button, Header, Icon, Label, Message, Table } from "semantic-ui-react";
import { observer } from "mobx-react";

import style from "./ContestRanklistPage.module.less";

import api from "@/api";
import { appState } from "@/appState";
import { defineRoute, RouteError } from "@/AppRouter";
import ScoreText from "@/components/ScoreText";
import { makeToBeLocalizedText } from "@/locales";
import { Link, useLocalizer } from "@/utils/hooks";
import UserLink from "@/components/UserLink";

async function fetchData(
  contestId: number,
  ranklistScope: "official" | "combined"
): Promise<ApiTypes.GetContestRanklistResponseDto> {
  const { requestError, response } = await api.contest.getContestRanklist({
    contestId,
    locale: appState.locale,
    ranklistScope
  });
  if (requestError) throw new RouteError(requestError, { showRefresh: true, showBack: true });
  if (response.error) throw new RouteError(makeToBeLocalizedText(`contest.error.${response.error}`));
  return response;
}

interface ContestRanklistPageProps {
  response: ApiTypes.GetContestRanklistResponseDto;
}

interface ContestRanklistScoreDetail {
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

function getScoreDetail(
  row: ApiTypes.ContestRanklistRowDto,
  problemId: number
): ContestRanklistScoreDetail | undefined {
  return (row.scoreDetails as Record<string, ContestRanklistScoreDetail>)[problemId];
}

function getSubmissionTime(detail: ContestRanklistScoreDetail | undefined): string | undefined {
  if (!detail?.submissionId) return undefined;
  return detail.submissions?.[detail.submissionId]?.time;
}

function getElapsedSeconds(startTime: string, time: string | undefined): number | undefined {
  if (!time) return undefined;
  const elapsed = Math.floor((new Date(time).getTime() - new Date(startTime).getTime()) / 1000);
  return Number.isFinite(elapsed) ? Math.max(0, elapsed) : undefined;
}

function formatDuration(seconds: number | undefined): string {
  if (seconds == null) return "";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const time = [hours, minutes, rest].map(item => String(item).padStart(2, "0")).join(":");
  return days ? `${days}d ${time}` : time;
}

function getScoreScale(score: number, maxScore: number): number {
  if (!maxScore) return 0;
  return Math.max(0, Math.min(100, Math.floor((score / maxScore) * 100)));
}

function getFirstSolvedRows(
  contest: ApiTypes.ContestMetaDto,
  problems: ApiTypes.ContestProblemDto[],
  rows: ApiTypes.ContestRanklistRowDto[]
): Record<number, number> {
  const result: Record<number, number> = {};
  for (const problem of problems) {
    let bestRowIndex = -1;
    let bestTime = Infinity;
    rows.forEach((row, rowIndex) => {
      const detail = getScoreDetail(row, problem.meta.id);
      const solved = contest.type === "acm" ? detail?.accepted : detail?.score === 100;
      const time = new Date(
        contest.type === "acm" ? detail?.acceptedTime || 0 : getSubmissionTime(detail) || 0
      ).getTime();
      if (solved && time && time < bestTime) {
        bestTime = time;
        bestRowIndex = rowIndex;
      }
    });
    result[problem.meta.id] = bestRowIndex;
  }
  return result;
}

function renderRank(rank: number): React.ReactNode {
  if (rank === 1)
    return (
      <Label ribbon color="yellow">
        {rank}
      </Label>
    );
  if (rank === 2) return <Label ribbon>{rank}</Label>;
  if (rank === 3)
    return (
      <Label ribbon className={style.bronze}>
        {rank}
      </Label>
    );
  return rank;
}

let ContestRanklistPage: React.FC<ContestRanklistPageProps> = props => {
  const _ = useLocalizer("contest");
  const { meta, problems, rows } = props.response;
  const combined = props.response.ranklistScope === "combined";
  const firstSolvedRows = getFirstSolvedRows(meta, problems, rows);
  const maxScore = rows[0]?.score || 0;

  useEffect(() => {
    appState.enterNewPage(`${meta.title} - ${_(combined ? ".learning_ranklist" : ".ranklist")}`, "contests" as any);
  }, [appState.locale, meta.id, combined]);

  return (
    <>
      <div className={style.header}>
        <Header as="h1">
          {meta.title}
          <Header.Subheader>{_(combined ? ".learning_ranklist" : ".ranklist")}</Header.Subheader>
        </Header>
        <Button className={style.back} as={Link} href={`/c/${meta.id}`}>
          <Icon name="arrow left" />
          {_(".back_to_contest")}
        </Button>
      </div>
      {combined && (
        <Message
          info
          header={_(".learning_ranklist")}
          content={meta.type === "noi" ? _(".noi_learning_ranklist_notice") : _(".learning_ranklist_notice")}
        />
      )}
      <div className={style.tableWrap}>
        <Table basic="very" textAlign="center" className={style.ranklist}>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>{_(".rank")}</Table.HeaderCell>
              <Table.HeaderCell>{_(".user")}</Table.HeaderCell>
              {meta.type === "acm" && (
                <>
                  <Table.HeaderCell>{_(".accepted_count")}</Table.HeaderCell>
                  <Table.HeaderCell>{_(".penalty")}</Table.HeaderCell>
                </>
              )}
              {problems.map((problem, index) => (
                <Table.HeaderCell key={problem.meta.id}>
                  <Link href={`/c/${meta.id}/p/${index + 1}`}>{String.fromCharCode(65 + index)}</Link>
                </Table.HeaderCell>
              ))}
              {meta.type !== "acm" && <Table.HeaderCell>{_(".total_score")}</Table.HeaderCell>}
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {rows.map((row, rowIndex) => (
              <Table.Row key={row.user.id}>
                <Table.Cell className={style.rank}>{renderRank(row.rank)}</Table.Cell>
                <Table.Cell>
                  <UserLink user={row.user} />
                </Table.Cell>
                {meta.type === "acm" && (
                  <>
                    <Table.Cell>
                      <ScoreText score={getScoreScale(row.score, maxScore)}>{row.score}</ScoreText>
                    </Table.Cell>
                    <Table.Cell>{formatDuration(row.timeSpent)}</Table.Cell>
                  </>
                )}
                {problems.map(problem => {
                  const detail = getScoreDetail(row, problem.meta.id);
                  const cellClassName = firstSolvedRows[problem.meta.id] === rowIndex ? style.firstSolved : undefined;
                  return (
                    <Table.Cell key={problem.meta.id} className={cellClassName}>
                      <ProblemScoreCell contest={meta} detail={detail} combined={combined} />
                    </Table.Cell>
                  );
                })}
                {meta.type !== "acm" && (
                  <Table.Cell>
                    <ScoreText score={getScoreScale(row.score, maxScore)}>{row.score}</ScoreText>
                    <div className={style.submitTime}>{formatDuration(row.timeSpent)}</div>
                  </Table.Cell>
                )}
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>
      {!rows.length && (
        <div className={style.empty}>
          <Icon name="file outline" />
          <div>{_(".empty_ranklist")}</div>
        </div>
      )}
    </>
  );
};

interface ProblemScoreCellProps {
  contest: ApiTypes.ContestMetaDto;
  detail?: ContestRanklistScoreDetail;
  combined: boolean;
}

const ProblemScoreCell: React.FC<ProblemScoreCellProps> = props => {
  const _ = useLocalizer("contest");
  const { contest, detail, combined } = props;
  if (!detail) return null;

  const content =
    contest.type === "acm" ? (
      detail.accepted ? (
        <>
          <ScoreText score={100}>+{detail.unacceptedCount || ""}</ScoreText>
          <div className={style.submitTime}>
            {formatDuration(getElapsedSeconds(contest.startTime, detail.acceptedTime))}
          </div>
        </>
      ) : detail.unacceptedCount ? (
        <ScoreText score={0}>-{detail.unacceptedCount}</ScoreText>
      ) : null
    ) : detail.weightedScore != null ? (
      <>
        <ScoreText score={detail.score || 0}>{Math.round(detail.weightedScore)}</ScoreText>
        <div className={style.submitTime}>
          {formatDuration(getElapsedSeconds(contest.startTime, getSubmissionTime(detail)))}
        </div>
      </>
    ) : (
      <ScoreText score={0}>0</ScoreText>
    );

  const selectedSubmission = detail.submissionId && detail.submissions?.[detail.submissionId];
  return (
    <>
      {detail.submissionId ? <Link href={`/c/${contest.id}/s/${detail.submissionId}`}>{content}</Link> : <>{content}</>}
      {combined && selectedSubmission?.contestPhase === "post_contest" && (
        <div>
          <Label size="mini" color="blue">
            {_(".post_contest_result")}
          </Label>
        </div>
      )}
    </>
  );
};

export default defineRoute(async request => {
  const ranklistScope = request.mountpath.endsWith("/post-ranklist") ? "combined" : "official";
  return <ContestRanklistPage response={await fetchData(Number(request.params.id), ranklistScope)} />;
});

ContestRanklistPage = observer(ContestRanklistPage);
