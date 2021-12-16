pragma solidity ^0.8.10;

// Safemath is default feature for solidity 0.8.0 an later
contract FlightSuretyData {
    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    address private contractOwner; // Account used to deploy contract
    bool private operational = true; // Blocks all state changes throughout the contract if false

    mapping(address => bool) private authorizedCallers; // Address of FlightSuretyApp contract

    // Airlines data
    struct Airline {
        bool canVote;
        bool registered;
    }

    mapping(address => Airline) private airlines; // List of registered oracles
    uint8 private airlinesCount = 0; // Number of registered airlines

    // Insurance data
    enum InsuranceStatus {
        Uninitialized,
        Bought,
        Claimable,
        Claimed
    }

    struct Insurance {
        bytes32 flightKey;
        uint256 value;
        uint256 payoutValue;
        InsuranceStatus status;
    }

    mapping(address => Insurance) private insurances; // List of passengers that paid for insurance
    mapping(bytes32 => address[]) private flightInsurees; // List of passengers that bought insurance for a flight

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/

    /**
     * @dev Constructor
     *      The deploying account becomes contractOwner
     */
    constructor(address airlineAddress) {
        contractOwner = msg.sender;
        airlines[airlineAddress] = Airline({canVote: false, registered: true});
        airlinesCount++;
    }

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
     * @dev Modifier that requires the "operational" boolean variable to be "true"
     *      This is used on all state changing functions to pause the contract in
     *      the event there is an issue that needs to be fixed
     */
    modifier requireIsOperational() {
        require(operational, "Contract is currently not operational");
        _; // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
     * @dev Modifier that requires the "ContractOwner" account to be the function caller
     */
    modifier requireContractOwner() {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    modifier requireFlightSuretyAppContract() {
        require(authorizedCallers[msg.sender], "Caller is not flightSuretyApp");
        _;
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
     * @dev Get operating status of contract
     *
     * @return A bool that is the current operating status
     */
    function isOperational() public view returns (bool) {
        return operational;
    }

    function getAirlinesCount()
        external
        view
        requireFlightSuretyAppContract
        returns (uint8)
    {
        return airlinesCount;
    }

    function isAirlineRegistered(address airlineAddress)
        external
        view
        requireFlightSuretyAppContract
        returns (bool)
    {
        return airlines[airlineAddress].registered;
    }

    function isAirlineAllowedToVote(address airlineAddress)
        external
        view
        requireFlightSuretyAppContract
        returns (bool)
    {
        return airlines[airlineAddress].canVote;
    }

    /**
     * @dev Sets contract operations on/off
     *
     * When operational mode is disabled, all write transactions except for this one will fail
     */
    function setOperatingStatus(bool mode) external requireContractOwner {
        operational = mode;
    }

    function authorizeCaller(address contractAddress, bool authorized)
        external
        requireContractOwner
    {
        authorizedCallers[contractAddress] = authorized;
    }

    // Insurance getters and setters
    function passengerHasInsurance(address passengerAddress)
        external
        view
        requireFlightSuretyAppContract
        returns (bool)
    {
        return
            insurances[passengerAddress].status !=
            InsuranceStatus.Uninitialized;
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

    /**
     * @dev Add an airline to the registration queue
     *      Can only be called from FlightSuretyApp contract
     *
     */
    function registerAirline(address addr)
        external
        requireFlightSuretyAppContract
    {
        // Add airline to list
        airlines[addr] = Airline({canVote: false, registered: true});
        airlinesCount++;
    }

    /**
     * @dev Buy insurance for a flight
     *
     */
    function buy(
        address passengerAddress,
        address airline,
        string calldata flight,
        uint256 timestamp
    ) external payable requireFlightSuretyAppContract {
        bytes32 flightKey = getFlightKey(airline, flight, timestamp);
        flightInsurees[flightKey].push(passengerAddress);
        insurances[passengerAddress] = (
            Insurance({
                flightKey: flightKey,
                value: msg.value,
                payoutValue: (msg.value * 3) / 2,
                status: InsuranceStatus.Bought
            })
        );
    }

    /**
     *  @dev Credits payouts to insurees
     */
    function creditInsurees(bytes32 flightKey)
        external
        requireFlightSuretyAppContract
    {
        for (uint256 i = 0; i < flightInsurees[flightKey].length; i++) {
            address insuree = flightInsurees[flightKey][i];
            if (insurances[insuree].status == InsuranceStatus.Bought) {
                insurances[insuree].status = InsuranceStatus.Claimable;
            }
        }
    }

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
     */
    function pay(address passenger) external requireFlightSuretyAppContract {
        require(
            insurances[passenger].status == InsuranceStatus.Claimable,
            "Insurance is not claimable"
        );
        insurances[passenger].status = InsuranceStatus.Claimed;

        uint256 payoutValue = insurances[passenger].payoutValue;
        if (payoutValue > address(this).balance) {
            payoutValue = address(this).balance;
        }

        payable(passenger).transfer(payoutValue);
    }

    /**
     * @dev Initial funding for the insurance. Unless there are too many delayed flights
     *      resulting in insurance payouts, the contract should be self-sustaining
     *
     */
    function fund(address airlineAddress)
        public
        payable
        requireFlightSuretyAppContract
    {
        airlines[airlineAddress].canVote = true;
    }

    function getFlightKey(
        address airline,
        string memory flight,
        uint256 timestamp
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    /**
     * @dev Fallback function for funding smart contract.
     *
     */
    fallback() external payable {
        fund(msg.sender);
    }

    receive() external payable {
        fund(msg.sender);
    }
}
