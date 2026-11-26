let activeCommand: string | null = null;

export function setActiveCommand(command: string): void {
  activeCommand = command;
}

export function getActiveCommand(): string | null {
  return activeCommand;
}

export function hasArg(flag: string): boolean {
  return process.argv.includes(flag);
}

export function isDryRunEnabled(): boolean {
  return hasArg("--dry-run");
}

export function isNonInteractiveMode(): boolean {
  return hasArg("--no-interactive") || !process.stdin.isTTY || !process.stdout.isTTY;
}

export function isCompactMode(): boolean {
  return hasArg("--compact");
}
