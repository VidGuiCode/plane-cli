import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { PlaneConfig, PlaneAccount } from "../../src/core/types.js";

// Import the module under test
// We need to mock the config path to use a temp directory
const originalHomedir = os.homedir;

// Helper to create a temp directory and mock homedir
function setupTempConfigDir(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "plane-cli-test-"));
  // Override homedir to return our temp directory
  (os as { homedir(): string }).homedir = () => tempDir;
  return tempDir;
}

// Restore original homedir
function restoreHomedir(): void {
  (os as { homedir(): string }).homedir = originalHomedir;
}

// Dynamically import to get fresh module with mocked paths
async function importConfigStore() {
  const module = await import("../../src/core/config-store.js");
  return module;
}

describe("config-store", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = setupTempConfigDir();
  });

  afterEach(() => {
    restoreHomedir();
    // Clean up temp directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("getConfigDir", () => {
    it("should return .plane-cli in home directory", async () => {
      const { getConfigDir } = await importConfigStore();
      const configDir = getConfigDir();
      expect(configDir).toBe(path.join(tempDir, ".plane-cli"));
    });
  });

  describe("getConfigPath", () => {
    it("should return config.json in config directory", async () => {
      const { getConfigPath } = await importConfigStore();
      const configPath = getConfigPath();
      expect(configPath).toBe(path.join(tempDir, ".plane-cli", "config.json"));
    });
  });

  describe("loadConfig", () => {
    it("should return default config when file does not exist", async () => {
      const { loadConfig } = await importConfigStore();
      const config = loadConfig();
      expect(config).toEqual({
        profiles: [],
        context: {},
      });
    });

    it("should load config from file when it exists", async () => {
      const { loadConfig, getConfigDir, getConfigPath } = await importConfigStore();
      
      // Create config directory and file
      const configDir = getConfigDir();
      fs.mkdirSync(configDir, { recursive: true });
      
      const testConfig: PlaneConfig = {
        profiles: [
          {
            name: "test",
            baseUrl: "https://test.example.com",
            token: "test-token",
            apiStyle: "issues",
          },
        ],
        context: {
          activeProfile: "test",
          activeWorkspace: "my-workspace",
        },
      };
      
      fs.writeFileSync(getConfigPath(), JSON.stringify(testConfig, null, 2));
      
      const config = loadConfig();
      expect(config).toEqual(testConfig);
    });

    it("should return default config when file contains invalid JSON", async () => {
      const { loadConfig, getConfigDir, getConfigPath } = await importConfigStore();
      
      const configDir = getConfigDir();
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(getConfigPath(), "not valid json");
      
      const config = loadConfig();
      expect(config).toEqual({
        profiles: [],
        context: {},
      });
    });
  });

  describe("saveConfig", () => {
    it("should create directory if it does not exist", async () => {
      const { saveConfig, getConfigDir, getConfigPath } = await importConfigStore();
      
      const config: PlaneConfig = {
        profiles: [],
        context: {},
      };
      
      saveConfig(config);
      
      expect(fs.existsSync(getConfigDir())).toBe(true);
      expect(fs.existsSync(getConfigPath())).toBe(true);
    });

    it("should save config to file", async () => {
      const { saveConfig, getConfigPath, loadConfig } = await importConfigStore();
      
      const config: PlaneConfig = {
        profiles: [
          {
            name: "prod",
            baseUrl: "https://plane.example.com",
            token: "secret-token",
            apiStyle: "work-items",
          },
        ],
        context: {
          activeProfile: "prod",
        },
      };
      
      saveConfig(config);
      
      const loaded = loadConfig();
      expect(loaded).toEqual(config);
    });

    it("should overwrite existing config", async () => {
      const { saveConfig, getConfigDir, getConfigPath, loadConfig } = await importConfigStore();
      
      const configDir = getConfigDir();
      fs.mkdirSync(configDir, { recursive: true });
      
      const oldConfig: PlaneConfig = {
        profiles: [{ name: "old", baseUrl: "https://old.com", token: "old", apiStyle: "issues" }],
        context: {},
      };
      fs.writeFileSync(getConfigPath(), JSON.stringify(oldConfig));
      
      const newConfig: PlaneConfig = {
        profiles: [{ name: "new", baseUrl: "https://new.com", token: "new", apiStyle: "work-items" }],
        context: { activeProfile: "new" },
      };
      
      saveConfig(newConfig);
      
      const loaded = loadConfig();
      expect(loaded).toEqual(newConfig);
    });

    it("should save with proper JSON formatting", async () => {
      const { saveConfig, getConfigPath } = await importConfigStore();
      
      const config: PlaneConfig = {
        profiles: [],
        context: {},
      };
      
      saveConfig(config);
      
      const content = fs.readFileSync(getConfigPath(), "utf-8");
      expect(content).toContain("{\n  \"profiles\": [],\n  \"context\": {}\n}");
    });

    it("should restrict default config directory and file permissions on POSIX", async () => {
      if (process.platform === "win32") {
        return;
      }

      const { saveConfig, getConfigDir, getConfigPath } = await importConfigStore();

      const config: PlaneConfig = {
        profiles: [],
        context: {},
      };

      saveConfig(config);

      expect(fs.statSync(getConfigDir()).mode & 0o777).toBe(0o700);
      expect(fs.statSync(getConfigPath()).mode & 0o777).toBe(0o600);
    });
  });

  describe("getActiveAccount", () => {
    it("should return undefined when no active profile", async () => {
      const { getActiveAccount } = await importConfigStore();
      
      const config: PlaneConfig = {
        profiles: [{ name: "test", baseUrl: "https://test.com", token: "token", apiStyle: "issues" }],
        context: {},
      };
      
      const account = getActiveAccount(config);
      expect(account).toBeUndefined();
    });

    it("should return undefined when active profile does not exist", async () => {
      const { getActiveAccount } = await importConfigStore();
      
      const config: PlaneConfig = {
        profiles: [{ name: "test", baseUrl: "https://test.com", token: "token", apiStyle: "issues" }],
        context: { activeProfile: "nonexistent" },
      };
      
      const account = getActiveAccount(config);
      expect(account).toBeUndefined();
    });

    it("should return active account when found", async () => {
      const { getActiveAccount } = await importConfigStore();
      
      const testAccount: PlaneAccount = {
        name: "active",
        baseUrl: "https://active.com",
        token: "active-token",
        apiStyle: "issues",
      };
      
      const config: PlaneConfig = {
        profiles: [
          { name: "other", baseUrl: "https://other.com", token: "other", apiStyle: "issues" },
          testAccount,
        ],
        context: { activeProfile: "active" },
      };
      
      const account = getActiveAccount(config);
      expect(account).toEqual(testAccount);
    });
  });

  describe("requireActiveWorkspace", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
      delete process.env.PLANE_WORKSPACE;
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("should return workspace from config when env var not set", async () => {
      const { requireActiveWorkspace } = await importConfigStore();
      
      const config: PlaneConfig = {
        profiles: [],
        context: { activeWorkspace: "my-workspace" },
      };
      
      const workspace = requireActiveWorkspace(config);
      expect(workspace).toBe("my-workspace");
    });

    it("should return workspace from env var when set", async () => {
      process.env.PLANE_WORKSPACE = "env-workspace";
      const { requireActiveWorkspace } = await importConfigStore();
      
      const config: PlaneConfig = {
        profiles: [],
        context: { activeWorkspace: "config-workspace" },
      };
      
      const workspace = requireActiveWorkspace(config);
      expect(workspace).toBe("env-workspace");
    });
  });

  describe("requireActiveProject", () => {
    it("should return project id and identifier", async () => {
      const { requireActiveProject } = await importConfigStore();
      
      const config: PlaneConfig = {
        profiles: [],
        context: { 
          activeProject: "project-123",
          activeProjectIdentifier: "PROJ",
        },
      };
      
      const project = requireActiveProject(config);
      expect(project).toEqual({ id: "project-123", identifier: "PROJ" });
    });

    it("should return empty identifier when not set", async () => {
      const { requireActiveProject } = await importConfigStore();
      
      const config: PlaneConfig = {
        profiles: [],
        context: { activeProject: "project-123" },
      };
      
      const project = requireActiveProject(config);
      expect(project).toEqual({ id: "project-123", identifier: "" });
    });
  });

  describe("createClient", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
      delete process.env.PLANE_BASE_URL;
      delete process.env.PLANE_API_TOKEN;
      delete process.env.PLANE_API_STYLE;
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("should create client from env vars when both are set", async () => {
      process.env.PLANE_BASE_URL = "https://env.example.com";
      process.env.PLANE_API_TOKEN = "env-token";
      process.env.PLANE_API_STYLE = "work-items";
      
      const { createClient } = await importConfigStore();
      
      const config: PlaneConfig = { profiles: [], context: {} };
      const client = createClient(config);
      
      expect(client.baseUrl).toBe("https://env.example.com");
      expect(client.token).toBe("env-token");
      expect(client.issuesSegment()).toBe("work-items");
    });

    it("should create client from account with env var overrides", async () => {
      process.env.PLANE_BASE_URL = "https://override.com";
      
      const { createClient } = await importConfigStore();
      
      const config: PlaneConfig = {
        profiles: [
          {
            name: "test",
            baseUrl: "https://config.com",
            token: "config-token",
            apiStyle: "issues",
          },
        ],
        context: { activeProfile: "test" },
      };
      
      const client = createClient(config);
      
      expect(client.baseUrl).toBe("https://override.com");
      expect(client.token).toBe("config-token");
    });
  });
});
