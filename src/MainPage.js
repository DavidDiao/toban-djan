import React from 'react';
import _ from 'lodash';
import mime from 'mime/lite';
import { fade, makeStyles } from '@material-ui/core/styles';
import File from '@material-ui/icons/InsertDriveFileOutlined';
import Video from '@material-ui/icons/Theaters';
import Audio from '@material-ui/icons/Audiotrack';
import Image from '@material-ui/icons/Image';
import Folder from '@material-ui/icons/FolderOutlined';
import Upload from '@material-ui/icons/Publish';
import SearchIcon from '@material-ui/icons/Search';
import HomeIcon from '@material-ui/icons/Home';
import AddIcon from '@material-ui/icons/Add';
import CreateNewFolderIcon from '@material-ui/icons/CreateNewFolder';
// import FilterListIcon from '@material-ui/icons/FilterList';
import SortIcon from '@material-ui/icons/Sort';
import Ascending from '@material-ui/icons/ArrowUpward';
import Descending from '@material-ui/icons/ArrowDownward';
import Save from '@material-ui/icons/SaveAlt';
import { AppBar, Badge, Box, Breadcrumbs, Button, ButtonGroup, Card, CardActionArea, CardContent, CardMedia, Container, Dialog, DialogActions, DialogContent, DialogTitle, Drawer, IconButton, InputBase, Link, List, ListItem, Menu, MenuItem, Paper, TextField, Toolbar, Typography } from '@material-ui/core';
import Loading from './components/Loading';
import UploadProgress from './components/UploadProgress';
import HashChange from 'react-hashchange';

const useStyles = makeStyles(theme => ({
  uploadPanel: {
    width: 240,
  },
  search: {
    position: 'relative',
    borderRadius: theme.shape.borderRadius,
    backgroundColor: fade(theme.palette.common.white, 0.15),
    '&:hover': {
      backgroundColor: fade(theme.palette.common.white, 0.25),
    },
    marginRight: theme.spacing(2),
    marginLeft: 0,
    width: '100%',
    [theme.breakpoints.up('sm')]: {
      marginLeft: theme.spacing(3),
      width: 'auto',
    },
  },
  searchIcon: {
    width: theme.spacing(7),
    height: '100%',
    position: 'absolute',
    pointerEvents: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputRoot: {
    color: 'inherit',
  },
  inputInput: {
    padding: theme.spacing(1, 1, 1, 7),
    transition: theme.transitions.create('width'),
    width: '100%',
    [theme.breakpoints.up('md')]: {
      width: 200,
    },
  },
  shade: {
    position: 'fixed',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 100,
    background: 'rgba(255, 255, 255, 0.5)',
  },
  container: {
    marginTop: '64px',
    padding: '32px',
    width: `${192 + 64}px`,
    ..._.fromPairs(_.range(2, 7).map(cnt => [theme.breakpoints.up(192 * cnt + 96), { width: `${192 * cnt + 64}px` }])),
  },
  card: {
    width: '160px',
    display: 'inline-block',
    margin: '16px',
    wordBreak: 'break-word',
  },
  functions: {
    display: 'flex',
    flexWrap: 'wrap',
    padding: '0px 16px 16px',
  },
  functionGroup: {
    marginTop: '16px',
  },
  files: {
    display: 'flex',
    flexWrap: 'wrap',
  },
  media: {
    height: '160px',
  },
  imgicon: {
    height: '100%',
    width: '50%',
    margin: 'auto',
    display: 'block',
  },
  breadcrumb: {
    margin: '0px 16px',
    padding: theme.spacing(1, 2),
    background: theme.palette.background.default,
  },
  breadcrumbItem: {
    display: 'flex',
  },
  breadcrumbIcon: {
    marginRight: theme.spacing(0.5),
    width: 20,
    height: 20,
  },
  view: {
    display: 'flex',
    flexDirection: 'row',
  },
  properties: {
    flexGrow: 1,
    overflowY: 'auto',
    '& > .MuiListItem-root': {
      justifyContent: 'space-around',
    },
  },
  editBtn: {
    margin: theme.spacing(1),
  }
}));

const parseBytes = (bytes) => {
  let unit = 0;
  while (bytes >= 1000) {
    bytes /= 1024;
    ++unit;
  }
  if (unit) bytes = bytes.toFixed(2);
  return bytes + ['B', 'KB', 'MB', 'GB', 'TB', 'PB'][unit];
};

const uploading = obj => _.includes(['queuing', 'preparing', 'uploading', 'verifying'], obj.state);

export default function MainPage(props) {
  const classes = useStyles();
  const [category, setCategory] = React.useState('所有文件'); // TODO
  const [hash, setHash] = React.useState(window.location.hash);
  const [ascending, setAscending] = React.useState(true);
  const [sortBy, setSortBy] = React.useState('name');
  const [settingSortBy, setSettingSortBy] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [promptCallback, setPromptCallback] = React.useState(false);
  const [promptTitle, setPromptTitle] = React.useState('');
  const [promptValue, setPromptValue] = React.useState('');
  const [files, _setFiles] = React.useState([]);
  const [showingUploads, setShowingUploads] = React.useState(false);
  const [uploads, setUploads] = React.useState([]);
  const [view, setView] = React.useState(undefined);
  const setFiles = files => {
    _setFiles(files.sort((a, b) => {
      if (a.type !== b.type) return (a.type !== 'folder') - (b.type !== 'folder');
      if (sortBy !== 'name') {
        let av = _.get(a, sortBy), _av = Number(av);
        let bv = _.get(b, sortBy), _bv = Number(bv);
        if (!isNaN(_av) && !isNaN(_bv)) {
          return (av - bv) * (ascending ? 1 : -1); // number or Date
        }
        if (av !== bv) return (av < bv ? -1 : 1) * (ascending ? 1 : -1);
      }
      return (a.filename < b.filename ? -1 : 1) * (sortBy !== 'name' || ascending ? 1 : -1);
    }));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => setFiles(files.slice()), [ascending, sortBy]);
  const [initial, setInitial] = React.useState(false);

  const changeDir = () => {
    if (hash === '') return window.location.hash = '#/';
    setHash(hash);
    loadDirectory();
  };
  React.useEffect(() => {
    changeDir();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash]);

  const parseHash = () => {
    // assert window.location.hash.startsWith('#/') && window.location.hash.endsWith('/')
    return decodeURI(hash).substring(1, hash.length - 1).split('/');
  };

  const loadDirectory = async () => {
    const path = decodeURI(hash.substr(1));
    setLoading(true);
    const result = await window.ipc.invoke('listFile', path);
    if (result.success) {
      const files = result.data;
      files.forEach(file => {
        if (file.time) file.time = new Date(file.time);
        if (file.type !== 'folder') file.mime = mime.getType('.' + file.filename) || '';
        file.icon = file.type === 'folder' ? <Folder className={classes.imgicon} /> : {
          'image': <Image className={classes.imgicon} />,
          'video': <Video className={classes.imgicon} />,
          'audio': <Audio className={classes.imgicon} />,
        }[(file.mime || '').split('/')[0]] || <File className={classes.imgicon} />;
      });
      setFiles(files);
    } else {
      props.showMessage(result.msg, 'error');
      setFiles([]);
    }
    setLoading(false);
  };

  React.useEffect(() => {
    let flag = false;
    const listeners = _.compact(uploads.map(file => {
      // eslint-disable-next-line array-callback-return
      if (file.uploaded) return;
      if (!uploading(window.ipc.sendSync(`progress${file.key}`))) {
        flag = true;
        file.uploaded = true;
        // eslint-disable-next-line array-callback-return
        return;
      }
      const update = (event, state) => {
        if (!uploading(state)) {
          file.uploaded = true;
          setUploads(uploads.slice());
          loadDirectory();
        }
      };
      window.ipc.on(`progress${file.key}`, update);
      return [`progress${file.key}`, update];
    }));
    if (flag) setUploads(uploads.slice());
    return () => {
      listeners.forEach(listener => window.ipc.removeListener(...listener));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploads]);

  if (!initial) {
    setInitial(true);
    changeDir();
  }

  const prompt = title => new Promise(resolve => {
    setPromptTitle(title || '提示');
    setPromptValue('');
    setPromptCallback(() => resolve);
  });

  const prompted = confirmed => {
    promptCallback(confirmed ? promptValue : undefined);
    setPromptCallback(false);
  };

  return (
    <>
      <AppBar position="fixed">
        <Toolbar>
          <Badge
            color="secondary"
            badgeContent={_.get(_.countBy(uploads, 'uploaded'), false, 0)}
            invisible={_.every(uploads, 'uploaded')}
            overlap="circle"
          >
            <IconButton
              color="inherit"
              onClick={() => setShowingUploads(true)}
            >
              <Upload />
            </IconButton>
          </Badge>
          <Drawer
            anchor="right"
            open={showingUploads}
            classes={{ paper: classes.uploadPanel }}
            onClose={() => setShowingUploads(false)}
          >
            {_.flatten(_.partition(uploads, 'uploaded').reverse().map(group => group.map(obj => <UploadProgress key={obj.key} text={obj.filename} id={obj.key} />)))}
          </Drawer>
          <Box className={classes.search}>
            <Box className={classes.searchIcon}>
              <SearchIcon />
            </Box>
            <InputBase
              placeholder="搜索… // TODO"
              classes={{
                root: classes.inputRoot,
                input: classes.inputInput,
              }}
            />
          </Box>
          <Box flexGrow="1" />
          <Button
            color="inherit"
            onClick={async () => {
              await window.ipc.invoke('logout');
              window.location.reload();
            }}
          >注销</Button>
        </Toolbar>
      </AppBar>
      <Box
        className={classes.shade}
        display={loading ? 'flex' : 'none'}
      >
        <Loading size="40px" style={{ margin: 'auto' }} />
      </Box>
      <Container className={classes.container}>
        <HashChange onChange={event => { setHash(event.hash) }} />
        <Paper className={classes.breadcrumb}>
          <Breadcrumbs itemsAfterCollapse={5}>
            {
              parseHash().map((dir, index, path) => index !== path.length - 1
                ? <Link
                  color="inherit"
                  href={`#${encodeURI(path.slice(0, index + 1).join('/'))}/`}
                  key={index}
                  className={classes.breadcrumbItem}
                >
                  {index ? dir : <>
                    <HomeIcon className={classes.breadcrumbIcon} />
                    {category}
                  </>}
                </Link>
                : <Typography
                  color="textPrimary"
                  key={index}
                  className={classes.breadcrumbItem}
                >
                  {index ? dir : <>
                    <HomeIcon className={classes.breadcrumbIcon} />
                    {category}
                  </>}
                </Typography>)}
          </Breadcrumbs>
        </Paper>
        <Box className={classes.functions}>
          <ButtonGroup variant="contained" className={classes.functionGroup}>
            <Button
              color="primary"
              onClick={async () => {
                const files = await window.ipc.invoke('selectLocalFiles');
                if (!files) return;
                setUploads(files.map(file => ({
                  key: window.ipc.sendSync('upload', file.fullpath, decodeURI(hash.substr(1)), file.filename),
                  filename: file.filename,
                  uploaded: false,
                })).concat(uploads));
              }}
            >
              <AddIcon />
              &nbsp;添加文件
            </Button>
            <Button
              color="default"
              onClick={async () => {
                const name = await prompt('新建文件夹');
                if (!name) return;
                setLoading(true);
                const result = await window.ipc.invoke('createFolder', decodeURI(hash.substr(1)), name);
                if (result.success) {
                  props.showMessage(result.msg, 'success');
                  loadDirectory();
                } else {
                  props.showMessage(result.msg, 'error');
                  setLoading(false);
                }
              }}
            >
              <CreateNewFolderIcon />
              &nbsp;添加文件夹
            </Button>
          </ButtonGroup>
          <Box flexGrow={1} />
          <ButtonGroup variant="outlined" className={classes.functionGroup}>
            {/* <Button> // TODO: filter
              <FilterListIcon />
            </Button> */}
            <Button
              id="sortBy"
              onClick={() => setSettingSortBy(true)}
            >
              <SortIcon />
            </Button>
            <Button onClick={() => setAscending(!ascending)}>
              {ascending ? <Ascending /> : <Descending />}
            </Button>
          </ButtonGroup>
          <Menu
            anchorEl={document.querySelector('#sortBy')}
            keepMounted
            open={settingSortBy}
            onClose={() => setSettingSortBy(false)}
          >
            {_.map({
              name: '文件名',
              time: '创建日期',
              mime: '文件类型',
            }, (option, key) => (
              <MenuItem
                key={key}
                selected={key === sortBy}
                onClick={() => {
                  setSortBy(key);
                  setSettingSortBy(false);
                }}
              >{option}</MenuItem>
            ))}
          </Menu>
        </Box>
        <Box className={classes.files}>
          {files.map((data) => (
            <Card
              className={classes.card}
              key={data.filename}
            >
              <CardActionArea
                onClick={() => { if (data.type === 'folder') window.location.hash += encodeURI(data.filename) + '/'; else setView(data); }}
                style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
              >
                <CardMedia className={classes.media}>{data.icon}</CardMedia>
                <CardContent style={{ flexGrow: 1 }}>
                  <Typography gutterBottom variant="body1">
                    {data.filename}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Box>
      </Container>
      <Dialog
        open={Boolean(promptCallback)}
        fullWidth={true}
        onClose={() => prompted(false)}
      >
        <DialogTitle>{promptTitle}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            fullWidth
            id="promptInput"
            onChange={event => setPromptValue(event.target.value)}
            onKeyPress={event => { if (event.key === 'Enter') prompted(true) }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => prompted(false)}
            color="default"
          >取消</Button>
          <Button
            onClick={() => prompted(true)}
            variant="contained"
            color="primary"
          >确认</Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={Boolean(view)}
        maxWidth="lg"
        fullWidth={true}
        onClose={() => setView()}
        classes={{ paper: classes.view }}
      >
        <Box width={240} display="flex" flexDirection="column" justifyContent="space-between" alignItems="center" flexGrow={0} flexShrink={0}>
          <List className={classes.properties}>
            <ListItem><Typography variant="subtitle1">
              {view && view.filename}
            </Typography></ListItem>
            <ListItem><Typography variant="caption" color="textSecondary">
              {view && view.time.toLocaleString()}
            </Typography></ListItem>
            <ListItem><Typography variant="caption" color="textSecondary">
              {view && parseBytes(view.size)}
            </Typography></ListItem>
          </List>
          <Box style={{ display: 'flex', justifyContent: 'space-around' }}>
            <a href={view && `http://localhost:6096/download?hash=${view.hash}&name=${encodeURI(view.filename)}`}>
              <Button
                variant="contained"
                color="primary"
                className={classes.editBtn}
              ><Save style={{ height: '1rem' }} />保存</Button>
            </a>
          </Box>
          <Box style={{ display: 'flex', justifyContent: 'space-around' }}>
            <Button
              variant="outlined"
              color="default"
              className={classes.editBtn}
              onClick={async () => {
                const newName = await prompt('重命名');
                const result = await window.ipc.invoke('rename', decodeURI(hash.substr(1)), view.filename, newName);
                view.filename = result.newName;
                setView(_.clone(view));
                loadDirectory();
              }}
            >重命名</Button>
            <Button
              variant="outlined"
              color="secondary"
              className={classes.editBtn}
              onClick={async () => {
                setView();
                await window.ipc.invoke('delete', decodeURI(hash.substr(1)), view.filename);
                loadDirectory();
              }}
            >删除</Button>
          </Box>
        </Box>
        <Box style={{
          flexGrow: 1,
          flexShrink: 1,
          // overflowY: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
        }}>
          <Box style={{ maxHeight: '100%', maxWidth: '100%', overflowY: 'auto' }}>
            {view && view.mime.startsWith('image/') ? <img src={`http://localhost:6096/view?hash=${view.hash}`} alt="view" style={{ width: '100%' }} />
              : view && view.mime.startsWith('video/') ? <video src={`http://localhost:6096/view?hash=${view.hash}`} controls="controls" style={{ width: '100%' }} />
                : view && view.mime.startsWith('audio/') ? <audio src={`http://localhost:6096/view?hash=${view.hash}`} controls="controls" style={{ width: '400px' }} />
                  : <Typography color="textSecondary">不支持预览</Typography>}
          </Box>
        </Box>
      </Dialog>
    </>
  );
};
