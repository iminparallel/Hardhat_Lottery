const { network } = require("hardhat")
const FUND_AMOUNT = ethers.parseUnits("1", 18) // 1 Ether, or 1e18 (10^18) Wei
const {
  networkConfig,
  developmentChains,
  VERIFICATION_BLOCK_CONFIRMATIONS,
} = require("../helper-hardhat-config")
//const { DeployFunction } = require("hardhat-deploy/types")
//const { ChainlinkVrfPropsStruct } = require("../build/typechain/src/MyContract")
/*
const {
  VRFCoordinatorV2Mock__factory,
} = require("../build/typechain/factories/@chainlink/contracts/src/v0.8/mocks/VRFCoordinatorV2Mock__factory")
*/
module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy, log } = deployments
  const { deployer } = await getNamedAccounts()

  const chainId = network.config.chainId
  let vrfCoordinatorV2Address,
    subscriptionId,
    vrfCoordinatorV2Mock,
    linkTokenDeployment,
    linktoken
  //console.log(chainId, networkConfig[chainId])
  const chainlink = networkConfig[chainId].chainlink
  if (chainId == 31337) {
    linkTokenDeployment = await deployments.get("LinkToken")
    linkToken = await ethers.getContractAt(
      "LinkToken",
      linkTokenDeployment.address,
    )

    const vrfCoordinatorV2MockDeployment = await deployments.get(
      "VRFCoordinatorV2Mock",
    )
    vrfCoordinatorV2Mock = await ethers.getContractAt(
      "VRFCoordinatorV2Mock",
      vrfCoordinatorV2MockDeployment.address,
    )
    vrfCoordinatorV2Address = vrfCoordinatorV2Mock.target
    const transactionResponse = await vrfCoordinatorV2Mock.createSubscription()
    const transactionReceipt = await transactionResponse.wait(1)
    //console.log(transactionReceipt.logs)
    subscriptionId = transactionReceipt.logs[0].topics[1]
    const paymentResponse = await vrfCoordinatorV2Mock.fundSubscription(
      subscriptionId,
      FUND_AMOUNT,
    )
  } else {
    vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"]
    subscriptionId = networkConfig[chainId]["subscriptionId"]
    linkTokenDeployment = networkConfig[chainId].chainlink["keyHash"]
  }
  console.log("A1")
  const args = [
    // linkTokenDeployment.address,
    vrfCoordinatorV2Address,
    networkConfig[chainId]["entranceFee"] / BigInt(100000000000000),
    subscriptionId,
    networkConfig[chainId]["gasLane"],
    networkConfig[chainId]["keepersUpdateInterval"],
    networkConfig[chainId]["callbackGasLimit"],
  ]
  const lottery = await deploy("Lottery", {
    from: deployer,
    args: args,
    log: true,
    waitConfirmations: network.config.blockConfirmations || 1,
    automine: true,
    gasLimit: 5_000_000,
  })
  console.log(`...........`, lottery.address)
  if (chainId == 31337) {
    try {
      //await token.increaseAllowance(lottery.address, FUND_AMOUNT)

      const subscriptionInfo =
        await vrfCoordinatorV2Mock.getSubscription(subscriptionId)

      console.log(subscriptionInfo.balance.toString())
      const paymentReceipt = await paymentResponse.wait(1)

      /* const addConsumerResponse = await vrfCoordinatorV2Mock.addConsumer(
        Number(subscriptionId),
        lottery.address,
      ) */
      const addConsumerReceipt = await addConsumerResponse.wait(1)

      console.log("... consumer is added ...")
    } catch (error) {
      console.log(error.toString())
    }
  }
  if (
    !developmentChains.includes(network.name) &&
    process.env.ETHERSCAN_API_KEY
  ) {
    log("- - - VERIFYING - - -")
    await verify(fundMe.address, [ethUsdPriceFeedAddress])
  }
}

module.exports.tags = ["all", "Lottery"]
