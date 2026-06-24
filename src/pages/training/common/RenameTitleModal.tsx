import React, { useState } from "react";
import { Button, Form, Icon, Modal } from "semantic-ui-react";

import { useAsyncCallbackPending, useLocalizer } from "@/utils/hooks";
import toast from "@/utils/toast";

interface RenameTitleModalProps {
  title: string;
  label: string;
  initialTitle: string;
  initialDescription?: string;
  pending?: boolean;
  onSubmit: (values: { title: string; description: string }) => Promise<void>;
}

const RenameTitleModal: React.FC<RenameTitleModalProps> = props => {
  const _ = useLocalizer("training");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(props.initialTitle);
  const [description, setDescription] = useState(props.initialDescription || "");

  const [internalPending, onSubmit] = useAsyncCallbackPending(async () => {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      toast.error(_(".input_item_name", { item: props.label }));
      return;
    }
    await props.onSubmit({
      title: normalizedTitle,
      description: description.trim()
    });
    setOpen(false);
  });
  const pending = props.pending || internalPending;

  function onOpen() {
    setTitle(props.initialTitle);
    setDescription(props.initialDescription || "");
    setOpen(true);
  }

  return (
    <Modal
      size="small"
      open={open}
      onClose={() => !pending && setOpen(false)}
      trigger={
        <Button className="labeled icon" onClick={onOpen}>
          <Icon name="edit" />
          {_(".rename")}
        </Button>
      }
    >
      <Modal.Header>{props.title}</Modal.Header>
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
        <Button disabled={pending} onClick={() => setOpen(false)}>
          {_(".cancel")}
        </Button>
        <Button primary loading={pending} onClick={onSubmit}>
          {_(".save")}
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default RenameTitleModal;
