import * as vscode from 'vscode';

/**
 * Profilkonfiguration — vilka agenter, modeller och guardrails som ska vara aktiva.
 */
export interface AgentProfile {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** Agenter som ska prioriteras / vara tillgängliga */
  agents: string[];
  /** Modell-override per agent-kategori */
  models?: Record<string, string>;
  /** Guard-rail-nivå: strict, normal, relaxed */
  guardLevel?: 'strict' | 'normal' | 'relaxed';
  /** Aktiva middleware */
  middleware?: string[];
  /** Anpassade inställningar */
  settings?: Record<string, unknown>;
  /** Om profilen är den aktiva */
  active?: boolean;
}

const BUILTIN_PROFILES: AgentProfile[] = [
  {
    id: 'frontend',
    name: 'Frontend Mode',
    icon: '🎨',
    description: 'Fokuserar på UI, komponenter, styling och tillgänglighet',
    agents: ['code', 'component', 'a11y', 'review', 'test', 'explain', 'refactor'],
    guardLevel: 'normal',
    settings: { preferredLanguages: ['typescript', 'typescriptreact', 'css', 'html'] },
  },
  {
    id: 'backend',
    name: 'Backend Mode',
    icon: '⚙️',
    description: 'Fokuserar på API, databas, prestanda och säkerhet',
    agents: ['code', 'api', 'db', 'security', 'perf', 'devops', 'test'],
    guardLevel: 'strict',
    settings: { preferredLanguages: ['typescript', 'python', 'go', 'sql'] },
  },
  {
    id: 'review',
    name: 'Review Mode',
    icon: '🔍',
    description: 'Granskning, statisk analys, säkerhet och kvalitetsmetriker',
    agents: ['review', 'security', 'perf', 'a11y', 'metrics', 'test'],
    guardLevel: 'strict',
  },
  {
    id: 'fullstack',
    name: 'Fullstack Mode',
    icon: '🚀',
    description: 'Alla agenter tillgängliga — maximalt autonoma',
    agents: ['fullstack', 'scaffold', 'autofix', 'devops', 'db', 'component', 'plan'],
    guardLevel: 'normal',
  },
  {
    id: 'learning',
    name: 'Learning Mode',
    icon: '📚',
    description: 'Fokus på förklaringar, pedagogik och dokumentation',
    agents: ['explain', 'docs', 'docgen', 'architect', 'translate'],
    guardLevel: 'relaxed',
    settings: { verboseExplanations: true },
  },
  {
    id: 'devops',
    name: 'DevOps Mode',
    icon: '🐳',
    description: 'CI/CD, Docker, Kubernetes, infrastruktur',
    agents: ['devops', 'cli', 'git', 'db', 'migrate', 'security'],
    guardLevel: 'strict',
  },
];

const PROFILES_KEY = 'agent.profiles';
const ACTIVE_PROFILE_KEY = 'agent.activeProfile';

export class AgentProfileManager implements vscode.Disposable {
  private profiles: Map<string, AgentProfile> = new Map();
  private activeProfileId: string | undefined;
  private statusBarItem: vscode.StatusBarItem;
  private readonly _onDidChange = new vscode.EventEmitter<AgentProfile | undefined>();
  public readonly onDidChange = this._onDidChange.event;

  constructor(private readonly globalState: vscode.Memento) {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      98
    );
    this.statusBarItem.command = 'vscode-agent.switchProfile';
    this.load();
    this.updateStatusBar();
  }

  /** Ladda profiler från state + inbyggda */
  private load(): void {
    // Inbyggda
    for (const p of BUILTIN_PROFILES) {
      this.profiles.set(p.id, { ...p });
    }
    // Anpassade från persistent state
    const custom = this.globalState.get<AgentProfile[]>(PROFILES_KEY, []);
    for (const p of custom) {
      this.profiles.set(p.id, p);
    }
    // Aktiv profil
    this.activeProfileId = this.globalState.get<string>(ACTIVE_PROFILE_KEY);
  }

  /** Spara anpassade profiler */
  private async save(): Promise<void> {
    const custom = [...this.profiles.values()].filter(
      (p) => !BUILTIN_PROFILES.some((b) => b.id === p.id)
    );
    await this.globalState.update(PROFILES_KEY, custom);
    await this.globalState.update(ACTIVE_PROFILE_KEY, this.activeProfileId);
  }

  /** Hämta aktiv profil */
  get active(): AgentProfile | undefined {
    return this.activeProfileId ? this.profiles.get(this.activeProfileId) : undefined;
  }

  /** Lista alla profiler */
  list(): AgentProfile[] {
    return [...this.profiles.values()].map((p) => ({
      ...p,
      active: p.id === this.activeProfileId,
    }));
  }

  /** Aktivera en profil */
  async activate(id: string): Promise<boolean> {
    if (!this.profiles.has(id)) {
      return false;
    }
    this.activeProfileId = id;
    await this.save();
    this.updateStatusBar();
    this._onDidChange.fire(this.active);
    vscode.window.showInformationMessage(
      `Profil aktiverad: ${this.active?.icon} ${this.active?.name}`
    );
    return true;
  }

  /** Avaktivera profil */
  async deactivate(): Promise<void> {
    this.activeProfileId = undefined;
    await this.save();
    this.updateStatusBar();
    this._onDidChange.fire(undefined);
  }

  /** Skapa ny profil */
  async create(profile: Omit<AgentProfile, 'active'>): Promise<AgentProfile> {
    this.profiles.set(profile.id, profile);
    await this.save();
    return profile;
  }

  /** Ta bort en anpassad profil */
  async remove(id: string): Promise<boolean> {
    if (BUILTIN_PROFILES.some((b) => b.id === id)) {
      vscode.window.showWarningMessage('Inbyggda profiler kan inte tas bort.');
      return false;
    }
    const deleted = this.profiles.delete(id);
    if (this.activeProfileId === id) {
      this.activeProfileId = undefined;
    }
    await this.save();
    this.updateStatusBar();
    this._onDidChange.fire(undefined);
    return deleted;
  }

  /** Duplicera en profil */
  async duplicate(sourceId: string, newId: string, newName: string): Promise<AgentProfile | undefined> {
    const source = this.profiles.get(sourceId);
    if (!source) { return undefined; }
    const copy: AgentProfile = {
      ...JSON.parse(JSON.stringify(source)),
      id: newId,
      name: newName,
    };
    return this.create(copy);
  }

  /** QuickPick: byt profil */
  async showPicker(): Promise<void> {
    const items: (vscode.QuickPickItem & { profileId?: string; action?: string })[] = [
      ...this.list().map((p) => ({
        label: `${p.active ? '✅ ' : ''}${p.icon} ${p.name}`,
        description: p.description,
        detail: `Agenter: ${p.agents.join(', ')} | Guard: ${p.guardLevel ?? 'normal'}`,
        profileId: p.id,
      })),
      { label: '', kind: vscode.QuickPickItemKind.Separator },
      { label: '$(add) Skapa ny profil...', action: 'create' },
      { label: '$(close) Avaktivera profil', action: 'deactivate' },
    ];

    const pick = await vscode.window.showQuickPick(items, {
      title: 'Välj agentprofil',
      placeHolder: 'Sök profil...',
    });

    if (!pick) { return; }

    if (pick.action === 'deactivate') {
      await this.deactivate();
    } else if (pick.action === 'create') {
      await this.showCreateWizard();
    } else if (pick.profileId) {
      await this.activate(pick.profileId);
    }
  }

  /** Wizard: skapa profil interaktivt */
  async showCreateWizard(): Promise<void> {
    const id = await vscode.window.showInputBox({
      prompt: 'Profil-ID (slug)',
      placeHolder: 'my-profile',
      validateInput: (v) => /^[a-z0-9-]+$/.test(v) ? null : 'Använd a-z, 0-9, bindestreck',
    });
    if (!id) { return; }

    const name = await vscode.window.showInputBox({
      prompt: 'Profilnamn',
      placeHolder: 'My Custom Profile',
    });
    if (!name) { return; }

    const icon = await vscode.window.showInputBox({
      prompt: 'Emoji-ikon',
      placeHolder: '🛠️',
      value: '🛠️',
    });

    const allAgents = [
      'code', 'docs', 'task', 'status', 'refactor', 'review', 'test', 'debug',
      'security', 'perf', 'architect', 'api', 'translate', 'deps', 'explain', 'git',
      'scaffold', 'autofix', 'devops', 'db', 'migrate', 'component', 'i18n', 'plan',
      'a11y', 'docgen', 'metrics', 'cli', 'fullstack', 'testrunner', 'create-agent',
    ];

    const selected = await vscode.window.showQuickPick(
      allAgents.map((a) => ({ label: a, picked: false })),
      { canPickMany: true, title: 'Välj agenter för profilen' }
    );
    if (!selected || selected.length === 0) { return; }

    const guardLevel = await vscode.window.showQuickPick(
      ['normal', 'strict', 'relaxed'],
      { title: 'Guard-rail-nivå' }
    ) as 'strict' | 'normal' | 'relaxed' | undefined;

    const profile = await this.create({
      id,
      name,
      icon: icon || '🛠️',
      description: `Custom profile: ${name}`,
      agents: selected.map((s) => s.label),
      guardLevel: guardLevel ?? 'normal',
    });

    await this.activate(profile.id);
  }

  /** Exportera profil till JSON */
  async exportProfile(id: string): Promise<void> {
    const profile = this.profiles.get(id);
    if (!profile) { return; }
    const json = JSON.stringify(profile, null, 2);
    const doc = await vscode.workspace.openTextDocument({ content: json, language: 'json' });
    await vscode.window.showTextDocument(doc);
  }

  /** Importera profil från JSON */
  async importProfile(): Promise<void> {
    const uris = await vscode.window.showOpenDialog({
      filters: { 'JSON': ['json'] },
      canSelectMany: false,
    });
    if (!uris || uris.length === 0) { return; }

    const content = await vscode.workspace.fs.readFile(uris[0]);
    try {
      const profile = JSON.parse(Buffer.from(content).toString('utf-8')) as AgentProfile;
      if (!profile.id || !profile.name || !profile.agents) {
        throw new Error('Ogiltigt profilformat');
      }
      await this.create(profile);
      vscode.window.showInformationMessage(`Profil importerad: ${profile.icon} ${profile.name}`);
    } catch {
      vscode.window.showErrorMessage('Kunde inte importera profilen — ogiltigt JSON-format.');
    }
  }

  private updateStatusBar(): void {
    const p = this.active;
    if (p) {
      this.statusBarItem.text = `${p.icon} ${p.name}`;
      this.statusBarItem.tooltip = `Aktiv profil: ${p.name}\nAgenter: ${p.agents.join(', ')}`;
    } else {
      this.statusBarItem.text = '$(gear) Ingen profil';
      this.statusBarItem.tooltip = 'Klicka för att välja agentprofil';
    }
    this.statusBarItem.show();
  }

  dispose(): void {
    this.statusBarItem.dispose();
    this._onDidChange.dispose();
  }
}
