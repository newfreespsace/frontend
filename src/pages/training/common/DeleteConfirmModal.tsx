import React, { useState } from "react";
import { Button, Header, Icon, Modal } from "semantic-ui-react";

import style from "./TrainingPage.module.less";

import { useLocalizer } from "@/utils/hooks";

interface DeleteConfirmModalProps {
  title: string;
  content: string;
  pending: boolean;
  onConfirm: () => void | Promise<void>;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = props => {
  const _ = useLocalizer("training");
  const [open, setOpen] = useState(false);

  async function onConfirm() {
    try {
      await props.onConfirm();
    } finally {
      setOpen(false);
    }
  }

  return (
    <Modal
      basic
      size="small"
      open={open}
      onClose={() => !props.pending && setOpen(false)}
      trigger={<Icon className={style.deleteIcon} name="delete" title={_(".delete")} onClick={() => setOpen(true)} />}
    >
      <Header icon="delete" content={props.title} />
      <Modal.Content>{props.content}</Modal.Content>
      <Modal.Actions>
        <Button basic inverted disabled={props.pending} onClick={() => setOpen(false)}>
          {_(".cancel")}
        </Button>
        <Button basic inverted negative loading={props.pending} onClick={onConfirm}>
          {_(".confirm_delete")}
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default DeleteConfirmModal;
