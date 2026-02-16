import * as vscode from 'vscode';

// ─── Typer ───────────────────────────────────────────────────────

/** Typ av template-variabel. */
export type TemplateVariableType = 'string' | 'choice' | 'file';

/** En variabel i en prompt-template. */
export interface TemplateVariable {
  /** Variabelnamn (utan {{ }}) */
  name: string;
  /** Beskrivning visad i UI */
  description: string;
  /** Standardvärde */
  defaultValue?: string;
  /** Krävs för rendering */
  required: boolean;
  /** Variabeltyp */
  type: TemplateVariableType;
  /** Valmöjligheter (om type === 'choice') */
  choices?: string[];
}

/** En prompt-template. */
export interface PromptTemplate {
  readonly id: string;
  name: string;
  /** Template-text med {{variabel}}-platshållare */
  template: string;
  /** Deklarerade variabler */
  variables: TemplateVariable[];
  /** Begränsa till specifik agent (valfritt) */
  agentId?: string;
  /** Kategori för gruppering */
  category: string;
  /** Sökbara taggar */
  tags: string[];
  /** Skapad tidpunkt */
  createdAt: number;
  /** Uppdaterad tidpunkt */
  updatedAt: number;
}

/** Resultat av en template-rendering. */
export interface RenderResult {
  /** Renderad prompt-text */
  text: string;
  /** Vilka variabler som fylldes i */
  filledVariables: Record<string, string>;
  /** Saknade variabler (om partiell rendering) */
  missingVariables: string[];
}

// ─── Inbyggda templates ─────────────────────────────────────────

const BUILTIN_TEMPLATES: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Kodgranskning',
    template: 'Granska koden i {{fil}} med fokus på {{fokus}}. Rapportera buggar, prestanda-problem och förbättringsförslag.',
    variables: [
      { name: 'fil', description: 'Fil att granska', required: true, type: 'string' },
      { name: 'fokus', description: 'Granskningsfokus', required: false, type: 'choice', choices: ['säkerhet', 'prestanda', 'läsbarhet', 'testbarhet'], defaultValue: 'läsbarhet' },
    ],
    agentId: 'review',
    category: 'Kodkvalitet',
    tags: ['review', 'granskning'],
  },
  {
    name: 'Buggrapport',
    template: 'Det finns en bugg i {{modul}}: {{beskrivning}}. Förväntat beteende: {{förväntat}}. Faktiskt beteende: {{faktiskt}}. Fixa buggen.',
    variables: [
      { name: 'modul', description: 'Modul/fil med buggen', required: true, type: 'string' },
      { name: 'beskrivning', description: 'Kort beskrivning av buggen', required: true, type: 'string' },
      { name: 'förväntat', description: 'Förväntat beteende', required: true, type: 'string' },
      { name: 'faktiskt', description: 'Faktiskt beteende', required: true, type: 'string' },
    ],
    agentId: 'autofix',
    category: 'Felsökning',
    tags: ['bugg', 'fix'],
  },
  {
    name: 'Feature-begäran',
    template: 'Implementera {{feature}} i {{modul}}. Krav: {{krav}}. Det ska vara kompatibelt med befintlig arkitektur.',
    variables: [
      { name: 'feature', description: 'Feature-namn', required: true, type: 'string' },
      { name: 'modul', description: 'Modul/komponent', required: true, type: 'string' },
      { name: 'krav', description: 'Detaljerade krav', required: true, type: 'string' },
    ],
    category: 'Utveckling',
    tags: ['feature', 'implementera'],
  },
  {
    name: 'Refaktoreringsplan',
    template: 'Refaktorera {{modul}} för att förbättra {{mål}}. Nuvarande problem: {{problem}}. Bevara bakåtkompatibilitet.',
    variables: [
      { name: 'modul', description: 'Modul att refaktorera', required: true, type: 'string' },
      { name: 'mål', description: 'Refaktoreingsmål', required: false, type: 'choice', choices: ['läsbarhet', 'prestanda', 'testbarhet', 'modularitet'], defaultValue: 'läsbarhet' },
      { name: 'problem', description: 'Nuvarande problem', required: true, type: 'string' },
    ],
    agentId: 'refactor',
    category: 'Kodkvalitet',
    tags: ['refaktorering', 'refactor'],
  },
  {
    name: 'Testgenerering',
    template: 'Generera tester för {{fil}} med fokus på {{testtyp}}. Täck edge cases och felhantering.',
    variables: [
      { name: 'fil', description: 'Fil att testa', required: true, type: 'string' },
      { name: 'testtyp', description: 'Typ av tester', required: false, type: 'choice', choices: ['unit', 'integration', 'edge-cases', 'regression'], defaultValue: 'unit' },
    ],
    agentId: 'test',
    category: 'Testning',
    tags: ['test', 'generera'],
  },
];

// ─── PromptTemplateEngine ───────────────────────────────────────

/**
 * PromptTemplateEngine — system för att skapa, lagra och återanvända
 * parameteriserade prompt-templates med variabel-interpolering.
 *
 * Templates lagras i VS Code globalState.
 * Inbyggda templates finns alltid tillgängliga.
 */
export class PromptTemplateEngine implements vscode.Disposable {
  private static readonly STORAGE_KEY = 'agent.promptTemplates';
  private templates: Map<string, PromptTemplate> = new Map();
  private counter = 0;

  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  constructor(private readonly state: vscode.Memento) {
    this.load();
  }

  // ─── CRUD ─────────────────────────────────────────────────────

  /**
   * Registrera en ny template.
   * Returnerar genererat ID.
   */
  register(
    input: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>
  ): string {
    const id = `tmpl-${++this.counter}-${Date.now()}`;
    const template: PromptTemplate = {
      ...input,
      id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.templates.set(id, template);
    this.save();
    this._onDidChange.fire();
    return id;
  }

  /** Uppdatera en befintlig template. */
  update(
    id: string,
    changes: Partial<Omit<PromptTemplate, 'id' | 'createdAt'>>
  ): boolean {
    const existing = this.templates.get(id);
    if (!existing) { return false; }

    const updated: PromptTemplate = {
      ...existing,
      ...changes,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: Date.now(),
    };
    this.templates.set(id, updated);
    this.save();
    this._onDidChange.fire();
    return true;
  }

  /** Ta bort en template. */
  delete(id: string): boolean {
    const deleted = this.templates.delete(id);
    if (deleted) {
      this.save();
      this._onDidChange.fire();
    }
    return deleted;
  }

  /** Hämta en template via ID. */
  get(id: string): PromptTemplate | undefined {
    return this.templates.get(id);
  }

  // ─── Lista & Sök ──────────────────────────────────────────────

  /**
   * Lista alla templates.
   * Inkluderar inbyggda + användardefinierade.
   */
  list(options?: {
    category?: string;
    agentId?: string;
    tag?: string;
  }): PromptTemplate[] {
    let all = [...this.allTemplates()];

    if (options?.category) {
      all = all.filter((t) => t.category === options.category);
    }
    if (options?.agentId) {
      all = all.filter((t) => !t.agentId || t.agentId === options.agentId);
    }
    if (options?.tag) {
      all = all.filter((t) => t.tags.includes(options.tag!));
    }

    return all.sort((a, b) => a.name.localeCompare(b.name, 'sv'));
  }

  /** Sök templates efter nyckelord. */
  search(query: string): PromptTemplate[] {
    const q = query.toLowerCase();
    return [...this.allTemplates()].filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.template.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  }

  /** Alla kategorier. */
  categories(): string[] {
    const cats = new Set<string>();
    for (const t of this.allTemplates()) {
      cats.add(t.category);
    }
    return [...cats].sort();
  }

  // ─── Rendering ────────────────────────────────────────────────

  /**
   * Rendera en template med angivna värden.
   * Ersätter {{variabel}} med värden från `values`.
   * Saknade required-variabler resulterar i `missingVariables`.
   */
  render(
    templateId: string,
    values: Record<string, string>
  ): RenderResult {
    const template = this.getFromAll(templateId);
    if (!template) {
      throw new Error(`Template "${templateId}" hittades inte.`);
    }

    return this.renderTemplate(template, values);
  }

  /**
   * Rendera en rå template-sträng med värden.
   */
  renderRaw(
    templateText: string,
    variables: TemplateVariable[],
    values: Record<string, string>
  ): RenderResult {
    const template: PromptTemplate = {
      id: '__raw__',
      name: 'raw',
      template: templateText,
      variables,
      category: '',
      tags: [],
      createdAt: 0,
      updatedAt: 0,
    };
    return this.renderTemplate(template, values);
  }

  private renderTemplate(
    template: PromptTemplate,
    values: Record<string, string>
  ): RenderResult {
    const filledVariables: Record<string, string> = {};
    const missingVariables: string[] = [];
    let text = template.template;

    for (const v of template.variables) {
      const value = values[v.name] ?? v.defaultValue;
      const placeholder = `{{${v.name}}}`;

      if (value !== undefined && value !== '') {
        text = text.replaceAll(placeholder, value);
        filledVariables[v.name] = value;
      } else if (v.required) {
        missingVariables.push(v.name);
      }
    }

    // Ersätt eventuella okonfigurerade platshållare med tom sträng
    text = text.replace(/\{\{[^}]+\}\}/g, '');

    return { text: text.trim(), filledVariables, missingVariables };
  }

  /** Extrahera variabelnamn från en template-sträng. */
  static extractVariables(templateText: string): string[] {
    const matches = templateText.matchAll(/\{\{(\w+)\}\}/g);
    const names = new Set<string>();
    for (const m of matches) {
      names.add(m[1]);
    }
    return [...names];
  }

  // ─── UI (QuickPick) ──────────────────────────────────────────

  /**
   * Visa template-väljare i QuickPick.
   * Returnerar vald template-id eller undefined.
   */
  async pick(options?: {
    agentId?: string;
    category?: string;
  }): Promise<string | undefined> {
    const templates = this.list(options);
    if (templates.length === 0) {
      vscode.window.showInformationMessage('Inga templates tillgängliga.');
      return undefined;
    }

    const items: vscode.QuickPickItem[] = templates.map((t) => ({
      label: t.name,
      description: t.category,
      detail: t.template.substring(0, 100),
    }));

    const selection = await vscode.window.showQuickPick(items, {
      title: 'Välj Prompt Template',
      placeHolder: 'Sök eller välj template...',
    });

    if (!selection) { return undefined; }

    const found = templates.find((t) => t.name === selection.label);
    return found?.id;
  }

  /**
   * Interaktiv template-användning: välj template, fyll i variabler, returnera renderad text.
   */
  async pickAndRender(options?: {
    agentId?: string;
  }): Promise<{ templateId: string; rendered: RenderResult } | undefined> {
    const templateId = await this.pick(options);
    if (!templateId) { return undefined; }

    const template = this.getFromAll(templateId);
    if (!template) { return undefined; }

    // Samla in variabelvärden via input-boxar
    const values: Record<string, string> = {};
    for (const v of template.variables) {
      if (v.type === 'choice' && v.choices && v.choices.length > 0) {
        const choice = await vscode.window.showQuickPick(v.choices, {
          title: v.description,
          placeHolder: v.defaultValue ?? `Välj ${v.name}`,
        });
        if (choice) {
          values[v.name] = choice;
        } else if (v.defaultValue) {
          values[v.name] = v.defaultValue;
        }
      } else {
        const input = await vscode.window.showInputBox({
          title: v.description,
          prompt: `Ange ${v.name}`,
          value: v.defaultValue ?? '',
        });
        if (input !== undefined) {
          values[v.name] = input;
        }
      }
    }

    const rendered = this.render(templateId, values);
    return { templateId, rendered };
  }

  // ─── Export / Import ──────────────────────────────────────────

  /** Exportera alla användardefinierade templates som JSON. */
  export(): string {
    const userTemplates = [...this.templates.values()];
    return JSON.stringify(userTemplates, null, 2);
  }

  /** Importera templates från JSON (slår samman med befintliga). */
  import(json: string): number {
    const imported: PromptTemplate[] = JSON.parse(json);
    let count = 0;
    for (const t of imported) {
      if (!this.templates.has(t.id)) {
        this.templates.set(t.id, t);
        count++;
      }
    }
    if (count > 0) {
      this.save();
      this._onDidChange.fire();
    }
    return count;
  }

  // ─── Interna hjälpmetoder ─────────────────────────────────────

  /** Alla templates (inbyggda + användardefinierade). */
  private *allTemplates(): Generator<PromptTemplate> {
    // Inbyggda
    for (let i = 0; i < BUILTIN_TEMPLATES.length; i++) {
      yield {
        ...BUILTIN_TEMPLATES[i],
        id: `builtin-${i}`,
        createdAt: 0,
        updatedAt: 0,
      };
    }
    // Användardefinierade
    for (const t of this.templates.values()) {
      yield t;
    }
  }

  private getFromAll(id: string): PromptTemplate | undefined {
    // Användardefinierade först
    const user = this.templates.get(id);
    if (user) { return user; }

    // Inbyggda
    if (id.startsWith('builtin-')) {
      const idx = parseInt(id.replace('builtin-', ''), 10);
      if (idx >= 0 && idx < BUILTIN_TEMPLATES.length) {
        return {
          ...BUILTIN_TEMPLATES[idx],
          id,
          createdAt: 0,
          updatedAt: 0,
        };
      }
    }
    return undefined;
  }

  private load(): void {
    const data = this.state.get<PromptTemplate[]>(PromptTemplateEngine.STORAGE_KEY, []);
    this.templates.clear();
    for (const t of data) {
      this.templates.set(t.id, t);
    }
    // Uppdatera counter
    for (const t of this.templates.values()) {
      const match = t.id.match(/^tmpl-(\d+)-/);
      if (match) {
        this.counter = Math.max(this.counter, parseInt(match[1], 10));
      }
    }
  }

  private save(): void {
    const data = [...this.templates.values()];
    this.state.update(PromptTemplateEngine.STORAGE_KEY, data);
  }

  dispose(): void {
    this._onDidChange.dispose();
  }
}
