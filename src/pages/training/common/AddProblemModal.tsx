import React, { useState } from "react";
import { Button, Icon, Label, Modal, Segment } from "semantic-ui-react";

import style from "./TrainingPage.module.less";

import api from "@/api";
import ProblemSearch from "@/components/ProblemSearch";
import { useAsyncCallbackPending, useLocalizer } from "@/utils/hooks";
import toast from "@/utils/toast";

interface AddProblemModalProps {
  section: ApiTypes.GetSectionByIdResponseDto;
  onAdded: () => void | Promise<void>;
}

function getProblemId(meta: ApiTypes.ProblemMetaDto) {
  return meta.displayId ? `#${meta.displayId}` : `P${meta.id}`;
}

const AddProblemModal: React.FC<AddProblemModalProps> = props => {
  const _ = useLocalizer("training");
  const [open, setOpen] = useState(false);
  const [selectedProblem, setSelectedProblem] = useState<ApiTypes.QueryProblemSetResponseItemDto>(null);

  const [pending, onSubmit] = useAsyncCallbackPending(async () => {
    if (!selectedProblem) {
      toast.error(_(".select_problem"));
      return;
    }
    if (props.section.problems.some(problem => problem.meta.id === selectedProblem.meta.id)) {
      toast.error(_(".duplicate_problem"));
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
    else if (!response.success) toast.error(_(".add_failed"));
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
          {_(".add_problem")}
        </Button>
      }
    >
      <Modal.Header>{_(".add_problem")}</Modal.Header>
      <Modal.Content>
        <ProblemSearch
          className={style.problemSearch}
          placeholder={_(".search_problem")}
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
        <Button onClick={() => setOpen(false)}>{_(".cancel")}</Button>
        <Button primary loading={pending} onClick={onSubmit}>
          {_(".add")}
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default AddProblemModal;
