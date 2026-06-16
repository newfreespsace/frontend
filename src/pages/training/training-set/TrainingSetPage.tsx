import React, { useEffect, useState } from "react";
import { Header, Icon, Segment, Table } from "semantic-ui-react";
import { observer } from "mobx-react";

import style from "../common/TrainingPage.module.less";

import api from "@/api";
import { appState } from "@/appState";
import { defineRoute, RouteError } from "@/AppRouter";
import { Link, useAsyncCallbackPending } from "@/utils/hooks";
import CreateTrainingModal from "../common/CreateTrainingModal";
import DeleteConfirmModal from "../common/DeleteConfirmModal";
import OrderButtons from "../common/OrderButtons";
import TrainingManageModal from "../common/TrainingManageModal";
import TrainingProgressBar from "../common/TrainingProgressBar";
import toast from "@/utils/toast";

async function fetchData(): Promise<ApiTypes.QueryTrainingSetResponseDto> {
  const { requestError, response } = await api.training.queryTrainingSet(undefined);
  if (requestError) throw new RouteError(requestError, { showRefresh: true, showBack: true });
  return response;
}

interface TrainingSetPageProps {
  response: ApiTypes.QueryTrainingSetResponseDto;
}

let TrainingSetPage: React.FC<TrainingSetPageProps> = props => {
  const [trainings, setTrainings] = useState(props.response.result);
  const canManageTraining = appState.currentUserHasPrivilege("ManageProblem");
  const [deletePending, onDelete] = useAsyncCallbackPending(async (id: number) => {
    const { requestError } = await api.training.delTrainingById({ id });
    if (requestError) toast.error(requestError((key: string) => key));
    else setTrainings(currentTrainings => normalizeSortOrder(currentTrainings.filter(training => training.id !== id)));
  });
  const [reorderPending, onMoveTraining] = useAsyncCallbackPending(async (index: number, direction: -1 | 1) => {
    const nextTrainings = moveItem(trainings, index, direction);
    if (nextTrainings === trainings) return;
    setTrainings(nextTrainings);
    const items = nextTrainings.map((training, nextIndex) => ({ id: training.id, sortOrder: nextIndex + 1 }));
    const { requestError } = await api.training.reorderTrainings({ items });
    if (requestError) {
      toast.error(requestError((key: string) => key));
      setTrainings(trainings);
    }
  });

  useEffect(() => {
    appState.enterNewPage("训练", "training");
  }, []);

  function normalizeSortOrder(items: ApiTypes.TrainingMetaDto[]): ApiTypes.TrainingMetaDto[] {
    return items.map((item, index) => ({ ...item, sortOrder: index + 1 }));
  }

  function moveItem(items: ApiTypes.TrainingMetaDto[], index: number, direction: -1 | 1): ApiTypes.TrainingMetaDto[] {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return items;
    const nextItems = [...items];
    [nextItems[index], nextItems[targetIndex]] = [nextItems[targetIndex], nextItems[index]];
    return normalizeSortOrder(nextItems);
  }

  function onTrainingCreated(training: ApiTypes.TrainingMetaDto) {
    setTrainings(currentTrainings =>
      normalizeSortOrder([...currentTrainings, training].sort((a, b) => a.sortOrder - b.sortOrder))
    );
  }

  const manageModal = canManageTraining && (
    <TrainingManageModal
      title="管理训练"
      actions={<CreateTrainingModal nextSortOrder={trainings.length + 1} onCreated={onTrainingCreated} />}
    >
      {trainings.length ? (
        <Table basic="very" textAlign="center" unstackable className={style.manageTable}>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell width={1}>#</Table.HeaderCell>
              <Table.HeaderCell className={style.tableTitle}>训练</Table.HeaderCell>
              <Table.HeaderCell width={2}>顺序</Table.HeaderCell>
              <Table.HeaderCell width={1}>操作</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {trainings.map((training, index) => (
              <Table.Row key={training.id}>
                <Table.Cell>{training.sortOrder}</Table.Cell>
                <Table.Cell className={style.tableTitle}>{training.title}</Table.Cell>
                <Table.Cell>
                  <OrderButtons
                    index={index}
                    count={trainings.length}
                    disabled={reorderPending}
                    onMoveUp={() => onMoveTraining(index, -1)}
                    onMoveDown={() => onMoveTraining(index, 1)}
                  />
                </Table.Cell>
                <Table.Cell>
                  <DeleteConfirmModal
                    title="删除训练"
                    content={`确定删除训练「${training.title}」吗？该训练下的章节、小节和题目关联也会一并删除。`}
                    pending={deletePending}
                    onConfirm={() => onDelete(training.id)}
                  />
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      ) : (
        <div className={style.manageEmpty}>暂无训练</div>
      )}
    </TrainingManageModal>
  );

  return (
    <>
      <div className={style.header}>
        <div className={style.headerTitle}>
          <Header as="h1">训练</Header>
        </div>
        {canManageTraining && <div className={style.headerActions}>{manageModal}</div>}
      </div>

      {trainings.length ? (
        <Table basic="very" textAlign="center" unstackable>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell width={1}>#</Table.HeaderCell>
              <Table.HeaderCell className={style.tableTitle}>训练</Table.HeaderCell>
              <Table.HeaderCell>进度</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {trainings.map(training => (
              <Table.Row key={training.id}>
                <Table.Cell>{training.sortOrder}</Table.Cell>
                <Table.Cell className={style.tableTitle}>
                  <div className={style.titleWithProgress}>
                    <Link href={`/t/${training.id}`}>{training.title}</Link>
                  </div>
                </Table.Cell>
                <Table.Cell className={style.tableDescription}>
                  <TrainingProgressBar
                    acceptedProblemCount={training.acceptedProblemCount}
                    problemCount={training.problemCount}
                  />
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      ) : (
        <Segment placeholder textAlign="center">
          <Header icon>
            <Icon name="book" />
            暂无训练
          </Header>
        </Segment>
      )}
    </>
  );
};

TrainingSetPage = observer(TrainingSetPage);

export default defineRoute(async () => {
  return <TrainingSetPage response={await fetchData()} />;
});
