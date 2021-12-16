import FlightSuretyApp from "../../build/contracts/FlightSuretyApp.json";
import Config from "./config.json";
import Web3 from "web3";
import express from "express";

let config = Config["localhost"];
let web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace("http", "ws")));
web3.eth.defaultAccount = web3.eth.accounts[0];
let flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
const oracles = [];

async function initializeOracles() {
  await registerOracles();
  flightSuretyApp.events.OracleRequest({ fromBlock: 0 }, (error, event) => {
    if (error) return console.log(error);
    if (!event.returnValues) return console.error("No return values");

    respondQuery(
      event.returnValues.index,
      event.returnValues.airline,
      event.returnValues.flight,
      event.returnValues.timestamp
    );
  });
}

async function registerOracles() {
  const accounts = await web3.eth.getAccounts();
  const NUMBER_OF_ORACLES = 50;

  const accountsToUse = accounts.slice(1, NUMBER_OF_ORACLES + 1);

  for (let i = 0; i < accountsToUse.length; i++) {
    const account = accountsToUse[i];

    try {
      await flightSuretyApp.methods
        .registerOracle()
        .send({ from: account, value: web3.utils.toWei("1", "ether"), gas: 6721975 });

      const indexes = await flightSuretyApp.methods.getMyIndexes().call({ from: account });
      flightSuretyApp.oracles.push({ account, indexes });
    } catch (e) {
      console.log(e.message);
    }
  }

  console.log(`${oracles.length} Oracles Registered`);
}

async function respondQuery(index, airline, flight, timestamp) {
  oracles
    .filter((oracle) => oracle.indexes.includes(index))
    .map(async (oracle) => {
      const code = generateRandomCode();
      try {
        flightSuretyApp.methods
          .submitOracleResponse(index, airline, flight, timestamp, code)
          .send({ from: oracle.account });
      } catch (e) {
        console.log(`Error ${e.message} occurred for oracle ${oracle.account}`);
      }
    });
}

function generateRandomCode() {
  const STATUS_CODE_UNKNOWN = 0;
  const STATUS_CODE_ON_TIME = 10;
  const STATUS_CODE_LATE_AIRLINE = 20;
  const STATUS_CODE_LATE_WEATHER = 30;
  const STATUS_CODE_LATE_TECHNICAL = 40;
  const STATUS_CODE_LATE_OTHER = 50;

  const randomNumber = Math.random();

  if (randomNumber < 0.1) return STATUS_CODE_UNKNOWN;
  else if (randomNumber < 0.4) return STATUS_CODE_ON_TIME;
  else if (randomNumber < 0.6) return STATUS_CODE_LATE_AIRLINE;
  else if (randomNumber < 0.8) return STATUS_CODE_LATE_WEATHER;
  else if (randomNumber < 0.9) STATUS_CODE_LATE_TECHNICAL;
  else return STATUS_CODE_LATE_OTHER;
}

initializeOracles();

const app = express();
app.get("/api", (req, res) => {
  res.send({
    message: "An API for use with your Dapp!",
  });
});

export default app;
