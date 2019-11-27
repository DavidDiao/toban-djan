import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import LoginPage from './LoginPage';
import MainPage from './MainPage';
import * as serviceWorker from './serviceWorker';
import ColoredSnackBar from './components/ColoredSnackBar';

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      loggedIn: props.loggedIn,
      showInfo: false,
    }
  }

  showSnackBar = (message = '', level = 'default') => {
    this.setState({
      showInfo: true,
      message,
      infoLevel: level,
    });
  }

  render() {
    return (<>
      {this.state.loggedIn
        ? <MainPage
          showMessage={this.showSnackBar}
        />
        : <LoginPage
          onLoggedIn={() => this.setState({ loggedIn: true })}
          showMessage={this.showSnackBar}
        />}
      <ColoredSnackBar
        open={this.state.showInfo}
        level={this.state.infoLevel}
        autoHideDuration={1000}
        onClose={(_, reason) => { if (reason !== 'clickaway') this.setState({ showInfo: false }) }}
        message={this.state.message}
      />
    </>);
  }
}

window.ipc.invoke('loggedIn').then(result => {
  ReactDOM.render(<App loggedIn={result} />, document.getElementById('root'));
});


// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
