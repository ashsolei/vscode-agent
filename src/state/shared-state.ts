import * as vscode from 'vscode';
import * as crypto from 'crypto';

/**
 * SharedState — tillståndshantering som delas mellan VS Code-fönster.
 *
 * Använder `globalState` (Memento) för att persistera tillstånd som
 * synkroniseras mellan alla VS Code-instanser via Settings Sync.
 * Stöder även realtidsnotifiering via en FileSystemWatcher på en
 * gemensam fil för snabb synkronisering inom samma maskin.
 */
export class SharedState {
  /** Unikt ID för detta fönster */
  public readonly windowId: string;

  private _onDidChange = new vscode.EventEmitter<{ key: string; value: unknown }>();
  /** Event som triggas när tillståndet ändras */
  public readonly onDidChange = this._onDidChange.event;

  private localCache = new Map<string, unknown>();
  private syncFile: vscode.Uri | undefined;
  private watcher: vscode.FileSystemWatcher | undefined;
  private disposables: vscode.Disposable[] = [];

  constructor(
    private globalState: vscode.Memento,
    private storageUri: vscode.Uri | undefined
  ) {
    this.windowId = crypto.randomUUID().slice(0, 8);

    // Ladda befintligt tillstånd
    this.loadFromGlobalState();

    // Sätt upp kors-fönster-synkronisering via filsystemet
    this.setupCrossWindowSync();
  }

  /**
   * Spara ett värde i delat tillstånd.
   */
  set<T>(key: string, value: T): void {
    this.localCache.set(key, value);
    this.persistToGlobalState();
    this.notifyOtherWindows(key);
    this._onDidChange.fire({ key, value });
  }

  /**
   * Hämta ett värde från delat tillstånd.
   */
  get<T>(key: string): T | undefined {
    return this.localCache.get(key) as T | undefined;
  }

  /**
   * Hämta allt delat tillstånd.
   */
  getAll(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of this.localCache) {
      result[key] = value;
    }
    return result;
  }

  /**
   * Ta bort ett värde.
   */
  delete(key: string): void {
    this.localCache.delete(key);
    this.persistToGlobalState();
    this.notifyOtherWindows(key);
    this._onDidChange.fire({ key, value: undefined });
  }

  /**
   * Rensa allt tillstånd.
   */
  clear(): void {
    const keys = Array.from(this.localCache.keys());
    this.localCache.clear();
    this.persistToGlobalState();

    for (const key of keys) {
      this._onDidChange.fire({ key, value: undefined });
    }
  }

  /**
   * Ladda tillstånd från globalState (Memento).
   */
  private loadFromGlobalState(): void {
    const stored = this.globalState.get<Record<string, unknown>>('sharedAgentState');
    if (stored) {
      for (const [key, value] of Object.entries(stored)) {
        this.localCache.set(key, value);
      }
    }
  }

  /**
   * Persistera tillstånd till globalState.
   */
  private persistToGlobalState(): void {
    const data: Record<string, unknown> = {};
    for (const [key, value] of this.localCache) {
      data[key] = value;
    }
    this.globalState.update('sharedAgentState', data);
  }

  /**
   * Sätt upp kors-fönster-synk via en gemensam fil.
   * När ett fönster ändrar tillståndet skrivs en marker-fil som
   * andra fönster lyssnar på.
   */
  private setupCrossWindowSync(): void {
    if (!this.storageUri) {
      return;
    }

    this.syncFile = vscode.Uri.joinPath(this.storageUri, '.agent-sync');

    // Lyssna på ändringar i sync-filen
    this.watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(this.storageUri, '.agent-sync')
    );

    this.watcher.onDidChange(async () => {
      await this.reloadFromSyncFile();
    });

    this.watcher.onDidCreate(async () => {
      await this.reloadFromSyncFile();
    });

    this.disposables.push(this.watcher);
  }

  /**
   * Skriv en marker-fil så att andra fönster märker ändringen.
   */
  private async notifyOtherWindows(changedKey: string): Promise<void> {
    if (!this.syncFile) {
      return;
    }

    try {
      const syncData = JSON.stringify({
        windowId: this.windowId,
        changedKey,
        timestamp: Date.now(),
        state: this.getAll(),
      });

      await vscode.workspace.fs.writeFile(
        this.syncFile,
        new TextEncoder().encode(syncData)
      );
    } catch {
      // Ignorera skrivfel — synk är best-effort
    }
  }

  /**
   * Ladda om tillstånd från sync-filen (skriven av annat fönster).
   */
  private async reloadFromSyncFile(): Promise<void> {
    if (!this.syncFile) {
      return;
    }

    try {
      const data = await vscode.workspace.fs.readFile(this.syncFile);
      const parsed = JSON.parse(new TextDecoder().decode(data));

      // Ignorera egna ändringar
      if (parsed.windowId === this.windowId) {
        return;
      }

      // Uppdatera lokal cache med data från annat fönster
      if (parsed.state && typeof parsed.state === 'object') {
        for (const [key, value] of Object.entries(parsed.state)) {
          this.localCache.set(key, value);
          this._onDidChange.fire({ key, value });
        }
        this.persistToGlobalState();
      }
    } catch {
      // Ignorera läsfel
    }
  }

  dispose(): void {
    this._onDidChange.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
