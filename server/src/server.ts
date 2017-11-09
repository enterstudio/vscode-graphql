'use strict';

// Seems to be needed for graphql-language-service-server
import 'regenerator-runtime/runtime';

import {
  IPCMessageReader,
  IPCMessageWriter,
  createConnection,
  IConnection,
} from 'vscode-languageserver';

// Using require instead of import to avoid missing type definition error
const { MessageProcessor } = require('graphql-language-service-server/dist/MessageProcessor');

let connection: IConnection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));

const messageProcessor = new MessageProcessor(connection.console);

connection.onInitialize(async (params) => {
  return messageProcessor.handleInitializeRequest(params);
});

connection.onShutdown(() => {
  messageProcessor.handleShutdownRequest();
});

connection.onExit(() => {
  messageProcessor.handleExitNotification();
});

connection.onDidOpenTextDocument(async (params) => {
  connection.console.log(`${params.textDocument.uri} opened.`);
  
  const diagnostics = await messageProcessor.handleDidOpenOrSaveNotification(params);
  if (diagnostics) {
    connection.sendDiagnostics(diagnostics);
  }
});

connection.onDidChangeTextDocument(async (params) => {
  connection.console.log(`${params.textDocument.uri} changed: ${JSON.stringify(params.contentChanges)}`);

  const diagnostics = await messageProcessor.handleDidChangeNotification(params);
  if (diagnostics) {
    connection.sendDiagnostics(diagnostics);
  }
});

connection.onDidCloseTextDocument(async (params) => {
  connection.console.log(`${params.textDocument.uri} closed.`);
  
  const diagnostics = await messageProcessor.handleDidCloseNotification(params);
  if (diagnostics) {
    connection.sendDiagnostics(diagnostics);
  }
});

connection.onDidChangeWatchedFiles(_change => {
  connection.console.log('We received an file change event');
});

connection.onCompletion(async (params) => {
  return messageProcessor.handleCompletionRequest(params);
});

connection.onCompletionResolve(item => item);

connection.onDefinition(params => {
  return messageProcessor.handleDefinitionRequest(params);
});

// Listen on the connection
connection.listen();
