import React, { useState } from "react";
import { Button, Form, Icon, Modal } from "semantic-ui-react";

import { useAsyncCallbackPending, useLocalizer } from "@/utils/hooks";
import toast from "@/utils/toast";

interface RenameTitleModalProps {
  title: string;
  label: string;
  initialTitle: string;
  pending?: boolean;
  onSubmit: (title: string) => Promise<void>;
}

const RenameTitleModal: React.FC<RenameTitleModalProps> = props => {
  const _ = useLocalizer("training");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(props.initialTitle);

  const [internalPending, onSubmit] = useAsyncCallbackPending(async () => {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      toast.error(_(".input_item_name", { item: props.label }));
      return;
    }
    await props.onSubmit(normalizedTitle);
    setOpen(false);
  });
  const pending = props.pending || internalPending;

  return (
    <Modal
      size="small"
      open={open}
      onClose={() => !pending && setOpen(false)}
      trigger={
        <Button className="labeled icon" onClick={() => setOpen(true)}>
          <Icon name="edit" />
          {_(".rename")}
        </Button>
      }
    >
      <Modal.Header>{props.title}</Modal.Header>
      <Modal.Content>
        <Form onSubmit={onSubmit}>
          <Form.Input label={_(".name")} value={title} onChange={e => setTitle(e.currentTarget.value)} />
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
