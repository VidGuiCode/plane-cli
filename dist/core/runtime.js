let activeCommand = null;
export function setActiveCommand(command) {
    activeCommand = command;
}
export function getActiveCommand() {
    return activeCommand;
}
export function hasArg(flag) {
    return process.argv.includes(flag);
}
export function isDryRunEnabled() {
    return hasArg("--dry-run");
}
export function isNonInteractiveMode() {
    return hasArg("--no-interactive") || !process.stdin.isTTY || !process.stdout.isTTY;
}
export function isCompactMode() {
    return hasArg("--compact");
}
//# sourceMappingURL=runtime.js.map