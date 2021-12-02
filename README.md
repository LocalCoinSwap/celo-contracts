# LocalCoinSwap non-custodial smart contracts for CELO, cUSD, and cEUR

## Pre-requisites

The dev environment is based on HardHat, along with other tools commonly used with Hardhat in the ecosystem.

## Local setup

Pull the repo and run

```
npm install
```

## Running tests

```
npx hardhat test
```

## Deployment

We use hardhat-deploy plugin to deploy easily. Ensure that `MNEMONiC` is set in `.env` file before deploying.

```
npx hardhat deploy --network celo --tags OnChainEscrow --write true
```

## Testing the deployed contract on forno mainnet

We have deployed the contract `OnChainEscrow` on Celo forno. Here’s the link to [Celo explorer](https://explorer.celo.org/address/0xE4789582d80935353d0aF9f46e07e61649c97339/transactions). You can see there are some test transactions already.

There are four scripts under the `scripts` directory, each showing an example of different situations for on-chain escrow contract.

 1. Successful trade between seller and buyer
 2. Buyer cancels after the seller has funded the escrow
 3. Dispute won by seller
 4. Dispute won by the buyer

### 1. Successful trade between seller and buyer

Before running the example script, please ensure the `.env` file has all four env variables populated correctly. Then fund the seller and relayer wallets with a small amount of CELO, say 1 CELO each. The trade value is 0.01 CELO. So anything more than that should do ideally.

If you deploy the contract again, please change the contract address in the script too. Current address is `0xE4789582d80935353d0aF9f46e07e61649c97339`.

```
npx hardhat run scripts/HappyCeloGoldTrade.ts
```

#### What happens in the script?

 - We get the deployed contract
 - Approve the contract address via seller to spend funds on seller’s behalf
 - Prepare the escrow transaction and broadcast
 - The contract stores all the current trades in memory, we cross-check that
 - Finally, we release the escrowed funds to the buyer and this time through the relayer

The rest of the three situations follow similar patterns, but of course different execution paths.

There’s one additional script to demonstrate a cUSD trade as well, `HappyCeloDollarTrade.ts`
