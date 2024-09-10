const { developmentChains } = require("../helper-hardhat-config")
const BASE_FEE = "100000000000000000" // 0.25 is this the premium in LINK?
const GAS_PRICE_LINK = 1e3 // link per gas, is this the gas lane? // 0.000000001 LINK per gas
const { verify } = require("../utils/verify")

module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy, log } = deployments
  const { deployer } = await getNamedAccounts()
  const chainId = network.config.chainId

  if (developmentChains.includes(network.name)) {
    log("local network detected, deploying mocks ....")
    log("Deploying LinkToken...")
    await deploy("LinkToken", {
      from: deployer,
      log: true,
      //autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks
    })
    await deploy("VRFCoordinatorV2Mock", {
      from: deployer,
      log: true,
      args: [BASE_FEE, GAS_PRICE_LINK],
    })
  }

  log("........ mocks deployed ........")
}

module.exports.tags = ["all", "mocks"]
