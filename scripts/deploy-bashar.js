const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer address", deployer.address);

  const Token = await ethers.getContractFactory("Bashar");

  const basharToken = await upgrades.deployProxy(Token, [deployer.address,"19630000000000000000000000000000",]);
  await basharToken.deployed();
  console.log("Bashar Token ", basharToken.address);
}

main();
