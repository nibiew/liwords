import React from 'react';

import { Modal, Alert } from 'antd';

type Props = {
  visible: boolean;
  error: string;
  onOk: () => void;
  onCancel: () => void;
};

export const AvatarRemoveModal = React.memo((props: Props) => {
  return (
    <Modal
      className="avatar-update-modal"
      title="Remove avatar"
      visible={props.visible}
      okText="Remove"
      onCancel={() => {
        props.onCancel();
      }}
      onOk={() => {
        props.onOk();
      }}
    >
      Are you sure you want to remove your avatar?
      {props.error !== '' ? <Alert message={props.error} type="error" /> : null}
    </Modal>
  );
});
