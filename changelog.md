## 04.02.2021

### StakeMaster

#### Changed
- StakingPoolCreated event add all pools arguments
- BurnPercentUpdated event add devider


### StakingPool

#### Added 
- allStakedAmount
- allPaidReward
- allRewardDebt
- poolTokenAmount
- participants
- withdrawPoolRemainder method return not distributed tokens for owner
- allow to create pool with the same token (reward, stake)


#### Updated
- stakes,rewardDebts mapping was removed, add mapping with userInfo with struct UserInfo (amount, rewardDebt)
- reward mul changed from 1e12 to 1e18

#### Removed
- Update finish block
- Update Pool token amount
- Withdraw all reward from pool by owner