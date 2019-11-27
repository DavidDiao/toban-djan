import React, { useEffect, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import CheckCircleOutlineIcon from '@material-ui/icons/CheckCircleOutline';
import { Box, CircularProgress, ListItem, ListItemText } from '@material-ui/core';
import Loading from './Loading';

const useStyles = makeStyles({
  item: {
    root: {
      display: 'flex',
    },
  },
  text: {
    wordBreak: 'break-word',
  },
  loading: {
    flexShrink: 0,
    marginLeft: 8,
  },
});

const parseBytes = (bytes) => {
  let unit = 0;
  while (bytes >= 1000) {
    bytes /= 1024;
    ++unit;
  }
  if (unit) bytes = bytes.toFixed(2);
  return bytes + ['B', 'KB', 'MB', 'GB', 'TB', 'PB'][unit];
};

export default function UploadProgress(props) {
  const classes = useStyles();
  const [state, setState] = useState(() => window.ipc.sendSync(`progress${props.id}`));
  const updateState = (event, message) => setState(message);

  useEffect(() => {
    window.ipc.on(`progress${props.id}`, updateState);
    return () => window.ipc.removeListener(`progress${props.id}`, updateState);
  }, [props.id, state]);

  return (
    <ListItem className={classes.item}>
      <ListItemText
        primary={props.text}
        secondary={state.state === 'queuing' ? '等待中'
          : state.state === 'preparing' ? '准备中'
            : state.state === 'uploading' ? '上传中' || `${parseBytes(state.progress)}/${parseBytes(state.total)}` // Progress is not supported
              : state.state === 'verifying' ? '检查中'
                : state.state === 'done' ? '已完成' : state.state}
        className={classes.text}
      />
      {state.state === 'uploading' || state.state === 'verifying' || state.state === 'queuing' || state.state === 'preparing' ? <Loading
        size={20}
        className={classes.loading}
      /> :
        state.state === 'uploading' || state.state === 'verifying' ? <CircularProgress // Progress is not supported
          variant="static"
          size={20}
          value={state.total ? 100 * state.progress / state.total : 100}
        /> : <Box width={20}><CheckCircleOutlineIcon color="primary" /></Box>

      }
    </ListItem>
  );
}
