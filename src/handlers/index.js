const express = require('express');

const repo = require('../repo');

const router = express.Router();

const sampleHandler = (request, response) => {
  const { params, body } = request;
  const { param1 } = params;

  const msg = {
    ts: new Date().toISOString(),
    topic: param1,
    message: body,
  };

  response.write(JSON.stringify(msg));

  response.status(200);
  response.send();
};

const watchHandler = (request, response) => {
  const { body } = request;
  const { directory } = body;

  const msg = {
    ts: new Date().toISOString(),
    message: `Watching directory ${directory}.`,
  };

  repo.watchDirectory(directory);

  response.write(JSON.stringify(msg));

  response.status(201);
  response.send();
};

router.get('/sample/:param1', sampleHandler);
router.post('/watch', watchHandler);

module.exports = router;
