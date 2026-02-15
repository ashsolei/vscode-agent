---
mode: "agent"
description: "Create a new agent — generates the agent class, registers it, adds the slash command, and creates a test file"
---

# Create a New Agent

You will create a complete, production-ready agent for the VS Code Agent extension.

## Steps

1. **Identify the agent type**: Is it a basic agent (streams LLM text) or autonomous (creates/edits files)?

2. **Create the agent file** at `src/agents/<id>-agent.ts`:

```typescript
import * as vscode from 'vscode';
import { BaseAgent, AgentContext, AgentResult } from './base-agent';

const PROMPT = `Du är en expert på [domän]. [Detaljerade instruktioner på svenska].`;

export class <Name>Agent extends BaseAgent {
  constructor() {
    super('<id>', '<Svenskt namn>', '<Beskrivning på svenska>');
    // Add { isAutonomous: true } if this agent creates/edits files
  }

  async handle(ctx: AgentContext): Promise<AgentResult> {
    const response = await this.chat(ctx, PROMPT);
    return {
      followUps: [
        { prompt: 'Relevant follow-up', label: 'Label', command: '<id>' },
      ],
    };
  }
}
```

3. **Register in `src/extension.ts`**: Import and call `registry.register(new <Name>Agent())`.

4. **Add slash command to `package.json`** under `chatParticipants[0].commands`:
```json
{ "name": "<id>", "description": "Beskrivning" }
```

5. **Create test file** at `src/agents/<id>.test.ts` following the pattern in `registry-extended.test.ts`.

6. **Verify**: `npm run compile && npm test`

## Quality Checks
- Agent ID is kebab-case
- Name and description are in Swedish
- Autonomous agents have `{ isAutonomous: true }`
- `description` is meaningful for smart auto-routing
