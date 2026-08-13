import React, { useState } from "react";
import { Button, Form, Icon, Modal } from "semantic-ui-react";

import api from "@/api";
import { useAsyncCallbackPending, useLocalizer, useNavigationChecked } from "@/utils/hooks";
import toast from "@/utils/toast";

interface CreateTrainingModalProps {
  nextSortOrder: number;
  onCreated?: (training: ApiTypes.TrainingMetaDto) => void | Promise<void>;
}

const CreateTrainingModal: React.FC<CreateTrainingModalProps> = props => {
  const _ = useLocalizer("training");
  const navigation = useNavigationChecked();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pointsPerProblem, setPointsPerProblem] = useState(0);

  const [pending, onSubmit] = useAsyncCallbackPending(async () => {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      toast.error(_(".input_training_title"));
      return;
    }

    const { requestError, response } = await api.training.createTraining({
      title: normalizedTitle,
      description: description.trim() || undefined,
      sortOrder: props.nextSortOrder,
      pointsPerProblem
    });
    if (requestError) toast.error(requestError((key: string) => key));
    else {
      setOpen(false);
      setTitle("");
      setDescription("");
      setPointsPerProblem(0);
      if (props.onCreated) await props.onCreated(response);
      else navigation.navigate(`/t/${response.id}`);
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
          {_(".add_training")}
        </Button>
      }
    >
      <Modal.Header>{_(".add_training")}</Modal.Header>
      <Modal.Content>
        <Form onSubmit={onSubmit}>
          <Form.Input label={_(".title_field")} value={title} onChange={e => setTitle(e.currentTarget.value)} />
          <Form.TextArea
            label={_(".description")}
            value={description}
            onChange={(e, { value }) => setDescription(String(value))}
          />
          <Form.Input
            type="number"
            min={0}
            step={1}
            label={_(".points_per_problem")}
            value={pointsPerProblem}
            onChange={e => setPointsPerProblem(Math.max(0, Math.floor(Number(e.currentTarget.value) || 0)))}
          />
        </Form>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={() => setOpen(false)}>{_(".cancel")}</Button>
        <Button primary loading={pending} onClick={onSubmit}>
          {_(".create")}
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default CreateTrainingModal;
