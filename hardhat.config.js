// hardhat.config.js

require("@nomicfoundation/hardhat-toolbox");
require("@nomiclabs/hardhat-ethers");
require("hardhat-deploy");
require("hardhat-deploy-ethers");
require("@nomicfoundation/hardhat-verify");

const dotenv = require('dotenv');

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) {
  throw new Error("process.env.PRIVATE_KEY IS REQUIRED");
}

const config = {
  solidity: {
    version: "0.6.12",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },  
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
    },
    localhost: {
      chainId: 31337,
      url: "http://127.0.0.1:8545/",
      accounts: [PRIVATE_KEY],
    },
    fuji: {
      url: "https://api.avax-test.network/ext/bc/C/rpc",
      chainId: 43113,
      accounts: [PRIVATE_KEY],
    },
    avalanche: {
      url: "https://api.avax.network/ext/bc/C/rpc",
      chainId: 43114,
      accounts: [PRIVATE_KEY],
    },
    polygon: {
      url: "https://rpc-mainnet.matic.network",
      chainId: 137,
      accounts: [PRIVATE_KEY],
    },
    mumbai: {
      url: "https://rpc-mumbai.matic.today",
      chainId: 80001,
      accounts: [PRIVATE_KEY],
    },
    bsc: {
      url: "https://bsc-dataseed.binance.org/",
      chainId: 56,
      accounts: [PRIVATE_KEY],
    },
    bscTestnet: {
      url: "https://data-seed-prebsc-2-s1.binance.org:8545/",
      chainId: 97,
      accounts: [PRIVATE_KEY],
    },
    goerli: {
      url: "https://goerli.infura.io/v3/c4bf91d837eb4f1baaa936fa404ef33d",
      chainId: 5,
      accounts: [PRIVATE_KEY],
    },
    ethereum: {
      url: "https://mainnet.infura.io/v3/c4bf91d837eb4f1baaa936fa404ef33d",
      chainId: 1,
      accounts: [PRIVATE_KEY],
    },
  },
  etherscan: {
    apiKey: {bscTestnet: "QTU498KHG8T1HHQQKDFKA82D2DUZ54R3U3"},
    customChains: [
      {
        network: "bsc",
        chainId: 56, // 0x38
        urls: {
          apiURL: "https://api.bscscan.com/",
          browserURL: "https://bscscan.com/",
        },
      },
    ],
  },
  mocha: {
    // parallel: true
  },
};

module.exports = config;
