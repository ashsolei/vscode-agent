import * as vscode from 'vscode';

/**
 * Hjälpfunktioner för att strömma svar till chatten.
 */

/**
 * Strömma ett komplett LanguageModel-svar till chatten.
 * Stöder valfri cancellation token.
 */
export async function streamResponse(
  chatResponse: vscode.LanguageModelChatResponse,
  stream: vscode.ChatResponseStream,
  token?: vscode.CancellationToken
): Promise<string> {
  let fullResponse = '';
  for await (const fragment of chatResponse.text) {
    if (token?.isCancellationRequested) {
      break;
    }
    stream.markdown(fragment);
    fullResponse += fragment;
  }
  return fullResponse;
}

/**
 * Skicka en begäran till språkmodellen med system-prompt och användarmeddelande.
 */
/**
 * Skapa en Proxy-stream som fångar all markdown-text.
 * Returnerar [captureStream, getCapturedText].
 */
export function createCaptureStream(
  stream: vscode.ChatResponseStream
): [vscode.ChatResponseStream, () => string] {
  let captured = '';
  const proxy = new Proxy(stream, {
    get(target, prop) {
      if (prop === 'markdown') {
        return (value: string | vscode.MarkdownString) => {
          const text = typeof value === 'string' ? value : value.value;
          captured += text;
          target.markdown(value);
        };
      }
      return Reflect.get(target, prop);
    },
  });
  return [proxy, () => captured];
}

/**
 * Skicka en begäran till språkmodellen med system-prompt och användarmeddelande.
 */
export async function sendChatRequest(
  model: vscode.LanguageModelChat,
  systemPrompt: string,
  userMessage: string,
  history: vscode.LanguageModelChatMessage[],
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<string> {
  const messages = [
    vscode.LanguageModelChatMessage.User(systemPrompt),
    ...history,
    vscode.LanguageModelChatMessage.User(userMessage),
  ];

  const chatResponse = await model.sendRequest(messages, {}, token);
  return streamResponse(chatResponse, stream);
}
