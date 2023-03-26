const { expect } = require("chai");
const { upgrades } = require("hardhat");
const { time } = require("../utilities");

const { encodeParameters } = require("../utilities/Ethereum");

const zeroAddress = "0x0000000000000000000000000000000000000000";

const Types = {
  Delegation: [
    { name: "delegatee", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "expiry", type: "uint256" },
  ],
};

const BallotTypes = {
  Ballot: [
    { name: "proposalId", type: "uint256" },
    { name: "support", type: "uint8" },
  ],
};

const version = '1';
let chainId;
let domain;
let ballotDomain;

function generateVoteSignature(proposalId, support, signature) {
  const { r, s, v } = ethers.utils.splitSignature(signature);
  const object = {proposalId, support, v, r, s};
  return object;
}

function generateDelegateSignature(delegatee, nonce, expiry, signature) {
  const { r, s, v } = ethers.utils.splitSignature(signature);
  const object = {delegatee, nonce, expiry , v, r, s};
  return object;
}

describe("Batch contract", function () {
  let Token;
  let stakeToken;
  let basharToken;
  let dBasharToken;
  let GovernorBravoDelegate;
  let governance;
  let TimelockContract;
  let timelock;
  let batchContract;
  let batch;

  let delay;

  let owner;
  let addr1;
  let addr2;
  let addrs;

  beforeEach(async function () {
    // Get the ContractFactory and Signers here.
    Token = await ethers.getContractFactory("Bashar");
    stakeToken = await ethers.getContractFactory("Dbashar");
    GovernorBravoDelegate = await ethers.getContractFactory(
      "GovernorBravoDelegate"
    );
    TimelockContract = await ethers.getContractFactory("Timelock");
    batchContract = await ethers.getContractFactory("BatchVote");
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
    delay = 120;

    const startBlock = await time.latestBlock();

    basharToken = await upgrades.deployProxy(Token, [owner.address, 100000]);
    await basharToken.deployed();
    await basharToken.setTreasuryAddress(owner.address);
    await basharToken.setWhitelistAddress(addr1.address, true);
    await basharToken.setWhitelistAddress(addr2.address, true);
    await basharToken.setWhitelistAddress(addrs[0].address, true);
    await basharToken.setTax(0);
    await basharToken.transfer(addr1.address, 1000);
    await basharToken.transfer(addr2.address, 1000);
    await basharToken.transfer(addrs[0].address, 1000);
    await owner.sendTransaction({
      to: addr1.address,
      value: ethers.utils.parseEther("1"),
    });
    await owner.sendTransaction({
      to: addr2.address,
      value: ethers.utils.parseEther("1"),
    });
    await owner.sendTransaction({
      to: addrs[0].address,
      value: ethers.utils.parseEther("1"),
    });

    dBasharToken = await upgrades.deployProxy(stakeToken, [
      basharToken.address,
      owner.address,
      startBlock,
      1,
    ]);

    await dBasharToken.add(100, basharToken.address, true);
    await basharToken.connect(addr1).approve(dBasharToken.address, 1000);
    await basharToken.connect(addr2).approve(dBasharToken.address, 1000);
    await basharToken.connect(addrs[0]).approve(dBasharToken.address, 1000);
    await basharToken.connect(owner).approve(dBasharToken.address, 1000);
    await dBasharToken.connect(addr1).deposit(0, 1000);
    await dBasharToken.connect(addr2).deposit(0, 900);
    await dBasharToken.connect(addrs[0]).deposit(0, 800);
    await dBasharToken.connect(owner).deposit(0, 700);
    timelock = await upgrades.deployProxy(TimelockContract, [
      owner.address,
      delay,
    ]);
    await timelock.deployed();
    governance = await upgrades.deployProxy(GovernorBravoDelegate, [
      timelock.address,
      dBasharToken.address,
      17280,
      1,
      "60000000000000000000000",
      addr1.address,
    ]);
    await governance.deployed();
    await timelock.setPendingAdmin(governance.address);
    await governance._AcceptTimelockAdmin();
    batch = await upgrades.deployProxy(batchContract, [
      governance.address,
      dBasharToken.address,
    ]);
    await batch.deployed();

    chainId = addr1.provider._network.chainId;
    domain = {
      name: "dBASHAR",
      version,
      chainId,
      verifyingContract: dBasharToken.address,
    };
    ballotDomain = {
      name: "Bashar Governor Bravo",
      chainId,
      verifyingContract: governance.address,
    };

    const delegatee = addr2.address, nonce = 0, expiry = 10e9;
    const message = { delegatee, nonce, expiry };

    const signature = await addr2._signTypedData(domain, Types, message);

    const { r, s, v } = ethers.utils.splitSignature(signature);
    await dBasharToken.delegateBySig(delegatee, nonce, expiry, v, r, s);
  });

  describe("Check admin conditions", function () {
    beforeEach(async function () {
      batch.pause();
    });

    it("User should not be able to delegate if contract is paused", async function () {
      await expect(batch.delegateBySigs([])).to.be.revertedWith(
        "Pausable: paused"
      );
    });

    it("User should not be able to castVote if contract is paused", async function () {
      await expect(batch.castVoteBySigs([])).to.be.revertedWith(
        "Pausable: paused"
      );
    });

    it("Only owner can pause the contract", async function () {
      await expect(batch.connect(addr2).pause()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });

    it("Only owner can pause the contract", async function () {
      await expect(batch.connect(addr2).unpause()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });

    it("Only owner can update contract address the contract", async function () {
      await expect(
        batch.connect(addr2).updatedDbasharAddress(addr2.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
      await batch.updatedDbasharAddress(addr2.address);
      expect(await batch.dBashar()).to.be.equal(addr2.address);
    });

    it("Only owner can update governance contract address the contract", async function () {
      await expect(
        batch.connect(addr2).updatedGovernanceAddress(addr2.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
      await batch.updatedGovernanceAddress(addr2.address);
      expect(await batch.governance()).to.be.equal(addr2.address);
    });
  });

  describe("Delegate by signature", function () {

    it("Check votes for delegated user", async function () {
      const latestBlock = parseInt(await time.latestBlock());
      await time.advanceBlock();
      expect(
        await dBasharToken.getPastVotes(addr2.address, latestBlock)
      ).to.be.bignumber.equal(900);
    });

    it("Delegate by signature", async function () {
      const signatureObject = []

      const delegatee = addrs[0].address, nonce = 0, expiry = 10e9;
      const message = { delegatee, nonce, expiry };
      const signature = await addrs[0]._signTypedData(domain, Types, message);
      const object = generateDelegateSignature(delegatee, nonce, expiry , signature);
      signatureObject.push(object);

      await batch.delegateBySigs(signatureObject);
      await time.advanceBlock();
      const latestBlock = parseInt(await time.latestBlock());
      await time.advanceBlock();
      expect(
        await dBasharToken.getPastVotes(addrs[0].address, latestBlock)
      ).to.be.bignumber.equal(800);
    });

    it("Delegate signature multiple users", async function () {
      const signatureObject = []

      const delegatee = addrs[0].address, nonce = 0, expiry = 10e9;
      const message = { delegatee, nonce, expiry };
      let signature = await addrs[0]._signTypedData(domain, Types, message);
      let object = generateDelegateSignature(
        delegatee,
        nonce,
        expiry,
        signature
      );
      signatureObject.push(object);

      signature = await owner._signTypedData(domain, Types, message);
      object = generateDelegateSignature(delegatee, nonce, expiry, signature);
      signatureObject.push(object);

      await batch.delegateBySigs(signatureObject);
      await time.advanceBlock();
      const latestBlock = parseInt(await time.latestBlock());
      await time.advanceBlock();
      expect(
        await dBasharToken.getPastVotes(addrs[0].address, latestBlock)
      ).to.be.bignumber.equal(1500);
    });
  });

  describe("Caste Vote by signature", function () {
    beforeEach(async function () {
      const targets = [basharToken.address];
      const values = ["0"];
      const signatures = ["balanceOf(address)"];
      const callDatas = [encodeParameters(["address"], [owner.address])];
      await dBasharToken.connect(owner).delegate(owner.address);
      await dBasharToken.connect(addr2).delegate(addr2.address);
      await governance
        .connect(addr1)
        .propose(targets, values, signatures, callDatas, "do nothing");
      proposalBlock = await time.latestBlock();
      proposalId = await governance.latestProposalIds(addr1.address);
      trivialProposal = await governance.proposals(proposalId);
    });

    it("Vote for delegated user", async function () {
      await time.advanceBlock();
      await governance.connect(addr2).castVote(1, 1);
      const prop = await governance.proposals(1);
      expect(prop.forVotes).to.be.bignumber.equal(900);
    });

    it("Caste Vote by signature", async function () {
      const proposalId = 1;
      const support = 1;
      const message = { proposalId, support }

      const signature = await addr2._signTypedData(ballotDomain, BallotTypes, message);

      const { r, s, v } = ethers.utils.splitSignature(signature);
      await time.advanceBlock();
      await expect(governance.castVoteBySig(proposalId, support, v, r, s))
        .to.emit(governance, "VoteCast")
        .withArgs(addr2.address, 1, 1, 900, "");
      const prop = await governance.proposals(1);
      expect(prop.forVotes).to.be.bignumber.equal(900);
    });

    it("Caste Vote using muliple users signature", async function () {
      const proposalId = 1;
      let support = 1;
      let message = { proposalId, support };
      const batchSigntaures = [];

      signature = await owner._signTypedData(
        ballotDomain,
        BallotTypes,
        message
      );
      let obj = generateVoteSignature(proposalId, support, signature);
      batchSigntaures.push(obj);

      support = 0;
      message = { proposalId, support };
      signature = await addr2._signTypedData(
        ballotDomain,
        BallotTypes,
        message
      );
      obj = generateVoteSignature(proposalId, support, signature);
      batchSigntaures.push(obj);

      await time.advanceBlock();
      await batch.castVoteBySigs(batchSigntaures);
      const prop = await governance.proposals(1);
      expect(prop.forVotes).to.be.bignumber.equal(700);
      expect(prop.againstVotes).to.be.bignumber.equal(900);
    });

    it("Caste Vote by signature(Try to vote again)", async function () {
      const proposalId = 1;
      const support = 1;
      const message = { proposalId, support }

      const signature = await addr2._signTypedData(ballotDomain, BallotTypes, message);
      const { r, s, v } = ethers.utils.splitSignature(signature);
      await time.advanceBlock();
      await governance.castVoteBySig(proposalId, support, v, r, s);
      await expect(
        governance.castVoteBySig(proposalId, support, v, r, s)
      ).to.be.revertedWith(
        "GovernorBravo::castVoteInternal: voter already voted"
      );
    });
  });
});
