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
import { fetchAll, PlaneApiError } from "./api-client.js";
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

/**
 * Capability flag for Plane Pages on the current instance.
 * - `supported: true`  — the token-authenticated project-pages endpoint answered.
 * - `supported: false` — it returned 404 (Pages are not on the public API here).
 * - `supported: null`  — could not be determined (probe error, or no project to probe).
 */
export interface PagesCapability {
  supported: boolean | null;
  reason: string | null;
}

/**
 * Non-fatal probe: can this instance serve project Pages over the
 * token-authenticated `/api/v1/.../pages/` endpoint? Mirrors how
 * `fetchProjectPages` treats a 404 as "unsupported", but NEVER throws — a probe
 * error is reported as unsupported/unknown so `discover` cannot be made to fail
 * by advertising a capability. See
 * context/research/lessons-learned/pages-support-root-cause.md.
 */
export async function probePagesSupport(
  client: PlaneApiClient,
  workspace: string,
  projectId: string,
): Promise<PagesCapability> {
  try {
    // per_page=1 keeps the probe cheap; we only care about the status code.
    await client.get(`workspaces/${workspace}/projects/${projectId}/pages/?per_page=1`);
    return { supported: true, reason: null };
  } catch (error) {
    if (error instanceof PlaneApiError && error.status === 404) {
      return {
        supported: false,
        reason: "project-pages endpoint returned 404 (Pages not on this instance's public API)",
      };
    }
    return {
      supported: null,
      reason: `pages probe failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
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
