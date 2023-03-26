const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer address", deployer.address);

  const timelockContract = await ethers.getContractFactory("Timelock");

  const timelock = await upgrades.deployProxy(timelockContract, [
    deployer.address, // Replace with the address that should be the admin of the timelock contract
    7200, // Replace with the delay in seconds (e.g. 7200 for 2 hours)
  ]);

  await timelock.deployed();
  console.log("Timelock Token ", timelock.address);
}

main();
