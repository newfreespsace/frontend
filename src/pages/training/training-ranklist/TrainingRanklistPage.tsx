import React, { useEffect } from "react";
import { Button, Header, Icon, Table } from "semantic-ui-react";
import { observer } from "mobx-react";
import { useCurrentRoute } from "react-navi";

import style from "./TrainingRanklistPage.module.less";

import api from "@/api";
import { appState } from "@/appState";
import { defineRoute, RouteError } from "@/AppRouter";
import { Pagination } from "@/components/Pagination";
import ScoreText from "@/components/ScoreText";
import UserLink from "@/components/UserLink";
import { makeToBeLocalizedText } from "@/locales";
import formatDateTime from "@/utils/formatDateTime";
import { Link, useLocalizer } from "@/utils/hooks";

const USERS_PER_PAGE = appState.serverPreference.pagination.userList;

interface TrainingRanklistPageProps {
  training: ApiTypes.TrainingMetaDto;
  response: ApiTypes.QueryTrainingRanklistResponseDto;
  currentPage: number;
}

async function fetchData(
  trainingId: number,
  currentPage: number
): Promise<Pick<TrainingRanklistPageProps, "training" | "response">> {
  const [trainingResult, ranklistResult] = await Promise.all([
    api.training.getTrainingById({ id: trainingId }),
    api.training.queryTrainingRanklist({
      trainingId,
      skipCount: USERS_PER_PAGE * (currentPage - 1),
      takeCount: USERS_PER_PAGE
    })
  ]);

  if (trainingResult.requestError)
    throw new RouteError(trainingResult.requestError, { showRefresh: true, showBack: true });
  if (ranklistResult.requestError)
    throw new RouteError(ranklistResult.requestError, { showRefresh: true, showBack: true });
  if (ranklistResult.response.error)
    throw new RouteError(makeToBeLocalizedText("training.ranklist_take_too_many"), {
      showRefresh: true,
      showBack: true
    });

  return {
    training: trainingResult.response,
    response: ranklistResult.response
  };
}

let TrainingRanklistPage: React.FC<TrainingRanklistPageProps> = props => {
  const _ = useLocalizer("training");
  const currentRoute = useCurrentRoute();

  useEffect(() => {
    appState.enterNewPage(_(".training_ranklist_page_title", { title: props.training.title }), "training");
  }, [appState.locale, props.training.title]);

  useEffect(() => {
    document.documentElement.scrollTop = 0;
  }, [props.currentPage]);

  function renderRank(rank: number): React.ReactNode {
    const medal = { 1: "🥇", 2: "🥈", 3: "🥉" }[rank];
    if (!medal) return rank;

    const label = _(".rank_number", { rank: String(rank) });
    return (
      <span className={style.medal} title={label} role="img" aria-label={label}>
        {medal}
      </span>
    );
  }

  return (
    <>
      <div className={style.header}>
        <div>
          <Header as="h1">{_(".training_ranklist_title")}</Header>
          <div className={style.trainingTitle}>{props.training.title}</div>
        </div>
        <Button as={Link} href={`/t/${props.training.id}`}>
          <Icon name="arrow left" />
          {_(".back_to_training")}
        </Button>
      </div>

      {props.response.result.length ? (
        <div className={style.tableWrap}>
          <Table basic="very" textAlign="center" unstackable className={style.ranklist}>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell className={style.rank}>{_(".rank")}</Table.HeaderCell>
                <Table.HeaderCell>{_(".user")}</Table.HeaderCell>
                <Table.HeaderCell>{_(".accepted_progress")}</Table.HeaderCell>
                <Table.HeaderCell>{_(".last_submission_time")}</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {props.response.result.map(item => (
                <Table.Row key={item.user.id}>
                  <Table.Cell className={style.rank}>{renderRank(item.rank)}</Table.Cell>
                  <Table.Cell>
                    <UserLink user={item.user} />
                  </Table.Cell>
                  <Table.Cell>
                    <ScoreText
                      score={
                        props.response.problemCount
                          ? (item.acceptedProblemCount / props.response.problemCount) * 100
                          : 0
                      }
                    >
                      {item.acceptedProblemCount}/{props.response.problemCount}
                    </ScoreText>
                  </Table.Cell>
                  <Table.Cell className={style.time}>{formatDateTime(new Date(item.lastSubmissionTime))[1]}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      ) : (
        <div className={style.empty}>
          <Icon name="file outline" />
          <div>{_(".empty_training_ranklist")}</div>
        </div>
      )}

      {props.response.count > USERS_PER_PAGE && (
        <div className={style.pagination}>
          <Pagination
            totalCount={props.response.count}
            currentPage={props.currentPage}
            itemsPerPage={USERS_PER_PAGE}
            pageUrl={page => ({
              query: {
                ...currentRoute.url.query,
                page: page.toString()
              }
            })}
          />
        </div>
      )}
    </>
  );
};

TrainingRanklistPage = observer(TrainingRanklistPage);

export default defineRoute(async request => {
  const trainingId = Number(request.params.trainingId);
  if (!Number.isSafeInteger(trainingId)) throw new RouteError("Invalid training id" as any);

  let currentPage = parseInt(request.query.page) || 1;
  if (currentPage < 1) currentPage = 1;

  return <TrainingRanklistPage currentPage={currentPage} {...await fetchData(trainingId, currentPage)} />;
});
