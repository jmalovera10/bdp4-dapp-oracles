var Test = require("../config/testConfig.js");
var BigNumber = require("bignumber.js");

contract("Flight Surety Tests", async (accounts) => {
  var config;
  before("setup contract", async () => {
    config = await Test.Config(accounts);
    await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address, true);
  });

  /****************************************************************************************/
  /* Operations and Settings                                                              */
  /****************************************************************************************/

  describe("Manage Operational Tests", () => {
    it(`(multiparty) has correct initial isOperational() value`, async function () {
      // Get operating status
      let status = await config.flightSuretyData.isOperational.call();
      assert.equal(status, true, "Incorrect initial operating status value");
    });

    it(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {
      // Ensure that access is denied for non-Contract Owner account
      let accessDenied = false;
      try {
        await config.flightSuretyData.setOperatingStatus(false, { from: config.testAddresses[2] });
      } catch (e) {
        accessDenied = true;
      }
      assert.equal(accessDenied, true, "Access not restricted to Contract Owner");
    });

    it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {
      // Ensure that access is allowed for Contract Owner account
      let accessDenied = false;
      try {
        await config.flightSuretyData.setOperatingStatus(false);
      } catch (e) {
        accessDenied = true;
      }
      assert.equal(accessDenied, false, "Access not restricted to Contract Owner");
    });

    it(`(multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {
      await config.flightSuretyData.setOperatingStatus(false);

      let reverted = false;
      try {
        await config.flightSurety.setTestingMode(true);
      } catch (e) {
        reverted = true;
      }
      assert.equal(reverted, true, "Access not blocked for requireIsOperational");

      // Set it back for other tests to work
      await config.flightSuretyData.setOperatingStatus(true);
    });
  });

  describe("Resgister an Airline Tests", () => {
    it("(airline) cannot register an Airline using registerAirline() if it is not funded", async () => {
      // ARRANGE
      const newAirline = accounts[2];

      // ACT
      try {
        await config.flightSuretyApp.registerAirline(newAirline, { from: config.firstAirline });
      } catch (e) {}

      const result = await config.flightSuretyData.isAirlineRegistered.call(newAirline, {
        from: config.flightSuretyApp.address,
      });

      // ASSERT
      assert.equal(
        result,
        false,
        "Airline should not be able to register another airline if it hasn't provided funding"
      );
    });

    it("(airline) can be funded", async () => {
      // ACT
      await config.flightSuretyApp.fundAirline({ from: config.firstAirline, value: web3.utils.toWei("10", "ether") });

      const result = await config.flightSuretyData.isAirlineAllowedToVote.call(config.firstAirline, {
        from: config.flightSuretyApp.address,
      });

      // ASSERT
      assert.equal(result, true, "Airline should be able to vote after providing funding");
    });

    it("(airline) can register a new Airline using registerAirline() if it is funded and threshold of 4 is not passed", async () => {
      // ARRANGE
      let newAirline = accounts[2];

      // ACT
      await config.flightSuretyApp.registerAirline(newAirline, { from: config.firstAirline });

      let result = await config.flightSuretyData.isAirlineRegistered.call(newAirline, {
        from: config.flightSuretyApp.address,
      });

      // ASSERT
      assert.equal(result, true, "Airline should be able to register another airline if it hasn't provided funding");
    });
    it("(airline) cannot register a new Airline using registerAirline() if threshold of 4 is passed and quorum is not met", async () => {
      // ARRANGE
      let newAirline1 = accounts[3];
      let newAirline2 = accounts[4];
      let newAirline3 = accounts[5];

      // ACT
      await config.flightSuretyApp.registerAirline(newAirline1, { from: config.firstAirline });
      await config.flightSuretyApp.registerAirline(newAirline2, { from: config.firstAirline });
      await config.flightSuretyApp.registerAirline(newAirline3, { from: config.firstAirline });

      let result = await config.flightSuretyData.isAirlineRegistered.call(newAirline3, {
        from: config.flightSuretyApp.address,
      });

      // ASSERT
      assert.equal(result, false, "Airline should not be registered if threshold is passed and quorum is not met");
    });
    it("(airline) can register a new Airline using registerAirline() if it is funded, threshold of 4 is passed and quorum is met", async () => {
      // ARRANGE
      let airline2 = accounts[3];
      let newAirline3 = accounts[5];

      // ACT
      await config.flightSuretyApp.fundAirline({ from: airline2, value: web3.utils.toWei("10", "ether") });
      await config.flightSuretyApp.registerAirline(newAirline3, { from: airline2 });

      let result = await config.flightSuretyData.isAirlineRegistered.call(newAirline3, {
        from: config.flightSuretyApp.address,
      });

      // ASSERT
      assert.equal(result, true, "Airline should not be registered if threshold is passed and quorum is not met");
    });
  });

  describe("Insurance Payments Tests", () => {
    const FLIGHT_NAME = "ND1234";
    const FLIGHT_TIMESTAMP = Date.now();

    before(async () => {
      await config.flightSuretyApp.registerFlight(FLIGHT_NAME, FLIGHT_TIMESTAMP, { from: config.firstAirline });
    });

    it("(passenger) cannot buy insurance past 1 Eth", async () => {
      // ARRANGE
      let passenger = accounts[6];
      let reverted = false;

      // ACT
      try {
        await config.flightSuretyApp.buyInsurance(config.firstAirline, FLIGHT_NAME, FLIGHT_TIMESTAMP, {
          from: passenger,
          value: web3.utils.toWei("3", "ether"),
        });
      } catch (e) {
        reverted = true;
      }

      assert.equal(reverted, true, "Passenger should not be able to buy insurance if greater than 1 Eth");
    });

    it("(passenger) can buy insurance of at most 1 Eth", async () => {
      // ARRANGE
      let passenger = accounts[6];
      let reverted = false;

      // ACT
      try {
        await config.flightSuretyApp.buyInsurance(config.firstAirline, FLIGHT_NAME, FLIGHT_TIMESTAMP, {
          from: passenger,
          value: web3.utils.toWei("1", "ether"),
        });
      } catch (e) {
        reverted = true;
      }

      const result = await config.flightSuretyData.passengerHasInsurance(passenger, {
        from: config.flightSuretyApp.address,
      });

      assert.equal(reverted, false, "Passenger should not be able to buy insurance if greater than 1 Eth");
      assert.equal(result, true, "Passenger should have a registered insurance");
    });
  });
});
