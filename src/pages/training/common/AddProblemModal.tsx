import React, { useState } from "react";
import { Button, Icon, Label, Modal, Segment } from "semantic-ui-react";

import style from "./TrainingPage.module.less";

import api from "@/api";
import ProblemSearch from "@/components/ProblemSearch";
import { useAsyncCallbackPending } from "@/utils/hooks";
import toast from "@/utils/toast";

interface AddProblemModalProps {
  section: ApiTypes.GetSectionByIdResponseDto;
  onAdded: () => void | Promise<void>;
}

function getProblemId(meta: ApiTypes.ProblemMetaDto) {
  return meta.displayId ? `#${meta.displayId}` : `P${meta.id}`;
}

const AddProblemModal: React.FC<AddProblemModalProps> = props => {
  const [open, setOpen] = useState(false);
  const [selectedProblem, setSelectedProblem] = useState<ApiTypes.QueryProblemSetResponseItemDto>(null);

  const [pending, onSubmit] = useAsyncCallbackPending(async () => {
    if (!selectedProblem) {
      toast.error("请选择题目");
      return;
    }
    if (props.section.problems.some(problem => problem.meta.id === selectedProblem.meta.id)) {
      toast.error("该题目已在当前小节中");
      return;
    }

    const problems = props.section.problems
      .map((problem, index) => ({ problemId: problem.meta.id, sortOrder: index + 1 }))
      .concat({ problemId: selectedProblem.meta.id, sortOrder: props.section.problems.length + 1 });
    const { requestError, response } = await api.training.setSectionProblems({
      sectionId: props.section.id,
      problems
    });
    if (requestError) toast.error(requestError((key: string) => key));
    else if (!response.success) toast.error("添加失败");
    else {
      await props.onAdded();
      setSelectedProblem(null);
      setOpen(false);
    }
  });

  return (
    <Modal
      size="small"
      open={open}
      onClose={() => setOpen(false)}
      trigger={
        <Button primary className="labeled icon" onClick={() => setOpen(true)}>
          <Icon name="plus" />
          添加题目
        </Button>
      }
    >
      <Modal.Header>添加题目</Modal.Header>
      <Modal.Content>
        <ProblemSearch
          className={style.problemSearch}
          placeholder="搜索题目"
          onResultSelect={problem => setSelectedProblem(problem)}
        />
        {selectedProblem && (
          <Segment className={style.selectedProblem}>
            <Label basic>{getProblemId(selectedProblem.meta)}</Label>
            {selectedProblem.title}
          </Segment>
        )}
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={() => setOpen(false)}>取消</Button>
        <Button primary loading={pending} onClick={onSubmit}>
          添加
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default AddProblemModal;
