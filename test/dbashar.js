const { expect } = require("chai");
const { upgrades } = require("hardhat");
const { time } = require("../utilities");

describe("dbashar contract", function () {
  let Token;
  let stakeToken;
  let basharToken;
  let dBasharToken;
  let owner;
  let addr1;
  let addr2;
  let addrs;

  beforeEach(async function () {
    // Get the ContractFactory and Signers here.
    Token = await ethers.getContractFactory("Bashar");
    stakeToken = await ethers.getContractFactory("Dbashar");
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

    const startBlock = await time.latestBlock();

    basharToken = await upgrades.deployProxy(Token, [owner.address, 100000]);
    await basharToken.deployed();
    await basharToken.setTreasuryAddress(owner.address);
    await basharToken.setWhitelistAddress(addr1.address, true);
    await basharToken.setWhitelistAddress(addr2.address, true);
    await basharToken.setWhitelistAddress(addrs[0].address, true);
    await basharToken.setTax(0);
    dBasharToken = await upgrades.deployProxy(stakeToken, [
      basharToken.address,
      owner.address,
      startBlock,
      2,
    ]);
    await dBasharToken.deployed();
  });
  describe("Deployment", function () {
    it("Should set the right owner BASHAR token", async function () {
      expect(await basharToken.owner()).to.equal(owner.address);
    });
    it("Should set the right owner of dBashar", async function () {
      expect(await dBasharToken.owner()).to.equal(owner.address);
    });
  });
  describe("Add Bashar pool", function () {
    it("Should revert if non owner tries to add pool", async function () {
      await expect(
        dBasharToken.connect(addr1).add(100, basharToken.address, true)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Should set the right owner of dBashar", async function () {
      await dBasharToken.connect(owner).add(100, basharToken.address, true);
      expect(await dBasharToken.poolLength()).to.equal(1);
    });
  });

  describe("Delegate votes", function () {
    beforeEach(async function () {
      await dBasharToken.connect(owner).add(100, basharToken.address, true);
      await basharToken.connect(owner).transfer(addr1.address, 1000);
      await basharToken.connect(owner).transfer(addr2.address, 1000);
      await basharToken.connect(owner).approve(dBasharToken.address, 1000);
      await basharToken.connect(addr1).approve(dBasharToken.address, 1000);
      await basharToken.connect(addr2).approve(dBasharToken.address, 1000);
      await dBasharToken.connect(owner).deposit(0, 800);
      await dBasharToken.connect(addr1).deposit(0, 900);
      await dBasharToken.connect(addr2).deposit(0, 1000);
    });
    it("User should have zero votes initially", async function () {
      expect(await dBasharToken.getVotes(owner.address)).to.equal(0);
    });
    it("User should have votes after delegate", async function () {
      await dBasharToken.connect(owner).delegate(owner.address);
      expect(await dBasharToken.getVotes(owner.address)).to.equal(800);
    });
    it("User can delegate votes to other users ", async function () {
      await dBasharToken.connect(owner).delegate(addr1.address);
      expect(await dBasharToken.getVotes(addr1.address)).to.equal(800);
    });
    it("Delegated user cannot delegate votes to other users ", async function () {
      await dBasharToken.connect(owner).delegate(addrs[0].address);
      await dBasharToken.connect(addrs[0]).delegate(addr2.address);
      expect(await dBasharToken.getVotes(addr2.address)).to.equal(0);
    });
    it("User votes will reduce on withdraw ", async function () {
      await dBasharToken.connect(owner).delegate(addr1.address);
      await dBasharToken.connect(owner).withdraw(0, 100);
      expect(await dBasharToken.getVotes(addr1.address)).to.equal(700);
    });
    it("Delegated user votes will reduce on withdraw ", async function () {
      await dBasharToken.connect(owner).delegate(addr1.address);
      await dBasharToken.connect(owner).withdraw(0, 100);
      expect(await dBasharToken.getVotes(addr1.address)).to.equal(700);
    });
    it("Should revert if top staker tries to delegate", async function () {
      await expect(
        dBasharToken.connect(addr1).delegate(addr1.address)
      ).to.be.revertedWith("Top staker cannot delegate");
    });
  });

  describe("Check dBashar ERC20 token", function () {
    beforeEach(async function () {
      await dBasharToken.connect(owner).add(100, basharToken.address, true);
      await basharToken.connect(owner).transfer(addr1.address, 1000);
      await basharToken.connect(addr1).approve(dBasharToken.address, 1000);
      await dBasharToken.connect(addr1).deposit(0, 1000);
      await basharToken.connect(owner).transfer(dBasharToken.address, 1000);
    });
    it("User should have should have dbashar token", async function () {
      expect(await dBasharToken.balanceOf(addr1.address)).to.equal(1000);
    });

    it("User should have should have total token supply", async function () {
      const balance = await dBasharToken.balanceOf(addr1.address);
      expect(await dBasharToken.totalSupply()).to.equal(balance);
    });

    it("User should have should have dbashar token after ", async function () {
      await basharToken.connect(owner).transfer(addr2.address, 1000);
      await basharToken.connect(addr2).approve(dBasharToken.address, 1000);
      await dBasharToken.connect(addr2).deposit(0, 1000);
      expect(await dBasharToken.balanceOf(addr2.address)).to.equal(1000);
    });
    it("dBASHAR token should be burned on withdraw", async function () {
      await dBasharToken.connect(addr1).withdraw(0, 100);
      expect(await dBasharToken.balanceOf(addr1.address)).to.equal(900);
      expect(await dBasharToken.totalSupply()).to.equal(900);

      await dBasharToken.connect(addr1).withdraw(0, 900);
      expect(await dBasharToken.balanceOf(addr1.address)).to.equal(0);
      expect(await dBasharToken.totalSupply()).to.equal(0);
    });
    it("Token should be non transferable", async function () {
      await expect(
        dBasharToken.connect(addr1).transfer(addr2.address, 900)
      ).to.be.revertedWith("Non transferable token");
      await expect(
        dBasharToken.connect(addr1).transfer(dBasharToken.address, 900)
      ).to.be.revertedWith("Non transferable token");
      await expect(
        dBasharToken
          .connect(addr1)
          .transfer("0x0000000000000000000000000000000000000000", 900)
      ).to.be.revertedWith("ERC20: transfer to the zero address");
    });
  });
  describe("Check top stakers", function () {
    beforeEach(async function () {
      await dBasharToken.connect(owner).add(100, basharToken.address, true);
      await basharToken.connect(owner).transfer(addr1.address, 1000);
      await basharToken.connect(addr1).approve(dBasharToken.address, 1000);
      await dBasharToken.connect(addr1).deposit(0, 1000);
    });
    it("First User should have should be highest staker", async function () {
      expect(await dBasharToken.checkHighestStaker(0, addr1.address)).to.equal(
        true
      );
    });

    it("All user under the limit should be top staker", async function () {
      await basharToken.connect(owner).transfer(addr2.address, 2000);
      await basharToken.connect(addr2).approve(dBasharToken.address, 2000);
      await dBasharToken.connect(addr2).deposit(0, 2000);

      expect(await dBasharToken.checkHighestStaker(0, addr2.address)).to.equal(
        true
      );
    });

    it("User with more amount should remove the user with less staked amount", async function () {
      await basharToken.connect(owner).transfer(addr2.address, 2000);
      await basharToken.connect(addr2).approve(dBasharToken.address, 2000);
      await dBasharToken.connect(addr2).deposit(0, 2000);

      await basharToken.connect(owner).transfer(addrs[0].address, 2000);
      await basharToken.connect(addrs[0]).approve(dBasharToken.address, 2000);
      await dBasharToken.connect(addrs[0]).deposit(0, 2000);

      expect(await dBasharToken.checkHighestStaker(0, addr1.address)).to.equal(
        false
      );
      expect(await dBasharToken.checkHighestStaker(0, addr2.address)).to.equal(
        true
      );
      expect(await dBasharToken.checkHighestStaker(0, addrs[0].address)).to.equal(
        true
      );
    });

    it("User shoul be removed from top staker list on withdrawal", async function () {
      await basharToken.connect(owner).transfer(addr2.address, 2000);
      await basharToken.connect(addr2).approve(dBasharToken.address, 2000);
      await dBasharToken.connect(addr2).deposit(0, 2000);

      await basharToken.connect(owner).transfer(addrs[0].address, 2000);
      await basharToken.connect(addrs[0]).approve(dBasharToken.address, 2000);
      await dBasharToken.connect(addrs[0]).deposit(0, 2000);

      await dBasharToken.connect(addr2).withdraw(0, 2000);

      expect(await dBasharToken.checkHighestStaker(0, addr1.address)).to.equal(
        false
      );
      expect(await dBasharToken.checkHighestStaker(0, addr2.address)).to.equal(
        false
      );
      expect(await dBasharToken.checkHighestStaker(0, addrs[0].address)).to.equal(
        true
      );
    });
  });
  describe("Check Bashar distribution with one user", function () {
    beforeEach(async function () {
      await dBasharToken.connect(owner).add(100, basharToken.address, true);
      await basharToken.connect(owner).transfer(addr1.address, 1000);
      await basharToken.connect(addr1).approve(dBasharToken.address, 1000);
      await dBasharToken.connect(addr1).deposit(0, 1000);
      await basharToken.connect(owner).transfer(dBasharToken.address, 1000);
    });
    it("User pending should be correct", async function () {
      expect(await dBasharToken.pendingBASHAR(0, addr1.address)).to.equal(1000);
    });
    it("User can claim token", async function () {
      const beforeClaimBalance = await basharToken.balanceOf(addr1.address);
      expect(beforeClaimBalance).to.equal(0);
      await time.advanceBlock();
      await dBasharToken.connect(addr1).claimBASHAR(0);
      const afterClaimBalance = await basharToken.balanceOf(addr1.address);
      expect(afterClaimBalance).to.equal(1000);
    });

    it("Second cannot claim for deposit/stake after reward send to contract", async function () {
      await basharToken.connect(owner).transfer(addr2.address, 1000);
      await basharToken.connect(addr2).approve(dBasharToken.address, 1000);
      await dBasharToken.connect(addr2).deposit(0, 1000);
      await time.advanceBlock();
      expect(await dBasharToken.pendingBASHAR(0, addr2.address)).to.equal(0);
      const beforeClaimBalance = await basharToken.balanceOf(addr2.address);
      expect(beforeClaimBalance).to.equal(0);
      await dBasharToken.connect(addr2).claimBASHAR(0);
      const afterClaimBalance = await basharToken.balanceOf(addr2.address);
      expect(afterClaimBalance).to.equal(0);
    });

    it("User rewards will be claimed during deposit", async function () {
      await basharToken.connect(owner).transfer(addr1.address, 10);
      await basharToken.connect(addr1).approve(dBasharToken.address, 10);
      await time.advanceBlock();
      expect(await dBasharToken.pendingBASHAR(0, addr1.address)).to.equal(1000);
      const beforeClaimBalance = await basharToken.balanceOf(addr1.address);
      expect(beforeClaimBalance).to.equal(10);
      await dBasharToken.connect(addr1).deposit(0, 10);
      const afterClaimBalance = await basharToken.balanceOf(addr1.address);
      expect(afterClaimBalance).to.equal(1000);
    });
  });

  describe("Check Bashar distribution with multiple address user", function () {
    beforeEach(async function () {
      await dBasharToken.connect(owner).add(100, basharToken.address, true);
      await basharToken.connect(owner).transfer(addr1.address, 1000);
      await basharToken.connect(addr1).approve(dBasharToken.address, 1000);
      await dBasharToken.connect(addr1).deposit(0, 1000);
      await basharToken.connect(owner).transfer(addr2.address, 1000);
      await basharToken.connect(addr2).approve(dBasharToken.address, 1000);
      await dBasharToken.connect(addr2).deposit(0, 1000);
      await basharToken.connect(owner).transfer(dBasharToken.address, 1000);
    });
    it("User first pending should be correct", async function () {
      expect(await dBasharToken.pendingBASHAR(0, addr1.address)).to.equal(500);
    });
    it("User second pending should be correct", async function () {
      expect(await dBasharToken.pendingBASHAR(0, addr2.address)).to.equal(500);
    });
    it("User first should claim half Reward", async function () {
      const beforeClaimBalance = await basharToken.balanceOf(addr1.address);
      expect(beforeClaimBalance).to.equal(0);
      await time.advanceBlock();
      await dBasharToken.connect(addr1).claimBASHAR(0);
      const afterClaimBalance = await basharToken.balanceOf(addr1.address);
      expect(afterClaimBalance).to.equal(500);
    });
    it("User second should claim half Reward", async function () {
      const beforeClaimBalance = await basharToken.balanceOf(addr2.address);
      expect(beforeClaimBalance).to.equal(0);
      await time.advanceBlock();
      await dBasharToken.connect(addr2).claimBASHAR(0);
      const afterClaimBalance = await basharToken.balanceOf(addr2.address);
      expect(afterClaimBalance).to.equal(500);
    });

    it("Second cannot claim extra rewards for deposit/stake after reward send to contract", async function () {
      await basharToken.connect(owner).transfer(addr2.address, 1000);
      await basharToken.connect(addr2).approve(dBasharToken.address, 1000);
      await dBasharToken.connect(addr2).deposit(0, 1000);
      await time.advanceBlock();
      expect(await dBasharToken.pendingBASHAR(0, addr2.address)).to.equal(0);
      const beforeClaimBalance = await basharToken.balanceOf(addr1.address);
      expect(beforeClaimBalance).to.equal(0);
      await dBasharToken.connect(addr1).claimBASHAR(0);
      const afterClaimBalance = await basharToken.balanceOf(addr2.address);
      expect(afterClaimBalance).to.equal(500);
    });

    it("Second cannot claim after withdrawal", async function () {
      expect(await dBasharToken.pendingBASHAR(0, addr2.address)).to.equal(500);
      const beforeClaimBalance = await basharToken.balanceOf(addr2.address);
      expect(beforeClaimBalance).to.equal(0);
      await dBasharToken.connect(addr2).withdraw(0, 1000);
      const afterClaimBalance = await basharToken.balanceOf(addr2.address);
      expect(afterClaimBalance).to.equal(1500);
      expect(await dBasharToken.pendingBASHAR(0, addr2.address)).to.equal(0);
      expect(await dBasharToken.pendingBASHAR(0, addr1.address)).to.equal(500);
      await basharToken.connect(owner).transfer(dBasharToken.address, 1000);
      expect(await dBasharToken.pendingBASHAR(0, addr2.address)).to.equal(0);
      expect(await dBasharToken.pendingBASHAR(0, addr1.address)).to.equal(1500);
      await dBasharToken.connect(addr1).claimBASHAR(0);
      expect(await basharToken.balanceOf(addr1.address)).to.equal(1500);
      await dBasharToken.connect(addr2).claimBASHAR(0);
      expect(await basharToken.balanceOf(addr2.address)).to.equal(1500);
    });

    it("Third user can only claim rewards after deposit", async function () {
      await basharToken.connect(owner).transfer(addrs[0].address, 2000);
      await basharToken.connect(addrs[0]).approve(dBasharToken.address, 2000);
      await time.advanceBlock();
      // Third user reward will always 0 before
      expect(await dBasharToken.pendingBASHAR(0, addrs[0].address)).to.equal(0);

      await dBasharToken.connect(addrs[0]).deposit(0, 2000);
      expect(await dBasharToken.pendingBASHAR(0, addrs[0].address)).to.equal(0);
      await basharToken.connect(owner).transfer(dBasharToken.address, 2000);
      expect(await dBasharToken.pendingBASHAR(0, addr1.address)).to.equal(1000);
      expect(await dBasharToken.pendingBASHAR(0, addr2.address)).to.equal(1000);
      expect(await dBasharToken.pendingBASHAR(0, addrs[0].address)).to.equal(1000);

      const beforeClaimBalance = await basharToken.balanceOf(addrs[0].address);
      expect(beforeClaimBalance).to.equal(0);
      await dBasharToken.connect(addrs[0]).claimBASHAR(0);
      const afterClaimBalance = await basharToken.balanceOf(addrs[0].address);
      expect(afterClaimBalance).to.equal(1000);

      await dBasharToken.connect(addrs[0]).withdraw(0, 1000);
      await basharToken.connect(owner).transfer(dBasharToken.address, 3000);
      expect(await dBasharToken.pendingBASHAR(0, addr1.address)).to.equal(2000);
      expect(await dBasharToken.pendingBASHAR(0, addr2.address)).to.equal(2000);
      expect(await dBasharToken.pendingBASHAR(0, addrs[0].address)).to.equal(1000);
    });
  });
});
