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
        subscriptionId,
        accounts
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
          // we pretend to be a keeper for a second
          await instance.performUpkeep("0x") // changes the state to calculating for our comparison below
          /* expect(raffleState).to.equal("CALCULATING") */
          await expect(instance.enterRaffle({ value: lotteryEntranceFee })).to
            .be.reverted
        })
      })
      describe("checkUpkeep", function () {
        it("returns false if people haven't sent any ETH", async () => {
          await network.provider.send("evm_increaseTime", [
            Number(interval) + 1,
          ])
          await network.provider.request({ method: "evm_mine", params: [] })
          const { upkeepNeeded } = await instance.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
          assert(!upkeepNeeded)
        })
        it("returns false if raffle isn't open", async () => {
          await instance.enterRaffle({ value: lotteryEntranceFee })
          await network.provider.send("evm_increaseTime", [
            Number(interval) + 1,
          ])
          await network.provider.request({ method: "evm_mine", params: [] })
          await instance.performUpkeep("0x") // changes the state to calculating
          const raffleState = await instance.getRaffleState() // stores the new state
          const { upkeepNeeded } = await instance.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
          assert.equal(raffleState.toString() == "1", upkeepNeeded == false)
        })
        it("returns false if enough time hasn't passed", async () => {
          await instance.enterRaffle({ value: lotteryEntranceFee })
          await network.provider.send("evm_increaseTime", [
            Number(interval) - 5,
          ]) // use a higher number here if this test fails
          await network.provider.request({ method: "evm_mine", params: [] })
          const { upkeepNeeded } = await instance.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
          assert(!upkeepNeeded)
        })
        it("returns true if enough time has passed, has players, eth, and is open", async () => {
          await instance.enterRaffle({ value: lotteryEntranceFee })
          await network.provider.send("evm_increaseTime", [
            Number(interval) + 1,
          ])
          await network.provider.request({ method: "evm_mine", params: [] })
          const { upkeepNeeded } = await instance.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
          assert(upkeepNeeded)
        })
      })
      describe("performUpkeep", function () {
        it("can only run if checkupkeep is true", async () => {
          await instance.enterRaffle({ value: lotteryEntranceFee })
          await network.provider.send("evm_increaseTime", [
            Number(interval) + 1,
          ])
          await network.provider.request({ method: "evm_mine", params: [] })
          const tx = await instance.performUpkeep("0x")
          assert(tx)
        })
        it("reverts if checkup is false", async () => {
          await expect(instance.performUpkeep("0x")).to.be.reverted
        })
        it("updates the raffle state and emits a requestId", async () => {
          // Too many asserts in this test!
          await instance.enterRaffle({ value: lotteryEntranceFee })
          await network.provider.send("evm_increaseTime", [
            Number(interval) + 1,
          ])
          await network.provider.request({ method: "evm_mine", params: [] })
          const txResponse = await instance.performUpkeep("0x") // emits requestId
          const txReceipt = await txResponse.wait(1) // waits 1 block
          const raffleState = await instance.getRaffleState() // updates state
          //console.log(txReceipt.logs)
          //const requestId = txReceipt.events[1].args.requestId
          //assert(Number(requestId) > 0)
          assert(raffleState == 1) // 0 = open, 1 = calculating
        })
      })
      describe("fulfillRandomWords", function () {
        beforeEach(async () => {
          await instance.enterRaffle({ value: lotteryEntranceFee })
          await network.provider.send("evm_increaseTime", [
            Number(interval) + 1,
          ])
          await network.provider.request({ method: "evm_mine", params: [] })
        })
        it("can only be called after performupkeep", async () => {
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(0, instance.target), // reverts if not fulfilled
          ).to.be.revertedWith("nonexistent request")
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(1, instance.target), // reverts if not fulfilled
          ).to.be.revertedWith("nonexistent request")
        })
        it("picks a winner, resets, and sends money", async () => {
          const additionalEntrances = 3 // to test
          const startingIndex = 2
          let startingBalance
          for (
            let i = startingIndex;
            i < startingIndex + additionalEntrances;
            i++
          ) {
            // i = 2; i < 5; i=i+1
            const newInstance = instance.connect(accounts[i]) // Returns a new instance of the Raffle contract connected to player
            await newInstance.enterRaffle({ value: lotteryEntranceFee })
          }
          const startingTimeStamp = await instance.getLastTimeStamp() // stores starting timestamp (before we fire our event)

          const tx1 = await instance.checkUpkeep("0x")
          console.log(tx1)
          console.log("it got here -1")

          await new Promise(async (resolve, reject) => {
            console.log("it got here 0")
            try {
              console.log("it got here 1")

              contractBalance = await ethers.provider.getBalance(
                vrfCoordinatorV2Mock.target,
              )
              console.log(`Contract balance: ${contractBalance.toString()}`)

              const tx = await instance.performUpkeep("0x")
              const txReceipt = await tx.wait(1)
              console.log("it got here first")

              //startingBalance = await accounts[2].getBalance()
              await vrfCoordinatorV2Mock.fulfillRandomWords(
                txReceipt.logs[1].args.requestId,
                instance.target,
              )
              console.log("it got here")
              done()
            } catch (e) {
              reject(e)
            }

            raffle.once("WinnerPicked", async () => {
              // event listener for WinnerPicked
              console.log("WinnerPicked event fired!")
              // assert throws an error if it fails, so we need to wrap
              // it in a try/catch so that the promise returns event
              // if it fails.
              try {
                // Now lets get the ending values...
                const recentWinner = await instance.getRecentWinner()
                console.log(recentWinner)
                const raffleState = await instance.getRaffleState()
                //const winnerBalance = await accounts[2].getBalance()
                const endingTimeStamp = await instance.getLastTimeStamp()
                //await expect(raffle.getPlayer(0)).to.be.reverted
                // Comparisons to check if our ending values are correct:
                // assert.equal(recentWinner.toString(), accounts[2].address)
                // assert.equal(raffleState, 0)
                /* assert.equal(
                  winnerBalance.toString(),
                  startingBalance // startingBalance + ( (raffleEntranceFee * additionalEntrances) + raffleEntranceFee )
                    .add(
                      raffleEntranceFee
                        .mul(additionalEntrances)
                        .add(raffleEntranceFee),
                    )
                    .toString(),
                )
                assert(endingTimeStamp > startingTimeStamp) */
                // if try passes, resolves the promise
              } catch (e) {
                reject(e) // if try fails, rejects the promise
              }
              resolve()
            })
            console.log("it got here 0.5")

            // kicking off the event by mocking the chainlink keepers and vrf coordinator
          })
        })
      })
    })
