import * as path from 'path';

import { workspace, ExtensionContext } from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient';

export function activate(context: ExtensionContext) {
  const serverModule = context.asAbsolutePath(path.join('server', 'server.js'));
  const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: ['graphql', 'javascript', 'typescript', 'javascriptreact', 'typescriptreact'],
    synchronize: {
      fileEvents: [
        workspace.createFileSystemWatcher('**/.graphqlconfig*'),
        workspace.createFileSystemWatcher('**/*.{graphql,js,ts,jsx,tsx}')
      ]
    }
  };

  const client = new LanguageClient('apollographql', 'Apollo GraphQL', serverOptions, clientOptions);
  client.registerProposedFeatures();
  context.subscriptions.push(client.start());
}
