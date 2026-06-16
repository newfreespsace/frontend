import React, { useState } from "react";
import { Button, Form, Icon, Modal } from "semantic-ui-react";

import api from "@/api";
import { useAsyncCallbackPending, useLocalizer, useNavigationChecked } from "@/utils/hooks";
import toast from "@/utils/toast";

interface CreateSectionModalProps {
  trainingId: number;
  chapterId: number;
  nextSortOrder: number;
  onCreated?: (section: ApiTypes.SectionMetaDto) => void | Promise<void>;
}

const CreateSectionModal: React.FC<CreateSectionModalProps> = props => {
  const _ = useLocalizer("training");
  const navigation = useNavigationChecked();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [pending, onSubmit] = useAsyncCallbackPending(async () => {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      toast.error(_(".input_section_title"));
      return;
    }

    const { requestError, response } = await api.training.createSection({
      chapterId: props.chapterId,
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
      else navigation.navigate(`/t/${props.trainingId}/${props.chapterId}/${response.id}`);
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
          {_(".add_section")}
        </Button>
      }
    >
      <Modal.Header>{_(".add_section")}</Modal.Header>
      <Modal.Content>
        <Form onSubmit={onSubmit}>
          <Form.Input label={_(".title_field")} value={title} onChange={e => setTitle(e.currentTarget.value)} />
          <Form.TextArea
            label={_(".description")}
            value={description}
            onChange={(e, { value }) => setDescription(String(value))}
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

export default CreateSectionModal;
