const express = require('express');

const repo = require('../repo');

const router = express.Router();

const isConfiguredHandler = (request, response) => {
  const msg = {
    isConfigured: repo.isConfigured(),
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

const getJumpDataHandler = (request, response) => {
  response.write(JSON.stringify(repo.getJumpData()));
  response.status(200);
  response.send();
};

const getMissionDataHandler = (request, response) => {
  response.write(JSON.stringify(repo.getMissionData()));
  response.status(200);
  response.send();
};

const getWalletDataHandler = (request, response) => {
  response.write(JSON.stringify(repo.getWalletData()));
  response.status(200);
  response.send();
};

const createWalletAdjustment = (request, response) => {
  const { body } = request;
  const { expectedAmount } = body;

  if (Number.isNaN(+expectedAmount)) {
    response.status(500);
    response.send();
    return;
  }

  repo.createWalletAdjustment(+expectedAmount);

  response.status(200);
  response.send();
};

router.get('/isConfigured', isConfiguredHandler);
router.get('/data/jumps', getJumpDataHandler);
router.get('/data/missions', getMissionDataHandler);
router.get('/data/wallet', getWalletDataHandler);
router.post('/walletAdjustment', createWalletAdjustment);
router.post('/watch', watchHandler);


module.exports = router;
