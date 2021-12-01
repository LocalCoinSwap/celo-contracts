/* eslint-disable node/no-unpublished-import */
// npx hardhat deploy --network ethereum --tags OnChainEscrow --write true

import { HardhatRuntimeEnvironment } from "hardhat/types";
import { BigNumber } from "ethers";

const func = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const contract = "OnChainEscrow";
  console.log("Deploying contract");

  // const ExecuteTrade = await deployments.get("ExecuteTrade")
  const { deployer } = await getNamedAccounts();
  console.log("Deployer address", deployer);

  const deployResult = await deploy(contract, {
    from: deployer,
    gasPrice: BigNumber.from("500000000"),
    args: [deployer],
    log: true,
  });

  if (deployResult.newlyDeployed) {
    console.log(
      `contract ${contract} deployed at ${deployResult.receipt?.contractAddress} using ${deployResult.receipt?.gasUsed} gas`
    );
  }
};

export default func;
func.tags = ["OnChainEscrow"];
