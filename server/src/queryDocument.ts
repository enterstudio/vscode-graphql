import { parse, Source, DocumentNode } from 'graphql';
import { SourceLocation, getLocation } from 'graphql/language/location';

import {
  TextDocument,
  Position,
  Diagnostic,
  DiagnosticSeverity
} from 'vscode-languageserver';

import { getRange } from 'graphql-language-service-interface/dist/getDiagnostics';

import { positionFromSourceLocation, rangeInContainingDocument } from './utilities/source'

export class QueryDocument {
  ast?: DocumentNode;
  syntaxError?: Diagnostic;

  constructor(public source: Source) {
    try {
      this.ast = parse(source);
    } catch (error) {
      // A GraphQL error only has a location, but we want the range of the token at that location
      const range = rangeInContainingDocument(source, getRange(error.locations[0], source.body));
      this.syntaxError = {
        severity: DiagnosticSeverity.Error,
        message: error.message,
        source: 'GraphQL: Syntax',
        range
      };
    }
  }

  containsPosition(position: Position): boolean {
    if (position.line < this.source.locationOffset.line - 1) return false;
    const end = positionFromSourceLocation(this.source, getLocation(this.source, this.source.body.length));
    return position.line <= end.line;
  }
}

export function extractQueryDocuments(document: TextDocument): QueryDocument[] | null {
  switch (document.languageId) {
    case 'graphql':
      return [new QueryDocument(new Source(document.getText(), document.uri))];
    case 'javascript':
    case 'javascriptreact':
    case 'typescript':
    case 'typescriptreact':
      return extractQueryDocumentsFromESTemplateLiterals(document);
    default:
      return null;
  }
}

function extractQueryDocumentsFromESTemplateLiterals(document: TextDocument): QueryDocument[] | null {
  const text = document.getText();

  const queryDocuments: QueryDocument[] = [];

  const regExp = new RegExp('gql' + '\\s*`([\\s\\S]+?)`', 'mg');

  let result;
  while ((result = regExp.exec(text)) !== null) {
    const contents = replacePlaceholdersWithWhiteSpace(result[1]);
    const position = document.positionAt(result.index + 4);
    const locationOffset: SourceLocation = { line: position.line + 1, column: position.character + 1 };
    // @ts-ignore: We should fix the typings
    const source = new Source(contents, document.uri, locationOffset);
    queryDocuments.push(new QueryDocument(source));
  }

  if (queryDocuments.length < 1) return null;

  return queryDocuments;
}

function replacePlaceholdersWithWhiteSpace(text: string) {
  return text.replace(/\$\{(.+)?\}/g, match => {
    return Array(match.length).join(' ');
  });
}