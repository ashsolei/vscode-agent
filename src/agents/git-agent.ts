import * as vscode from 'vscode';
import { BaseAgent, AgentContext, AgentResult } from './base-agent';

const PROMPT = `Du är en expert på Git och versionshantering. Du hjälper med:
- Skapa bra commit-meddelanden (Conventional Commits)
- Git-strategier: trunk-based, GitFlow, GitHub Flow
- Lösa merge-konflikter
- Interaktiv rebase, cherry-pick, bisect
- Branch-strategier och namnkonventioner  
- Git hooks och automatisering
- .gitignore-konfiguration
- Rensa historik (filter-branch, BFG)
- Arbetsdagliga git-kommandon och arbetsflöden

Ge alltid konkreta git-kommandon. Förklara vad varje steg gör.
Svara på samma språk som användaren.`;

/**
 * GitAgent — specialiserad agent för Git-operationer och versionshantering.
 */
export class GitAgent extends BaseAgent {
  constructor() {
    super('git', 'Gitagent', 'Git-operationer och versionshantering');
  }

  async handle(ctx: AgentContext): Promise<AgentResult> {
    this.progress(ctx, 'Analyserar git-fråga...');

    let additionalContext = '';

    // Visa git-information om det finns en arbetsyta
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders) {
      additionalContext += `\nArbetsyta: ${workspaceFolders[0].name}`;
    }

    // Kolla om det finns .gitignore
    const gitignoreFiles = await vscode.workspace.findFiles('.gitignore', undefined, 1);
    if (gitignoreFiles.length > 0) {
      additionalContext += '\n.gitignore finns i projektet.';
    }

    const prompt = additionalContext
      ? `${PROMPT}\n\nProjektkontext:${additionalContext}`
      : PROMPT;

    await this.chat(ctx, prompt);

    return {
      followUps: [
        { prompt: 'Skriv ett bra commit-meddelande för mina ändringar', label: 'Commit msg', command: 'git' },
        { prompt: 'Förklara hur jag löser en merge-konflikt', label: 'Merge', command: 'git' },
        { prompt: 'Vilken branch-strategi bör jag använda?', label: 'Branch-strategi', command: 'git' },
      ],
    };
  }
}
