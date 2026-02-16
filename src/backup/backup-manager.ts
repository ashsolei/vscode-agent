import * as vscode from 'vscode';

// ─── Types ──────────────────────────────────────────────────────

/**
 * Namn på moduler som kan säkerhetskopieras.
 */
export type BackupModuleName =
  | 'memory'
  | 'snippets'
  | 'conversations'
  | 'telemetry'
  | 'profiles'
  | 'history'
  | 'templates'
  | 'marketplace';

/**
 * Metadata för en enskild backup.
 */
export interface BackupMetadata {
  id: string;
  label: string;
  createdAt: number;
  modules: BackupModuleName[];
  sizeBytes: number;
  version: number;
  auto: boolean;
}

/**
 * Fullständigt backup-paket.
 */
export interface BackupBundle {
  meta: BackupMetadata;
  data: Partial<Record<BackupModuleName, unknown>>;
}

/**
 * Konfiguration för BackupManager.
 */
export interface BackupConfig {
  /** Max antal sparade backups (standard: 20) */
  maxBackups: number;
  /** Aktivera auto-backup vid dispose (standard: true) */
  autoBackupOnDispose: boolean;
  /** Standard-label för auto-backup */
  autoBackupLabel: string;
}

// ─── Storage key mapping ────────────────────────────────────────

const MODULE_KEYS: Record<BackupModuleName, string[]> = {
  memory: ['agentMemories'],
  snippets: ['agent-snippets'],
  conversations: ['agent.conversations', 'agent.currentConversation'],
  telemetry: ['agent.telemetry'],
  profiles: ['agent.profiles', 'agent.activeProfile'],
  history: ['agent.commandHistory'],
  templates: ['agent.promptTemplates'],
  marketplace: [
    'agent.marketplace.installed',
    'agent.marketplace.ratings',
    'agent.marketplace.community',
  ],
};

const ALL_MODULES: BackupModuleName[] = Object.keys(MODULE_KEYS) as BackupModuleName[];

const BACKUPS_KEY = 'agent.backups';
const BUNDLE_PREFIX = 'agent.backup.bundle.';
const CURRENT_VERSION = 1;

// ─── BackupManager ──────────────────────────────────────────────

/**
 * BackupManager — centraliserad backup och återställning av all
 * persistent agent-data.
 *
 * Funktioner:
 * - Skapa namngivna backups av valfria moduler (eller alla)
 * - Återställ selektivt via QuickPick
 * - Lista och ta bort backups
 * - Auto-backup vid dispose
 * - Storleksbegränsning (äldsta automatiska rensas)
 * - Export/Import av backup-filer
 */
export class BackupManager implements vscode.Disposable {
  private readonly config: BackupConfig;

  constructor(
    private readonly globalState: vscode.Memento,
    config?: Partial<BackupConfig>,
  ) {
    this.config = {
      maxBackups: config?.maxBackups ?? 20,
      autoBackupOnDispose: config?.autoBackupOnDispose ?? true,
      autoBackupLabel: config?.autoBackupLabel ?? 'auto-dispose',
    };
  }

  // ─── Create ───────────────────────────────────────────────────

  /**
   * Skapa en backup.
   * @param label  Etikett (t.ex. "före refaktorering")
   * @param modules  Vilka moduler (standard: alla)
   * @param auto  Markera som automatisk backup
   * @returns Backup-id
   */
  async createBackup(
    label: string,
    modules: BackupModuleName[] = ALL_MODULES,
    auto = false,
  ): Promise<string> {
    const id = `bak-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const data: Partial<Record<BackupModuleName, unknown>> = {};

    for (const mod of modules) {
      const keys = MODULE_KEYS[mod];
      if (keys.length === 1) {
        data[mod] = this.globalState.get(keys[0]);
      } else {
        // Spara som object med alla nycklar
        const obj: Record<string, unknown> = {};
        for (const key of keys) {
          obj[key] = this.globalState.get(key);
        }
        data[mod] = obj;
      }
    }

    const json = JSON.stringify(data);

    const bundle: BackupBundle = {
      meta: {
        id,
        label,
        createdAt: Date.now(),
        modules,
        sizeBytes: new TextEncoder().encode(json).length,
        version: CURRENT_VERSION,
        auto,
      },
      data,
    };

    // Spara bundle separat
    await this.globalState.update(`${BUNDLE_PREFIX}${id}`, bundle);

    // Uppdatera lista
    const list = this.listMetadata();
    list.push(bundle.meta);
    await this.globalState.update(BACKUPS_KEY, list);

    // Rensa äldsta om för många
    await this.pruneOldBackups();

    return id;
  }

  // ─── Restore ──────────────────────────────────────────────────

  /**
   * Återställ en backup.
   * @param id  Backup-id
   * @param modules  Vilka moduler att återställa (standard: alla i backupen)
   */
  async restoreBackup(
    id: string,
    modules?: BackupModuleName[],
  ): Promise<boolean> {
    const bundle = this.getBundle(id);
    if (!bundle) {
      return false;
    }

    const toRestore = modules ?? bundle.meta.modules;

    for (const mod of toRestore) {
      const snapshot = bundle.data[mod];
      if (snapshot === undefined) {
        continue;
      }

      const keys = MODULE_KEYS[mod];
      if (keys.length === 1) {
        await this.globalState.update(keys[0], snapshot);
      } else {
        // Snapshot är ett object med nycklarna
        const obj = snapshot as Record<string, unknown>;
        for (const key of keys) {
          await this.globalState.update(key, obj[key]);
        }
      }
    }

    return true;
  }

  // ─── List / Get ───────────────────────────────────────────────

  /**
   * Lista alla backup-metadata (senaste först).
   */
  listMetadata(): BackupMetadata[] {
    return this.globalState.get<BackupMetadata[]>(BACKUPS_KEY, []);
  }

  /**
   * Hämta full backup-bundle.
   */
  getBundle(id: string): BackupBundle | undefined {
    return this.globalState.get<BackupBundle>(`${BUNDLE_PREFIX}${id}`);
  }

  // ─── Delete ───────────────────────────────────────────────────

  /**
   * Ta bort en backup.
   */
  async deleteBackup(id: string): Promise<boolean> {
    const list = this.listMetadata();
    const idx = list.findIndex((b) => b.id === id);
    if (idx === -1) {
      return false;
    }
    list.splice(idx, 1);
    await this.globalState.update(BACKUPS_KEY, list);
    await this.globalState.update(`${BUNDLE_PREFIX}${id}`, undefined);
    return true;
  }

  /**
   * Ta bort alla backups.
   */
  async deleteAll(): Promise<number> {
    const list = this.listMetadata();
    const count = list.length;
    for (const meta of list) {
      await this.globalState.update(`${BUNDLE_PREFIX}${meta.id}`, undefined);
    }
    await this.globalState.update(BACKUPS_KEY, []);
    return count;
  }

  // ─── Prune ────────────────────────────────────────────────────

  /**
   * Rensa äldsta auto-backups om antalet överstiger maxBackups.
   */
  private async pruneOldBackups(): Promise<void> {
    const list = this.listMetadata();
    if (list.length <= this.config.maxBackups) {
      return;
    }

    // Sortera äldst först, ta bara bort auto-backups
    const sorted = [...list].sort((a, b) => a.createdAt - b.createdAt);
    let toRemove = list.length - this.config.maxBackups;
    const idsToRemove: string[] = [];

    for (const meta of sorted) {
      if (toRemove <= 0) { break; }
      if (meta.auto) {
        idsToRemove.push(meta.id);
        toRemove--;
      }
    }

    for (const id of idsToRemove) {
      await this.globalState.update(`${BUNDLE_PREFIX}${id}`, undefined);
    }

    const remaining = list.filter((m) => !idsToRemove.includes(m.id));
    await this.globalState.update(BACKUPS_KEY, remaining);
  }

  // ─── Export / Import ──────────────────────────────────────────

  /**
   * Exportera en backup som JSON-sträng.
   */
  exportBackup(id: string): string | undefined {
    const bundle = this.getBundle(id);
    if (!bundle) {
      return undefined;
    }
    return JSON.stringify(bundle, null, 2);
  }

  /**
   * Importera en backup från JSON-sträng.
   * @returns backup-id om lyckad, undefined vid fel
   */
  async importBackup(json: string): Promise<string | undefined> {
    try {
      const bundle = JSON.parse(json) as BackupBundle;
      if (!bundle.meta || !bundle.data) {
        return undefined;
      }

      // Generera nytt id för att undvika krock
      const newId = `bak-imp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      bundle.meta.id = newId;
      bundle.meta.label = `[Importerad] ${bundle.meta.label}`;

      await this.globalState.update(`${BUNDLE_PREFIX}${newId}`, bundle);

      const list = this.listMetadata();
      list.push(bundle.meta);
      await this.globalState.update(BACKUPS_KEY, list);

      return newId;
    } catch {
      return undefined;
    }
  }

  // ─── UI ───────────────────────────────────────────────────────

  /**
   * Visa QuickPick för att välja en backup att återställa.
   */
  async showRestorePicker(): Promise<string | undefined> {
    const list = this.listMetadata();
    if (list.length === 0) {
      vscode.window.showInformationMessage('Inga backups hittade.');
      return undefined;
    }

    const items = list
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((m) => ({
        label: `${m.auto ? '$(clock) ' : '$(archive) '}${m.label}`,
        description: new Date(m.createdAt).toLocaleString(),
        detail: `Moduler: ${m.modules.join(', ')} · ${formatBytes(m.sizeBytes)}`,
        id: m.id,
      }));

    const picked = await vscode.window.showQuickPick(items, {
      title: 'Återställ backup',
      placeHolder: 'Välj backup att återställa…',
    });

    return picked?.id;
  }

  /**
   * Visa QuickPick för att välja moduler att säkerhetskopiera.
   */
  async showModulePicker(): Promise<BackupModuleName[] | undefined> {
    const items = ALL_MODULES.map((m) => ({
      label: m,
      picked: true,
    }));

    const picked = await vscode.window.showQuickPick(items, {
      title: 'Välj moduler att säkerhetskopiera',
      canPickMany: true,
    });

    if (!picked || picked.length === 0) {
      return undefined;
    }

    return picked.map((p) => p.label as BackupModuleName);
  }

  /**
   * Visa backup-status i output.
   */
  showBackupSummary(): void {
    const list = this.listMetadata();
    const totalSize = list.reduce((sum, m) => sum + m.sizeBytes, 0);
    const autoCount = list.filter((m) => m.auto).length;
    const manualCount = list.length - autoCount;

    void vscode.window.showInformationMessage(
      `Backups: ${list.length} (${manualCount} manuella, ${autoCount} auto) · Storlek: ${formatBytes(totalSize)}`,
    );
  }

  // ─── Dispose ──────────────────────────────────────────────────

  async dispose(): Promise<void> {
    if (this.config.autoBackupOnDispose) {
      await this.createBackup(this.config.autoBackupLabel, ALL_MODULES, true);
    }
  }
}

// ─── Helpers ────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) { return `${bytes} B`; }
  if (bytes < 1024 * 1024) { return `${(bytes / 1024).toFixed(1)} KB`; }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
