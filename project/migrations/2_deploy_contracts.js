const FlightSuretyApp = artifacts.require("FlightSuretyApp");
const FlightSuretyData = artifacts.require("FlightSuretyData");
const fs = require("fs");

module.exports = function (deployer) {
  let firstAirline = "0xfe1df249cb2d8e7e16d4f2afc250c3b7b34d1f92";
  deployer.deploy(FlightSuretyData, firstAirline).then(() => {
    return deployer.deploy(FlightSuretyApp, FlightSuretyData.address).then(() => {
      let config = {
        localhost: {
          url: "http://localhost:8545",
          dataAddress: FlightSuretyData.address,
          appAddress: FlightSuretyApp.address,
        },
      };
      fs.writeFileSync(__dirname + "/../src/dapp/config.json", JSON.stringify(config, null, "\t"), "utf-8");
      fs.writeFileSync(__dirname + "/../src/server/config.json", JSON.stringify(config, null, "\t"), "utf-8");
    });
  });
};
