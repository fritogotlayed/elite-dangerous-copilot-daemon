const _ = require('lodash');
const bunyan = require('bunyan');
const bunyanLogstashHttp = require('./bunyan-logstash-http');

const buildLogStreams = () => {
  const loggerMetadata = { fromLocal: process.env.DEBUG };
  const logStreams = [];

  if (!/test/.test(process.env.NODE_ENV)) {
    logStreams.push({
      stream: process.stdout,
    });
  }

  if (process.env.MDS_LOG_URL) {
    logStreams.push(
      {
        stream: bunyanLogstashHttp.createLoggerStream({
          loggingEndpoint: process.env.MDS_LOG_URL,
          level: 'debug',
          metadata: loggerMetadata,
        }),
      },
    );
  }

  return logStreams;
};

const getUserLogLevel = () => {
  const userData = _.lowerCase(process.env.LOG_LEVEL);
  if (userData === 'debug') return bunyan.DEBUG;
  if (userData === 'info') return bunyan.INFO;
  if (userData === 'trace') return bunyan.TRACE;
  return bunyan.INFO;
};

const logger = bunyan.createLogger({
  name: 'elite-dangerous-copilot-daemon',
  level: getUserLogLevel(),
  serializers: bunyan.stdSerializers,
  streams: buildLogStreams(),
});

/**
 * returns the current logger for the application
 */
const getLogger = () => logger;

const delay = (timeout) => new Promise((resolve) => setTimeout(resolve, timeout));

module.exports = {
  buildLogStreams,
  getLogger,
  delay,
};
