import ActiveConnection from "./activeConnection";
import AutoCompleteData from "../shared/autoCompleteData";
import ContractDetector from "./detectors/contractDetector";
import NeoExpress from "./neoExpress/neoExpress";
import NeoExpressIo from "./neoExpress/neoExpressIo";
import WalletDetector from "./detectors/walletDetector";

const LOG_PREFIX = "[AutoComplete]";
const REFRESH_INTERVAL_MS = 1000 * 5;

export default class AutoComplete {
  private disposed = false;
  private latestData: AutoCompleteData;

  get data() {
    return this.latestData;
  }

  constructor(
    private readonly neoExpress: NeoExpress,
    private readonly activeConnection: ActiveConnection,
    private readonly contractDetector: ContractDetector,
    private readonly walletDetector: WalletDetector
  ) {
    this.latestData = {
      contractManifests: {},
      contractHashes: {},
      contractPaths: {},
      wellKnownAddresses: {},
      addressNames: {},
    };
    this.refreshLoop();
  }

  dispose() {
    this.disposed = true;
  }

  private async refreshLoop() {
    if (this.disposed) {
      return;
    }
    try {
      await this.periodicUpdate();
      // console.debug(LOG_PREFIX, this.latestData);
    } finally {
      setTimeout(() => this.refreshLoop(), REFRESH_INTERVAL_MS);
    }
  }

  private async periodicUpdate() {
    const newData: AutoCompleteData = {
      contractManifests: { ...this.contractDetector.contracts },
      contractHashes: {},
      contractPaths: {},
      wellKnownAddresses: {},
      addressNames: {},
    };

    const wallets = [...this.walletDetector.wallets];
    for (const wallet of wallets) {
      for (const address of wallet.addresses) {
        newData.addressNames[address] = newData.addressNames[address] || [];
        newData.addressNames[address].push(wallet.path);
      }
    }

    for (const contractPath of Object.keys(newData.contractManifests)) {
      const manifest = newData.contractManifests[contractPath];
      const contractHash = manifest.abi?.hash;
      if (contractHash) {
        newData.contractHashes[contractPath] = contractHash;
        newData.contractPaths[contractHash] =
          newData.contractPaths[contractHash] || [];
        newData.contractPaths[contractHash].push(contractPath);
      }
    }

    const connection = this.activeConnection.connection;

    newData.wellKnownAddresses =
      connection?.blockchainIdentifier.getWalletAddresses() || {};

    for (const walletName of Object.keys(newData.wellKnownAddresses)) {
      const walletAddress = newData.wellKnownAddresses[walletName];
      newData.addressNames[walletAddress] =
        newData.addressNames[walletAddress] || [];
      newData.addressNames[walletAddress].push(walletName);
    }

    if (connection?.blockchainIdentifier?.blockchainType === "express") {
      try {
        const deployedContracts = await NeoExpressIo.contractList(
          this.neoExpress,
          connection.blockchainIdentifier
        );
        for (const deployedContract of deployedContracts) {
          newData.contractManifests[
            deployedContract.abi.hash
          ] = deployedContract;
        }
      } catch (e) {
        console.warn(
          LOG_PREFIX,
          "Could not list neo-express contracts",
          connection.blockchainIdentifier.configPath,
          e
        );
      }
    }

    this.latestData = newData;
  }
}