import type { PlaneConfig, PlaneAccount } from "./types.js";
import { PlaneApiClient } from "./api-client.js";
export declare const DEFAULT_CONFIG: PlaneConfig;
export declare function getConfigDir(): string;
export declare function getConfigPath(): string;
export declare function loadConfig(): PlaneConfig;
export declare function saveConfig(config: PlaneConfig): void;
export declare function getActiveAccount(config: PlaneConfig): PlaneAccount | undefined;
export declare function requireActiveAccount(config: PlaneConfig): PlaneAccount;
export declare const requireActiveProfile: typeof requireActiveAccount;
export declare function requireActiveWorkspace(config: PlaneConfig): string;
export declare function requireActiveProject(config: PlaneConfig): {
    id: string;
    identifier: string;
};
export declare function createClient(config: PlaneConfig): PlaneApiClient;
//# sourceMappingURL=config-store.d.ts.map