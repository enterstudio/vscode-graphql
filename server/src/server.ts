// Seems to be needed for graphql-language-service-server
import 'regenerator-runtime/runtime';

import {
  createConnection,
  ProposedFeatures,
  Proposed,
  TextDocuments,
  FileChangeType
} from 'vscode-languageserver';

import { GraphQLWorkspace } from './workspace';
import { GraphQLLanguageProvider } from './languageProvider';

const connection = createConnection(ProposedFeatures.all);

let hasWorkspaceFolderCapability = false;

const workspace = new GraphQLWorkspace();

workspace.onDiagnostics(params => {
  connection.sendDiagnostics(params);
});

connection.onInitialize(async params => {
  let capabilities = params.capabilities as Proposed.WorkspaceFoldersClientCapabilities;
  hasWorkspaceFolderCapability = !!(capabilities.workspace && capabilities.workspace.workspaceFolders);

  const workspaceFolders = (params as Proposed.WorkspaceFoldersInitializeParams).workspaceFolders;
  if (workspaceFolders) {
    workspaceFolders.forEach(folder => workspace.addProjectsInFolder(folder));
  }

  return {
    capabilities: {
      hoverProvider: true,
      definitionProvider: true,
      completionProvider: {
        resolveProvider: false,
        triggerCharacters: ['...']
      },
      codeLensProvider: {
        resolveProvider: false
      },
      textDocumentSync: documents.syncKind
    }
  };
});

connection.onInitialized(async () => {
  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders(event => {
      event.removed.forEach(folder => workspace.removeProjectsInFolder(folder));
      event.added.forEach(folder => workspace.addProjectsInFolder(folder));
    });
  }
});

const documents: TextDocuments = new TextDocuments();

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

documents.onDidChangeContent(params => {
  const project = workspace.projectForFile(params.document.uri);
  if (!project) return;

  project.documentDidChange(params.document);
});

connection.onDidChangeWatchedFiles(params => {
  for (const change of params.changes) {
    const uri = change.uri;

    // Don't respond to changes in files that are currently open,
    // because we'll get content change notifications instead
    if (documents.get(uri)) continue;

    const project = workspace.projectForFile(uri);
    if (!project) return;

    switch (change.type) {
      case FileChangeType.Created:
      case FileChangeType.Changed:
        project.fileDidChange(uri);
        break;
      case FileChangeType.Deleted:
        project.fileWasDeleted(uri);
    }
  }
});

const languageProvider = new GraphQLLanguageProvider(workspace);

connection.onHover((params, token) => {
  return languageProvider.provideHover(params.textDocument.uri, params.position, token);
});

connection.onDefinition((params, token) => {
  return languageProvider.provideDefinition(params.textDocument.uri, params.position, token);
});

connection.onCompletion((params, token) => {
  return languageProvider.provideCompletionItems(params.textDocument.uri, params.position, token);
});

connection.onCodeLens((params, token) => {
  return languageProvider.provideCodeLenses(params.textDocument.uri, token);
});

// Listen on the connection
connection.listen();
