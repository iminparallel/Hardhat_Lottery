const { ethers } = require("hardhat")
const networkConfig = {
  11155111: {
    name: "sepolia",
    vrfCoordinatorV2: "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625",
    entranceFee: ethers.parseEther("0.1"),
    gasLane:
      "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c", // 30 gwei
    subscriptionId: "0",
    callbackGasLimit: "500000",
    keepersUpdateInterval: "30",
  },
  31337: {
    name: "hardhat",
    entranceFee: ethers.parseEther("0.1"),
    gasLane:
      "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c", // 30 gwei
    subscriptionId: "0",
    callbackGasLimit: "500000",
    keepersUpdateInterval: "30",
    chainlink: {
      keyHash:
        "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc",
      minimumRequestConfirmations: 3,
    },
  },
}

const developmentChains = ["hardhat", "localhost"]

module.exports = {
  networkConfig,
  developmentChains,
}
