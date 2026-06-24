import React, { useEffect, useState } from "react";
import { Header, Icon, Message, MessageHeader, Segment, Table } from "semantic-ui-react";
import { observer } from "mobx-react";

import style from "../common/TrainingPage.module.less";

import api from "@/api";
import { appState } from "@/appState";
import { defineRoute, RouteError } from "@/AppRouter";
import { Link, useAsyncCallbackPending, useLocalizer } from "@/utils/hooks";
import MarkdownContent from "@/markdown/MarkdownContent";
import CreateChapterModal from "../common/CreateChapterModal";
import DeleteConfirmModal from "../common/DeleteConfirmModal";
import OrderButtons from "../common/OrderButtons";
import RenameTitleModal from "../common/RenameTitleModal";
import TrainingManageModal from "../common/TrainingManageModal";
import TrainingProgressBar from "../common/TrainingProgressBar";
import toast from "@/utils/toast";

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
  const _ = useLocalizer("training");
  const [training, setTraining] = useState(props.training);
  const [chapters, setChapters] = useState(props.chapters);
  const canManageTraining = appState.currentUserHasPrivilege("ManageProblem");
  const [deletePending, onDelete] = useAsyncCallbackPending(async (id: number) => {
    const { requestError } = await api.training.delChapterById({ id });
    if (requestError) toast.error(requestError((key: string) => key));
    else setChapters(currentChapters => normalizeSortOrder(currentChapters.filter(chapter => chapter.id !== id)));
  });
  const [reorderPending, onMoveChapter] = useAsyncCallbackPending(async (index: number, direction: -1 | 1) => {
    const nextChapters = moveItem(chapters, index, direction);
    if (nextChapters === chapters) return;
    setChapters(nextChapters);
    const items = nextChapters.map((chapter, nextIndex) => ({ id: chapter.id, sortOrder: nextIndex + 1 }));
    const { requestError } = await api.training.reorderChapters({ trainingId: props.training.id, items });
    if (requestError) {
      toast.error(requestError((key: string) => key));
      setChapters(chapters);
    }
  });

  useEffect(() => {
    appState.enterNewPage(training.title, "training");
  }, [training.title]);

  function normalizeSortOrder(items: ApiTypes.ChapterMetaDto[]): ApiTypes.ChapterMetaDto[] {
    return items.map((item, index) => ({ ...item, sortOrder: index + 1 }));
  }

  function moveItem(items: ApiTypes.ChapterMetaDto[], index: number, direction: -1 | 1): ApiTypes.ChapterMetaDto[] {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return items;
    const nextItems = [...items];
    [nextItems[index], nextItems[targetIndex]] = [nextItems[targetIndex], nextItems[index]];
    return normalizeSortOrder(nextItems);
  }

  function onChapterCreated(chapter: ApiTypes.ChapterMetaDto) {
    setChapters(currentChapters =>
      normalizeSortOrder([...currentChapters, chapter].sort((a, b) => a.sortOrder - b.sortOrder))
    );
  }

  const [renamePending, onRenameTraining] = useAsyncCallbackPending(
    async ({ title, description }: { title: string; description: string }) => {
      const { requestError, response } = await api.training.updateTraining({ id: training.id, title, description });
      if (requestError) toast.error(requestError((key: string) => key));
      else
        setTraining(currentTraining => ({
          ...currentTraining,
          title: response.title,
          description: response.description
        }));
    }
  );

  const manageModal = canManageTraining && (
    <TrainingManageModal
      title={_(".manage_chapter")}
      actions={
        <>
          <RenameTitleModal
            title={_(".rename_training")}
            label={_(".training")}
            initialTitle={training.title}
            initialDescription={training.description}
            pending={renamePending}
            onSubmit={onRenameTraining}
          />
          <CreateChapterModal
            trainingId={training.id}
            nextSortOrder={chapters.length + 1}
            onCreated={onChapterCreated}
          />
        </>
      }
    >
      {chapters.length ? (
        <Table basic="very" textAlign="center" unstackable className={style.manageTable}>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell width={1}>#</Table.HeaderCell>
              <Table.HeaderCell className={style.tableTitle}>{_(".chapter")}</Table.HeaderCell>
              <Table.HeaderCell width={2}>{_(".order")}</Table.HeaderCell>
              <Table.HeaderCell width={1}>{_(".action")}</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {chapters.map((chapter, index) => (
              <Table.Row key={chapter.id}>
                <Table.Cell>{chapter.sortOrder}</Table.Cell>
                <Table.Cell className={style.tableTitle}>{chapter.title}</Table.Cell>
                <Table.Cell>
                  <OrderButtons
                    index={index}
                    count={chapters.length}
                    disabled={reorderPending}
                    onMoveUp={() => onMoveChapter(index, -1)}
                    onMoveDown={() => onMoveChapter(index, 1)}
                  />
                </Table.Cell>
                <Table.Cell>
                  <DeleteConfirmModal
                    title={_(".delete_chapter")}
                    content={_(".confirm_delete_chapter", { title: chapter.title })}
                    pending={deletePending}
                    onConfirm={() => onDelete(chapter.id)}
                  />
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      ) : (
        <div className={style.manageEmpty}>{_(".empty_chapter")}</div>
      )}
    </TrainingManageModal>
  );

  return (
    <>
      <div className={style.header}>
        <div className={style.headerTitle}>
          <Header as="h1">{training.title}</Header>
        </div>
        {canManageTraining && <div className={style.headerActions}>{manageModal}</div>}
      </div>

      {training.description && (
        <p style={{ marginBottom: 24 }}>
          <MarkdownContent content={training.description} />
        </p>
      )}

      {chapters.length ? (
        <Table basic="very" textAlign="center" unstackable className={style.progressTable}>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell className={style.indexColumn}>#</Table.HeaderCell>
              <Table.HeaderCell className={style.tableTitle}>{_(".chapter")}</Table.HeaderCell>
              <Table.HeaderCell className={style.progressColumn}>{_(".progress")}</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {chapters.map(chapter => (
              <Table.Row key={chapter.id}>
                <Table.Cell className={style.indexColumn}>{chapter.sortOrder}</Table.Cell>
                <Table.Cell className={style.tableTitle}>
                  <div className={style.titleWithProgress}>
                    <Link href={`/t/${training.id}/${chapter.id}`}>{chapter.title}</Link>
                  </div>
                </Table.Cell>
                <Table.Cell className={style.progressColumn}>
                  <TrainingProgressBar
                    acceptedProblemCount={chapter.acceptedProblemCount}
                    problemCount={chapter.problemCount}
                  />
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      ) : (
        <Segment placeholder textAlign="center">
          <Header icon>
            <Icon name="list" />
            {_(".empty_chapter")}
          </Header>
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
