import React from 'react';
import PropTypes from 'prop-types';
import CloseIcon from '@material-ui/icons/Close';
import { IconButton, Snackbar, SnackbarContent } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { amber, green } from '@material-ui/core/colors';

const colors = makeStyles(theme => ({
  success: {
    backgroundColor: green[600],
  },
  info: {
    backgroundColor: theme.palette.primary.main,
  },
  warning: {
    backgroundColor: amber[700],
  },
  error: {
    backgroundColor: theme.palette.error.dark,
  },
}));

export default function ColoredSnackBar(props) {
  const { level, message, open, onClose, ...other } = props;
  const classes = colors();
  const handleClose = onClose ? onClose : () => { };
  return (
    <Snackbar
      {...other}
      open={open}
      onClose={handleClose}
    >
      <SnackbarContent
        className={level ? classes[level] : undefined}
        message={message}
        action={[
          <IconButton
            key="close"
            color="inherit"
            onClick={event => handleClose(event, 'click')}>
            <CloseIcon />
          </IconButton>
        ]}
      />
    </Snackbar>
  );
};

ColoredSnackBar.propTypes = {
  color: PropTypes.oneOf(['success', 'info', 'warning', 'error']),
};
