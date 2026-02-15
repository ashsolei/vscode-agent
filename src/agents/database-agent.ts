import * as vscode from 'vscode';
import { BaseAgent, AgentContext, AgentResult } from './base-agent';
import { AutonomousExecutor } from '../autonomous';

const PROMPT = `Du är en autonom databasarkitekt. Du designar och genererar KOMPLETTA databasscheman, migreringsfiler, ORM-modeller och queries.

Du MÅSTE svara med ett JSON-objekt i ett kodblock (\`\`\`json):
{
  "files": [
    { "path": "sökväg", "content": "filinnehåll" }
  ],
  "summary": "vad som skapades"
}

Du kan skapa:
- SQL-schema (CREATE TABLE med constraints, index, foreign keys)
- Migreringsfiler (up/down) för Prisma, Drizzle, Knex, Alembic, Flyway
- ORM-modeller (Prisma schema, TypeORM entities, SQLAlchemy models, Django models)
- Seed-data och fixtures
- Lagrade procedurer och vyer
- Index-strategier och query-optimering
- TypeScript/Python-typer som matchar databas-schemat
- Repository/DAO-lager med CRUD-operationer
- Databasdiagram som Mermaid ER-diagram

Regler:
- Inkludera ALLTID migreringar (up + down)
- Använd korrekta datatyper och constraints
- Lägg till index på foreign keys och vanliga sökfält
- Inkludera created_at/updated_at timestamps
- Soft delete (deleted_at) när det passar
- Skriv seed-data för utveckling`;

/**
 * DatabaseAgent — designar scheman, skapar migrationer och ORM-modeller autonomt.
 */
export class DatabaseAgent extends BaseAgent {
  constructor() {
    super('db', 'Databasagent', 'Databasedesign, migrationer, ORM-modeller', { isAutonomous: true });
  }

  async handle(ctx: AgentContext): Promise<AgentResult> {
    const executor = new AutonomousExecutor(ctx.stream);

    this.progress(ctx, '🗄️ Analyserar databasbehov...');

    let projectContext = '';

    // Sök efter befintliga databasrelaterade filer
    const prismaFiles = await executor.findFiles('**/prisma/**');
    const migrationFiles = await executor.findFiles('**/migrations/**');
    const modelFiles = await executor.findFiles('**/{models,entities}/**/*.{ts,py,rb}');

    if (prismaFiles.length > 0) { projectContext += `\nPrisma-filer: ${prismaFiles.join(', ')}`; }
    if (migrationFiles.length > 0) { projectContext += `\nMigrationer: ${migrationFiles.join(', ')}`; }
    if (modelFiles.length > 0) { projectContext += `\nModell-filer: ${modelFiles.join(', ')}`; }

    // Läs befintligt schema
    const prismaSchema = await executor.readFile('prisma/schema.prisma');
    if (prismaSchema) { projectContext += `\n\nBefintligt Prisma-schema:\n${prismaSchema}`; }

    // Kolla projekttyp
    const packageJson = await executor.readFile('package.json');
    if (packageJson) { projectContext += `\n\npackage.json:\n${packageJson}`; }

    this.progress(ctx, '🤖 Genererar databasschema...');

    const messages = [
      vscode.LanguageModelChatMessage.User(PROMPT),
      vscode.LanguageModelChatMessage.User(
        `Projektkontext:\n${projectContext}\n\nBegäran: ${ctx.request.prompt}`
      ),
    ];

    const fullResponse = await this.chatRaw(ctx, messages);

    if (this.isCancelled(ctx)) { return {}; }

    const result = this.extractJson<{
      files: Array<{ path: string; content: string }>;
      summary?: string;
    }>(fullResponse);

    if (!result) {
      ctx.stream.markdown(fullResponse);
      return {};
    }

    try {
      this.progress(ctx, `📝 Skapar ${result.files.length} databasfiler...`);

      for (const file of result.files) {
        await executor.createFile(file.path, file.content);
      }

      executor.reportSummary();
      if (result.summary) { ctx.stream.markdown(`\n${result.summary}\n`); }
    } catch (err) {
      ctx.stream.markdown(`❌ Fel: ${this.formatError(err)}`);
    }

    return {
      followUps: [
        { prompt: 'Skapa Prisma-schema med modeller', label: 'Prisma', command: 'db' },
        { prompt: 'Generera SQL-migrationer', label: 'Migrationer', command: 'db' },
        { prompt: 'Skapa seed-data', label: 'Seed data', command: 'db' },
      ],
    };
  }
}
