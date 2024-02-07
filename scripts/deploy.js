// scripts/deploy.js

const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  const TierSystem = await hre.ethers.getContractFactory("TierSystem");
  const tierSystem = await TierSystem.deploy(
    hre.ethers.utils.parseEther("100"),
    "100",
    hre.ethers.utils.parseEther("10"),
    "100",
    hre.ethers.utils.parseEther("100"),
    "100",
    hre.ethers.utils.parseEther("100"),
    "100",
    hre.ethers.utils.parseEther("100"),
    "100"
  );
  await tierSystem.deployed();
  console.log("TierSystem address:", tierSystem.address);
  const IDOMaster = await hre.ethers.getContractFactory("IDOMaster");
  const idoMaster = await IDOMaster.deploy(
    "0x6597F132775BBC503a6FC989208Be74435EA6B32",
    "0xce01c35b316ccdf43eb3a5f73aa597d519637a28",
    hre.ethers.utils.parseEther("0"),
    "0"
  );
  await idoMaster.deployed();
  console.log("IDO Master address:", idoMaster.address);

  const FeeProcessor = await hre.ethers.getContractFactory("FeeProcessor");
  const feeProcessor = await FeeProcessor.deploy(idoMaster.address);
  await feeProcessor.deployed();
  console.log("FeeProcessor address:", feeProcessor.address);



  const IDOCreator = await hre.ethers.getContractFactory("IDOCreator");
  const idoCreator = await IDOCreator.deploy(idoMaster.address, tierSystem.address, feeProcessor.address);
  await idoCreator.deployed();
  console.log("IDO Creator address:", idoCreator.address);





  await idoMaster.setCreatorProxy(idoCreator.address);
  console.log("IDO Master's Creator Proxy set to:", idoCreator.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
