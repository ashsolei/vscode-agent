import * as vscode from 'vscode';
import { BaseAgent, AgentContext, AgentResult } from './base-agent';
import { ToolRegistry } from '../tools';

const PROMPT = `Du är en expert på kodsäkerhet och säkerhetsgranskningar. Du hjälper med:
- Identifiera säkerhetssårbarheter (OWASP Top 10)
- SQL-injection, XSS, CSRF och andra injektionsattacker
- Autentisering och auktorisering (JWT, OAuth, RBAC)
- Säker hantering av hemligheter och API-nycklar
- Input-validering och sanitering
- Kryptografi — hashning, kryptering, certifikat
- Säker konfiguration av servrar och ramverk
- Dependency-sårbarheter (CVE-scanning)
- CORS-policyer och Content Security Policy
- Säker filhantering och uppladdning

Varna tydligt för allvarliga sårbarheter med 🔴 (kritisk), 🟡 (varning), 🟢 (info).
Ge alltid konkreta fixförslag. Svara på samma språk som användaren.`;

/**
 * SecurityAgent — specialiserad agent för säkerhetsanalys.
 */
export class SecurityAgent extends BaseAgent {
  constructor(private tools: ToolRegistry) {
    super('security', 'Säkerhetsagent', 'Säkerhetsgranskning och sårbarhetsskanning');
  }

  async handle(ctx: AgentContext): Promise<AgentResult> {
    this.progress(ctx, 'Granskar säkerhet...');

    let additionalContext = '';

    // Hämta aktiv fil
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const text = editor.document.getText();
      const lang = editor.document.languageId;
      const relativePath = vscode.workspace.asRelativePath(editor.document.uri);
      additionalContext += `\n\nFil att granska (${relativePath}):\n\`\`\`${lang}\n${text}\n\`\`\``;
      ctx.stream.reference(editor.document.uri);
    }

    // Sök efter potentiellt känsliga filer
    const sensitiveFiles = await this.tools.execute(
      'file',
      { action: 'search', pattern: '**/{.env,.env.*,secrets,credentials,*.pem,*.key}' },
      ctx.token
    );
    if (sensitiveFiles.success && Array.isArray(sensitiveFiles.data) && (sensitiveFiles.data as string[]).length > 0) {
      additionalContext += `\n\n⚠️ Potentiellt känsliga filer hittade: ${(sensitiveFiles.data as string[]).join(', ')}`;
    }

    // Kolla package.json för kända sårbara paket
    const pkgFiles = await this.tools.execute(
      'file',
      { action: 'search', pattern: '**/package.json' },
      ctx.token
    );
    if (pkgFiles.success && Array.isArray(pkgFiles.data) && (pkgFiles.data as string[]).length > 0) {
      additionalContext += `\n\npackage.json-filer: ${(pkgFiles.data as string[]).join(', ')}`;
    }

    const prompt = additionalContext ? `${PROMPT}\n\nProjektkontext:${additionalContext}` : PROMPT;

    await this.chat(ctx, prompt);

    return {
      followUps: [
        { prompt: 'Gör en fullständig OWASP-granskning', label: 'OWASP', command: 'security' },
        { prompt: 'Kontrollera autentiseringsflödet', label: 'Auth', command: 'security' },
        { prompt: 'Sök efter hårdkodade hemligheter', label: 'Hemligheter', command: 'security' },
      ],
    };
  }
}
