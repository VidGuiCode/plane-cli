import type {
  PlaneConfig,
  PlaneCycle,
  PlaneLabel,
  PlaneMember,
  PlaneModule,
  PlaneProject,
  PlaneState,
} from "./types.js";
import type { PlaneApiClient } from "./api-client.js";
import { fetchAll } from "./api-client.js";
import { requireActiveProject } from "./config-store.js";
import { resolveProject } from "./resolvers.js";

export interface ResolvedProjectContext {
  workspace: string;
  projectId: string;
  projectIdentifier: string;
  projectName?: string;
}

export interface IssueInputOptions {
  states: PlaneState[];
  members: PlaneMember[];
  labels: PlaneLabel[];
  cycles: PlaneCycle[];
  modules: PlaneModule[];
}

export async function resolveProjectContext(
  client: PlaneApiClient,
  config: PlaneConfig,
  workspace: string,
  projectRef?: string,
): Promise<ResolvedProjectContext> {
  if (projectRef) {
    const project = await resolveProject(client, workspace, projectRef);
    return {
      workspace,
      projectId: project.id,
      projectIdentifier: project.identifier,
      projectName: project.name,
    };
  }

  if (config.context.activeWorkspace && config.context.activeWorkspace !== workspace) {
    throw new Error(
      `No active project in workspace "${workspace}". Provide --project <identifier-or-name>.`,
    );
  }

  const active = requireActiveProject(config);
  return {
    workspace,
    projectId: active.id,
    projectIdentifier: active.identifier,
  };
}

export async function fetchProjects(
  client: PlaneApiClient,
  workspace: string,
): Promise<PlaneProject[]> {
  return fetchAll<PlaneProject>(client, `workspaces/${workspace}/projects/`);
}

export async function fetchMembers(
  client: PlaneApiClient,
  workspace: string,
): Promise<PlaneMember[]> {
  return fetchAll<PlaneMember>(client, `workspaces/${workspace}/members/`);
}

export async function fetchIssueInputOptions(
  client: PlaneApiClient,
  workspace: string,
  projectId: string,
): Promise<IssueInputOptions> {
  const [states, members, labels, cycles, modules] = await Promise.all([
    fetchAll<PlaneState>(client, `workspaces/${workspace}/projects/${projectId}/states/`),
    fetchAll<PlaneMember>(client, `workspaces/${workspace}/members/`),
    fetchAll<PlaneLabel>(client, `workspaces/${workspace}/projects/${projectId}/labels/`),
    fetchAll<PlaneCycle>(client, `workspaces/${workspace}/projects/${projectId}/cycles/`),
    fetchAll<PlaneModule>(client, `workspaces/${workspace}/projects/${projectId}/modules/`),
  ]);

  return {
    states,
    members,
    labels,
    cycles,
    modules,
  };
}
