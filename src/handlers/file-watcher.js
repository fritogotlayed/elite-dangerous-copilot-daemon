const socketIO = require('socket.io');
const chokidar = require('chokidar');
const tail = require('tail');
const fs = require('fs');

const globals = require('../globals');

const journalMatcher = /Journal\.(\d{0,})\.(\d{0,})\.log/;
const jsonMatcher = /.*\/(.*)\.json/;
const newTail = (filePath, opts) => new tail.Tail(filePath, opts);

/**
 * @param {http.Server} server the http server to bind to
 * @returns {object}
 */
const wire = (server) => {
  const io = socketIO(server);

  return {
    socket: io,
    shutdownHandler: () => {
      io.close();
    },
  };
};

/**
 * @param {String} logsDir The directory that Elite Dangerous logs are stored
 * @param {socketIO.Server} socket The socket that updates will be emitted on
 */
const watchPath = (logsDir, socket) => {
  let hasClientConnected = false;
  const logger = globals.getLogger();
  const watchOpts = {
    ignored: /.*\.cache/,
  };
  const journalKeys = {};
  let handle = -1;

  socket.on('connect', () => {
    if (hasClientConnected) return;
    hasClientConnected = true;

    const watcher = chokidar.watch(logsDir, watchOpts);
    logger.debug({ logsDir }, 'Wiring directory watcher');

    watcher.on('change', (path) => {
      const jsonMatchData = jsonMatcher.exec(path);
      if (jsonMatchData && jsonMatchData[1] !== 'Status') {
        logger.debug({ path }, 'file changed');
        const readOptions = { encoding: 'utf-8' };
        fs.readFile(path, readOptions, (err, data) => {
          if (err) {
            logger.warn({ path, err }, 'Failed to read updated file');
          } else {
            // Cargo, Market, ModulesInfo, Outfitting, Shipyard, Status
            socket.emit(`${jsonMatchData[1]}Changed`, data);
          }
        });
      }
    });

    watcher.on('add', (path) => {
      logger.debug({ path }, 'Directory watcher discovered new file.');

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
        const t = newTail(
          journalKeys[keys[keys.length - 1]][subKeys[subKeys.length - 1]],
          tailOpts,
        );
        t.on('line', (line) => {
          const lineData = JSON.parse(line);
          logger.trace({ lineData }, 'log file output');
          if (lineData.event === 'Shutdown') {
            t.unwatch();
          }
          socket.emit(lineData.event, line);
        });
      }, 100);
    });
  });
};

module.exports = {
  wire,
  watchPath,
};
