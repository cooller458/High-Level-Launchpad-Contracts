const ERC20Basic = artifacts.require("ERC20Basic");
const FeeToken = artifacts.require("FeeToken");
const StakeMaster = artifacts.require("StakeMaster");
const StakingPool = artifacts.require("StakingPool");
const IDOMaster = artifacts.require("IDOMaster");
const IDOCreator = artifacts.require("IDOCreator");
const IDOPool = artifacts.require("IDOPool");
const TierSystem = artifacts.require("TierSystem");
const { toWei, fromWei, toBN } = web3.utils;

let idoMasterContract;

const totalSupply = toWei("10000");
const poolTokenSupply = toWei("1");
const stakeAmount = toWei("10");
const feeAmount = toWei("0");
const poolDurationInSecunds = 900;




//TestBSC
const feeWallet = "0xb58967989C8e878de4D7e78965e066F26B2d9bF4";
const feeToken = "0xce01c35b316ccdf43eb3a5f73aa597d519637a28";
const burnPercent = "0";



module.exports = async (deployer, network, accounts) => {
    
    await deployer.deploy(TierSystem, toWei("100"), "100", toWei("10"), "100", toWei("100"), "100",toWei("100"), "100", toWei("100"), "100");
    let tierSystemContract = await TierSystem.deployed();
    console.log("TierSystem address ====> " + tierSystemContract.address);

    await deployer.deploy(IDOMaster, feeToken, feeWallet, feeAmount, burnPercent);
    let idoMasterContract = await IDOMaster.deployed();
    console.log("IDO master address ====> " + idoMasterContract.address);

    await deployer.deploy(IDOCreator, idoMasterContract.address, tierSystemContract.address);
    let idoCreatorContract = await IDOCreator.deployed();
    console.log("IDO creator address ====> " + idoCreatorContract.address);

    await idoMasterContract.setCreatorProxy(idoCreatorContract.address);
    console.log("set setCreatorProxy ====> " + idoCreatorContract.address);
};
