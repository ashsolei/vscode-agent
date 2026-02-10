import * as vscode from 'vscode';
import { BaseAgent, AgentContext, AgentResult } from './base-agent';
import { AutonomousExecutor } from '../autonomous';

const PROMPT = `Du är en autonom DevOps-ingenjör. Du skapar kompletta CI/CD-pipelines, Dockerfiler och infrastrukturkonfiguration.

Du MÅSTE svara med ett JSON-objekt i ett kodblock (\`\`\`json):
{
  "files": [
    { "path": "sökväg", "content": "filinnehåll" }
  ],
  "summary": "vad som skapades och varför"
}

Du kan skapa:
- GitHub Actions workflows (.github/workflows/*.yml)
- GitLab CI (.gitlab-ci.yml)
- Dockerfile och docker-compose.yml
- Kubernetes-manifester (deployment, service, ingress)
- Terraform/Pulumi-moduler
- Nginx/Caddy-konfigurationer
- Makefiles
- Pre-commit hooks
- Release-skript

Regler:
- Analysera projekttypen och skapa rätt pipeline
- Inkludera build, test, lint, och deploy-steg
- Använd caching för snabbare builds
- Inkludera environment-variabler och secrets-hantering
- Multi-stage Docker builds för minimal image-storlek
- Health checks och restart-policyer`;

/**
 * DevOpsAgent — skapar CI/CD, Docker, K8s och infrastruktur autonomt.
 */
export class DevOpsAgent extends BaseAgent {
  constructor() {
    super('devops', 'DevOps-agent', 'CI/CD, Docker, Kubernetes, infrastruktur');
  }

  async handle(ctx: AgentContext): Promise<AgentResult> {
    const executor = new AutonomousExecutor(ctx.stream);

    this.progress(ctx, '🔧 Analyserar projekt för DevOps-setup...');

    // Samla projektinfo
    let projectContext = '';

    // Kontrollera projekttyp
    const packageJson = await executor.readFile('package.json');
    if (packageJson) { projectContext += `\npackage.json:\n${packageJson}`; }

    const pyProject = await executor.readFile('pyproject.toml');
    if (pyProject) { projectContext += `\npyproject.toml:\n${pyProject}`; }

    const reqTxt = await executor.readFile('requirements.txt');
    if (reqTxt) { projectContext += `\nrequirements.txt:\n${reqTxt}`; }

    const goMod = await executor.readFile('go.mod');
    if (goMod) { projectContext += `\ngo.mod:\n${goMod}`; }

    const cargoToml = await executor.readFile('Cargo.toml');
    if (cargoToml) { projectContext += `\nCargo.toml:\n${cargoToml}`; }

    // Existerande Docker/CI-filer
    const existingDocker = await executor.readFile('Dockerfile');
    if (existingDocker) { projectContext += `\nBefintlig Dockerfile:\n${existingDocker}`; }

    const rootFiles = await executor.listDir();
    projectContext += `\n\nProjektstruktur:\n${rootFiles.map(f => `${f.isDir ? '📁' : '📄'} ${f.name}`).join('\n')}`;

    this.progress(ctx, '🤖 Genererar DevOps-konfiguration...');

    const messages = [
      vscode.LanguageModelChatMessage.User(PROMPT),
      vscode.LanguageModelChatMessage.User(
        `Projektkontext:\n${projectContext}\n\nAnvändarens begäran: ${ctx.request.prompt}`
      ),
    ];

    const response = await ctx.request.model.sendRequest(messages, {}, ctx.token);
    let fullResponse = '';
    for await (const fragment of response.text) { fullResponse += fragment; }

    const jsonMatch = fullResponse.match(/```json\s*([\s\S]*?)```/);
    if (!jsonMatch) {
      ctx.stream.markdown(fullResponse);
      return {};
    }

    try {
      const result = JSON.parse(jsonMatch[1]);

      this.progress(ctx, `📦 Skapar ${result.files.length} konfigurationsfiler...`);

      for (const file of result.files) {
        await executor.createFile(file.path, file.content);
      }

      executor.reportSummary();
      if (result.summary) { ctx.stream.markdown(`\n${result.summary}\n`); }
    } catch (err) {
      ctx.stream.markdown(`❌ Fel: ${err}`);
    }

    return {
      followUps: [
        { prompt: 'Skapa GitHub Actions CI/CD', label: 'GitHub Actions', command: 'devops' },
        { prompt: 'Skapa Dockerfile och docker-compose', label: 'Docker', command: 'devops' },
        { prompt: 'Skapa Kubernetes-manifester', label: 'K8s', command: 'devops' },
      ],
    };
  }
}
