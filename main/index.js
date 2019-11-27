const path = require('path');
const url = require('url');

require('./server').start(url.format({
    pathname: path.join(__dirname, '..', 'build', 'index.html'),
    protocol: 'file:',
    slashes: true,
}), {
    webPreferences: {
        preload: path.join(__dirname, 'renderInit.js')
    }
});
