const Dcmtk = require('./Dcmtk');
const DcmtkModule = require('./DcmtkModule');
const log = require('./log');
const version = require('./version');

const dcmtkWasm = {
  Dcmtk,
  DcmtkModule,
  log,
  version,
};

//#region Exports
module.exports = dcmtkWasm;
//#endregion
