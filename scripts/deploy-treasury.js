const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer address", deployer.address);

  const basharTokenAddress = "0xC2Aa634a4110EA04cDcFa5efAeA5BdbC5Ce878b1"; // Replace with the Bashar token address
  const RouterAddress = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45"; // Replace with the Router address

  const treasuryContract = await ethers.getContractFactory("Treasury");

  const treasury = await upgrades.deployProxy(treasuryContract, [
    basharTokenAddress, // Replace with the Bashar token address
    RouterAddress, // Replace with the Router address
  ]);

  await treasury.deployed();
  console.log("Treasury Token ", treasury.address);
}

main();
