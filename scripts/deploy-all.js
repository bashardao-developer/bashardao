const { ethers, upgrades } = require("hardhat");
const { BN } = require("@openzeppelin/test-helpers");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer address", deployer.address);

  const RouterAddress = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
  const Token = await ethers.getContractFactory("Basher");
  const governanceToken = await ethers.getContractFactory(
    "GovernorBravoDelegate"
  );
  const treasuryContract = await ethers.getContractFactory("Treasury");
  const timeLockContract = await ethers.getContractFactory("Timelock");
  const dBasharContract = await ethers.getContractFactory("dBashar");

  const basharToken = await upgrades.deployProxy(Token, [
    deployer.address,
    "19630000000000000000000000000000",
  ]);
  await basharToken.deployed();
  console.log("Bashar Token ", basharToken.address);

  const dBasharToken = await upgrades.deployProxy(dBasharContract, [
    basharToken.address,
    deployer.address,
    100,
    50,
  ]);

  await dBasharToken.deployed();

  console.log("dBashar Token ", dBasharToken.address);

  const treasury = await upgrades.deployProxy(treasuryContract, [
    basharToken.address,
    RouterAddress,
  ]);
  await treasury.deployed();
  console.log("Treasury Token ", treasury.address);

  const timelock = await upgrades.deployProxy(timeLockContract, [
    deployer.address,
    7200,
  ]);
  await timelock.deployed();
  console.log("Timelock Token ", timelock.address);

  const governance = await upgrades.deployProxy(governanceToken, [
    timelock.address,
    dBasharToken.address,
    32500,
    1,
    "60000000000000000000000",
    treasury.address,
  ]);
  console.log("Governance Token ", governance.address);
}

main();
