const _ = require('lodash');
const globals = require('../globals');

let socket;

const runningData = {
  jumpLog: [],
  jumpLogHandle: -1,
  missionLog: [],
  missionLogHandle: -1,
  walletData: {
    balance: 0,
    log: [],
  },
  walletDataHandle: -1,
};

const wireSocket = (sock) => {
  socket = sock;
};

const emitUpdate = (section) => {
  const handleKey = `${section}Handle`;
  if (runningData[handleKey] !== -1) clearTimeout(runningData[handleKey]);
  runningData[handleKey] = setTimeout(() => {
    const logger = globals.getLogger();

    if (logger.trace()) logger.trace({ section, data: runningData[section] }, 'Emitting update');
    else if (logger.debug()) logger.debug({ section }, 'Emitting update');

    runningData[handleKey] = -1;
    socket.emit(section, runningData[section]);
  },
  100);
};

const resetData = () => {
  runningData.jumpLog = [];
  runningData.missionLog = [];
};

const processLocation = (data) => {
  const existing = _.find(runningData.jumpLog, (v) => v.timestamp === data.timestamp);
  if (!existing) runningData.jumpLog.push({ location: data.StarSystem, ts: data.timestamp });
  emitUpdate('jumpLog');
};

const processMissionAccepted = (data) => {
  const existing = _.find(runningData.missionLog, (v) => v.id === data.MissionID);
  if (!existing) {
    runningData.missionLog.push({
      id: data.MissionID,
      name: data.LocalisedName || data.Name,
      location: data.DestinationSystem || 'Unknown',
    });
    emitUpdate('missionLog');
  }
};

const processMissionRedirected = (data) => {
  const existing = _.find(runningData.missionLog, (v) => v.id === data.MissionID);
  if (existing) {
    existing.location = data.NewDestinationSystem;
    emitUpdate('missionLog');
  }
};

const processMissionRemove = (data) => {
  _.remove(runningData.missionLog, (v) => v.id === data.MissionID);
  emitUpdate('missionLog');
};

const processMissions = (data) => {
  // TODO: handle non "Active" missions.
  data.Active.map((e) => processMissionAccepted(e));
};

const processLoadGame = (data) => {
  runningData.walletData.balance = data.Credits;
  runningData.walletData.log = [];
  runningData.missionLog = [];
  emitUpdate('walletData');
  emitUpdate('missionLog');
};

const handleCredit = (data, keys) => {
  const event = typeof data === 'string' ? JSON.parse(data) : data;
  if (typeof keys === 'string') {
    const amountKey = keys;
    if (event[amountKey]) {
      runningData.walletData.balance += event[amountKey];
      runningData.walletData.log.push({
        amount: event[amountKey],
        note: event.event,
        type: 'credit',
        ts: event.timestamp,
      });
    }
  } else {
    const items = keys.map((k) => ({
      amount: event[k],
      note: event.event,
      type: 'credit',
      ts: event.timestamp,
    }));
    runningData.walletData.balance += _.sum(items.map((e) => e.amount));
    runningData.walletData.log.push(..._.filter(items, (e) => e.amount !== undefined));
  }
  emitUpdate('walletData');
};

const handleDebit = (data, amountKey) => {
  const event = typeof data === 'string' ? JSON.parse(data) : data;
  runningData.walletData.balance -= event[amountKey];
  runningData.walletData.log.push({
    amount: event[amountKey],
    note: event.event,
    type: 'debit',
    ts: event.timestamp,
  });
  emitUpdate('walletData');
};

const handleDebitCredit = (data, debitKey, creditKey) => {
  const event = typeof data === 'string' ? JSON.parse(data) : data;
  const debitEvent = event[debitKey]
    ? {
      amount: event[debitKey],
      note: event.event,
      type: 'debit',
      ts: event.timestamp,
    } : undefined;
  const creditEvent = event[creditKey]
    ? {
      amount: event[creditKey],
      note: event.event,
      type: 'credit',
      ts: event.timestamp,
    } : undefined;

  if (debitEvent) {
    runningData.walletData.balance -= debitEvent.amount;
    runningData.walletData.log.push(debitEvent);
  }
  if (creditEvent) {
    runningData.walletData.balance += creditEvent.amount;
    runningData.walletData.log.push(creditEvent);
  }
  emitUpdate('walletData');
};

const processEvent = (key, data) => {
  // TODO: Wallet / PowerplayVoucher -- ??
  // const logger = globals.getLogger();
  const standardizedData = typeof data === 'string' ? JSON.parse(data) : data;

  switch (key) {
    case 'BuyAmmo': return handleDebit(standardizedData, 'Cost');
    case 'BuyDrones': return handleDebit(standardizedData, 'TotalCost');
    case 'BuyExplorationData': return handleDebit(standardizedData, 'Cost');
    case 'BuyTradeData': return handleDebit(standardizedData, 'Cost');
    case 'FetchRemoteModule': return handleDebit(standardizedData, 'TransferCost');
    case 'FSDJump': return processLocation(standardizedData);
    case 'LoadGame': return processLoadGame(standardizedData);
    case 'Location': return processLocation(standardizedData);
    case 'MarketBuy': return handleDebit(standardizedData, 'TotalCost');
    case 'MarketSell': return handleCredit(standardizedData, 'TotalSale');
    case 'MissionAccepted': return processMissionAccepted(standardizedData);
    case 'MissionAbandoned': return processMissionRemove(standardizedData);
    case 'MissionCompleted':
      processMissionRemove(standardizedData);
      return handleDebitCredit(standardizedData, 'Donation', 'Reward');
    case 'MissionFailed': return processMissionRemove(standardizedData);
    case 'MissionRedirected': return processMissionRedirected(standardizedData);
    case 'Missions': return processMissions(standardizedData);
    case 'ModuleBuy': return handleDebitCredit(standardizedData, 'BuyPrice', 'SellPrice');
    case 'ModuleSell': return handleCredit(standardizedData, 'SellPrice');
    case 'ModuleSellRemote': return handleCredit(standardizedData, 'SellPrice');
    case 'ModuleStore': return handleDebit(standardizedData, 'Cost');
    case 'PayFines': return handleDebit(standardizedData, 'Amount');
    case 'PayLegacyFines': return handleDebit(standardizedData, 'Amount');
    case 'PowerplayFastTrack': return handleDebit(standardizedData, 'Cost');
    case 'PowerplaySalary': return handleCredit(standardizedData, 'Amount');
    case 'RedeemVoucher': return handleCredit(standardizedData, 'Amount');
    case 'RefuelAll': return handleDebit(standardizedData, 'Cost');
    case 'RefuelPartial': return handleDebit(standardizedData, 'Cost');
    case 'Repair': return handleDebit(standardizedData, 'Cost');
    case 'RepairAll': return handleDebit(standardizedData, 'Cost');
    case 'RestockVehicle': return handleDebit(standardizedData, 'Cost');
    case 'Resurrect': return handleDebit(standardizedData, 'Cost');
    case 'SellDrones': return handleDebit(standardizedData, 'TotalSale');
    case 'SellExplorationData': return handleCredit(standardizedData, ['BaseValue', 'Bonus']);
    case 'ShipyardBuy': return handleDebitCredit(standardizedData, 'ShipPrice', 'SellPrice');
    case 'ShipyardSell': return handleCredit(standardizedData, 'ShipPrice');
    case 'ShipyardTransfer': return handleDebit(standardizedData, 'TransferPrice');
    default:
      // logger.warn({ key, data: standardizedData }, 'Cannot process event');
      return undefined;
  }
};

const getJumpData = () => runningData.jumpLog;

const getMissionData = () => runningData.missionLog;

const getWalletData = () => runningData.walletData;

const createWalletAdjustment = (expectedBalance) => {
  /* balance + adjustment = expectedBalance
   * balance - balance + adjustment = expectedBalance - balance
   * adjustment = expectedBalance - balance
   */
  const adjustmentAmount = (+expectedBalance - runningData.walletData.balance);

  if (adjustmentAmount > 0) {
    handleCredit({
      Total: adjustmentAmount,
      event: 'CreditAdjustment',
      timestamp: new Date().toISOString(),
    },
    'Total');
  }

  if (adjustmentAmount < 0) {
    handleDebit({
      Total: adjustmentAmount * -1,
      event: 'DebitAdjustment',
      timestamp: new Date().toISOString(),
    },
    'Total');
  }
};

module.exports = {
  createWalletAdjustment,
  getJumpData,
  getMissionData,
  getWalletData,
  processEvent,
  resetData,
  wireSocket,
};
