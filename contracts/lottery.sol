// SPDX--Licence-Identifier: MIT
import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";
import {VRFCoordinatorV2Interface} from "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/automation/interfaces/AutomationCompatibleInterface.sol"; /*KeeperCompatibleInterface AutomationCompatibleInterface- can be used aswell*/
import "hardhat/console.sol";
import {LinkTokenInterface} from "@chainlink/contracts/src/v0.8/shared/interfaces/LinkTokenInterface.sol";

pragma solidity ^0.8.24;
error Lottery_NotEnoughETHEntered();
error Raffle__TransferFailed();
error Raffle__RaffleNotOpen();
error Raffle__UpkeepNotNeeded(uint256 currentBalance, uint256 numPlayers, uint256 raffleState);
//error Raffele_InvalidConsumer();

contract Lottery is VRFConsumerBaseV2, AutomationCompatibleInterface {

    enum RaffleState {
        OPEN,
        CALCULATING
    }

    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    LinkTokenInterface private immutable i_linktoken;

    uint64 private immutable i_subscriptionId;
    bytes32 private immutable i_gasLane;
    uint32 private immutable i_callbackGasLimit;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1;    
    uint256 private immutable i_entrancefee;    
    uint256 private immutable i_interval;

    address private s_recentWinner;
    RaffleState private s_raffleState;
    uint256 private s_lastTimeStamp;
    address payable[] private s_players;
    address link_token_contract = 0x779877A7B0D9E8603169DdbD7836e478b4624789;

   /* address [] private s_consumers;*/


    event RaffleEnter(address indexed player); 
    event RequestedRaffleWinner(uint256 indexed requestId);
    event WinnerPicked(address payable winner); 

    constructor(address vrfCoordinatorV2,
    //address linkToken,
        uint64 subscriptionId,
        bytes32 gasLane, // keyHash
        uint256 entranceFee,
        uint256 interval,
        uint32 callbackGasLimit) VRFConsumerBaseV2(vrfCoordinatorV2) {
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_entrancefee = entranceFee/10**70; 
        i_subscriptionId = i_vrfCoordinator.createSubscription();
        i_gasLane = gasLane;
        i_interval = interval;
        i_callbackGasLimit = callbackGasLimit;
        s_raffleState = RaffleState.OPEN;
        s_lastTimeStamp = block.timestamp;
       // i_linktoken = LinkTokenInterface(link_token_contract);
        i_vrfCoordinator.addConsumer(i_subscriptionId, address(this));
       /* i_linktoken.transferAndCall(
            address(i_vrfCoordinator),
            100000000,
            abi.encode(i_subscriptionId));   */ 
       // i_vrfCoordinator.fundSubscription(i_subscriptionId, 100000000000000000000);
        }

    function enterRaffle() public payable{
        if(msg.value < i_entrancefee){
            revert Lottery_NotEnoughETHEntered();

        }
        if (s_raffleState != RaffleState.OPEN) {
            revert Raffle__RaffleNotOpen();
        }

        s_players.push(payable(msg.sender)); 
        emit RaffleEnter(msg.sender);
    }  

    function checkUpkeep(bytes memory /* checkData */ ) public view override
        returns (bool upkeepNeeded, bytes memory /* performData */ )
    {
        bool isOpen = RaffleState.OPEN == s_raffleState;
        bool timePassed = ((block.timestamp - s_lastTimeStamp) > i_interval);
        bool hasPlayers = s_players.length > 0;
        bool hasBalance = address(this).balance > 0;
        upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers);
        return (upkeepNeeded, "0x0"); 
    }
    /* function consumerIsAdded(uint64 _subId, address _consumer) public view returns (bool) {
     address [] memory consumers = s_consumers[_subId];
      for (uint256 i = 0; i < s_consumers[_subId].length; i++) {
       if (s_consumers[i] == _consumer) {
         return true;
       }
     }
     return false;
    }

    modifier onlyValidConsumer(uint64 _subId, address _consumer) {
      if (!consumerIsAdded(_subId, _consumer)) {
        revert Raffele_InvalidConsumer();
      }
      _;
    } */
    function performUpkeep(bytes calldata /* performData */ ) external override {
        (bool upkeepNeeded,) = checkUpkeep("");
        // require(upkeepNeeded, "Upkeep not needed");
        if (!upkeepNeeded) {
            revert Raffle__UpkeepNotNeeded(address(this).balance, s_players.length, uint256(s_raffleState));
        }    
        //request a random number
        //operate
        s_raffleState = RaffleState.CALCULATING;
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane, i_subscriptionId, REQUEST_CONFIRMATIONS, i_callbackGasLimit, NUM_WORDS
        );
        emit RequestedRaffleWinner(requestId);
    }

    function fulfillRandomWords(uint256, uint256[] memory randomWords) internal override
    {
        uint256 indexOfWinner = randomWords[0] % s_players.length;
        address payable recentWinner = s_players[indexOfWinner];
        s_recentWinner = recentWinner;
        s_players = new address payable[](0);
        s_raffleState = RaffleState.OPEN; 
        s_lastTimeStamp = block.timestamp;               
        (bool success,) = recentWinner.call{value: address(this).balance}("");
        // require(success, "Transfer failed");
        if (!success) {
            revert Raffle__TransferFailed();
        }
        emit WinnerPicked(recentWinner);
    }


    function getRecentWinner() public view returns (address) {
        return s_recentWinner;
    }
    function getEntranceFee() public view returns(uint256){
        return i_entrancefee;
    }
    function getPlayer(uint256 index) public view returns(address){
        return s_players[index];
    }
    function getRaffleState() public view returns (RaffleState) {
        return s_raffleState;
    }
    function getLastTimeStamp() public view returns (uint256) {
        return s_lastTimeStamp;
    }
    function getInterval() public view returns (uint256) {
        return i_interval;
    }
    function getNumWords() public pure returns (uint256) {
        return NUM_WORDS;
    }
    function getRequestConfirmations() public pure returns (uint256) {
        return REQUEST_CONFIRMATIONS;
    }   
    function getNumberOfPlayers() public view returns (uint256) {
        return s_players.length;
    }  
    function getSubscriptionId() public view returns (uint256) {
        return i_subscriptionId;
    }     
}