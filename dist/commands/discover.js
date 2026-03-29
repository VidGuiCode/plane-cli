import { Command } from "commander";
import { createClient, getActiveAccount, loadConfig, requireActiveWorkspace, } from "../core/config-store.js";
import { exitWithError } from "../core/errors.js";
import { fetchIssueInputOptions, fetchMembers, fetchProjects, resolveProjectContext, } from "../core/discovery.js";
import { printJson } from "../core/output.js";
const PRIORITIES = ["urgent", "high", "medium", "low", "none"];
export function createDiscoverCommand() {
    const command = new Command("discover")
        .description("Machine-readable discovery helpers for AI and automation")
        .action(() => command.help());
    command
        .command("context")
        .description("Show normalized account, workspace, project, and user context")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier-or-name>", "Project identifier or name (overrides active context)")
        .action(async (opts) => {
        try {
            const config = loadConfig();
            const client = createClient(config);
            const account = getActiveAccount(config);
            const workspace = opts.workspace ?? requireActiveWorkspace(config);
            const project = opts.project
                ? await resolveProjectContext(client, config, workspace, opts.project)
                : config.context.activeProject
                    ? await resolveProjectContext(client, config, workspace)
                    : null;
            const user = await client.get("users/me/");
            printJson({
                schemaVersion: 1,
                kind: "context",
                context: {
                    account: account
                        ? {
                            name: account.name,
                            baseUrl: account.baseUrl,
                            apiStyle: account.apiStyle,
                        }
                        : null,
                    workspace: workspace ? { slug: workspace } : null,
                    project: project
                        ? {
                            id: project.projectId,
                            identifier: project.projectIdentifier,
                            name: project.projectName ?? null,
                        }
                        : null,
                    user: {
                        id: user.id,
                        email: user.email,
                        displayName: user.display_name,
                        firstName: user.first_name ?? null,
                        lastName: user.last_name ?? null,
                        isActive: user.is_active ?? null,
                        role: user.role ?? null,
                    },
                },
            });
        }
        catch (err) {
            exitWithError(err, true);
        }
    });
    command
        .command("projects")
        .description("List normalized project metadata for the active workspace")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .action(async (opts) => {
        try {
            const config = loadConfig();
            const client = createClient(config);
            const workspace = opts.workspace ?? requireActiveWorkspace(config);
            const projects = await fetchProjects(client, workspace);
            printJson({
                schemaVersion: 1,
                kind: "projects",
                context: {
                    workspace: { slug: workspace },
                    activeProjectId: config.context.activeProject ?? null,
                },
                projects: projects.map((project) => ({
                    id: project.id,
                    identifier: project.identifier,
                    name: project.name,
                    description: project.description ?? null,
                    isMember: project.is_member,
                    counts: {
                        members: project.total_members,
                        cycles: project.total_cycles,
                        modules: project.total_modules,
                    },
                    isActive: project.id === config.context.activeProject,
                })),
            });
        }
        catch (err) {
            exitWithError(err, true);
        }
    });
    command
        .command("issue-inputs")
        .description("Fetch all normalized metadata needed for issue create/update automation")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier-or-name>", "Project identifier or name (overrides active context)")
        .action(async (opts) => {
        try {
            const config = loadConfig();
            const client = createClient(config);
            const account = getActiveAccount(config);
            const workspace = opts.workspace ?? requireActiveWorkspace(config);
            const project = await resolveProjectContext(client, config, workspace, opts.project);
            const [projects, inputs] = await Promise.all([
                fetchProjects(client, workspace),
                fetchIssueInputOptions(client, workspace, project.projectId),
            ]);
            const resolvedProject = projects.find((candidate) => candidate.id === project.projectId) ?? null;
            const completed = inputs.states.find((state) => state.group === "completed") ?? null;
            const reopen = inputs.states.find((state) => state.group === "backlog") ??
                inputs.states.find((state) => state.group === "unstarted") ??
                null;
            printJson({
                schemaVersion: 1,
                kind: "issue-inputs",
                context: {
                    account: account
                        ? {
                            name: account.name,
                            baseUrl: account.baseUrl,
                            apiStyle: account.apiStyle,
                        }
                        : null,
                    workspace: { slug: workspace },
                    project: {
                        id: project.projectId,
                        identifier: project.projectIdentifier,
                        name: project.projectName ?? resolvedProject?.name ?? null,
                    },
                },
                selectors: {
                    project: { accepted: ["identifier", "name"] },
                    issue: {
                        accepted: ["sequence", "project-sequence", "uuid"],
                        examples: [
                            "42",
                            `${project.projectIdentifier}-42`,
                            "550e8400-e29b-41d4-a716-446655440000",
                        ],
                    },
                    state: { accepted: ["id", "name"] },
                    member: { accepted: ["displayName", "email"] },
                    label: { accepted: ["name", "color"] },
                    cycle: { accepted: ["id", "name"] },
                    module: { accepted: ["id", "name"] },
                },
                issue: {
                    fields: {
                        required: ["name"],
                        optional: [
                            "description_html",
                            "priority",
                            "state",
                            "assignees",
                            "label_ids",
                            "parent",
                            "due_date",
                            "start_date",
                        ],
                    },
                    enums: {
                        priority: PRIORITIES,
                        dateFormat: "YYYY-MM-DD",
                    },
                    defaults: {
                        completedStateId: completed?.id ?? null,
                        reopenStateId: reopen?.id ?? null,
                    },
                },
                inputs: {
                    states: inputs.states.map((state) => ({
                        id: state.id,
                        name: state.name,
                        group: state.group,
                        color: state.color,
                    })),
                    members: inputs.members.map((member) => ({
                        id: member.id,
                        displayName: member.member__display_name,
                        email: member.member__email ?? null,
                        role: member.role,
                    })),
                    labels: inputs.labels.map((label) => ({
                        id: label.id,
                        name: label.name,
                        color: label.color,
                    })),
                    cycles: inputs.cycles.map((cycle) => ({
                        id: cycle.id,
                        name: cycle.name,
                        status: cycle.status ?? null,
                        startDate: cycle.start_date ?? null,
                        endDate: cycle.end_date ?? null,
                    })),
                    modules: inputs.modules.map((module) => ({
                        id: module.id,
                        name: module.name,
                        status: module.status ?? null,
                    })),
                },
            });
        }
        catch (err) {
            exitWithError(err, true);
        }
    });
    for (const resource of ["states", "members", "labels", "cycles", "modules"]) {
        command
            .command(resource)
            .description(`List normalized ${resource} for AI discovery`)
            .option("--workspace <slug>", "Workspace slug (overrides active context)")
            .option("--project <identifier-or-name>", "Project identifier or name (overrides active context where required)")
            .action(async (opts) => {
            try {
                const config = loadConfig();
                const client = createClient(config);
                const workspace = opts.workspace ?? requireActiveWorkspace(config);
                if (resource === "members") {
                    const account = getActiveAccount(config);
                    const members = await fetchMembers(client, workspace);
                    printJson({
                        schemaVersion: 1,
                        kind: resource,
                        context: {
                            account: account
                                ? {
                                    name: account.name,
                                    baseUrl: account.baseUrl,
                                    apiStyle: account.apiStyle,
                                }
                                : null,
                            workspace: { slug: workspace },
                        },
                        items: members.map((member) => ({
                            id: member.id,
                            displayName: member.member__display_name,
                            email: member.member__email ?? null,
                            role: member.role,
                        })),
                    });
                    return;
                }
                const project = await resolveProjectContext(client, config, workspace, opts.project);
                const inputs = await fetchIssueInputOptions(client, workspace, project.projectId);
                const items = resource === "states"
                    ? inputs.states.map((state) => ({
                        id: state.id,
                        name: state.name,
                        group: state.group,
                        color: state.color,
                    }))
                    : resource === "labels"
                        ? inputs.labels.map((label) => ({
                            id: label.id,
                            name: label.name,
                            color: label.color,
                        }))
                        : resource === "cycles"
                            ? inputs.cycles.map((cycle) => ({
                                id: cycle.id,
                                name: cycle.name,
                                status: cycle.status ?? null,
                                startDate: cycle.start_date ?? null,
                                endDate: cycle.end_date ?? null,
                            }))
                            : inputs.modules.map((module) => ({
                                id: module.id,
                                name: module.name,
                                status: module.status ?? null,
                            }));
                printJson({
                    schemaVersion: 1,
                    kind: resource,
                    context: {
                        workspace: { slug: workspace },
                        project: {
                            id: project.projectId,
                            identifier: project.projectIdentifier,
                            name: project.projectName ?? null,
                        },
                    },
                    items,
                });
            }
            catch (err) {
                exitWithError(err, true);
            }
        });
    }
    return command;
}
//# sourceMappingURL=discover.js.map