import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import {
  ModelOption,
  ModelProvider,
  defaultSpeedForLevels,
  modelsForProviders
} from './types';

const execFileAsync = promisify(execFile);

/**
 * Builds the list of models the workflow UIs offer, gated by which CLIs are
 * authenticated. Codex has no "list models" command, so its real list is read
 * from the local cache (`~/.codex/models_cache.json`); the static catalog in
 * `@nwa/workflow-sdk` is the fallback. Shared by the Workflow Settings builder
 * and the Task Manager run view so both compute the list one way.
 */
export class ModelCatalogService {
  /** Models for providers the caller already knows are authenticated. */
  async buildAvailableModels(authedProviders: ModelProvider[]): Promise<ModelOption[]> {
    const models = modelsForProviders(authedProviders);
    if (!authedProviders.includes('codex')) {
      return models;
    }
    const codexFromCache = await this.getCodexModelsFromCache();
    if (!codexFromCache) {
      return models;
    }
    return [...models.filter(model => model.provider !== 'codex'), ...codexFromCache];
  }

  /** Detect auth then build the list. For callers without CLI status (Task Manager). */
  async getAvailableModels(): Promise<ModelOption[]> {
    return this.buildAvailableModels(await this.detectAuthedProviders());
  }

  async detectAuthedProviders(): Promise<ModelProvider[]> {
    const providers: ModelProvider[] = [];
    if (await this.isClaudeAuthenticated()) {
      providers.push('claude');
    }
    if (await this.isCodexAuthenticated()) {
      providers.push('codex');
    }
    return providers;
  }

  private async getCodexModelsFromCache(): Promise<ModelOption[] | null> {
    try {
      const cachePath = path.join(os.homedir(), '.codex', 'models_cache.json');
      const raw = await fs.readFile(cachePath, 'utf8');
      const parsed = JSON.parse(raw) as { models?: Array<Record<string, unknown>> };
      const entries = Array.isArray(parsed.models) ? parsed.models : [];
      const options: ModelOption[] = entries
        .filter(entry => entry && typeof entry.slug === 'string' && entry.visibility === 'list')
        .sort((a, b) => Number(a.priority ?? 0) - Number(b.priority ?? 0))
        .map(entry => {
          const speeds = Array.isArray(entry.supported_reasoning_levels)
            ? (entry.supported_reasoning_levels as Array<Record<string, unknown>>)
                .map(level => String(level.effort))
                .filter(Boolean)
            : [];
          return {
            id: String(entry.slug),
            label: typeof entry.display_name === 'string' && entry.display_name
              ? String(entry.display_name)
              : String(entry.slug),
            provider: 'codex' as ModelProvider,
            speeds,
            defaultSpeed: defaultSpeedForLevels(speeds)
          };
        });
      return options.length > 0 ? options : null;
    } catch {
      return null;
    }
  }

  private async isClaudeAuthenticated(): Promise<boolean> {
    if (process.env.ANTHROPIC_API_KEY?.trim()) {
      return true;
    }
    const result = await this.runCli('claude', ['auth', 'status']);
    if (!result) {
      return false;
    }
    try {
      const payload = JSON.parse(result) as { loggedIn?: boolean };
      if (payload.loggedIn) {
        return true;
      }
    } catch {
      return /logged\s*in|authenticated|signed\s*in/i.test(result);
    }
    return false;
  }

  private async isCodexAuthenticated(): Promise<boolean> {
    if (process.env.OPENAI_API_KEY?.trim()) {
      return true;
    }
    return (await this.runCli('codex', ['login', 'status'])) !== null;
  }

  /** Run a CLI command; returns trimmed stdout on success, null on any failure. */
  private async runCli(command: string, args: string[]): Promise<string | null> {
    try {
      const result = await execFileAsync(command, args, {
        timeout: 10000,
        shell: process.platform === 'win32'
      });
      return String(result.stdout || '').trim();
    } catch {
      return null;
    }
  }
}
