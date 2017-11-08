import { GraphQLSchema, DocumentNode, FragmentDefinitionNode } from 'graphql';
import { SourceLocation } from 'graphql/language/location';

declare module 'graphql/language/source' {
  interface Source {
    body: string;
    name: string;
    locationOffset: SourceLocation;
  }
}

declare module 'graphql/validation/validate' {
  interface ValidationContext {
    _fragments: { [fragmentName: string]: FragmentDefinitionNode };
  }
}

declare module "graphql/utilities/buildASTSchema" {
  function buildASTSchema(
    ast: DocumentNode,
    options?: { assumeValid?: boolean, commentDescriptions?: boolean },
  ): GraphQLSchema;
}