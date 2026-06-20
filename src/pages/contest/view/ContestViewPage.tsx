import React, { useEffect, useState } from "react";
import {
  Button,
  ButtonGroup,
  Grid,
  GridColumn,
  GridRow,
  Header,
  Icon,
  Label,
  Message,
  Progress,
  Segment,
  Table
} from "semantic-ui-react";
import { observer } from "mobx-react";

import style from "./ContestViewPage.module.less";

import api from "@/api";
import { appState } from "@/appState";
import { defineRoute, RouteError } from "@/AppRouter";
import ScoreText from "@/components/ScoreText";
import StatusText from "@/components/StatusText";
import { makeToBeLocalizedText } from "@/locales";
import { Link, useLocalizer } from "@/utils/hooks";
import formatDateTime from "@/utils/formatDateTime";

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

  const contestStartTime = new Date(contest.startTime).getTime();
  const contestEndTime = new Date(contest.endTime).getTime();
  const nowTime = new Date().getTime();
  const [percent, setPercent] = useState(
    Math.floor((100 * (nowTime - contestStartTime)) / (contestEndTime - contestStartTime))
  );
  useEffect(() => {
    const timer = setInterval(() => {
      const nowTime = new Date().getTime();
      const nowPercent = Math.floor((100 * (nowTime - contestStartTime)) / (contestEndTime - contestStartTime));
      setPercent(Math.min(100, nowPercent));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const ContestActions = () => (
    <div className={style.actions}>
      <ButtonGroup>
        {props.contest.permissions.viewRanklist && (
          <Button primary as={Link} href={`/c/${contest.id}/ranklist`}>
            <Icon name="trophy" />
            {_(".ranklist")}
          </Button>
        )}
        <Button
          as={Link}
          href={{
            pathname: "/s",
            query: {
              contestId: contest.id.toString(),
              ...(appState.activeGroupContests.some(activeContest => activeContest.id === contest.id) &&
              appState.currentUser
                ? { submitter: appState.currentUser.username }
                : {})
            }
          }}
        >
          <Icon name="hourglass half" />
          {_(".submissions")}
        </Button>
        {props.contest.permissions.manage && (
          <Button as={Link} href={`/c/${contest.id}/edit`}>
            <Icon name="edit" />
            {_(".edit")}
          </Button>
        )}
      </ButtonGroup>
    </div>
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
      </div>

      <div className={style.timeline}>
        <Label pointing="below">{formatDateTime(contest.startTime)[1]}</Label>
        <Label pointing="below" style={{ float: "right" }}>
          {formatDateTime(contest.endTime)[1]}
        </Label>
        <Progress percent={percent} size="tiny" indicating />
      </div>

      <Grid>
        <GridRow>
          <GridColumn>
            <ContestActions />
          </GridColumn>
        </GridRow>
        {contest.information && (
          <GridRow>
            <GridColumn>
              <Header className={style.header} as="h4" block content={_(".information")} attached="top" />
              <Segment attached="bottom">
                <div className={style.notice}>{contest.information}</div>
              </Segment>
            </GridColumn>
          </GridRow>
        )}
        <GridRow>
          <GridColumn>
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
                        <ProblemStatusCell contest={contest} problem={problem} />
                      </Table.Cell>
                      <Table.Cell>
                        <Link href={`/c/${contest.id}/p/${index + 1}`}>
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
          </GridColumn>
        </GridRow>
      </Grid>
    </>
  );
};

interface ProblemStatusCellProps {
  contest: ApiTypes.ContestMetaDto;
  problem: ApiTypes.ContestProblemDto;
}

const ProblemStatusCell: React.FC<ProblemStatusCellProps> = props => {
  const { contest, problem } = props;
  if (!problem.submissionId) return null;

  // console.log(contest, problem);

  const content =
    contest.type === "acm" ? (
      problem.accepted ? (
        <ScoreText score={100}>+{problem.unacceptedCount || ""}</ScoreText>
      ) : problem.unacceptedCount ? (
        <ScoreText score={0}>-{problem.unacceptedCount}</ScoreText>
      ) : null
    ) : contest.type === "noi" && problem.status ? (
      <>
        <StatusText status={problem.status} statusText={problem.score == null ? undefined : `${problem.score} / 100`} />
      </>
    ) : // <StatusText status={"Wrong"} />
    problem.score != null ? (
      <ScoreText score={problem.score}>{problem.score}</ScoreText>
    ) : problem.status ? (
      <StatusText status={problem.status} />
    ) : null;

  if (!content) return null;
  return (
    <Link className={style.statusLink} href={`/c/${contest.id}/s/${problem.submissionId}`}>
      {content}
    </Link>
  );
};

export default defineRoute(async request => {
  return <ContestViewPage contest={await fetchData(Number(request.params.id))} />;
});

ContestViewPage = observer(ContestViewPage);
