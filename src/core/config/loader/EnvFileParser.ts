/**
 * @file EnvFileParser.ts
 * @description Pure parser that converts raw .env file text into a RawConfigMap.
 *
 * Responsibilities (this file only):
 *   - Tokenise lines from .env file content.
 *   - Extract valid KEY=VALUE pairs.
 *   - Strip comments, blank lines, and surrounding quotes.
 *
 * RULE: This class is pure — no I/O, no side effects, no dependencies.
 *       Feed it text; it returns a frozen map. Nothing else.
 * RULE: Malformed lines are silently skipped — they are not config values.
 *       Validation of required keys is the responsibility of EnvironmentLoader.
 * RULE: Secret values from the file MUST NOT be logged — the parsed map
 *       flows into the engine where secrets are handled by ConfigValidator.
 *
 * Supported syntax:
 *   KEY=value              — bare value (trailing whitespace stripped)
 *   KEY="value"            — double-quoted (inline # preserved)
 *   KEY='value'            — single-quoted (inline # preserved)
 *   KEY=                   — empty value (valid, stored as empty string)
 *   export KEY=value       — export prefix stripped
 *   # comment              — entire line skipped
 *   KEY=value # comment    — unquoted: inline comment stripped
 *
 * Not supported (by design — keep it simple):
 *   Multi-line values, variable expansion ($VAR), command substitution.
 *
 * @see EnvFileLoader    — the I/O layer that feeds text to this parser
 * @see EnvironmentLoader — the orchestrator
 */

import type { RawConfigMap } from '../sources/IConfigSource.js';

// ─── Parsing constants ────────────────────────────────────────────────────────

/** Regex: valid env key (must start with letter or _, contain only [A-Za-z0-9_]). */
const VALID_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

// ─── EnvFileParser ────────────────────────────────────────────────────────────

/**
 * Stateless, pure .env file parser.
 *
 * The same instance can be reused across multiple parse() calls without
 * any state leaking between them.
 */
export class EnvFileParser {

  /**
   * Parse the text content of a .env file into a frozen RawConfigMap.
   *
   * Lines are processed top-to-bottom. When the same key appears multiple
   * times in one file, the LAST occurrence wins (same as shell behaviour).
   *
   * @param content  - Raw text content of a .env file (UTF-8).
   * @param filePath - Used only in parse-warning messages (never in values).
   * @returns A frozen key-value map of all valid pairs found in the file.
   */
  parse(content: string, filePath: string): RawConfigMap {
    const result: Record<string, string> = {};
    // Normalise line endings so \r\n and \n are both handled.
    const lines = content.replace(/\r\n/g, '\n').split('\n');

    for (let i = 0; i < lines.length; i++) {
      const raw  = lines[i];
      const line = raw.trim();

      // Skip blank lines and full-line comments.
      if (!line || line.startsWith('#')) continue;

      // Strip optional leading `export `.
      const stripped = line.startsWith('export ')
        ? line.slice('export '.length).trimStart()
        : line;

      // Must contain an `=` to be a key-value pair.
      const eqIdx = stripped.indexOf('=');
      if (eqIdx === -1) continue;

      const key   = stripped.slice(0, eqIdx).trim();
      const raw_v = stripped.slice(eqIdx + 1);  // everything after `=`

      // Key must match the valid identifier pattern.
      if (!VALID_KEY_RE.test(key)) continue;

      const value = this.parseValue(raw_v);
      result[key] = value;
    }

    void filePath; // accepted for future diagnostic use; not logged now.
    return Object.freeze(result) as RawConfigMap;
  }

  // ─── Private helpers ──────────────────────────────────────────────────

  /**
   * Extract the final string value from the raw right-hand side of a `=`.
   *
   * Handles:
   *   - Double-quoted:  `"hello world"`  → `hello world`
   *   - Single-quoted:  `'hello world'`  → `hello world`
   *   - Unquoted:       `hello world # c` → `hello world` (comment stripped)
   *   - Empty:          `` (nothing)     → `""` (empty string)
   */
  private parseValue(raw: string): string {
    const trimmed = raw.trim();

    if (trimmed === '') return '';

    // Double-quoted value.
    if (trimmed.startsWith('"')) {
      const closeIdx = trimmed.indexOf('"', 1);
      if (closeIdx !== -1) {
        return trimmed.slice(1, closeIdx);
      }
      // Unclosed quote — treat everything after the opening quote as the value.
      return trimmed.slice(1);
    }

    // Single-quoted value.
    if (trimmed.startsWith("'")) {
      const closeIdx = trimmed.indexOf("'", 1);
      if (closeIdx !== -1) {
        return trimmed.slice(1, closeIdx);
      }
      return trimmed.slice(1);
    }

    // Unquoted value — strip inline comment (` #` or `\t#`).
    const commentIdx = trimmed.search(/\s+#/);
    const value = commentIdx !== -1
      ? trimmed.slice(0, commentIdx)
      : trimmed;

    return value.trim();
  }
}
