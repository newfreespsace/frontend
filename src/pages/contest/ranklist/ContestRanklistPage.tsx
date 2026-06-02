import React, { useEffect } from "react";
import { Button, Header, Icon, Table } from "semantic-ui-react";
import { observer } from "mobx-react";

import style from "./ContestRanklistPage.module.less";

import api from "@/api";
import { appState } from "@/appState";
import { defineRoute, RouteError } from "@/AppRouter";
import { makeToBeLocalizedText } from "@/locales";
import { Link, useLocalizer } from "@/utils/hooks";
import UserLink from "@/components/UserLink";

async function fetchData(contestId: number): Promise<ApiTypes.GetContestRanklistResponseDto> {
  const { requestError, response } = await api.contest.getContestRanklist({
    contestId,
    locale: appState.locale
  });
  if (requestError) throw new RouteError(requestError, { showRefresh: true, showBack: true });
  if (response.error) throw new RouteError(makeToBeLocalizedText(`contest.error.${response.error}`));
  return response;
}

interface ContestRanklistPageProps {
  response: ApiTypes.GetContestRanklistResponseDto;
}

let ContestRanklistPage: React.FC<ContestRanklistPageProps> = props => {
  const _ = useLocalizer("contest");

  useEffect(() => {
    appState.enterNewPage(`${props.response.meta.title} - ${_(".ranklist")}`, "contests" as any);
  }, [appState.locale, props.response.meta.id]);

  return (
    <>
      <div className={style.header}>
        <Header as="h1">{_(".ranklist")}</Header>
        <Button className={style.back} as={Link} href={`/c/${props.response.meta.id}`}>
          <Icon name="arrow left" />
          {_(".back_to_contest")}
        </Button>
      </div>
      <Table celled textAlign="center">
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>{_(".rank")}</Table.HeaderCell>
            <Table.HeaderCell>{_(".user")}</Table.HeaderCell>
            <Table.HeaderCell>{_(".score")}</Table.HeaderCell>
            {props.response.problems.map((problem, index) => (
              <Table.HeaderCell key={problem.meta.id}>{String.fromCharCode(65 + index)}</Table.HeaderCell>
            ))}
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {props.response.rows.map(row => (
            <Table.Row key={row.user.id}>
              <Table.Cell>{row.rank}</Table.Cell>
              <Table.Cell>
                <UserLink user={row.user} />
              </Table.Cell>
              <Table.Cell>{row.score}</Table.Cell>
              {props.response.problems.map(problem => {
                const detail = (row.scoreDetails as any)[problem.meta.id];
                return (
                  <Table.Cell key={problem.meta.id} className={style.detail}>
                    {props.response.meta.type === "acm"
                      ? detail?.accepted
                        ? `+${detail.unacceptedCount || ""}`
                        : detail?.unacceptedCount
                        ? `-${detail.unacceptedCount}`
                        : ""
                      : detail?.weightedScore ?? detail?.score ?? ""}
                  </Table.Cell>
                );
              })}
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </>
  );
};

export default defineRoute(async request => {
  return <ContestRanklistPage response={await fetchData(Number(request.params.id))} />;
});

ContestRanklistPage = observer(ContestRanklistPage);
