pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "./IDOPool.sol";
import "./interfaces/IidoMaster.sol";
import "./FeeProcessor.sol";

contract IDOCreator is Ownable {
    using SafeERC20 for ERC20;

    IidoMaster public idoMaster;
    ITierSystem public tierSystem;
    FeeProcessor public feeProcessor;

    struct PoolConfig {
        uint256 startTimestamp;
        uint256 finishTimestamp;
        uint256 startClaimTimestamp;
        uint256 minStablePayment;
        uint256 maxStablePayment;
        uint256 maxDistributedTokenAmount;
        bool hasWhitelisting;
        bool enableTierSystem;
    }

    constructor(IidoMaster _idoMaster, ITierSystem _tierSystem,FeeProcessor _feeProcessor) public {
        idoMaster = _idoMaster;
        tierSystem = _tierSystem;
        feeProcessor = _feeProcessor;
    }

    function createIDO(
        uint256 _tokenPrice,
        ERC20 _rewardToken,
        PoolConfig memory _config
    ) external returns (address) {
        feeProcessor.processFee();
        IidoMaster.PoolConfig memory masterConfig = IidoMaster.PoolConfig({
            startTimestamp: _config.startTimestamp,
            finishTimestamp: _config.finishTimestamp,
            startClaimTimestamp: _config.startClaimTimestamp,
            maxStablePayment: _config.maxStablePayment,
            minStablePayment: _config.minStablePayment,
            maxDistributedTokenAmount: _config.maxDistributedTokenAmount,
            hasWhitelisting: _config.hasWhitelisting,
            enableTierSystem: _config.enableTierSystem
        });
        IDOPool.PoolConfig memory config = IDOPool.PoolConfig({
            startTimestamp: _config.startTimestamp,
            finishTimestamp: _config.finishTimestamp,
            startClaimTimestamp: _config.startClaimTimestamp,
            maxStablePayment: _config.maxStablePayment,
            minStablePayment: _config.minStablePayment,
            maxDistributedTokenAmount: _config.maxDistributedTokenAmount,
            hasWhitelisting: _config.hasWhitelisting,
            enableTierSystem: _config.enableTierSystem
        });

        IDOPool idoPool = new IDOPool(
            idoMaster,
            idoMaster.feeFundsPercent(),
            _tokenPrice,
            _rewardToken,
            config,
            tierSystem
        );

        idoPool.transferOwnership(msg.sender);

        _rewardToken.safeTransferFrom(
            msg.sender,
            address(idoPool),
            _config.maxDistributedTokenAmount
        );


        idoMaster.registrateIDO(
            address(idoPool),
            _tokenPrice,
            address(0),
            address(_rewardToken),
            masterConfig
        );

        return address(idoPool);
    }

    function setTierSystem(ITierSystem _tierSystem) external onlyOwner {
        tierSystem = _tierSystem;
    }
}
