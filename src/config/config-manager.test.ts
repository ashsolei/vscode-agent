import { describe, it, expect, beforeEach, vi } from 'vitest';
import { workspace, Uri, EventEmitter } from '../__mocks__/vscode';
import { ConfigManager, AgentConfig } from './config-manager';

describe('ConfigManager', () => {
  let configManager: ConfigManager;

  beforeEach(() => {
    vi.clearAllMocks();
    // Setup workspace
    (workspace as any).workspaceFolders = [
      { uri: Uri.file('/workspace'), name: 'test-ws', index: 0 },
    ];
    // Default: no config file (throw on read)
    (workspace.fs.readFile as any).mockRejectedValue(new Error('not found'));
    configManager = new ConfigManager();
  });

  it('should return empty config when no .agentrc.json exists', () => {
    const config = configManager.current;
    expect(config).toEqual({});
  });

  it('should return a copy of config (not mutable reference)', () => {
    const config1 = configManager.current;
    const config2 = configManager.current;
    expect(config1).toEqual(config2);
    expect(config1).not.toBe(config2);
  });

  it('should return undefined prompt for unknown agent', () => {
    expect(configManager.getPrompt('unknown')).toBeUndefined();
  });

  it('should check if an agent is disabled', () => {
    expect(configManager.isDisabled('code')).toBe(false);
  });

  it('should get specific config values', () => {
    expect(configManager.get('defaultAgent')).toBeUndefined();
    expect(configManager.get('autoRouter')).toBeUndefined();
  });

  it('should setup a file watcher for .agentrc.json', () => {
    expect(workspace.createFileSystemWatcher).toHaveBeenCalledWith(
      expect.stringContaining('.agentrc.json')
    );
  });

  it('should dispose watcher and event emitter on dispose', () => {
    configManager.dispose();
    // No error should be thrown
  });

  describe('createDefault', () => {
    it('should create a default .agentrc.json file', async () => {
      await configManager.createDefault();
      expect(workspace.fs.writeFile).toHaveBeenCalled();
    });

    it('should not create when no workspace is open', async () => {
      (workspace as any).workspaceFolders = undefined;
      await configManager.createDefault();
      expect(workspace.fs.writeFile).not.toHaveBeenCalled();
    });

    it('should set default config values after creation', async () => {
      await configManager.createDefault();
      const config = configManager.current;
      expect(config.defaultAgent).toBe('code');
      expect(config.language).toBe('sv');
      expect(config.autoRouter).toBe(true);
    });
  });
});
