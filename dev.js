const path = require('path');
const { Socket } = require('net');
const server = require('./main/server');

console.log('Waiting for debug server...');

function check() {
  let sock = new Socket();
  const retry = () => {
    sock.destroy();
    check();
  }
  sock
    .on('connect', () => {
      sock.destroy();
      console.log('Debug server detected.')
      server.start('http://localhost:3000', {
        webPreferences: {
          preload: path.join(__dirname, 'devRenderInit.js')
        }
      });
    })
    .on('error', retry)
    .on('timeout', retry)
    .connect(3000, '127.0.0.1');
}

check();

