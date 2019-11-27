import React from 'react';
import _ from 'lodash';
import { Box, Container, Paper, TextField } from '@material-ui/core';
import LoadButton from './components/LoadButton';

export default class LoginPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      logging: false,
      inputs: {},
      error: {},
    };
    this.inputRef = React.createRef();
  }

  checkInput(name, value) {
    this.setState({
      inputs: _.set(this.state.inputs, name, value),
      error: _.set(this.state.error, name, value ? undefined : `${name} should not be empty`),
    });
  }

  renderInput(name, type, ref = false) {
    return (
      <Box my={2}>
        <TextField
          label={name}
          variant="outlined"
          required={true}
          fullWidth={true}
          disabled={this.state.logging}
          error={Boolean(this.state.error[name])}
          helperText={this.state.error[name]}
          onBlur={event => this.checkInput(name, event.target.value)}
          onChange={event => this.checkInput(name, event.target.value)}
          type={type}
          onKeyPress={event => { if (event.key === 'Enter') this.login() }}
          ref={ref ? this.inputRef : undefined}
        />
      </Box>
    );
  }

  async login() {
    if (!Boolean(this.state.inputs.Username && this.state.inputs.Password)) return;
    this.setState({ logging: true });
    const result = await window.ipc.invoke('login', _.mapKeys(this.state.inputs, (value, key) => _.lowerCase(key)));
    this.setState({ logging: false });
    this.props.showMessage(result.msg, result.success ? 'success' : 'error');
    if (result.success) {
      if (this.props.onLoggedIn) this.props.onLoggedIn();
    } else {
      this.inputRef.current.getElementsByTagName('input')[0].focus();
    }
  }

  render() {
    return (
      <Container maxWidth="sm">
        <Box p={4} />
        <Paper>
          <Box px={4} py={2} textAlign="center">
            <h2>Login</h2>
            {this.renderInput('Username', undefined, true)}
            {this.renderInput('Password', 'password')}
            <Box textAlign="right">
              <LoadButton
                variant="contained"
                color="primary"
                loading={this.state.logging}
                disabled={!Boolean(this.state.inputs.Username && this.state.inputs.Password && !this.state.logging)}
                onClick={() => this.login()}
              >login</LoadButton>
            </Box>
          </Box>
        </Paper>
      </Container>
    );
  }
};
