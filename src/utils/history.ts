import * as vscode from 'vscode';

/**
 * Hjälpfunktioner för att bygga konversationshistorik.
 */

/**
 * Extrahera textinnehåll från en ChatResponseTurn.
 */
export function extractTurnText(turn: vscode.ChatResponseTurn): string {
  let fullMessage = '';
  for (const part of turn.response) {
    const mdPart = part as vscode.ChatResponseMarkdownPart;
    if (mdPart?.value?.value) {
      fullMessage += mdPart.value.value;
    }
  }
  return fullMessage;
}

/**
 * Bygg en lista med meddelanden från konversationshistoriken.
 */
export function buildHistory(
  context: vscode.ChatContext
): vscode.LanguageModelChatMessage[] {
  const messages: vscode.LanguageModelChatMessage[] = [];

  for (const turn of context.history) {
    if (turn instanceof vscode.ChatResponseTurn) {
      const text = extractTurnText(turn);
      if (text) {
        messages.push(vscode.LanguageModelChatMessage.Assistant(text));
      }
    } else if (turn instanceof vscode.ChatRequestTurn) {
      messages.push(vscode.LanguageModelChatMessage.User(turn.prompt));
    }
  }

  return messages;
}
