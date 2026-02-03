/**
 * .agents.json Loader
 *
 * Reads workspace isolation configuration from repo root.
 * The .agents.json file defines setup/archive scripts and port allocation.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface AgentsConfig {
  scripts?: {
    /** Script to run when creating a new agent workspace */
    setup?: string;
    /** Script to run when archiving/deleting */
    archive?: string;
    /** Script to run tests */
    test?: string;
  };
  ports?: {
    /** Default base port (default: 3000) */
    base?: number;
    /** Port increment per agent (default: 10) */
    increment?: number;
  };
  /** Additional environment variables to set */
  env?: Record<string, string>;
}

/**
 * Load .agents.json from the repo root.
 * Returns null if the file doesn't exist or can't be parsed.
 */
export function loadAgentsConfig(repoRoot: string): AgentsConfig | null {
  const configPath = join(repoRoot, '.agents.json');

  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const raw = readFileSync(configPath, 'utf-8');
    return JSON.parse(raw) as AgentsConfig;
  } catch {
    return null;
  }
}
