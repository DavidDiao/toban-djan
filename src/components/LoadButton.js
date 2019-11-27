import React from 'react';
import PropTypes from 'prop-types';
import Button from '@material-ui/core/Button';
import Loading from './Loading';

export default class LoadButton extends React.Component {
  render() {
    const { loading, children, ...props } = this.props;
    return (
      <Button {...props}>
        <Loading
          size="20px"
          style={{
            position: 'absolute',
            display: loading ? 'block' : 'none',
          }}
        />
        {children}
      </Button>
    );
  }
};

LoadButton.propTypes = {
  loading: PropTypes.bool,
};
