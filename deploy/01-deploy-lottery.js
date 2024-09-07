const { network } = require("hardhat")
const FUND_AMOUNT = ethers.parseEther("1") // 1 Ether, or 1e18 (10^18) Wei
const {
  networkConfig,
  developmentChains,
  VERIFICATION_BLOCK_CONFIRMATIONS,
} = require("../helper-hardhat-config")
module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy, log } = deployments
  const { deployer } = await getNamedAccounts()

  const chainId = network.config.chainId
  let vrfCoordinatorV2Address, subscriptionId, vrfCoordinatorV2Mock

  if (chainId == 31337) {
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
    await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, FUND_AMOUNT)
    console.log(subscriptionId)
  } else {
    vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"]
    subscriptionId = networkConfig[chainId]["subscriptionId"]
  }
  console.log("A1")
  const args = [
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
  })
  console.log(`...........`, lottery.address)
  if (chainId == 31337) {
    try {
      await vrfCoordinatorV2Mock.addConsumer(
        Number(subscriptionId),
        lottery.address,
      )
      console.log("... consome is added ...")
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
