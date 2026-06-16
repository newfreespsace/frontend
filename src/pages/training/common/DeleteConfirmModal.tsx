import React, { useState } from "react";
import { Button, Header, Icon, Modal } from "semantic-ui-react";

import style from "./TrainingPage.module.less";

interface DeleteConfirmModalProps {
  title: string;
  content: string;
  pending: boolean;
  onConfirm: () => void | Promise<void>;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = props => {
  const [open, setOpen] = useState(false);

  async function onConfirm() {
    await props.onConfirm();
    setOpen(false);
  }

  return (
    <Modal
      basic
      size="small"
      open={open}
      onClose={() => !props.pending && setOpen(false)}
      trigger={<Icon className={style.deleteIcon} name="delete" title="删除" onClick={() => setOpen(true)} />}
    >
      <Header icon="delete" content={props.title} />
      <Modal.Content>{props.content}</Modal.Content>
      <Modal.Actions>
        <Button basic inverted disabled={props.pending} onClick={() => setOpen(false)}>
          取消
        </Button>
        <Button basic inverted negative loading={props.pending} onClick={onConfirm}>
          确认删除
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default DeleteConfirmModal;
