const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer address", deployer.address);

  const basharTokenAddress = "0xC2Aa634a4110EA04cDcFa5efAeA5BdbC5Ce878b1"; // Replace with the Bashar token address

  const dBasharContract = await ethers.getContractFactory("dBashar");

  const dBasharToken = await upgrades.deployProxy(dBasharContract, [
    basharTokenAddress, // Replace with the Bashar token address
    deployer.address, // Replace with the address that should receive the initial supply of dBashar tokens
    100, // Replace with the initial fee percentage (in basis points)
    50, // Replace with the fee percentage decay (in basis points)
  ]);

  await dBasharToken.deployed();

  console.log("dBashar Token ", dBasharToken.address);
}

main();
