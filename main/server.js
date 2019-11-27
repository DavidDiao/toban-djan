const _ = require('lodash');
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const hasha = require('hasha');
const http = require('http');
const path = require('path');
const { app, dialog, BrowserWindow, ipcMain } = require('electron');

let win;
let config = {};

exports.start = (url, extraConf) => fs.readFile(path.join(app.getPath('userData'), 'config.json'), (err, data) => {
    if (!err) {
        config = JSON.parse(data);
    }
    app.whenReady().then(() => {
        win = new BrowserWindow({
            ..._.pick(config, ['x', 'y', 'width', 'height']),
            backgroundColor: '#2e2c29',
            show: false,
            ...extraConf,
        });
        win.loadURL(url);
        win.removeMenu();
        win.once('ready-to-show', () => {
            win.show();
        });
        win.on('close', () => {
            config = _.merge(config, win.getBounds());
            fs.writeFile(path.join(app.getPath('userData'), 'config.json'), JSON.stringify(config), () => { });
        });
        win.on('closed', () => win = null);
        // win.webContents.openDevTools();
    });
});

require('../backend').start().then(() => console.log('Backend started.'));

function sendRequest(name, parameters) {
    return new Promise(resolve => {
        const content = JSON.stringify(parameters);
        const req = http.request({
            host: 'localhost',
            port: 6096,
            method: 'POST',
            path: name,
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(content) }
        }, res => {
            res.setEncoding('utf8');
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        });
        req.write(content);
        req.end();
    });
}

let token;

ipcMain.handle('login', async (event, args) => {
    const result = await sendRequest('/login', args);
    if (result.success) {
        token = result.token;
        return { success: true, msg: '登录成功' };
    }
    await new Promise(resolve => setTimeout(resolve, 500));
    return { success: false, msg: result.msg };
});

ipcMain.handle('loggedIn', () => {
    return Boolean(token);
});

ipcMain.handle('logout', () => {
    token = undefined;
});

ipcMain.handle('listFile', async (event, path) => {
    // await new Promise(resolve => setTimeout(resolve, 500));
    return await sendRequest('/ls', { token, path });
});

ipcMain.handle('selectLocalFiles', async () => {
    const files = await dialog.showOpenDialog(win, {
        defaultPath: config.defaultPath,
        properties: ['openFile', 'multiSelections'],
    });
    if (files.canceled) return undefined;
    config.defaultPath = path.dirname(files.filePaths[0]);
    return files.filePaths.map(value => ({
        fullpath: value,
        filename: path.basename(value),
    }));
});

ipcMain.handle('createFolder', async (event, path, name) => {
    return await sendRequest('/createFolder', { token, path, name });
});

ipcMain.handle('delete', async (event, path, filename) => {
    return await sendRequest('/delete', { token, path, filename });
});

ipcMain.handle('rename', async (event, path, oldName, newName) => {
    return await sendRequest('/rename', { token, path, oldName, newName });
});

let fileCnt = 0, fileQueue = [], processing = false;

function next() {
    if (!processing && fileQueue.length) {
        processing = true;
        fileQueue.shift()();
    }
}

ipcMain.on('upload', (event, rawfile, path, filename) => {
    const state = { state: 'queuing' };
    const id = ++fileCnt;

    ipcMain.on(`progress${id}`, event => {
        event.returnValue = _.clone(state);
    });

    const broadcast = () => win.webContents.send(`progress${id}`, state);

    fileQueue.push(async () => {
        state.state = 'preparing';
        win.webContents.send(`progress${id}`, state);
        const hash = await hasha.fromFile(rawfile, { algorithm: 'sha256' });
        processing = false;
        next();
        state.state = 'uploading';
        // state.progress = 0;
        // state.total = fs.statSync(rawfile).size;
        broadcast();

        let form  = new FormData();
        form.append('file', fs.createReadStream(rawfile));
        form.append('token', token);
        form.append('hash', hash);
        form.append('path', path);
        form.append('filename', filename);
        const response = await axios.post('http://localhost:6096/upload', form, {
            transformRequest: [data => data],
            headers: form.getHeaders(),
            maxContentLength: 2000 * 1024 * 1024,
            onUploadProgress: event => {
                // Not supported
                // state.progress = event.loaded;
                // state.total = event.total;
                // if (state.progress === event.loaded) state.state = 'verifying';
                state.state = 'verifying';
                broadcast();
            },
            validateStatus: () => true,
        });
        state.state = response.data.success ? 'done' : response.data.msg;
        broadcast();
    });

    next();

    event.returnValue = id;
});
