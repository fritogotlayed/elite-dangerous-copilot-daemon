const bodyParser = require('body-parser');
const express = require('express');
const path = require('path');
const socketIO = require('socket.io');

const globals = require('./globals');
const handlers = require('./handlers');
const appShutdown = require('./handlers/app_shutdown');
const repo = require('./repo');

const buildApp = () => {
  const logger = globals.getLogger();
  const app = express();

  const requestLogger = (req, res, next) => {
    logger.trace({ path: req.path, method: req.method }, 'Handling request');
    next();
  };

  const commonResponseSetup = (req, res, next) => {
    if (req.path.toLowerCase().startsWith('/api')) {
      res.setHeader('content-type', 'application/json');
    }
    next();
  };

  const configureRoutes = (expressApp) => {
    expressApp.use('/', express.static(path.join(__dirname, 'static')));
    expressApp.use('/api', handlers);
  };

  if (process.env.NODE_ENV === 'local') {
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    app.use(require('cors')());
  }

  app.use(requestLogger);
  app.use(commonResponseSetup);
  app.use(bodyParser.json());
  app.use(bodyParser.text());
  configureRoutes(app);
  appShutdown.wire();

  return app;
};

const wireSocketIO = (server) => {
  // TODO: Move file watcher from this location.
  const io = socketIO(server);
  repo.wireSocket(io);
  return () => { io.close(); };
};

module.exports = {
  buildApp,
  wireSocketIO,
};
