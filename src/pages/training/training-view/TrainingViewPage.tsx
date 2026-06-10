import React, { useEffect } from "react";
import { Header, Icon, Segment, Table } from "semantic-ui-react";
import { observer } from "mobx-react";

import style from "../common/TrainingPage.module.less";

import api from "@/api";
import { appState } from "@/appState";
import { defineRoute, RouteError } from "@/AppRouter";
import { Link } from "@/utils/hooks";
import CreateChapterModal from "../common/CreateChapterModal";
import TrainingProgressBar from "../common/TrainingProgressBar";

interface TrainingViewData {
  training: ApiTypes.TrainingMetaDto;
  chapters: ApiTypes.ChapterMetaDto[];
}

async function fetchData(trainingId: number): Promise<TrainingViewData> {
  const trainingResult = await api.training.getTrainingById({ id: trainingId });
  if (trainingResult.requestError)
    throw new RouteError(trainingResult.requestError, { showRefresh: true, showBack: true });

  const chaptersResult = await api.training.queryChapterSetByTrainingId({ trainingId });
  if (chaptersResult.requestError)
    throw new RouteError(chaptersResult.requestError, { showRefresh: true, showBack: true });

  return {
    training: trainingResult.response,
    chapters: ((chaptersResult.response as unknown) || []) as ApiTypes.ChapterMetaDto[]
  };
}

interface TrainingViewPageProps extends TrainingViewData {}

let TrainingViewPage: React.FC<TrainingViewPageProps> = props => {
  useEffect(() => {
    appState.enterNewPage(props.training.title, "training");
  }, [props.training.title]);

  return (
    <>
      <div className={style.header}>
        <div className={style.headerTitle}>
          <Header as="h1">{props.training.title}</Header>
          <TrainingProgressBar
            acceptedProblemCount={props.training.acceptedProblemCount}
            problemCount={props.training.problemCount}
          />
        </div>
        <div className={style.headerActions}>
          <CreateChapterModal trainingId={props.training.id} nextSortOrder={props.chapters.length + 1} />
        </div>
      </div>

      {props.training.description && <Segment className={style.description}>{props.training.description}</Segment>}

      {props.chapters.length ? (
        <Table basic="very" textAlign="center" unstackable>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell width={1}>#</Table.HeaderCell>
              <Table.HeaderCell className={style.tableTitle}>章节</Table.HeaderCell>
              <Table.HeaderCell>描述</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {props.chapters.map(chapter => (
              <Table.Row key={chapter.id}>
                <Table.Cell>{chapter.sortOrder}</Table.Cell>
                <Table.Cell className={style.tableTitle}>
                  <div className={style.titleWithProgress}>
                    <Link href={`/t/${props.training.id}/${chapter.id}`}>{chapter.title}</Link>
                    <TrainingProgressBar
                      acceptedProblemCount={chapter.acceptedProblemCount}
                      problemCount={chapter.problemCount}
                    />
                  </div>
                </Table.Cell>
                <Table.Cell className={style.tableDescription}>
                  {chapter.description || <span className={style.muted}>-</span>}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      ) : (
        <Segment placeholder textAlign="center">
          <Header icon>
            <Icon name="list" />
            暂无章节
          </Header>
          <CreateChapterModal trainingId={props.training.id} nextSortOrder={1} />
        </Segment>
      )}
    </>
  );
};

TrainingViewPage = observer(TrainingViewPage);

export default defineRoute(async request => {
  const trainingId = Number(request.params.trainingId);
  if (!Number.isSafeInteger(trainingId)) throw new RouteError("Invalid training id" as any);
  return <TrainingViewPage {...await fetchData(trainingId)} />;
});
