import { soliditySHA3 } from "ethereumjs-abi";
import {
  bufferToHex,
  hashPersonalMessage,
  ecsign,
  toBuffer,
} from "ethereumjs-util";
import { ethers } from "hardhat";

const Web3 = require("web3");
const ContractKit = require("@celo/contractkit");
const DeployedContract = require("../deployments/celo/OnChainEscrow.json");

const web3 = new Web3("https://forno.celo.org");
const kit = ContractKit.newKitFromWeb3(web3);

const { Wallet } = ethers;

const tradeID = "0x8a221ffd05e94a16b4590b508d085ef7";
const seller = new Wallet(process.env.DEMO_SELLER_HEX);
const buyer = new Wallet(process.env.DEMO_BUYER_HEX);
const relayer = new Wallet(process.env.DEMO_RELAYER_HEX);

const CONTRACT_ADDRESS = "0xE4789582d80935353d0aF9f46e07e61649c97339";

const value = "10000000000000000"; // 0.01 CELO
const fee = 100;
const MAX_UINT128 = "0xffffffffffffffffffffffffffffffff";
let tradeHashHex = "";

const printBalances = async () => {
  const goldtoken = await kit.contracts.getGoldToken();
  const relayerBalance = await goldtoken.balanceOf(relayer.address);
  const sellerBalance = await goldtoken.balanceOf(seller.address);
  const buyerBalance = await goldtoken.balanceOf(buyer.address);
  const contractBalance = await goldtoken.balanceOf(CONTRACT_ADDRESS);

  console.log(`RELAYER: ${relayer.address} CELO: ${relayerBalance.toString()}`);
  console.log(`SELLER:  ${seller.address} CELO: ${sellerBalance.toString()}`);
  console.log(`BUYER:   ${buyer.address} CELO: ${buyerBalance.toString()}`);
  console.log(
    `CONTRACT:${CONTRACT_ADDRESS} CELO: ${contractBalance.toString()}`
  );
};

const fundEscrow = async () => {
  const instance = new kit.web3.eth.Contract(
    DeployedContract.abi,
    CONTRACT_ADDRESS
  );
  console.log("Initializing escrow");

  // Calculate VRS of invitation to escrow by relayer
  const tradeHashBytes = soliditySHA3(
    ["bytes16", "address", "address", "uint256", "uint16"],
    [tradeID, seller.address, buyer.address, value, fee]
  );
  tradeHashHex = bufferToHex(tradeHashBytes);

  const instructionHashBytes = soliditySHA3(["bytes32"], [tradeHashHex]);
  const prefixedHash = hashPersonalMessage(instructionHashBytes);
  const signed = ecsign(prefixedHash, toBuffer(relayer.privateKey));
  const _r = bufferToHex(signed.r);
  const _s = bufferToHex(signed.s);
  const _v = signed.v;

  // Open escrow
  console.log({ tradeHashHex });
  console.log({ value });
  console.log({ _v });
  console.log({ _r });
  console.log({ _s });

  const goldtoken = await kit.contracts.getGoldToken();
  console.log("Add seller to kit");
  kit.connection.addAccount(seller.privateKey);

  console.log("CELO token address", goldtoken.address);

  const approveTx = await goldtoken.approve(CONTRACT_ADDRESS, value).send({
    from: seller.address,
  });
  const approveReceipt = await approveTx.waitReceipt();
  console.log(approveReceipt);

  const allow = await goldtoken.allowance(seller.address, CONTRACT_ADDRESS);
  console.log(`TRADING:   ${value}`);
  console.log(`ALLOWANCE: ${allow.toString()}`);

  console.log("Building txn");
  const txObject = await instance.methods.createEscrow(
    tradeHashHex,
    goldtoken.address,
    value,
    _v,
    _r,
    _s
  );
  console.log("Sending txn");
  const tx = await kit.sendTransactionObject(txObject, {
    from: seller.address,
  });

  const receipt = await tx.waitReceipt();
  console.log(receipt);
};

const checkEscrow = async () => {
  const instance = new kit.web3.eth.Contract(
    DeployedContract.abi,
    CONTRACT_ADDRESS
  );
  const result = await instance.methods.escrows(tradeHashHex).call();

  console.log(result);
};

const releaseToSeller = async () => {
  const instance = new kit.web3.eth.Contract(
    DeployedContract.abi,
    CONTRACT_ADDRESS
  );

  const relayedSenderParams = soliditySHA3(
    ["bytes16", "uint8", "uint128"],
    [tradeID, 0x02, MAX_UINT128]
  );
  const prefixedHash = hashPersonalMessage(relayedSenderParams);
  const signed = ecsign(prefixedHash, toBuffer(buyer.privateKey));
  const _r = bufferToHex(signed.r);
  const _s = bufferToHex(signed.s);
  const _v = signed.v;

  console.log("Add relayer to kit");
  kit.connection.addAccount(buyer.privateKey);

  console.log("Building release txn");
  const txObject = await instance.methods.relay(
    tradeID,
    seller.address,
    buyer.address,
    value,
    fee,
    MAX_UINT128,
    _v,
    _r,
    _s,
    0x02
  );
  console.log("Sending release txn");
  const tx = await kit.sendTransactionObject(txObject, {
    from: buyer.address,
  });

  const receipt = await tx.waitReceipt();
  console.log(receipt);
};

const celoGoldBuyerCancels = async () => {
  await printBalances();
  await fundEscrow();
  await printBalances();
  await checkEscrow();
  await releaseToSeller();
  await printBalances();
};

celoGoldBuyerCancels().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

export default celoGoldBuyerCancels;
