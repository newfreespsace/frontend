import React, { useState } from "react";
import { Button, Form, Icon, Modal } from "semantic-ui-react";

import api from "@/api";
import { useAsyncCallbackPending, useNavigationChecked } from "@/utils/hooks";
import toast from "@/utils/toast";

interface CreateTrainingModalProps {
  nextSortOrder: number;
  onCreated?: (training: ApiTypes.TrainingMetaDto) => void | Promise<void>;
}

const CreateTrainingModal: React.FC<CreateTrainingModalProps> = props => {
  const navigation = useNavigationChecked();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [pending, onSubmit] = useAsyncCallbackPending(async () => {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      toast.error("请输入训练标题");
      return;
    }

    const { requestError, response } = await api.training.createTraining({
      title: normalizedTitle,
      description: description.trim() || undefined,
      sortOrder: props.nextSortOrder
    });
    if (requestError) toast.error(requestError((key: string) => key));
    else {
      setOpen(false);
      setTitle("");
      setDescription("");
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
          添加训练
        </Button>
      }
    >
      <Modal.Header>添加训练</Modal.Header>
      <Modal.Content>
        <Form onSubmit={onSubmit}>
          <Form.Input label="标题" value={title} onChange={e => setTitle(e.currentTarget.value)} />
          <Form.TextArea label="描述" value={description} onChange={(e, { value }) => setDescription(String(value))} />
        </Form>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={() => setOpen(false)}>取消</Button>
        <Button primary loading={pending} onClick={onSubmit}>
          创建
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default CreateTrainingModal;
