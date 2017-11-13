'use strict';

// Seems to be needed for graphql-language-service-server
import 'regenerator-runtime/runtime';
import { spawn } from 'child_process';

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

/**
 * Trigger a recompile of the queries using persistgraphql. 
 */
function triggerPersistCompile(verbose: boolean = false) {
  // TODO Make this so that your package.json doesn't have to have a 
  // "persistgraphql" run reference - you can call it something else, set
  // the options somewhere in .vscode, etc.
  const persistSpawn = spawn('npm', ['run', 'persistgraphql']);
  persistSpawn.stdout.on('data', (data) => {
    console.log(`Received this from npm run persistgraphql (stdout): ${data}`);
    if (verbose) {
      connection.window.showInformationMessage("Compiled persisted queries successfully.");
    }
  });

  persistSpawn.stderr.on('data', (data) => {
    console.log(`Received this from npm run persistgraphql (stderr): ${data}`);

    // TODO Make this error message more helpful.
    if (verbose) {
      connection.window.showErrorMessage("Compiling your queries caused an error; check the logs.");
    }
  });
}

/**
 * Handle saving a document.
 * @param textUri Uri (e.g. "file:///root/scheme.graphql") of the file that was just saved.
 */
function handleSavedDocument(textUri: string) {
  const pathPieces = textUri.split('/');
  const filename = pathPieces[pathPieces.length - 1];

  // TODO There's probably some more VS Code compatible way of
  // doing this.
  const persistCompileTriggers = [
    /\.js$/,
    /\.ts$/,
    /\.graphql$/,
    /\.gql$/
  ];

  // figure out what the extension is on this textUri  
  const extensions = filename.split('.');
  const extension = extensions[extensions.length - 1];
  const compilePersist = persistCompileTriggers.some((trigger) => {
    return trigger.test(extension);
  });

  if (compilePersist) {
    triggerPersistCompile();
  }
}

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

connection.onDidSaveTextDocument(async (params) => {
  connection.console.log('Params received from the document about to be saved: ');
  connection.console.log(JSON.stringify(params));
  const uri = params.textDocument.uri;
  handleSavedDocument(uri);
});

connection.onDidChangeWatchedFiles(_change => {
  connection.console.log('CHANGED WATCHED FILE.');
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
