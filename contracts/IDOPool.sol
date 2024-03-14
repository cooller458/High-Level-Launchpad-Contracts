pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "./Pausable.sol";
import "./Whitelist.sol";
import "./interfaces/IidoMaster.sol";
import "./interfaces/ITierSystem.sol";

contract IDOPool is Ownable, Pausable, Whitelist, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for ERC20;

    uint256 public tokenPrice;
    ERC20 public rewardToken;
    ERC20 public stableCoin;
    uint256 public decimals;
    uint256 public startTimestamp;
    uint256 public finishTimestamp;
    uint256 public startClaimTimestamp;
    uint256 public maxStablePayment;
    uint256 public minStablePayment;
    uint256 public maxDistributedTokenAmount;
    uint256 public tokensForDistribution;
    uint256 public distributedTokens;
    uint256 public participants;
    bool public isFcfsOpen = false;

    ITierSystem public tierSystem;
    IidoMaster public idoMaster;
    uint256 public feeFundsPercent;
    bool public enableTierSystem;

    struct UserInfo {
        uint debt;
        uint total;
        uint totalInvestedStable;
    }
    struct PoolConfig {
        uint256 startTimestamp;
        uint256 finishTimestamp;
        uint256 startClaimTimestamp;
        uint256 maxStablePayment;
        uint256 minStablePayment;
        uint256 maxDistributedTokenAmount;
        bool hasWhitelisting;
        bool enableTierSystem;
    }

    mapping(address => UserInfo) public userInfo;

    event TokensDebt(
        address indexed holder,
        uint256 StableAmount,
        uint256 tokenAmount
    );

    event TokensWithdrawn(address indexed holder, uint256 amount);
    event HasWhitelistingUpdated(bool newValue);
    event EnableTierSystemUpdated(bool newValue);

    uint256 public vestingPercent;
    uint256 public vestingStart;
    uint256 public vestingInterval;
    uint256 public vestingDuration;

    event VestingUpdated(
        uint256 _vestingPercent,
        uint256 _vestingStart,
        uint256 _vestingInterval,
        uint256 _vestingDuration
    );
    event VestingCreated(address indexed holder, uint256 amount);
    event VestingReleased(uint256 amount);

    struct Vesting {
        uint256 balance;
        uint256 released;
    }

    mapping(address => Vesting) private _vestings;



    constructor(
        IidoMaster _idoMaster,
        uint256 _feeFundsPercent,
        uint256 _tokenPrice,
        ERC20 _rewardToken,
        PoolConfig memory _config,
        ITierSystem _tierSystem
    ) public Whitelist(_config.hasWhitelisting) {
        idoMaster = _idoMaster;
        feeFundsPercent = _feeFundsPercent;
        tokenPrice = _tokenPrice;
        rewardToken = _rewardToken;
        decimals = rewardToken.decimals();

        startTimestamp = _config.startTimestamp;
        finishTimestamp = _config.finishTimestamp;
        startClaimTimestamp = _config.startClaimTimestamp;
        maxStablePayment = _config.maxStablePayment;
        minStablePayment = _config.minStablePayment;
        maxDistributedTokenAmount = _config.maxDistributedTokenAmount;
        enableTierSystem = _config.enableTierSystem;
        tierSystem = _tierSystem;
    }

    modifier fcfs() {
    if (isFcfsOpen) {
        require(isWhitelisted(msg.sender), "User is not whitelisted");
    }
    _;
}

    function setVesting(
        uint256 _vestingPercent,
        uint256 _vestingStart,
        uint256 _vestingInterval,
        uint256 _vestingDuration
    ) external onlyOwner {
        require(now < startTimestamp, "Already started");

        require(_vestingPercent <= 100, "Vesting percent must be <= 100");
        if (_vestingPercent > 0) {
            require(_vestingInterval > 0, "interval must be greater than 0");
            require(
                _vestingDuration >= _vestingInterval,
                "interval cannot be bigger than duration"
            );
        }

        vestingPercent = _vestingPercent;
        vestingStart = _vestingStart;
        vestingInterval = _vestingInterval;
        vestingDuration = _vestingDuration;

        emit VestingUpdated(
            vestingPercent,
            vestingStart,
            vestingInterval,
            vestingDuration
        );
    }

    function payWithStable(
        uint256 stableAmount
    ) external nonReentrant onlyWhitelisted whenNotPaused fcfs {
        require(
            address(stableCoin) != address(0),
            "Stable coin address not set"
        );
        require(
            now >= startTimestamp && now < finishTimestamp,
            "Sale is not active"
        );
        require(stableAmount > 0, "Amount should be greater than 0");

        uint256 tokenAmount = getTokenAmountForStable(stableAmount);
        if (!isFcfsOpen) {
            require(
                tokensForDistribution.add(tokenAmount) <=
                    maxDistributedTokenAmount,
                "Overfilled"
            );
        }

        UserInfo storage user = userInfo[msg.sender];

        if (enableTierSystem) {
            require(
                user.totalInvestedStable.add(stableAmount) <=
                    tierSystem.getMaxEthPayment(msg.sender, maxStablePayment),
                "More than max amount"
            );
        } else {
            require(
                user.totalInvestedStable.add(stableAmount) <= maxStablePayment,
                "More than max amount"
            );
        }
        require(
            user.totalInvestedStable.add(stableAmount) >= minStablePayment,
            "Less than min amount"
        );

        if (!isFcfsOpen) {
            require(
                user.totalInvestedStable.add(stableAmount) <= maxStablePayment,
                "More than max amount"
            );
        }

        tokensForDistribution = tokensForDistribution.add(tokenAmount);
        user.totalInvestedStable = user.totalInvestedStable.add(stableAmount);
        user.total = user.total.add(tokenAmount);
        user.debt = user.debt.add(tokenAmount);
        participants += 1;

        stableCoin.transferFrom(msg.sender, address(this), stableAmount);

        emit TokensDebt(msg.sender, stableAmount, tokenAmount);
    }

    function getTokenAmount(
        uint256 stableAmount
    ) internal view returns (uint256) {
        return stableAmount.mul(10 ** decimals).div(tokenPrice);
    }

    function claim() external whenNotPaused {
        proccessClaim(msg.sender);
    }

    function proccessClaim(address _receiver) internal nonReentrant {
        UserInfo storage user = userInfo[_receiver];
        uint256 _amount = user.debt;
        if (_amount > 0) {
            user.debt = 0;
            distributedTokens = distributedTokens.add(_amount);

            if (vestingPercent > 0) {
                uint256 vestingAmount = _amount.mul(vestingPercent).div(100);
                createVesting(_receiver, vestingAmount);
                _amount = _amount.sub(vestingAmount);
            }

            rewardToken.safeTransfer(_receiver, _amount);
            emit TokensWithdrawn(_receiver, _amount);
        }
    }

    function setHasWhitelisting(bool value) external onlyOwner {
        hasWhitelisting = value;
        emit HasWhitelistingUpdated(hasWhitelisting);
    }

    function howMuchClaim(address _receiver) public view returns (uint256) {
        UserInfo storage user = userInfo[_receiver];
        uint256 _amount = user.debt;
        if (_amount > 0) {
            if (vestingPercent > 0) {
                uint256 vestingAmount = _amount.mul(vestingPercent).div(100);
                _amount = _amount.sub(vestingAmount);
            }
        }
        return _amount;
    }

    function withdrawFunds() external onlyOwner nonReentrant {
        if (feeFundsPercent > 0) {
            uint256 feeAmount = address(this).balance.mul(feeFundsPercent).div(
                100
            );
            idoMaster.feeWallet().transfer(feeAmount);
        }
        uint256 amount = address(this).balance;
        msg.sender.transfer(amount);
    }
    function getVesting(
        address beneficiary
    ) public view returns (uint256, uint256) {
        Vesting memory v = _vestings[beneficiary];
        return (v.balance, v.released);
    }
    function createVesting(address beneficiary, uint256 amount) private {
        Vesting storage vest = _vestings[beneficiary];

        vest.balance = amount;

        emit VestingCreated(beneficiary, amount);
    }
    function release(address beneficiary) external nonReentrant {
        uint256 unreleased = releasableAmount(beneficiary);

        Vesting storage vest = _vestings[beneficiary];

        vest.released = vest.released.add(unreleased);
        vest.balance = vest.balance.sub(unreleased);

        rewardToken.safeTransfer(beneficiary, unreleased);
        emit VestingReleased(unreleased);
    }

    function releasableAmount(
        address beneficiary
    ) public view returns (uint256) {
        return vestedAmount(beneficiary).sub(_vestings[beneficiary].released);
    }

    function vestedAmount(address beneficiary) public view returns (uint256) {
        if (block.timestamp < vestingStart) {
            return 0;
        }

        Vesting memory vest = _vestings[beneficiary];
        uint256 currentBalance = vest.balance;
        uint256 totalBalance = currentBalance.add(vest.released);

        if (block.timestamp >= vestingStart.add(vestingDuration)) {
            return totalBalance;
        } else {
            uint256 numberOfInvervals = block.timestamp.sub(vestingStart).div(
                vestingInterval
            );
            uint256 totalIntervals = vestingDuration.div(vestingInterval);
            return totalBalance.mul(numberOfInvervals).div(totalIntervals);
        }
    }

    // function numberOfInterval(address beneficiary) public view returns(uint256) {
    //     Vesting memory vest = _vestings[beneficiary];
    //     uint256 currentBalance = vest.balance;
    //     uint256 totalBalance = currentBalance.add(vest.released);
    //     uint256 numberOfInvervals = block.timestamp.sub(vestingStart).div(vestingInterval);
    //     uint256 totalIntervals = vestingDuration.div(vestingInterval);
    //     return totalIntervals;
    // }
    function setStableCoinAddress(ERC20 _stableCoin) external onlyOwner {
        stableCoin = _stableCoin;
    }
    function getTokenAmountForStable(
        uint256 stableAmount
    ) internal view returns (uint256) {
        uint8 stableDecimals = stableCoin.decimals();
        return
            stableAmount.mul(10 ** decimals).div(tokenPrice).mul(
                10 ** stableDecimals
            );
    }
    function toggleFcfs() external onlyOwner {
        isFcfsOpen = !isFcfsOpen;
    }
}
