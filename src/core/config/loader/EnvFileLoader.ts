/**
 * @file EnvFileLoader.ts
 * @description IConfigSource implementation that reads .env files from disk.
 *
 * Responsibilities:
 *   - Accept a list of env file descriptors (path + required flag).
 *   - Check that required files exist; throw ConfigError if they are absent.
 *   - Read file content from disk and pass it to EnvFileParser.
 *   - Merge all parsed maps left-to-right (later files override earlier ones).
 *   - Return a single frozen RawConfigMap to the caller.
 *
 * RULE: No validation of key names or values — that is ConfigValidator's job.
 * RULE: No business logic — only file I/O and structural merge.
 * RULE: No process.env access — use EnvironmentSource for that.
 * RULE: Optional files that do not exist are silently skipped.
 *       Required files that do not exist throw ConfigError immediately.
 * RULE: I/O errors other than ENOENT (file not found) always throw ConfigError.
 *
 * @see EnvFileParser    — parses raw .env text into a RawConfigMap
 * @see EnvironmentLoader — the orchestrator that composes this with required-key checks
 * @see IConfigSource    — the interface this class implements
 */

import { readFile }          from 'node:fs/promises';
import { ConfigError }       from '../../errors/ConfigError.js';
import type { IConfigSource, RawConfigMap } from '../sources/IConfigSource.js';
import { EnvFileParser }     from './EnvFileParser.js';

// ─── EnvFileDescriptor ────────────────────────────────────────────────────────

/**
 * Describes a single .env file that the loader should read.
 *
 * Files are processed in the order they are listed.
 * Later files override earlier files on key conflicts.
 *
 * Example ordering (lowest → highest priority):
 *   { path: '.env',            required: false }  // committed base defaults
 *   { path: '.env.local',      required: false }  // developer overrides (gitignored)
 *   { path: '.env.production', required: false }  // production-only (gitignored)
 */
export interface EnvFileDescriptor {
  /**
   * File path, relative to the working directory or absolute.
   * Examples: '.env', '/secrets/.env.production'
   */
  readonly path: string;

  /**
   * When true: the application MUST NOT start if this file is absent.
   * When false: the file is optional — silently skipped if not found.
   */
  readonly required: boolean;
}

// ─── EnvFileLoader ────────────────────────────────────────────────────────────

/**
 * Reads one or more .env files from disk and merges their contents.
 *
 * Implements IConfigSource so it can be composed inside ConfigProvider
 * alongside EnvironmentSource for layered configuration:
 *
 *   new ConfigProvider([
 *     new EnvFileLoader([{ path: '.env', required: false }]),
 *     new EnvironmentSource(),   // process.env wins over file values
 *   ])
 */
export class EnvFileLoader implements IConfigSource {
  readonly name: string;

  private readonly files:  readonly EnvFileDescriptor[];
  private readonly parser: EnvFileParser;

  constructor(files: readonly EnvFileDescriptor[]) {
    if (files.length === 0) {
      throw new ConfigError(
        'CONFIG_LOAD_FAILED',
        'EnvFileLoader requires at least one EnvFileDescriptor. ' +
        'Pass an array with at least one file entry.',
        { context: { filesCount: 0 } },
      );
    }

    this.files  = files;
    this.parser = new EnvFileParser();
    this.name   = `env-files:[${files.map((f) => f.path).join(', ')}]`;
  }

  // ─── IConfigSource ─────────────────────────────────────────────────────

  /**
   * Read all configured files and return a merged RawConfigMap.
   *
   * Files are processed in registration order. On key conflicts, later
   * files win. Required files that are missing throw immediately.
   */
  async read(): Promise<RawConfigMap> {
    let merged: Record<string, string | undefined> = {};

    for (const descriptor of this.files) {
      const content = await this.readFile(descriptor);

      if (content === null) {
        // Optional file not found — skip without error.
        continue;
      }

      const parsed = this.parser.parse(content, descriptor.path);
      merged = { ...merged, ...parsed };
    }

    return Object.freeze(merged) as RawConfigMap;
  }

  // ─── Private ───────────────────────────────────────────────────────────

  /**
   * Read a single file from disk.
   *
   * Returns:
   *   - The file content string if the file exists and is readable.
   *   - null if the file does not exist AND is optional.
   *
   * Throws:
   *   - ConfigError (CONFIG_LOAD_FAILED) if the file is required and missing.
   *   - ConfigError (CONFIG_LOAD_FAILED) on any other I/O error.
   */
  private async readFile(descriptor: EnvFileDescriptor): Promise<string | null> {
    try {
      return await readFile(descriptor.path, 'utf-8');
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;

      if (nodeError.code === 'ENOENT') {
        if (descriptor.required) {
          throw new ConfigError(
            'CONFIG_LOAD_FAILED',
            `Required environment file "${descriptor.path}" was not found. ` +
            'Create the file or mark it as optional if it is not always present.',
            {
              cause:   error,
              context: { filePath: descriptor.path, required: true },
            },
          );
        }
        // Optional file missing — caller treats null as "skip".
        return null;
      }

      // Any other I/O error (permission denied, directory, etc.).
      throw new ConfigError(
        'CONFIG_LOAD_FAILED',
        `Failed to read environment file "${descriptor.path}": ` +
        (error instanceof Error ? error.message : String(error)),
        {
          cause:   error,
          context: {
            filePath:  descriptor.path,
            errorCode: nodeError.code ?? 'UNKNOWN',
          },
        },
      );
    }
  }
}
