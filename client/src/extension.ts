'use strict';

import * as path from 'path';

import { workspace, ExtensionContext } from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient';

export function activate(context: ExtensionContext) {
  let serverModule = context.asAbsolutePath(path.join('server', 'server.js'));
  let debugOptions = { execArgv: ['--nolazy', '--debug=6009'] };

  let serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
  };

  let clientOptions: LanguageClientOptions = {
    documentSelector: ['graphql'],
    synchronize: {
      configurationSection: 'apollographql',
      fileEvents: workspace.createFileSystemWatcher('**/.graphqlconfig')
    }
  };

  let disposable = new LanguageClient(
    'apollographql',
    'Apollo GraphQL',
    serverOptions,
    clientOptions
  ).start();

  context.subscriptions.push(disposable);
}
