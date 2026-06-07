import { ModelProvider } from './types';

/**
 * Maps a step's model id + speed (reasoning level) onto the CLI invocation used
 * to run it. Provider is inferred from the id: `claude*` → Claude CLI, anything
 * else → Codex CLI. Speed only applies to Codex (Claude has no level flag).
 */
export function providerForModel(model: string | undefined): ModelProvider | undefined {
  if (!model) {
    return undefined;
  }
  return model.startsWith('claude') ? 'claude' : 'codex';
}

/**
 * The CLI program + flag tokens (no prompt) for running a coding agent with the
 * given model/speed. Returns `['claude']` (the default) when no model is set.
 */
export function buildAgentCommandPrefix(model?: string, speed?: string): string[] {
  if (providerForModel(model) === 'codex') {
    const tokens = ['codex'];
    if (model) {
      tokens.push('-m', model);
    }
    if (speed) {
      tokens.push('-c', `model_reasoning_effort=${speed}`);
    }
    return tokens;
  }
  const tokens = ['claude'];
  if (model) {
    tokens.push('--model', model);
  }
  return tokens;
}
