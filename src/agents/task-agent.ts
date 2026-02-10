import { BaseAgent, AgentContext, AgentResult } from './base-agent';
import { SYSTEM_PROMPTS } from '../prompts';
import { SharedState } from '../state';

/**
 * TaskAgent — specialiserad agent för uppgiftshantering.
 * Sparar uppgifter i delat tillstånd så de syns i alla VS Code-fönster.
 */
export class TaskAgent extends BaseAgent {
  constructor(private state: SharedState) {
    super('task', 'Uppgiftsagent', 'Hanterar uppgifter och planering');
  }

  async handle(ctx: AgentContext): Promise<AgentResult> {
    this.progress(ctx, 'Hanterar uppgifter...');

    // Visa befintliga uppgifter som kontext
    const tasks = this.state.get<string[]>('tasks') ?? [];
    let taskContext = '';

    if (tasks.length > 0) {
      taskContext = `\n\nBefintliga uppgifter:\n${tasks.map((t, i) => `${i + 1}. ${t}`).join('\n')}`;
    }

    const prompt = `${SYSTEM_PROMPTS.task}${taskContext}`;

    const response = await this.chat(ctx, prompt);

    // Spara eventuella nya uppgifter i delat tillstånd
    const newTasks = this.extractTasks(response);
    if (newTasks.length > 0) {
      const allTasks = [...tasks, ...newTasks];
      this.state.set('tasks', allTasks);
    }

    // Lägg till knappar för uppgiftshantering
    this.button(ctx, 'Rensa uppgifter', 'vscode-agent.clearState');
    this.button(ctx, 'Visa tillstånd', 'vscode-agent.showState');

    return {
      followUps: [
        { prompt: 'Visa alla uppgifter', label: 'Visa uppgifter' },
        { prompt: 'Bryt ner uppgifterna i delsteg', label: 'Delsteg' },
        { prompt: 'Prioritera uppgifterna', label: 'Prioritera' },
      ],
    };
  }

  /**
   * Extrahera uppgifter från agentens svar (letar efter checkbox-mönster).
   */
  private extractTasks(response: string): string[] {
    const taskPattern = /- \[[ x]\] (.+)/g;
    const tasks: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = taskPattern.exec(response)) !== null) {
      tasks.push(match[1]);
    }

    return tasks;
  }
}
