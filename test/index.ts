import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { soliditySHA3 } from "ethereumjs-abi";
import {
  bufferToHex,
  hashPersonalMessage,
  ecsign,
  toBuffer,
} from "ethereumjs-util";

const { Wallet } = ethers;

// These are default from harhat signers, so no worries
const relayer = new Wallet(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
);
const seller = new Wallet(
  "0xd49743deccbccc5dc7baa8e69e5be03298da8688a15dd202e20f15d5e0e9a9fb"
);
const buyer = new Wallet(
  "0x23c601ae397441f3ef6f1075dcb0031ff17fb079837beadaf3c84d96c6f3e569"
);

describe("OnChainEscrow contract", function () {
  let OnChainEscrow;
  let escrowContract;
  let owner;
  let testToken;

  const value = "10000000000000000"; // 0.01 CELO
  const fee = 100;
  const tradeID = "0x8a221ffd05e94a16b4590b508d085ef7";
  const MAX_UINT128 = "0xffffffffffffffffffffffffffffffff";
  let tradeHashHex = "";

  beforeEach(async function () {
    OnChainEscrow = await ethers.getContractFactory("OnChainEscrow");
    [owner] = await ethers.getSigners();

    escrowContract = await OnChainEscrow.deploy(owner.address);

    const TestToken = await ethers.getContractFactory("TestToken");
    testToken = await TestToken.deploy(owner.address);
    await testToken.deployed();

    await testToken.mint(owner.address, "1000000000000000000");
  });

  async function initEscrow() {
    await testToken.approve(escrowContract.address, value);

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

    await escrowContract.createEscrow(
      tradeHashHex,
      testToken.address,
      value,
      _v,
      _r,
      _s
    );

    const result = await escrowContract.escrows(tradeHashHex);
    expect(result.exists).to.equal(true);

    const escrowContractBalance = await testToken.balanceOf(
      escrowContract.address
    );
    expect(escrowContractBalance).to.equal(value);
  }

  describe("Contract basics", function () {
    it("Should assert the owner address", async function () {
      expect(await escrowContract.owner()).to.equal(owner.address);
    });
  });

  describe("Test createEscrow", function () {
    it("Should fund escrow successfully", async function () {
      await testToken.approve(escrowContract.address, value);

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

      await escrowContract.createEscrow(
        tradeHashHex,
        testToken.address,
        value,
        _v,
        _r,
        _s
      );

      const result = await escrowContract.escrows(tradeHashHex);
      expect(result.exists).to.equal(true);

      const escrowContractBalance = await testToken.balanceOf(
        escrowContract.address
      );
      expect(escrowContractBalance).to.equal(value);
    });

    it("Should throw error if value is too small", async function () {
      await testToken.approve(escrowContract.address, value);

      // Calculate VRS of invitation to escrow by relayer
      const tradeHashBytes = soliditySHA3(
        ["bytes16", "address", "address", "uint256", "uint16"],
        [tradeID, seller.address, buyer.address, "0", fee]
      );
      tradeHashHex = bufferToHex(tradeHashBytes);

      const instructionHashBytes = soliditySHA3(["bytes32"], [tradeHashHex]);
      const prefixedHash = hashPersonalMessage(instructionHashBytes);
      const signed = ecsign(prefixedHash, toBuffer(relayer.privateKey));
      const _r = bufferToHex(signed.r);
      const _s = bufferToHex(signed.s);
      const _v = signed.v;

      await expect(
        escrowContract.createEscrow(
          tradeHashHex,
          testToken.address,
          "0",
          _v,
          _r,
          _s
        )
      ).to.be.revertedWith("Escrow value too small");
    });

    it("Should throw error if signature does not match", async function () {
      await testToken.approve(escrowContract.address, value);

      // Calculate VRS of invitation to escrow by relayer
      const tradeHashBytes = soliditySHA3(
        ["bytes16", "address", "address", "uint256", "uint16"],
        [tradeID, seller.address, buyer.address, value, fee]
      );
      tradeHashHex = bufferToHex(tradeHashBytes);

      const instructionHashBytes = soliditySHA3(["bytes32"], [tradeHashHex]);
      const prefixedHash = hashPersonalMessage(instructionHashBytes);
      const signed = ecsign(prefixedHash, toBuffer(seller.privateKey));
      const _r = bufferToHex(signed.r);
      const _s = bufferToHex(signed.s);
      const _v = signed.v;

      await expect(
        escrowContract.createEscrow(
          tradeHashHex,
          testToken.address,
          value,
          _v,
          _r,
          _s
        )
      ).to.be.revertedWith("Signature not from relayer");
    });

    it("Should throw error if trade already exists", async function () {
      await testToken.approve(escrowContract.address, value);

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

      await escrowContract.createEscrow(
        tradeHashHex,
        testToken.address,
        value,
        _v,
        _r,
        _s
      );

      const result = await escrowContract.escrows(tradeHashHex);
      expect(result.exists).to.equal(true);

      await expect(
        escrowContract.createEscrow(
          tradeHashHex,
          testToken.address,
          value,
          _v,
          _r,
          _s
        )
      ).to.be.revertedWith("Trade already exists");
    });
  });

  describe("Test relay", function () {
    it("Should fund and release escrow successfully", async function () {
      await initEscrow();

      const relayedSenderParams = soliditySHA3(
        ["bytes16", "uint8", "uint128"],
        [tradeID, 0x01, MAX_UINT128]
      );
      const prefixedHash2 = hashPersonalMessage(relayedSenderParams);
      const signed2 = ecsign(prefixedHash2, toBuffer(seller.privateKey));
      const _r2 = bufferToHex(signed2.r);
      const _s2 = bufferToHex(signed2.s);
      const _v2 = signed2.v;

      await escrowContract.relay(
        tradeID,
        seller.address,
        buyer.address,
        value,
        fee,
        MAX_UINT128,
        _v2,
        _r2,
        _s2,
        0x01
      );
      const _totalFees = BigNumber.from(value).mul(fee).div(10000);
      const buyerBalance = await testToken.balanceOf(buyer.address);
      expect(buyerBalance).to.equal(BigNumber.from(value).sub(_totalFees));
    });

    it("Should fund and release back to seller when buyer cancels", async function () {
      await initEscrow();

      const relayedSenderParams = soliditySHA3(
        ["bytes16", "uint8", "uint128"],
        [tradeID, 0x02, MAX_UINT128]
      );
      const prefixedHash = hashPersonalMessage(relayedSenderParams);
      const signed = ecsign(prefixedHash, toBuffer(buyer.privateKey));
      const _r = bufferToHex(signed.r);
      const _s = bufferToHex(signed.s);
      const _v = signed.v;

      // We expect the buyer wallet to remain the same and the seller to
      // get the trade value back when cancelling
      const buyerBalance = await testToken.balanceOf(buyer.address);
      let expectedSellerBalance = await testToken.balanceOf(seller.address);
      expectedSellerBalance = expectedSellerBalance.add(value);

      await escrowContract.relay(
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

      const newBuyerBalance = await testToken.balanceOf(buyer.address);
      expect(newBuyerBalance).to.equal(buyerBalance);

      const newSellerBalance = await testToken.balanceOf(seller.address);
      expect(newSellerBalance).to.equal(expectedSellerBalance);
    });

    it("Should fund and release to buyer on winning dispute", async function () {
      await initEscrow();

      const _buyerPercent = 100;
      const relayedSenderParams = soliditySHA3(
        ["bytes16", "uint8"],
        [tradeID, 0x03]
      );
      const prefixedHash = hashPersonalMessage(relayedSenderParams);
      const signed = ecsign(prefixedHash, toBuffer(buyer.privateKey));
      const _r = bufferToHex(signed.r);
      const _s = bufferToHex(signed.s);
      const _v = signed.v;

      const buyerBalance = await testToken.balanceOf(buyer.address);

      await escrowContract.resolveDispute(
        tradeID,
        seller.address,
        buyer.address,
        value,
        fee,
        _v,
        _r,
        _s,
        _buyerPercent
      );

      const _totalFees = BigNumber.from(value).mul(fee).div(10000);
      const newBuyerBalance = await testToken.balanceOf(buyer.address);
      expect(newBuyerBalance).to.equal(
        BigNumber.from(buyerBalance).add(value).sub(_totalFees)
      );
    });

    it("Should fund and release to seller on winning dispute", async function () {
      await initEscrow();

      const _buyerPercent = 0;
      const relayedSenderParams = soliditySHA3(
        ["bytes16", "uint8"],
        [tradeID, 0x03]
      );
      const prefixedHash = hashPersonalMessage(relayedSenderParams);
      const signed = ecsign(prefixedHash, toBuffer(buyer.privateKey));
      const _r = bufferToHex(signed.r);
      const _s = bufferToHex(signed.s);
      const _v = signed.v;

      const sellerBalance = await testToken.balanceOf(seller.address);

      await escrowContract.resolveDispute(
        tradeID,
        seller.address,
        buyer.address,
        value,
        fee,
        _v,
        _r,
        _s,
        _buyerPercent
      );

      const newSellerBalance = await testToken.balanceOf(seller.address);
      expect(newSellerBalance).to.equal(
        BigNumber.from(sellerBalance).add(value)
      );
    });
  });
});
