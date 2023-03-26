const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying GovernorBravoDelegate with the account:", deployer.address);

  const timeLockAddress = "0x573b412481be3200435769b51f1778b2097c1298"; // Replace with the address of the Timelock contract
  const dBasharAddress = "0x935192eaaf3f58469a443eda8a6e6e113435d73e"; // Replace with the address of the dBashar contract
  const votingPeriod = 604800; // Replace with the desired voting period in seconds (7 days by default)
  const votingDelay = 86400; // Replace with the desired voting delay in seconds (1 day by default)
  const proposalThreshold = ethers.utils.parseEther("1000"); // Replace with the desired proposal threshold (1000 Bashar by default)
  const treasuryAddress = "0x094aec835fb8fb79f12078740c90e9068bce98b2"; // Replace with the address of the Treasury contract

  const GovernorBravoDelegate = await ethers.getContractFactory("GovernorBravoDelegate");
  const governor = await upgrades.deployProxy(GovernorBravoDelegate, [
    timeLockAddress,
    dBasharAddress,
    votingPeriod,
    votingDelay,
    proposalThreshold,
    treasuryAddress,
  ]);

  await governor.deployed();
  console.log("GovernorBravoDelegate deployed to:", governor.address);
}

main();
