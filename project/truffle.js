const fs = require("fs");
const mnemonic = fs.readFileSync(".secret").toString().trim();
var HDWalletProvider = require("truffle-hdwallet-provider");

module.exports = {
  networks: {
    development: {
      provider: function () {
        return new HDWalletProvider(mnemonic, "http://127.0.0.1:8545/", 0, 50);
      },
      network_id: "*",
      gas: 6721975,
    },
  },
  compilers: {
    solc: {
      version: "^0.8.10",
    },
  },
};
