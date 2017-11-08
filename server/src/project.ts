import * as path from 'path';
import * as fs from 'fs';
import * as readdir from 'recursive-readdir';

import { Source, parse, buildASTSchema, GraphQLSchema, FragmentDefinitionNode } from 'graphql';

import * as Kind from 'graphql/language/kinds';

import './utilities/array';

import {
  TextDocument,
  NotificationHandler,
  PublishDiagnosticsParams,
  Position,
  Diagnostic
} from 'vscode-languageserver';

import { GraphQLProjectConfig } from 'graphql-config';

import { collectDiagnostics } from './diagnostics';
import { QueryDocument, extractQueryDocuments } from './queryDocument';

import Uri from 'vscode-uri';

export type DocumentUri = string;

const fileAssociations: { [extension: string]: string } = {
  '.graphql': 'graphql',
  '.js': 'javascript',
  '.ts': 'typescript',
  '.jsx': 'javascriptreact',
  '.tsx': 'typescriptreact'
};

const defaultExcludes = ['node_modules/**'];

export class GraphQLProject {
  schema: GraphQLSchema;

  private _onDiagnostics?: NotificationHandler<PublishDiagnosticsParams>;

  private isReady = false;
  private needsValidation = false;

  private queryDocumentsByFile: Map<DocumentUri, QueryDocument[]> = new Map();

  constructor(public config: GraphQLProjectConfig) {
    // FIXME: Add defaultExcludes option to graphql-config
    if (!config.config.excludes) {
      config.config.excludes = defaultExcludes;
    }

    if (!config.schemaPath) {
      throw new Error('No schemaPath configured');
    }

    const schemaPath = config.resolveConfigPath(config.schemaPath);
    const schemaSource = new Source(fs.readFileSync(schemaPath, { encoding: 'utf-8' }), Uri.file(schemaPath).toString());

    this.schema = buildASTSchema(parse(schemaSource), { commentDescriptions: true })

    this.scanAllIncludedFiles();
  }

  get displayName(): string {
    return this.config.projectName
      ? `${this.config.configDir} (${this.config.projectName})`
      : this.config.configDir;
  }

  onDiagnostics(handler: NotificationHandler<PublishDiagnosticsParams>) {
    this._onDiagnostics = handler;
  }

  includesFile(uri: DocumentUri) {
    return this.includesPath(Uri.parse(uri).fsPath);
  }

  private includesPath(filePath: string) {
    // Always ignore the schema file
    if (filePath === this.config.schemaPath) return false;

    // FIXME: Never include files that are not inside the config dir, to avoid a project without
    // includes matching everything.
    // See https://github.com/graphcool/graphql-config/issues/43
    if (!filePath.startsWith(this.config.configDir)) return false;

    return this.config.includesFile(filePath);
  }

  async scanAllIncludedFiles() {
    console.time(`scanAllIncludedFiles - ${this.displayName}`);

    const shouldIgnore = (filePath: string, stats: fs.Stats) => {
      return (
        !stats.isDirectory() &&
        !(
          this.includesPath(filePath) &&
          Object.keys(fileAssociations).some(extension => filePath.endsWith(extension))
        )
      );
    };

    const files = await readdir(this.config.configDir, [shouldIgnore]);

    for (const filePath of files) {
      const uri = Uri.file(filePath).toString();

      // If we already have query documents for this file, that means it was either
      // opened or changed before we got a chance to read it.
      if (this.queryDocumentsByFile.has(uri)) continue;

      this.fileDidChange(uri);
    }

    console.timeEnd(`scanAllIncludedFiles - ${this.displayName}`);

    this.isReady = true;
    this.validateIfNeeded();
  }

  fileDidChange(uri: DocumentUri) {
    const filePath = Uri.parse(uri).fsPath;
    const extension = path.extname(filePath);
    const languageId = fileAssociations[extension];

    // Don't process files of an unsupported filetype
    if (!languageId) return;

    try {
      const contents = fs.readFileSync(filePath, 'utf8');
      const document = TextDocument.create(uri, languageId, -1, contents);
      this.documentDidChange(document);
    } catch (error) {
      console.error(error);
    }
  }

  fileWasDeleted(uri: DocumentUri) {
    this.removeQueryDocumentsFor(uri);
  }

  documentDidChange(document: TextDocument) {
    const queryDocuments = extractQueryDocuments(document);

    if (queryDocuments) {
      this.queryDocumentsByFile.set(document.uri, queryDocuments);
      this.invalidate();
    } else {
      this.removeQueryDocumentsFor(document.uri);
    }
  }

  private removeQueryDocumentsFor(uri: DocumentUri) {
    if (this.queryDocumentsByFile.has(uri)) {
      this.queryDocumentsByFile.delete(uri);
      this.invalidate();
    }
  }

  private invalidate() {
    if (!this.needsValidation && this.isReady) {
      setTimeout(() => {
        this.validateIfNeeded();
      }, 0);
    }
    this.needsValidation = true;
  }

  private validateIfNeeded() {
    if (!this.needsValidation || !this._onDiagnostics) return;

    const fragments = this.fragments;

    for (const [uri, queryDocumentsForFile] of this.queryDocumentsByFile) {
      const diagnostics: Diagnostic[] = [];
      for (const queryDocument of queryDocumentsForFile) {
        diagnostics.push(...collectDiagnostics(this.schema, queryDocument, fragments));
      }
      this._onDiagnostics({ uri, diagnostics });
    }

    this.needsValidation = false;
  }

  queryDocumentsAt(uri: DocumentUri): QueryDocument[] | undefined {
    return this.queryDocumentsByFile.get(uri);
  }

  queryDocumentAt(uri: DocumentUri, position: Position): QueryDocument | undefined {
    const queryDocuments = this.queryDocumentsByFile.get(uri);
    if (!queryDocuments) return undefined;
    return queryDocuments.find(document => document.containsPosition(position));
  }

  get queryDocuments(): QueryDocument[] {
    const queryDocuments: QueryDocument[] = [];
    for (const queryDocumentsForFile of this.queryDocumentsByFile.values()) {
      queryDocuments.push(...queryDocumentsForFile);
    }
    return queryDocuments;
  }

  get fragments(): { [fragmentName: string]: FragmentDefinitionNode } {
    return this.queryDocuments
      .filter(document => document.ast)
      .flatMap(document => document.ast && document.ast.definitions)
      .reduce((fragments, definition) => {
        if (definition.kind === Kind.FRAGMENT_DEFINITION) {
          fragments[definition.name.value] = definition;
        }
        return fragments;
      }, Object.create(null));
  }
}
