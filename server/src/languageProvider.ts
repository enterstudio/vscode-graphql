import {
  CancellationToken,
  Position,
  CompletionItem,
  Hover,
  Definition,
  CodeLens,
  Command
} from 'vscode-languageserver';

import * as Kind from 'graphql/language/kinds';

import { getAutocompleteSuggestions } from 'graphql-language-service-interface';

import { GraphQLWorkspace } from './workspace';
import { DocumentUri } from './project';

import {
  positionFromPositionInContainingDocument,
  rangeForASTNode,
  getASTNodeAndTypeInfoAtPosition
} from './utilities/source';

import { highlightNodeForNode } from './utilities/graphql';
import { GraphQLNamedType } from 'graphql';

export class GraphQLLanguageProvider {
  constructor(public workspace: GraphQLWorkspace) {}

  async provideCompletionItems(
    uri: DocumentUri,
    position: Position,
    _token: CancellationToken
  ): Promise<CompletionItem[]> {
    const project = this.workspace.projectForFile(uri);
    if (!project) return [];

    const queryDocument = project.queryDocumentAt(uri, position);
    if (!queryDocument) return [];

    const positionInQueryDocument = positionFromPositionInContainingDocument(queryDocument.source, position);

    return getAutocompleteSuggestions(project.schema, queryDocument.source.body, positionInQueryDocument);
  }

  async provideHover(uri: DocumentUri, position: Position, _token: CancellationToken): Promise<Hover | null> {
    const project = this.workspace.projectForFile(uri);
    if (!project) return null;

    const queryDocument = project.queryDocumentAt(uri, position);
    if (!(queryDocument && queryDocument.ast)) return null;

    const positionInQueryDocument = positionFromPositionInContainingDocument(queryDocument.source, position);

    const nodeAndTypeInfo = getASTNodeAndTypeInfoAtPosition(
      queryDocument.source,
      positionInQueryDocument,
      queryDocument.ast,
      project.schema
    );

    if (nodeAndTypeInfo) {
      const [node, typeInfo] = nodeAndTypeInfo;

      switch (node.kind) {
        case Kind.FRAGMENT_SPREAD: {
          const fragmentName = node.name.value;
          const fragment = project.fragments[fragmentName];
          if (fragment) {
            return {
              contents: {
                language: 'graphql',
                value: `fragment ${fragmentName} on ${fragment.typeCondition.name.value}`
              }
            };
          }
          break;
        }
        case Kind.FIELD: {
          const parentType = typeInfo.getParentType();
          const fieldDef = typeInfo.getFieldDef();

          if (parentType && fieldDef) {
            return {
              contents: [
                { language: 'graphql', value: `${parentType}.${fieldDef.name}: ${fieldDef.type}` },
                fieldDef.description
              ],
              range: rangeForASTNode(highlightNodeForNode(node))
            };
          }
          break;
        }
        case Kind.NAMED_TYPE: {
          const type = typeInfo.getType() as GraphQLNamedType;

          if (!(type.astNode && type.astNode.loc)) break;

          return {
            contents: [{ language: 'graphql', value: String(type) }, type.description],
            range: rangeForASTNode(highlightNodeForNode(node))
          };
        }
      }
    }
    return null;
  }

  async provideDefinition(
    uri: DocumentUri,
    position: Position,
    _token: CancellationToken
  ): Promise<Definition> {
    const project = this.workspace.projectForFile(uri);
    if (!project) return null;

    const queryDocument = project.queryDocumentAt(uri, position);
    if (!(queryDocument && queryDocument.ast)) return null;

    const positionInQueryDocument = positionFromPositionInContainingDocument(queryDocument.source, position);
    const nodeAndTypeInfo = getASTNodeAndTypeInfoAtPosition(
      queryDocument.source,
      positionInQueryDocument,
      queryDocument.ast,
      project.schema
    );

    if (nodeAndTypeInfo) {
      const [node, typeInfo] = nodeAndTypeInfo;

      switch (node.kind) {
        case Kind.FRAGMENT_SPREAD:
          const fragmentName = node.name.value;
          const fragment = project.fragments[fragmentName];
          if (fragment && fragment.loc) {
            return {
              uri: fragment.loc.source.name,
              range: rangeForASTNode(fragment)
            };
          }
          break;
        case Kind.FIELD: {
          const fieldDef = typeInfo.getFieldDef();

          if (!(fieldDef.astNode && fieldDef.astNode.loc)) break;

          return {
            uri: fieldDef.astNode.loc.source.name,
            range: rangeForASTNode(fieldDef.astNode)
          };
        }
        case Kind.NAMED_TYPE: {
          const type = typeInfo.getType() as GraphQLNamedType;

          if (!(type.astNode && type.astNode.loc)) break;

          return {
            uri: type.astNode.loc.source.name,
            range: rangeForASTNode(type.astNode)
          };
        }
      }
    }
    return null;
  }

  async provideCodeLenses(uri: DocumentUri, _token: CancellationToken): Promise<CodeLens[]> {
    const project = this.workspace.projectForFile(uri);
    if (!project) return [];

    const queryDocuments = project.queryDocumentsAt(uri);
    if (!queryDocuments) return [];

    let codeLenses: CodeLens[] = [];

    for (const queryDocument of queryDocuments) {
      if (!queryDocument.ast) continue;
      for (const definition of queryDocument.ast.definitions) {
        if (definition.kind === Kind.OPERATION_DEFINITION) {
          codeLenses.push({
            range: rangeForASTNode(definition),
            command: Command.create('Run query', 'apollographql.runQuery')
          });
        } else if (definition.kind === Kind.FRAGMENT_DEFINITION) {
          codeLenses.push({
            range: rangeForASTNode(definition),
            command: Command.create('? references', '')
          });
        }
      }
    }
    return codeLenses;
  }
}
