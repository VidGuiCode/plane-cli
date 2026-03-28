import { Command } from "commander";
import { printError } from "../core/output.js";
const SUPPORTED_SHELLS = ["bash", "zsh", "fish"];
function isSupportedShell(value) {
    return SUPPORTED_SHELLS.includes(value);
}
function generateBashCompletion(program) {
    const name = program.name();
    return `_${name}_completion() {
    local cur prev opts
    COMPREPLY=()
    cur="\${COMP_WORDS[COMP_CWORD]}"
    prev="\${COMP_WORDS[COMP_CWORD-1]}"
    
    # Get all commands and options
    opts="${program.commands.map((cmd) => cmd.name()).join(" ")} --help --version"
    
    case "\${prev}" in
      ${name})
        COMPREPLY=( $(compgen -W "\${opts}" -- "\${cur}") )
        return 0
        ;;
    esac
    
    COMPREPLY=( $(compgen -W "\${opts}" -- "\${cur}") )
}

complete -F _${name}_completion ${name}
`;
}
function generateZshCompletion(program) {
    const name = program.name();
    const commands = program.commands
        .map((cmd) => `"${cmd.name()}:${cmd.description().replace(/"/g, '\\"')}"`)
        .join("\n        ");
    return `#compdef ${name}

_${name}() {
    local curcontext="$curcontext" state line
    typeset -A opt_args

    _arguments -C \\
        '(-h --help)'{-h,--help}'[Show help]' \\
        '(-v --version)'{-v,--version}'[Show version]' \\
        '1: :->command' \\
        '*:: :->args'

    case "$state" in
        command)
            _describe -t commands '${name} command' (
        ${commands}
            )
            ;;
        args)
            case "$line[1]" in
                *)
                    _files
                    ;;
            esac
            ;;
    esac
}

_${name} "$@"
`;
}
function generateFishCompletion(program) {
    const name = program.name();
    const commands = program.commands
        .map((cmd) => `complete -c ${name} -n "__fish_use_subcommand" -a "${cmd.name()}" -d "${cmd.description().replace(/"/g, '\\"')}"`)
        .join("\n");
    return `${commands}
complete -c ${name} -s h -l help -d "Show help"
complete -c ${name} -s v -l version -d "Show version"
`;
}
function generateCompletionScript(program, shell) {
    switch (shell) {
        case "bash":
            return generateBashCompletion(program);
        case "zsh":
            return generateZshCompletion(program);
        case "fish":
            return generateFishCompletion(program);
        default:
            throw new Error(`Unsupported shell: ${shell}`);
    }
}
export function createCompletionCommand(program) {
    return new Command("completion")
        .description("Generate shell completion script")
        .argument("<shell>", `shell type (${SUPPORTED_SHELLS.join(" | ")})`)
        .action((shell) => {
        if (!isSupportedShell(shell)) {
            printError(`Unsupported shell: "${shell}"`);
            printError(`Supported shells: ${SUPPORTED_SHELLS.join(", ")}`);
            process.exit(1);
        }
        try {
            const script = generateCompletionScript(program, shell);
            console.log(script);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            printError(`Failed to generate completion script: ${message}`);
            process.exit(1);
        }
    });
}
//# sourceMappingURL=completion.js.map