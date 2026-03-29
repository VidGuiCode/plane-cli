import { fetchAll } from "./api-client.js";
import { requireActiveProject } from "./config-store.js";
import { resolveProject } from "./resolvers.js";
export async function resolveProjectContext(client, config, workspace, projectRef) {
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
        throw new Error(`No active project in workspace "${workspace}". Provide --project <identifier-or-name>.`);
    }
    const active = requireActiveProject(config);
    return {
        workspace,
        projectId: active.id,
        projectIdentifier: active.identifier,
    };
}
export async function fetchProjects(client, workspace) {
    return fetchAll(client, `workspaces/${workspace}/projects/`);
}
export async function fetchMembers(client, workspace) {
    return fetchAll(client, `workspaces/${workspace}/members/`);
}
export async function fetchIssueInputOptions(client, workspace, projectId) {
    const [states, members, labels, cycles, modules] = await Promise.all([
        fetchAll(client, `workspaces/${workspace}/projects/${projectId}/states/`),
        fetchAll(client, `workspaces/${workspace}/members/`),
        fetchAll(client, `workspaces/${workspace}/projects/${projectId}/labels/`),
        fetchAll(client, `workspaces/${workspace}/projects/${projectId}/cycles/`),
        fetchAll(client, `workspaces/${workspace}/projects/${projectId}/modules/`),
    ]);
    return {
        states,
        members,
        labels,
        cycles,
        modules,
    };
}
//# sourceMappingURL=discovery.js.map