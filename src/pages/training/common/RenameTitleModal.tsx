import React, { useState } from "react";
import { Button, DropdownItemProps, Form, Icon, Modal } from "semantic-ui-react";

import { useAsyncCallbackPending, useLocalizer } from "@/utils/hooks";
import toast from "@/utils/toast";

interface RenameTitleModalProps {
  title: string;
  label: string;
  initialTitle: string;
  initialDescription?: string;
  parentField?: {
    label: string;
    initialValue: number;
    options: DropdownItemProps[];
  };
  pending?: boolean;
  onSubmit: (values: { title: string; description: string; parentId?: number }) => Promise<boolean | void>;
}

const RenameTitleModal: React.FC<RenameTitleModalProps> = props => {
  const _ = useLocalizer("training");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(props.initialTitle);
  const [description, setDescription] = useState(props.initialDescription || "");
  const [parentId, setParentId] = useState(props.parentField?.initialValue);

  const [internalPending, onSubmit] = useAsyncCallbackPending(async () => {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      toast.error(_(".input_item_name", { item: props.label }));
      return;
    }
    const saved = await props.onSubmit({
      title: normalizedTitle,
      description: description.trim(),
      parentId
    });
    if (saved !== false) setOpen(false);
  });
  const pending = props.pending || internalPending;

  function onOpen() {
    setTitle(props.initialTitle);
    setDescription(props.initialDescription || "");
    setParentId(props.parentField?.initialValue);
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
          {props.parentField && (
            <Form.Select
              search
              required
              label={props.parentField.label}
              value={parentId}
              options={props.parentField.options}
              onChange={(event, data) => setParentId(Number(data.value))}
            />
          )}
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
