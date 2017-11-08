'use strict';

// Seems to be needed for graphql-language-service-server
import 'regenerator-runtime/runtime';

import {
  IPCMessageReader,
  IPCMessageWriter,
  createConnection,
  IConnection,
  DidOpenTextDocumentNotification,
  PublishDiagnosticsNotification,
  DidSaveTextDocumentNotification,
  DidChangeTextDocumentNotification,
  DidCloseTextDocumentNotification,
  ShutdownRequest,
  ExitNotification,
  InitializeRequest,
  CompletionRequest,
  CompletionResolveRequest,
  DefinitionRequest
} from 'vscode-languageserver';

// Using require instead of import to avoid missing type definition error
const { MessageProcessor } = require('graphql-language-service-server/dist/MessageProcessor');

let connection: IConnection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));

addHandlers(connection);

connection.onDidChangeWatchedFiles(_change => {
  connection.console.log('We received an file change event');
});

// Listen on the connection
connection.listen();

// Copied from graphql-language-service-server/dist/startServer
function addHandlers(connection: IConnection): void {
  const messageProcessor = new MessageProcessor(connection.console);
  connection.onNotification(DidOpenTextDocumentNotification.type, async params => {
    const diagnostics = await messageProcessor.handleDidOpenOrSaveNotification(params);
    if (diagnostics) {
      connection.sendNotification(PublishDiagnosticsNotification.type, diagnostics);
    }
  });
  connection.onNotification(DidSaveTextDocumentNotification.type, async params => {
    const diagnostics = await messageProcessor.handleDidOpenOrSaveNotification(params);
    if (diagnostics) {
      connection.sendNotification(PublishDiagnosticsNotification.type, diagnostics);
    }
  });
  connection.onNotification(DidChangeTextDocumentNotification.type, async params => {
    const diagnostics = await messageProcessor.handleDidChangeNotification(params);
    if (diagnostics) {
      connection.sendNotification(PublishDiagnosticsNotification.type, diagnostics);
    }
  });

  connection.onNotification(DidCloseTextDocumentNotification.type, params =>
    messageProcessor.handleDidCloseNotification(params)
  );
  connection.onRequest(ShutdownRequest.type, () => messageProcessor.handleShutdownRequest());
  connection.onNotification(ExitNotification.type, () => messageProcessor.handleExitNotification());

  // Ignore cancel requests
  connection.onNotification('$/cancelRequest', () => ({}));

  connection.onRequest(InitializeRequest.type, (params, token) =>
    messageProcessor.handleInitializeRequest(params, token)
  );

  connection.onRequest(CompletionRequest.type, params => messageProcessor.handleCompletionRequest(params));
  connection.onRequest(CompletionResolveRequest.type, item => item);
  connection.onRequest(DefinitionRequest.type, params => messageProcessor.handleDefinitionRequest(params));
}
