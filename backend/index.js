const _ = require('lodash');
const Busboy = require('busboy');
const crypto = require('crypto');
const fs = require('fs');
const hasha = require('hasha');
const http = require('http');
const nedb = require('nedb');
const os = require('os');
const path = require('path');
const randomString = require('string-random');
const url = require('url');
const { app } = require('electron');

function getPath(dbname) {
    return path.join(app.getPath('userData'), dbname + '.db'); // modify if backend would be independent
}

const db = _.mapValues(_.mapKeys(['user', 'files']), name => ['insert', 'remove', 'update', 'find', 'findOne', 'loadDatabase'].reduce((methods, method) => _.set(methods, method, (...args) => new Promise((resolve, reject) => methods.raw[method](...args, (err, docs) => err ? reject(err) : resolve(docs)))), { raw: new nedb({ filename: getPath(name) }) }));

let config;
let tokens = {};

const encryptPassword = password => crypto.createHash('sha256').update(`${config.saltBegin}${password}${config.saltEnd}`).digest('base64');

const filterFilename = filename => filename.replace(/[\\/:*?"'<>|]/g, '');

function HandleRequest(_request, _response) {
    this._response = _response;
    this.request = _request;
    this.responsed = false;
    this.response = (data, status) => {
        if (this.responsed) return;
        this.responsed = true;
        if (status) _response.writeHead(status);
        if (data === undefined) return _response.end();
        if (typeof data !== 'string') data = JSON.stringify(data);
        _response.end(data);
    };

    try {
        this.req = url.parse(this.request.url, true);
        if (!this.request.headers['content-type']) {
            this.data = {};
            this.handle();
        } else if (this.request.headers['content-type'] === 'application/json') {
            let _data = '';
            this.request.on('data', chunk => _data += chunk);
            this.request.on('end', async () => {
                this.data = _data ? JSON.parse(_data) : undefined;
                this.handle();
            });
        } else if (this.request.headers['content-type'].startsWith('multipart/form-data')) {
            this.data = {};
            this.files = {};
            const busboy = new Busboy({ headers: this.request.headers });
            const promises = [];
            busboy.on('file', (fieldname, file, fielanem, encoding, mimetype) => {
                const fn = path.join(os.tmpdir(), randomString(12));
                file.pipe(fs.createWriteStream(fn));
                file.on('end', () => {
                    promises.push(hasha.fromFile(fn, { algorithm: 'sha256' }).then((hash) => {
                        this.files[fieldname] = {
                            path: fn,
                            hash
                        };
                    }));
                });
            });
            busboy.on('field', (fieldname, val, fieldnameTruncated, valTruncated, encoding, mimetype) => {
                this.data[fieldname] = val;
            });
            busboy.on('finish', () => {
                Promise.all(promises).then(async () => {
                    await this.handle();
                    _.forEach(this.files, value => {
                        if (fs.existsSync(value.path)) fs.unlinkSync(value.path);
                    });
                });
            });
            this.request.pipe(busboy);
        }
    } catch (err) {
        if (!this.responsed) this.response({ success: false, error: err.message || err }, 500);
    }
}

HandleRequest.prototype = {
    '/login': async function () {
        console.log(`Logging in as ${this.data.username}`);
        if (!await db.user.findOne({
            _id: this.data.username,
            password: encryptPassword(this.data.password),
        })) return this.response({ success: false, msg: '账号或密码错误' });
        let token;
        do {
            token = randomString(18, { specials: true });
        } while (tokens[token]);
        tokens[token] = this.data.username;
        this.response({ success: true, token });
    },
    '/ls': async function () {
        await this.requireLogin();
        console.log(`${this.username} listing ${this.data.path}`);
        if (!await this.hasDirectory(this.data.path)) return this.response({ success: false, msg: '路径不存在' });
        this.response({
            success: true,
            data: await db.files.find({
                user: this.username,
                path: this.data.path,
            }),
        });
    },
    '/createFolder': async function () {
        await this.requireLogin();
        this.data.name = filterFilename(this.data.name);
        console.log(`${this.username} creating folder ${this.data.path + this.data.name}/`);
        if (await this.has(`${this.data.path + this.data.name}/`)) await Promise.reject(`文件已存在`);
        if (!await this.hasDirectory(this.data.path)) await Promise.reject(`路径不存在`);
        await db.files.insert({
            user: this.username,
            path: this.data.path,
            filename:this.data.name,
            type: 'folder',
            time: new Date(),
        });
        return this.response({ success: true, msg: '创建成功' });
    },
    '/delete': async function () {
        await this.requireLogin();
        console.log(`${this.username} deleteing file ${this.data.path + this.data.filename}`);
        await db.files.remove({
            user: this.username,
            path: this.data.path,
            filename: this.data.filename,
        });
        this.response({ success: true });
    },
    '/rename': async function () {
        await this.requireLogin();
        console.log(`${this.username} renamed file ${this.data.path + this.data.oldName} to ${this.data.newName}`);
        await db.files.update({
            user: this.username,
            path: this.data.path,
            filename: this.data.oldName,
        }, {
            $set: {
                filename: filterFilename(this.data.newName),
            },
        });
        this.response({ success: true, newName: filterFilename(this.data.newName) });
    },
    '/upload': async function () {
        await this.requireLogin();
        this.data.filename = filterFilename(this.data.filename);
        if (await this.has(this.data.path + this.data.filename)) await Promise.reject('文件已存在');
        if (!await this.hasDirectory(this.data.path)) await Promise.reject('路径不存在');
        console.log(`${this.username} uploading file ${this.data.path + this.data.filename}`);
        const targetFile = path.join(app.getPath('userData'), 'objects', this.files.file.hash.substr(0, 2), this.files.file.hash.substr(2));
        if (!fs.existsSync(path.dirname(targetFile))) {
            if (!fs.existsSync(path.join(app.getPath('userData'), 'objects'))) fs.mkdirSync(path.join(app.getPath('userData'), 'objects'));
            fs.mkdirSync(path.dirname(targetFile));
        }
        await new Promise((resolve, reject) => {
            fs.rename(this.files.file.path, targetFile, err => {
                if (!err) return resolve();
                fs.copyFile(this.files.file.path, targetFile, reject);
            })
        });
        await db.files.insert({
            user: this.username,
            path: this.data.path,
            filename: this.data.filename,
            hash: this.files.file.hash,
            type: 'file',
            size: fs.statSync(targetFile).size,
            time: new Date(),
        });
        this.response({ success: true });
    },
    '/view': async function () {
        const targetFile = path.join(app.getPath('userData'), 'objects', this.req.query.hash.substr(0, 2), this.req.query.hash.substr(2));
        if (!fs.existsSync(targetFile)) return this.response({ success: false, msg: '文件不存在' }, 404);
        const stream = fs.createReadStream(targetFile);
        stream.pipe(this._response);
        await new Promise(resolve => stream.on('end', resolve));
        this.response();
    },
    '/download': async function () {
        const targetFile = path.join(app.getPath('userData'), 'objects', this.req.query.hash.substr(0, 2), this.req.query.hash.substr(2));
        if (!fs.existsSync(targetFile)) return this.response({ success: false, msg: '文件不存在' }, 404);
        this._response.writeHead(200, {
            'Content-Disposition': `attachment;filename="${encodeURI(this.req.query.name)}"`,
        });
        const stream = fs.createReadStream(targetFile);
        stream.pipe(this._response);
        await new Promise(resolve => stream.on('end', resolve));
        this.response();
    },
};

HandleRequest.prototype.handle = async function () {
    this.username = tokens[this.data.token];

    if (this[this.req.pathname]) await this[this.req.pathname]().catch(err => this.response({ success: false, msg: err.message || err }, 500));
    else this.response({ success: false, msg: 'Entry not found' }, 404);
    if (!this.responsed) this.response({ success: false, msg: '无响应' });
};

HandleRequest.prototype.requireLogin = function () {
    return new Promise((resolve, reject) => {
        if (this.username) return resolve();
        this.response({ success: false, msg: '请先登录' }, 401);
        reject();
    });
};

HandleRequest.prototype.hasDirectory = async function (path) {
    if (path[0] !== '/' || path[path.length - 1] !== '/') await Promise.reject('路径不合法');
    if (path === '/') return true;
    const pos = path.lastIndexOf('/', path.length - 2) + 1;
    return Boolean(await db.files.findOne({
        user: this.username,
        path: path.substr(0, pos),
        filename: path.substring(pos, path.length - 1),
        type: 'folder',
    }));
};

HandleRequest.prototype.hasFile = async function (path) {
    if (path[0] !== '/' || path[path.length - 1] === '/') await Promise.reject('路径不合法');
    const pos = path.lastIndexOf('/') + 1;
    return Boolean(await db.files.findOne({
        user: this.username,
        path: path.substr(0, pos),
        filename: path.substr(pos),
        type: 'file',
    }));
};

HandleRequest.prototype.has = async function (path) {
    if (path[0] !== '/') await Promise.reject('路径不合法');
    if (path === '/') return true;
    if (path[path.length - 1] === '/') path = path.substring(0, path.length - 1);
    const pos = path.lastIndexOf('/') + 1;
    return Boolean(await db.files.findOne({
        user: this.username,
        path: path.substr(0, pos),
        filename: path.substr(pos),
    }));
};

exports.start = () => {
    return Promise.all([
        ..._.map(db, value => value.loadDatabase()),
        new Promise((resolve, reject) => {
            fs.readFile(path.join(__dirname, 'conf.json'), (err, data) => {
                if (err) return reject(err);
                config = JSON.parse(data);
                resolve();
            })
        }),
    ]).then(async () => {
        return new Promise(resolve => {
            db.user.findOne({}).then((doc) => {
                if (!doc) {
                    db.user.insert({
                        _id: 'admin',
                        password: encryptPassword('admin'),
                    });
                }
            });
            http.createServer((request, response) => new HandleRequest(request, response)).listen(config.port, config.host, resolve);
        })
    });
};
