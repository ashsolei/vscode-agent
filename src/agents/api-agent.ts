import * as vscode from 'vscode';
import { BaseAgent, AgentContext, AgentResult } from './base-agent';
import { ToolRegistry } from '../tools';

const PROMPT = `Du är en expert på API-design och utveckling. Du hjälper med:
- Designa RESTful API:er med rätt HTTP-metoder och statuskoder
- GraphQL-schema och resolvers
- gRPC och Protocol Buffers
- WebSocket- och Server-Sent Events-design
- OpenAPI/Swagger-specifikationer
- API-versionering och bakåtkompatibilitet
- Autentisering: API-nycklar, JWT, OAuth 2.0
- Rate limiting, pagination och filtrering
- Felhantering och felsvar (RFC 7807 Problem Details)
- HATEOAS och hypermedia
- API-testning och dokumentation
- Webhooks och event-driven API:er

Ge alltid konkreta kodexempel med request/response-format.
Svara på samma språk som användaren.`;

/**
 * ApiAgent — specialiserad agent för API-design och utveckling.
 */
export class ApiAgent extends BaseAgent {
  constructor(private tools: ToolRegistry) {
    super('api', 'API-agent', 'API-design, endpoints och integrationer');
  }

  async handle(ctx: AgentContext): Promise<AgentResult> {
    this.progress(ctx, 'Analyserar API...');

    let additionalContext = '';

    // Sök efter API-relaterade filer
    const apiFiles = await this.tools.execute(
      'file',
      { action: 'search', pattern: '**/{routes,controllers,api,endpoints,resolvers}/**/*.{ts,js,py,go,rs}' },
      ctx.token
    );
    if (apiFiles.success && Array.isArray(apiFiles.data) && (apiFiles.data as string[]).length > 0) {
      additionalContext += `\nAPI-filer: ${(apiFiles.data as string[]).slice(0, 10).join(', ')}`;
    }

    // Sök efter OpenAPI/Swagger
    const specFiles = await this.tools.execute(
      'file',
      { action: 'search', pattern: '**/{openapi,swagger}.{json,yaml,yml}' },
      ctx.token
    );
    if (specFiles.success && Array.isArray(specFiles.data) && (specFiles.data as string[]).length > 0) {
      additionalContext += `\nOpenAPI-spec: ${(specFiles.data as string[]).join(', ')}`;
    }

    // Hämta aktiv fil
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const text = editor.document.getText();
      const lang = editor.document.languageId;
      const relativePath = vscode.workspace.asRelativePath(editor.document.uri);
      additionalContext += `\n\nAktuell fil (${relativePath}):\n\`\`\`${lang}\n${text}\n\`\`\``;
      ctx.stream.reference(editor.document.uri);
    }

    const prompt = additionalContext ? `${PROMPT}\n\nProjektkontext:${additionalContext}` : PROMPT;

    await this.chat(ctx, prompt);

    return {
      followUps: [
        { prompt: 'Generera OpenAPI-spec för API:et', label: 'OpenAPI', command: 'api' },
        { prompt: 'Designa autentiseringen', label: 'Auth', command: 'api' },
        { prompt: 'Skapa API-testsvit', label: 'Tester', command: 'api' },
      ],
    };
  }
}
