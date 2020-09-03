import * as neonCore from "@cityofzion/neon-core";
import * as vscode from "vscode";

import Block from "../../shared/neon/block";
import PanelControllerBase from "./panelControllerBase";
import TrackerViewRequest from "../../shared/messages/trackerViewRequest";
import TrackerViewState from "../../shared/viewState/trackerViewState";

const LOG_PREFIX = "[TrackerPanelController]";
const REFRESH_INTERVAL_MS = 1000 * 3; // check for new blocks every 3 seconds
const BLOCKS_PER_PAGE = 50;
const PAGINATION_DISTANCE = 15;
const BLOCK_CACHE_SIZE = 10240;

export default class TrackerPanelController extends PanelControllerBase<
  TrackerViewState,
  TrackerViewRequest
> {
  private readonly rpcClient: neonCore.rpc.RPCClient;

  private cachedBlocks: Block[];
  private closed: boolean;

  constructor(context: vscode.ExtensionContext, rpcUrl: string) {
    super(
      {
        view: "tracker",
        panelTitle: `Block Explorer: ${rpcUrl}`,
        blockHeight: 0,
        paginationDistance: PAGINATION_DISTANCE,
        blocks: [],
        selectedBlock: -1,
        startAtBlock: -1,
      },
      context
    );
    this.closed = false;
    this.cachedBlocks = [];
    this.rpcClient = new neonCore.rpc.RPCClient(rpcUrl);
    this.refreshLoop();
  }

  onClose() {
    this.closed = true;
  }

  protected async onRequest(request: TrackerViewRequest) {
    if (request.setStartAtBlock !== undefined) {
      await this.updateViewState({
        startAtBlock: request.setStartAtBlock,
        blocks: await this.getBlocks(
          request.setStartAtBlock,
          this.viewState.blockHeight
        ),
      });
    }
    if (request.selectBlock !== undefined) {
      const selectedBlock = request.selectBlock;
      const startAtBlock = Math.min(
        this.viewState.blockHeight - 1,
        request.selectBlock + 2
      );
      await this.updateViewState({
        selectedBlock,
        startAtBlock,
        blocks: await this.getBlocks(startAtBlock, this.viewState.blockHeight),
      });
    }
  }

  private async getBlock(blockNumber: number): Promise<Block> {
    const cachedBlock = this.cachedBlocks.find((_) => _.index === blockNumber);
    if (cachedBlock) {
      return cachedBlock;
    }
    console.log(LOG_PREFIX, "Retrieving block", blockNumber);
    const block = (await this.rpcClient.getBlock(blockNumber)) as Block;
    if (blockNumber < this.viewState.blockHeight) {
      // never cache head block
      if (this.cachedBlocks.length === BLOCK_CACHE_SIZE) {
        this.cachedBlocks.shift();
      }
      this.cachedBlocks.push(block);
    }
    return block;
  }

  private async getBlocks(startAtBlock: number, blockHeight: number) {
    let newBlocks: Promise<Block>[] = [];
    startAtBlock =
      startAtBlock < 0 || startAtBlock >= blockHeight
        ? blockHeight - 1
        : startAtBlock;
    for (let i = 0; i < BLOCKS_PER_PAGE; i++) {
      const blockNumber = startAtBlock - i;
      if (blockNumber >= 0) {
        newBlocks.push(this.getBlock(blockNumber));
      }
    }
    return Promise.all(newBlocks);
  }

  private async onNewBlockAvailable(blockHeight: number) {
    if (this.viewState.startAtBlock >= 0) {
      await this.updateViewState({ blockHeight });
    } else {
      await this.updateViewState({
        blockHeight,
        blocks: await this.getBlocks(-1, blockHeight),
      });
    }
  }

  private async refreshLoop() {
    if (this.closed) {
      return;
    }
    try {
      const blockHeight = await this.rpcClient.getBlockCount();
      if (blockHeight > this.viewState.blockHeight) {
        console.log(LOG_PREFIX, "New block available", blockHeight);
        await this.onNewBlockAvailable(blockHeight);
      }
    } finally {
      setTimeout(() => this.refreshLoop(), REFRESH_INTERVAL_MS);
    }
  }
}
