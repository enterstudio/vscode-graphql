import { Proposed, NotificationHandler, PublishDiagnosticsParams } from 'vscode-languageserver';
import Uri from 'vscode-uri';

import { getGraphQLConfig } from 'graphql-config';

import { GraphQLProject, DocumentUri } from './project';
import { GraphQLProjectConfig } from 'graphql-config/lib/GraphQLProjectConfig';

export class GraphQLWorkspace {
  private _onDiagnostics?: NotificationHandler<PublishDiagnosticsParams>;
  private projectsByFolderUri: Map<string, GraphQLProject[]> = new Map();

  onDiagnostics(handler: NotificationHandler<PublishDiagnosticsParams>) {
    this._onDiagnostics = handler;
  }

  addProjectsInFolder(folder: Proposed.WorkspaceFolder) {
    const config = getGraphQLConfig(Uri.parse(folder.uri).fsPath);

    let projectConfigs: GraphQLProjectConfig[] = [];

    const projectConfigsByName = config.getProjects();
    if (projectConfigsByName) {
      projectConfigs = Object.values(projectConfigsByName);
    } else {
      projectConfigs = [config.getProjectConfig()];
    }

    const projects = projectConfigs.map(projectConfig => {
      const project = new GraphQLProject(projectConfig);

      project.onDiagnostics(params => {
        this._onDiagnostics && this._onDiagnostics(params);
      });

      return project;
    });

    this.projectsByFolderUri.set(folder.uri, projects);
  }

  removeProjectsInFolder(folder: Proposed.WorkspaceFolder) {
    this.projectsByFolderUri.delete(folder.uri);
  }

  projectForFile(uri: DocumentUri): GraphQLProject | undefined {
    for (const projects of this.projectsByFolderUri.values()) {
      const project = projects.find(project => project.includesFile(uri));
      if (project) {
        return project;
      }
    }
    return undefined;
  }
}
