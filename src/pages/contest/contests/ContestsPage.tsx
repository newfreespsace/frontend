import React, { useEffect } from "react";
import { Button, Header, Icon, Label, Segment, Table } from "semantic-ui-react";
import { observer } from "mobx-react";

import style from "./ContestsPage.module.less";

import api from "@/api";
import { appState } from "@/appState";
import { defineRoute, RouteError } from "@/AppRouter";
import { makeToBeLocalizedText } from "@/locales";
import { useLocalizer, Link } from "@/utils/hooks";
import formatDateTime from "@/utils/formatDateTime";
import { Pagination } from "@/components/Pagination";
import { getContestStatus, getContestUrl } from "../utils";

const CONTESTS_PER_PAGE = 20;

async function fetchData(currentPage: number): Promise<ApiTypes.QueryContestsResponseDto> {
  const { requestError, response } = await api.contest.queryContests({
    skipCount: CONTESTS_PER_PAGE * (currentPage - 1),
    takeCount: CONTESTS_PER_PAGE
  });
  if (requestError) throw new RouteError(requestError, { showRefresh: true, showBack: true });
  if (response.error) throw new RouteError(makeToBeLocalizedText(`contests.error.${response.error}`));
  return response;
}

interface ContestsPageProps {
  currentPage: number;
  response: ApiTypes.QueryContestsResponseDto;
}

let ContestsPage: React.FC<ContestsPageProps> = props => {
  const _ = useLocalizer("contests");

  useEffect(() => {
    appState.enterNewPage(_(".title"), "contests" as any);
  }, [appState.locale]);

  const statusColor = {
    pending: "red",
    running: "green",
    ended: "grey"
  } as const;

  return (
    <>
      <div className={style.header}>
        <Header as="h1">{_(".title")}</Header>
        {props.response.permissions.createContest && (
          <Button className={style.createContest} primary as={Link} href="/c/new">
            <Icon name="write" />
            {_(".create_contest")}
          </Button>
        )}
      </div>

      {props.response.result.length ? (
        <>
          <Table basic="very" textAlign="center">
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>{_(".contest")}</Table.HeaderCell>
                <Table.HeaderCell>{_(".start_time")}</Table.HeaderCell>
                <Table.HeaderCell>{_(".end_time")}</Table.HeaderCell>
                <Table.HeaderCell>{_(".description")}</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {props.response.result.map(contest => {
                const status = getContestStatus(contest);
                return (
                  <Table.Row key={contest.id}>
                    <Table.Cell>
                      <Link href={getContestUrl(contest.id)}>{contest.title}</Link>{" "}
                      <Label size="mini" color={statusColor[status]}>
                        {_(`.status.${status}`)}
                      </Label>
                    </Table.Cell>
                    <Table.Cell title={formatDateTime(contest.startTime)[1]}>
                      {formatDateTime(contest.startTime)[0]}
                    </Table.Cell>
                    <Table.Cell title={formatDateTime(contest.endTime)[1]}>
                      {formatDateTime(contest.endTime)[0]}
                    </Table.Cell>
                    <Table.Cell className={style.subtitle}>{contest.subtitle}</Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table>
          {props.response.count > CONTESTS_PER_PAGE && (
            <div className={style.pagination}>
              <Pagination
                totalCount={props.response.count}
                currentPage={props.currentPage}
                itemsPerPage={CONTESTS_PER_PAGE}
                pageUrl={page => ({ query: { page: page.toString() } })}
              />
            </div>
          )}
        </>
      ) : (
        <Segment placeholder textAlign="center">
          <Header icon>
            <Icon name="calendar" />
            {_(".empty")}
          </Header>
          {props.response.permissions.createContest && (
            <Button primary as={Link} href="/c/new">
              {_(".create_first_contest")}
            </Button>
          )}
        </Segment>
      )}
    </>
  );
};

export default defineRoute(async request => {
  const currentPage = Math.max(1, Number(request.query.page) || 1);
  return <ContestsPage currentPage={currentPage} response={await fetchData(currentPage)} />;
});

ContestsPage = observer(ContestsPage);
