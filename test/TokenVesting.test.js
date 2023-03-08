const {
  BN,
  constants,
  expectEvent,
  ether,
  expectRevert,
  time,
} = require("@openzeppelin/test-helpers");
const { ZERO_ADDRESS } = constants;
const { expect } = require("chai");
const timeTravel = time.increaseTo;

const TokenVesting = artifacts.require("TokenVesting");
const ERC20Mock = artifacts.require("ERC20Mock");

contract.only("TokenVesting", function (accounts) {
  const [owner, beneficiary, other] = accounts;

  const ownerBal = ether("12000000000000000000");
  let start;
  const interval = 240; // 4 minutes
  const duration = interval * 4; // 16 minutes
  const balance = ether("120"); // 120 tokens

  beforeEach(async function () {
    const blockNumber = await web3.eth.getBlockNumber();
    const block = await web3.eth.getBlock(blockNumber);
    start = block.timestamp;
    this.token = await ERC20Mock.new(owner, ownerBal);
    this.tokenVesting = await TokenVesting.new(this.token.address);
    this.token.approve(this.tokenVesting.address, ownerBal, { from: owner });
  });

  const mineBlock = async function (_token, spender) {
    await _token.burn(owner, "0", { from: owner });
  };

  describe("create vesting", function () {
    beforeEach("createVesting", async function () {
      const allowance = await this.token.allowance(
        owner,
        this.tokenVesting.address
      );
      // console.log('allowance', allowance.toString())
      // console.log('balance', balance.toString())
      await this.tokenVesting.createVesting(
        owner,
        beneficiary,
        start,
        interval,
        duration,
        balance
      );
    });

    describe("vesting should have correct data", function () {
      it("getVesting", async function () {
        const vesting = await this.tokenVesting.getVesting(beneficiary);
        expect(vesting[0]).to.be.bignumber.equal(start.toString());
        expect(vesting[1]).to.be.bignumber.equal(interval.toString());
        expect(vesting[2]).to.be.bignumber.equal(duration.toString());
        expect(vesting[3]).to.be.bignumber.equal(balance.toString());
        expect(vesting[4]).to.be.bignumber.equal("0");
      });
    });

    describe("reverts", function () {
      it("when interval > duration", async function () {
        await expectRevert(
          this.tokenVesting.createVesting(
            owner,
            beneficiary,
            start,
            interval + 1,
            interval,
            balance
          ),
          "TokenVesting #createVesting: interval cannot be bigger than duration"
        );
      });

      it("when current balance > 0", async function () {
        await expectRevert(
          this.tokenVesting.createVesting(
            owner,
            beneficiary,
            start,
            interval,
            duration,
            balance
          ),
          "TokenVesting #createVesting: vesting for beneficiary already created"
        );
      });
    });

    const checkVesting = function (intervalsVested, alreadyReleased) {
      describe(`should vested ${intervalsVested} intervals`, async function () {
        it("vestedAmount", async function () {
          const vestedAmount = await this.tokenVesting.vestedAmount(
            beneficiary
          );
          const intervalsVestedBN = new BN(intervalsVested.toString());
          const durationBN = new BN(duration.toString());
          const intervalBN = new BN(interval.toString());
          const alreadyReleasedBN = new BN(alreadyReleased.toString());
          const expectedVestedAmount = balance
            .mul(intervalsVestedBN)
            .div(durationBN.div(intervalBN));
          expect(vestedAmount).to.be.bignumber.equal(expectedVestedAmount);
        });

        it("releasableAmount", async function () {
          const releasableAmount = await this.tokenVesting.releasableAmount(
            beneficiary
          );
          const intervalsVestedBN = new BN(intervalsVested.toString());
          const durationBN = new BN(duration.toString());
          const intervalBN = new BN(interval.toString());
          const alreadyReleasedBN = new BN(alreadyReleased.toString());
          const expectedReleasableAmount = balance
            .mul(intervalsVestedBN.sub(alreadyReleasedBN))
            .div(durationBN.div(intervalBN));
          expect(releasableAmount).to.be.bignumber.equal(
            expectedReleasableAmount
          );
        });
      });
    };

    const releaseAndCheckBalances = function (
      intervalsVested,
      alreadyReleased
    ) {
      describe(`should release token for ${intervalsVested} intervals`, function () {
        it("release", async function () {
          const releasableAmount = await this.tokenVesting.releasableAmount(
            beneficiary
          );

          const openBalBeneficiary = await this.token.balanceOf(beneficiary);
          const openBalVestingContract = await this.token.balanceOf(
            this.tokenVesting.address
          );
          const openBalVesting = new BN(
            (await this.tokenVesting.getVesting(beneficiary))[3].toString()
          );

          await this.tokenVesting.release(beneficiary);

          const closeBalBeneficiary = await this.token.balanceOf(beneficiary);
          const closeBalVestingContract = await this.token.balanceOf(
            this.tokenVesting.address
          );
          const closeBalVesting = new BN(
            (await this.tokenVesting.getVesting(beneficiary))[3].toString()
          );

          expect(closeBalBeneficiary).to.be.bignumber.equal(
            openBalBeneficiary.add(releasableAmount)
          );
          expect(closeBalVestingContract).to.be.bignumber.equal(
            openBalVestingContract.sub(releasableAmount)
          );
          expect(closeBalVesting).to.be.bignumber.equal(
            openBalVesting.sub(releasableAmount)
          );
        });
      });
    };

    context("time travel 1 interval", function () {
      beforeEach("time travel", async function () {
        await mineBlock(this.token, this.tokenVesting.address);
        await timeTravel(start + interval);
        await mineBlock(this.token, this.tokenVesting.address);
      });

      checkVesting(1, 0);
      releaseAndCheckBalances(1, 0);
    });

    context("time travel 2 intervals minus 10 second", function () {
      beforeEach("time travel", async function () {
        await mineBlock(this.token, this.tokenVesting.address);
        await timeTravel(start + interval * 2 - 10);
        await mineBlock(this.token, this.tokenVesting.address);
      });
      context("when released for interval 1", function () {
        beforeEach("release for interval 1", async function () {
          await this.tokenVesting.release(beneficiary);
        });
        checkVesting(1, 1);
      });
    });

    context("time travel 2 intervals", function () {
      beforeEach("time travel", async function () {
        await mineBlock(this.token, this.tokenVesting.address);
        await timeTravel(start + interval * 2 + 5);
        await mineBlock(this.token, this.tokenVesting.address);
      });
      checkVesting(2, 0);
      releaseAndCheckBalances(2, 0);
    });

    context("time travel 2 intervals and release after each", function () {
      beforeEach("time travel", async function () {
        await mineBlock(this.token, this.tokenVesting.address);
        await timeTravel(start + interval + 5);
        await this.tokenVesting.release(beneficiary);
        await timeTravel(start + interval * 2 + 5);
        await mineBlock(this.token, this.tokenVesting.address);
      });
      checkVesting(2, 1);
      releaseAndCheckBalances(2, 1);
    });

    context("time travel 3 intervals and release", function () {
      beforeEach("time travel", async function () {
        await mineBlock(this.token, this.tokenVesting.address);
        await timeTravel(start + interval * 3 + 5);
        await mineBlock(this.token, this.tokenVesting.address);
      });
      checkVesting(3, 0);
      releaseAndCheckBalances(3, 0);
    });

    context("time travel 4 intervals, postpone and release", function () {
      let newStart, wrongNewStart;

      beforeEach("time travel", async function () {
        newStart = start + interval * 3;
        wrongNewStart = start - 1;
        await mineBlock(this.token, this.tokenVesting.address);
        await timeTravel(start + interval * 4 + 5);
        await mineBlock(this.token, this.tokenVesting.address);
      });
      checkVesting(4, 0);

      context("postpone vesting", function () {
        describe("reverts", function () {
          it("when balance is 0 (vesting not extists)", async function () {
            await expectRevert(
              this.tokenVesting.postponeVesting(newStart, { from: owner }),
              "TokenVesting #postponeVesting: vesting for beneficiary does not exist"
            );
          });

          it("new start is before old start", async function () {
            await expectRevert(
              this.tokenVesting.postponeVesting(start, { from: beneficiary }),
              "TokenVesting #postponeVesting: new start date cannot be earlier than original start date"
            );

            await expectRevert(
              this.tokenVesting.postponeVesting(wrongNewStart, {
                from: beneficiary,
              }),
              "TokenVesting #postponeVesting: new start date cannot be earlier than original start date"
            );
          });
        });

        it("postponeVesting", async function () {
          await this.tokenVesting.postponeVesting(newStart, {
            from: beneficiary,
          });
          const vesting = await this.tokenVesting.getVesting(beneficiary);

          expect(vesting[0]).to.be.bignumber.equal(newStart.toString());
          expect(vesting[1]).to.be.bignumber.equal(interval.toString());
          expect(vesting[2]).to.be.bignumber.equal(duration.toString());
          expect(vesting[3]).to.be.bignumber.equal(balance.toString());
          expect(vesting[4]).to.be.bignumber.equal("0");
        });

        context("postpone 3 intervals", function () {
          beforeEach(async function () {
            await this.tokenVesting.postponeVesting(newStart, {
              from: beneficiary,
            });
          });
          checkVesting(1, 0);
          releaseAndCheckBalances(1, 0);
        });
      });
    });

    context("time travel 4 intervals and release after each", function () {
      beforeEach("time travel", async function () {
        await mineBlock(this.token, this.tokenVesting.address);
        await timeTravel(start + interval + 5);
        await this.tokenVesting.release(beneficiary);
        await timeTravel(start + interval * 2 + 5);
        await this.tokenVesting.release(beneficiary);
        await timeTravel(start + interval * 3 + 5);
        await this.tokenVesting.release(beneficiary);
        await timeTravel(start + interval * 4 + 5);
        await mineBlock(this.token, this.tokenVesting.address);
      });
      checkVesting(4, 3);
      releaseAndCheckBalances(4, 3);
    });

    context("time travel 4 intervals and release", function () {
      beforeEach("time travel", async function () {
        await mineBlock(this.token, this.tokenVesting.address);
        await timeTravel(start + interval * 4 + 5);
        await mineBlock(this.token, this.tokenVesting.address);
      });
      checkVesting(4, 0);
      releaseAndCheckBalances(4, 0);
    });
  });
});
