import React from "react";
import { Button } from "semantic-ui-react";

interface OrderButtonsProps {
  index: number;
  count: number;
  disabled?: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const OrderButtons: React.FC<OrderButtonsProps> = props => (
  <Button.Group basic compact size="small">
    <Button icon="arrow up" disabled={props.disabled || props.index === 0} title="上移" onClick={props.onMoveUp} />
    <Button
      icon="arrow down"
      disabled={props.disabled || props.index === props.count - 1}
      title="下移"
      onClick={props.onMoveDown}
    />
  </Button.Group>
);

export default OrderButtons;
