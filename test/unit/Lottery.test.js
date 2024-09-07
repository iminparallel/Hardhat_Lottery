const {
  developmentChains,
  networkConfig,
} = require("../../helper-hardhat-config")
const { network, deployments, ethers } = require("hardhat")
const { assert, expect, chai } = require("chai")

!developmentChains.includes(network.name)
  ? descripbe.skip
  : describe("Lottery", async function () {
      let lottery,
        vrfCoordinatorV2Mock,
        instance,
        lotteryEntranceFee,
        interval,
        player,
        subscriptionId
      const FUND_AMOUNT = ethers.parseEther("10000000000")
      beforeEach(async function () {
        const { deployer } = await getNamedAccounts()
        await deployments.fixture(["all", "lottery"])

        const lotteryDeployment = await deployments.get("Lottery")
        lottery = await ethers.getContractAt(
          "Lottery",
          lotteryDeployment.address,
        )

        const vrfCoordinatorV2MockDeployment = await deployments.get(
          "VRFCoordinatorV2Mock",
        )
        vrfCoordinatorV2Mock = await ethers.getContractAt(
          "VRFCoordinatorV2Mock",
          vrfCoordinatorV2MockDeployment.address,
        )
        accounts = await ethers.getSigners() // could also do with getNamedAccounts
        //   deployer = accounts[0]
        player = accounts[1]
        /* await network.provider.send("hardhat_setBalance", [
          player.address,
          "0x56bc75e2d63100000", // This is 1000 ETH in hex (for testing purposes)
        ])*/

        instance = lottery.connect(player) // Returns a new instance of the Raffle contract connected to player
        // wait for the transaction to be mined
        lotteryEntranceFee = await instance.getEntranceFee()
        interval = await instance.getInterval()
      })

      describe("constructor", async function () {
        it("Initializes the lottery correctly", async function () {
          const lotteryState = (await lottery.getRaffleState()).toString()
          // Comparisons for Raffle initialization:
          assert.equal(lotteryState, "0")
          assert.equal(
            interval.toString(),
            networkConfig[network.config.chainId]["keepersUpdateInterval"],
          )
        })
      })
      describe("enterRaffle", function () {
        it("reverts when you don't pay enough", async () => {
          await expect(instance.enterRaffle()).to.be.reverted
        })
        it("records player when they enter", async () => {
          await instance.enterRaffle({ value: lotteryEntranceFee })
          const contractPlayer = await instance.getPlayer(0)
          assert.equal(player.address, contractPlayer)
        })
        it("emits event on enter", async () => {
          await expect(
            instance.enterRaffle({ value: lotteryEntranceFee }),
          ).to.emit(
            // emits RaffleEnter event if entered to index player(s) address
            lottery,
            "RaffleEnter",
          )
        })
        it("doesn't allow entrance when raffle is calculating", async () => {
          await instance.enterRaffle({ value: lotteryEntranceFee })
          // for a documentation of the methods below, go here: https://hardhat.org/hardhat-network/reference
          const blockTimestamp = (await ethers.provider.getBlock("latest"))
            .timestamp
          console.log(blockTimestamp)

          await network.provider.send("evm_increaseTime", [
            Number(interval) + 1,
          ])
          /*                 
          await network.provider.send("evm_setNextBlockTimestamp", [
            Number(blockTimestamp) + Number(interval) + 1,
          ])*/
          await network.provider.request({
            method: "evm_mine",
            params: [
              /*Number(blockTimestamp) + Number(interval) + 1*/
            ],
          })
          let state = await lottery.getRaffleState()
          console.log(state)
          // we pretend to be a keeper for a second
          await lottery.performUpkeep("0x") // changes the state to calculating for our comparison below
          state = await lottery.getRaffleState()
          console.log(state)

          /* expect(raffleState).to.equal("CALCULATING") */

          await expect(
            instance.enterRaffle({ value: lotteryEntranceFee }),
          ).to.be.revertedWith(
            // is reverted as raffle is calculating
            "Raffle__RaffleNotOpen",
          )
        })
      })
    })
