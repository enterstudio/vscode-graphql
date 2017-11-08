declare module 'graphql-language-service-interface' {
  import { DocumentNode, GraphQLSchema, Location } from 'graphql';
  import { Diagnostic, Position, Range, CompletionItem } from 'vscode-languageserver';

  function validateQuery(ast: DocumentNode, schema: GraphQLSchema): Diagnostic[];
  function getAutocompleteSuggestions(
    schema: GraphQLSchema,
    queryText: string,
    position: Position
  ): CompletionItem[];
}

declare module 'graphql-language-service-interface/dist/getDiagnostics' {
  import { Location } from 'graphql';
  import { Range } from 'vscode-languageserver';

  function getRange(location: Location, queryText: string): Range;
}

declare module 'graphql-language-service-utils' {
  import { ASTNode, Location } from 'graphql';
  import { Position, Range } from 'vscode-languageserver';

  function getASTNodeAtPosition(query: string, ast: ASTNode, point: Position): ASTNode | null;
  function locToRange(text: string, loc: Location): Range;
}
