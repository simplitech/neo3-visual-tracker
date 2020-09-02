import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

import ControllerRequest from "../../shared/messages/controllerRequest";
import ViewRequest from "../../shared/messages/viewRequest";
import ViewStateBase from "../../shared/viewState/viewStateBase";

const LOG_PREFIX = "[PanelControllerBase]";

export default abstract class PanelControllerBase<
  TViewState extends ViewStateBase,
  TViewRequest
> {
  protected viewState: TViewState;

  private readonly postMessage: (request: ControllerRequest) => void;

  private readonly setTitle: (newTitle: string) => void;

  constructor(initialViewState: TViewState, context: vscode.ExtensionContext) {
    this.viewState = { ...initialViewState };
    const panel = vscode.window.createWebviewPanel(
      `neo3-visual-tracker-${this.viewState.view}`,
      this.viewState.panelTitle,
      vscode.ViewColumn.Active,
      { enableScripts: true }
    );
    context.subscriptions.push(panel);
    panel.iconPath = vscode.Uri.file(
      path.join(context.extensionPath, "resources", "neo-logo.png")
    );
    panel.onDidDispose(this.onClose, this, context.subscriptions);
    panel.webview.onDidReceiveMessage(
      this.recieveRequest,
      this,
      context.subscriptions
    );
    this.postMessage = (message) => panel.webview.postMessage(message);
    this.setTitle = (newTitle) => (panel.title = newTitle);
    panel.webview.html = fs
      .readFileSync(
        path.join(context.extensionPath, "dist", "panel", "index.html")
      )
      .toString()
      .replace(
        "[BASE_HREF]",
        panel.webview
          .asWebviewUri(
            vscode.Uri.file(path.join(context.extensionPath, "dist", "panel"))
          )
          .toString() + "/"
      );
  }

  abstract onClose(): void;

  protected abstract onRequest(request: TViewRequest): void;

  protected updateViewState(updates: Partial<TViewState>) {
    if (updates.panelTitle !== undefined) {
      this.setTitle(updates.panelTitle);
    }
    this.viewState = { ...this.viewState, ...updates };
    this.sendRequest({ viewState: this.viewState });
  }

  private recieveRequest(request: ViewRequest) {
    console.log(LOG_PREFIX, "📬", request);
    if (request.retrieveViewState) {
      this.sendRequest({ viewState: this.viewState });
    }
    if (request.typedRequest) {
      this.onRequest(request.typedRequest);
    }
  }

  private sendRequest(request: ControllerRequest) {
    console.log(LOG_PREFIX, "📤", request);
    this.postMessage(request);
  }
}