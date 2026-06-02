import React, { useEffect } from "react";
import { Button, Header, Icon, Label, Message, Segment, Table } from "semantic-ui-react";
import { observer } from "mobx-react";

import style from "./ContestViewPage.module.less";

import api from "@/api";
import { appState } from "@/appState";
import { defineRoute, RouteError } from "@/AppRouter";
import { makeToBeLocalizedText } from "@/locales";
import { Link, useLocalizer } from "@/utils/hooks";
import formatDateTime from "@/utils/formatDateTime";
import { getProblemUrl } from "@/pages/problem/utils";
import { getContestStatus } from "../utils";

async function fetchData(contestId: number): Promise<ApiTypes.GetContestResponseDto> {
  const { requestError, response } = await api.contest.getContest({
    contestId,
    locale: appState.locale
  });
  if (requestError) throw new RouteError(requestError, { showRefresh: true, showBack: true });
  if (response.error) throw new RouteError(makeToBeLocalizedText(`contest.error.${response.error}`));
  return response;
}

interface ContestViewPageProps {
  contest: ApiTypes.GetContestResponseDto;
}

let ContestViewPage: React.FC<ContestViewPageProps> = props => {
  const _ = useLocalizer("contest");
  const contest = props.contest.meta;

  useEffect(() => {
    appState.enterNewPage(`${contest.title} - ${_(".title")}`, "contests" as any);
  }, [appState.locale, contest.id]);

  const status = getContestStatus(contest);
  const progress =
    status === "pending"
      ? 0
      : status === "ended"
      ? 100
      : Math.floor(
          ((Date.now() - new Date(contest.startTime).getTime()) /
            (new Date(contest.endTime).getTime() - new Date(contest.startTime).getTime())) *
            100
        );

  return (
    <>
      <div className={style.header}>
        <div>
          <Header as="h1">
            {contest.title} <Label>{_(`.type.${contest.type}`)}</Label>
          </Header>
          <div className={style.subtitle}>{contest.subtitle}</div>
        </div>
        <div className={style.actions}>
          {props.contest.permissions.viewRanklist && (
            <Button primary as={Link} href={`/c/${contest.id}/ranklist`}>
              <Icon name="trophy" />
              {_(".ranklist")}
            </Button>
          )}
          <Button as={Link} href={{ pathname: "/s", query: { problemId: contest.problemIds.join(",") } }}>
            <Icon name="hourglass half" />
            {_(".submissions")}
          </Button>
          {props.contest.permissions.manage && (
            <Button as={Link} href={`/c/${contest.id}/edit`}>
              <Icon name="edit" />
              {_(".edit")}
            </Button>
          )}
        </div>
      </div>

      <div className={style.timeline}>
        <Label pointing="below">{formatDateTime(contest.startTime)[1]}</Label>
        <Label pointing="below" style={{ float: "right" }}>
          {formatDateTime(contest.endTime)[1]}
        </Label>
        <div className={style.progress}>
          <div className={style.bar} style={{ width: `${progress}%` }} />
        </div>
      </div>

      {contest.information && (
        <Segment>
          <Header as="h4">{_(".information")}</Header>
          <div className={style.notice}>{contest.information}</div>
        </Segment>
      )}

      {!props.contest.permissions.unveiled ? (
        <Message info>{_(".not_started")}</Message>
      ) : (
        <Table selectable celled>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell width={2} textAlign="center">
                {_(".problem.status")}
              </Table.HeaderCell>
              <Table.HeaderCell>{_(".problem.title")}</Table.HeaderCell>
              {props.contest.permissions.viewStatistics && (
                <Table.HeaderCell width={2} textAlign="center">
                  {_(".problem.statistics")}
                </Table.HeaderCell>
              )}
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {props.contest.problems.map((problem, index) => (
              <Table.Row key={problem.meta.id}>
                <Table.Cell className={style.statusCell}>
                  {contest.type === "acm" && problem.accepted ? (
                    <Label color="green">+{problem.unacceptedCount || ""}</Label>
                  ) : problem.submissionId ? (
                    <Label color={problem.status === "Accepted" ? "green" : "orange"}>
                      {problem.score != null ? problem.score : problem.status}
                    </Label>
                  ) : null}
                </Table.Cell>
                <Table.Cell>
                  <Link
                    href={getProblemUrl(problem.meta.displayId || problem.meta.id, {
                      use: problem.meta.displayId ? "displayId" : "id"
                    })}
                  >
                    {String.fromCharCode(65 + index)}. {problem.title}
                  </Link>
                </Table.Cell>
                {props.contest.permissions.viewStatistics && (
                  <Table.Cell textAlign="center">
                    {problem.statistics.accepted}
                    {contest.type !== "acm" && ` / ${problem.statistics.partially}`}
                    {` / ${problem.statistics.attempt}`}
                  </Table.Cell>
                )}
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </>
  );
};

export default defineRoute(async request => {
  return <ContestViewPage contest={await fetchData(Number(request.params.id))} />;
});

ContestViewPage = observer(ContestViewPage);
