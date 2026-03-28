import { Command } from "commander";
export declare function fetchLatestVersion(): Promise<string | null>;
export declare function isNewer(remote: string, current: string): boolean;
export declare function createUpgradeCommand(): Command;
//# sourceMappingURL=upgrade.d.ts.map