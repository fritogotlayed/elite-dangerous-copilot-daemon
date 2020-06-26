const chokidar = require('chokidar');
const fs = require('fs');
const tail = require('tail');

const globals = require('../globals');
const repoData = require('./data');

const journalMatcher = /Journal\.(\d{0,})\.(\d{0,})\.log/;
const jsonMatcher = /.*\/(.*)\.json/;

let sock;
let dirWatcher;
let fileWatcher;

const newTail = (filePath, opts) => new tail.Tail(filePath, opts);

const wireSocket = (socket) => {
  sock = socket;
  repoData.wireSocket(socket);
};

const processEvent = (key, data) => {
  // const logger = globals.getLogger();
  // logger.debug({ eventKey: data.event, data }, 'Emitting event');
  repoData.processEvent(key, data);
  // sock.emit(key, data);
};

const isConfigured = () => !!dirWatcher && !!fileWatcher;

const watchDirectory = (directoryPath) => {
  const logger = globals.getLogger();
  const watchOpts = {
    ignored: /.*\.cache/,
  };
  const journalKeys = {};
  let handle = -1;

  if (dirWatcher) dirWatcher.close();
  if (fileWatcher) fileWatcher.unwatch();
  repoData.resetData();

  dirWatcher = chokidar.watch(directoryPath, watchOpts);
  logger.debug({ directoryPath }, 'Wiring directory watcher');

  dirWatcher.on('change', (path) => {
    const jsonMatchData = jsonMatcher.exec(path);
    if (jsonMatchData && jsonMatchData[1] !== 'Status') {
      logger.debug({ path }, 'file changed');
      const readOptions = { encoding: 'utf-8' };
      fs.readFile(path, readOptions, (err, data) => {
        if (err) {
          logger.warn({ path, err }, 'Failed to read updated file');
        } else {
          // Cargo, Market, ModulesInfo, Outfitting, Shipyard, Status
          const eventKey = `${jsonMatchData[1]}Changed`;
          sock.emit(eventKey, data);
          logger.debug({ eventKey, data }, 'Emitting event');
        }
      });
    }
  });

  dirWatcher.on('add', (path) => {
    // logger.debug({ path }, 'Directory watcher discovered new file.');

    const data = journalMatcher.exec(path);
    if (data) {
      if (!journalKeys[data[1]]) {
        journalKeys[data[1]] = {};
      }
      journalKeys[data[1]][data[2]] = path;
      logger.trace({ data }, 'match data');
    }

    if (handle !== -1) {
      clearTimeout(handle);
    }

    handle = setTimeout(() => {
      const keys = Object.keys(journalKeys);
      const subKeys = Object.keys(journalKeys[keys[keys.length - 1]]);

      const tailOpts = {
        fromBeginning: true,
      };
      fileWatcher = newTail(
        journalKeys[keys[keys.length - 1]][subKeys[subKeys.length - 1]],
        tailOpts,
      );
      fileWatcher.on('line', (line) => {
        const lineData = JSON.parse(line);
        logger.trace({ lineData }, 'log file output');
        if (lineData.event === 'Shutdown') {
          fileWatcher.unwatch();
        } else {
          processEvent(lineData.event, lineData);
        }
      });
    }, 100);
  });
};

const {
  createWalletAdjustment,
  getJumpData,
  getMissionData,
  getWalletData,
} = repoData;

module.exports = {
  createWalletAdjustment,
  getJumpData,
  getMissionData,
  getWalletData,
  isConfigured,
  wireSocket,
  watchDirectory,
};
