import React, { useEffect, useState } from "react";
import { Header, Icon, Message, Segment, Table } from "semantic-ui-react";
import { observer } from "mobx-react";

import style from "../common/TrainingPage.module.less";

import api from "@/api";
import { appState } from "@/appState";
import { defineRoute, RouteError } from "@/AppRouter";
import { Link, useAsyncCallbackPending, useLocalizer } from "@/utils/hooks";
import MarkdownContent from "@/markdown/MarkdownContent";
import CreateSectionModal from "../common/CreateSectionModal";
import DeleteConfirmModal from "../common/DeleteConfirmModal";
import OrderButtons from "../common/OrderButtons";
import RenameTitleModal from "../common/RenameTitleModal";
import TrainingManageModal from "../common/TrainingManageModal";
import TrainingProgressBar from "../common/TrainingProgressBar";
import toast from "@/utils/toast";

interface ChapterViewData {
  training: ApiTypes.TrainingMetaDto;
  chapter: ApiTypes.ChapterMetaDto;
  sections: ApiTypes.SectionMetaDto[];
}

async function fetchData(trainingId: number, chapterId: number): Promise<ChapterViewData> {
  const trainingResult = await api.training.getTrainingById({ id: trainingId });
  if (trainingResult.requestError)
    throw new RouteError(trainingResult.requestError, { showRefresh: true, showBack: true });

  const chapterResult = await api.training.getChapterById({ id: chapterId });
  if (chapterResult.requestError)
    throw new RouteError(chapterResult.requestError, { showRefresh: true, showBack: true });

  const sectionsResult = await api.training.querySectionSetByChapterId({ chapterId });
  if (sectionsResult.requestError)
    throw new RouteError(sectionsResult.requestError, { showRefresh: true, showBack: true });

  return {
    training: trainingResult.response,
    chapter: chapterResult.response,
    sections: ((sectionsResult.response as unknown) || []) as ApiTypes.SectionMetaDto[]
  };
}

interface ChapterViewPageProps extends ChapterViewData {}

let ChapterViewPage: React.FC<ChapterViewPageProps> = props => {
  const _ = useLocalizer("training");
  const [chapter, setChapter] = useState(props.chapter);
  const [sections, setSections] = useState(props.sections);
  const canManageTraining = appState.currentUserHasPrivilege("ManageProblem");
  const [deletePending, onDelete] = useAsyncCallbackPending(async (id: number) => {
    const { requestError } = await api.training.delSectionById({ id });
    if (requestError) toast.error(requestError((key: string) => key));
    else setSections(currentSections => normalizeSortOrder(currentSections.filter(section => section.id !== id)));
  });
  const [reorderPending, onMoveSection] = useAsyncCallbackPending(async (index: number, direction: -1 | 1) => {
    const nextSections = moveItem(sections, index, direction);
    if (nextSections === sections) return;
    setSections(nextSections);
    const items = nextSections.map((section, nextIndex) => ({ id: section.id, sortOrder: nextIndex + 1 }));
    const { requestError } = await api.training.reorderSections({ chapterId: props.chapter.id, items });
    if (requestError) {
      toast.error(requestError((key: string) => key));
      setSections(sections);
    }
  });

  useEffect(() => {
    appState.enterNewPage(chapter.title, "training");
  }, [chapter.title]);

  function normalizeSortOrder(items: ApiTypes.SectionMetaDto[]): ApiTypes.SectionMetaDto[] {
    return items.map((item, index) => ({ ...item, sortOrder: index + 1 }));
  }

  function moveItem(items: ApiTypes.SectionMetaDto[], index: number, direction: -1 | 1): ApiTypes.SectionMetaDto[] {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return items;
    const nextItems = [...items];
    [nextItems[index], nextItems[targetIndex]] = [nextItems[targetIndex], nextItems[index]];
    return normalizeSortOrder(nextItems);
  }

  function onSectionCreated(section: ApiTypes.SectionMetaDto) {
    setSections(currentSections =>
      normalizeSortOrder([...currentSections, section].sort((a, b) => a.sortOrder - b.sortOrder))
    );
  }

  const [renamePending, onRenameChapter] = useAsyncCallbackPending(
    async ({ title, description }: { title: string; description: string }) => {
      const { requestError, response } = await api.training.updateChapter({ id: chapter.id, title, description });
      if (requestError) toast.error(requestError((key: string) => key));
      else
        setChapter(currentChapter => ({
          ...currentChapter,
          title: response.title,
          description: response.description
        }));
    }
  );

  const manageModal = canManageTraining && (
    <TrainingManageModal
      title={_(".manage_section")}
      actions={
        <>
          <RenameTitleModal
            title={_(".rename_chapter")}
            label={_(".chapter")}
            initialTitle={chapter.title}
            initialDescription={chapter.description}
            pending={renamePending}
            onSubmit={onRenameChapter}
          />
          <CreateSectionModal
            trainingId={props.training.id}
            chapterId={chapter.id}
            nextSortOrder={sections.length + 1}
            onCreated={onSectionCreated}
          />
        </>
      }
    >
      {sections.length ? (
        <Table basic="very" textAlign="center" unstackable className={style.manageTable}>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell width={1}>#</Table.HeaderCell>
              <Table.HeaderCell className={style.tableTitle}>{_(".section")}</Table.HeaderCell>
              <Table.HeaderCell width={2}>{_(".order")}</Table.HeaderCell>
              <Table.HeaderCell width={1}>{_(".action")}</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {sections.map((section, index) => (
              <Table.Row key={section.id}>
                <Table.Cell>{section.sortOrder}</Table.Cell>
                <Table.Cell className={style.tableTitle}>{section.title}</Table.Cell>
                <Table.Cell>
                  <OrderButtons
                    index={index}
                    count={sections.length}
                    disabled={reorderPending}
                    onMoveUp={() => onMoveSection(index, -1)}
                    onMoveDown={() => onMoveSection(index, 1)}
                  />
                </Table.Cell>
                <Table.Cell>
                  <DeleteConfirmModal
                    title={_(".delete_section")}
                    content={_(".confirm_delete_section", { title: section.title })}
                    pending={deletePending}
                    onConfirm={() => onDelete(section.id)}
                  />
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      ) : (
        <div className={style.manageEmpty}>{_(".empty_section")}</div>
      )}
    </TrainingManageModal>
  );

  return (
    <>
      <div className={style.header}>
        <div className={style.headerTitle}>
          <Header as="h1">{chapter.title}</Header>
        </div>
        {canManageTraining && <div className={style.headerActions}>{manageModal}</div>}
      </div>

      {chapter.description && (
        <p style={{ marginBottom: 30, marginTop: 30 }}>
          <MarkdownContent content={chapter.description} />
        </p>
      )}

      {sections.length ? (
        <Table basic="very" textAlign="center" unstackable className={style.progressTable}>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell className={style.indexColumn}>#</Table.HeaderCell>
              <Table.HeaderCell className={style.tableTitle}>{_(".section")}</Table.HeaderCell>
              <Table.HeaderCell className={style.progressColumn}>{_(".progress")}</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {sections.map(section => (
              <Table.Row key={section.id}>
                <Table.Cell className={style.indexColumn}>{section.sortOrder}</Table.Cell>
                <Table.Cell className={style.tableTitle}>
                  <div className={style.titleWithProgress}>
                    <Link href={`/t/${props.training.id}/${chapter.id}/${section.id}`}>{section.title}</Link>
                  </div>
                </Table.Cell>
                <Table.Cell className={style.progressColumn}>
                  <TrainingProgressBar
                    acceptedProblemCount={section.acceptedProblemCount}
                    problemCount={section.problemCount}
                  />
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      ) : (
        <Segment placeholder textAlign="center">
          <Header icon>
            <Icon name="list alternate" />
            {_(".empty_section")}
          </Header>
        </Segment>
      )}
    </>
  );
};

ChapterViewPage = observer(ChapterViewPage);

export default defineRoute(async request => {
  const trainingId = Number(request.params.trainingId);
  const chapterId = Number(request.params.chapterId);
  if (!Number.isSafeInteger(trainingId) || !Number.isSafeInteger(chapterId))
    throw new RouteError("Invalid chapter id" as any);
  return <ChapterViewPage {...await fetchData(trainingId, chapterId)} />;
});
