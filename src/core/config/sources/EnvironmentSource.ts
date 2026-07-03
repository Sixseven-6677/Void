/**
 * @file EnvironmentSource.ts
 * @description The ONLY component in the entire Void system authorized to read process.env.
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  ARCHITECTURAL BOUNDARY — DO NOT CROSS                                  ║
 * ║                                                                          ║
 * ║  process.env may ONLY be accessed inside this file.                     ║
 * ║  Any other file that reads process.env directly is an architectural     ║
 * ║  violation and must be refactored to use IConfigProvider instead.       ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Why a dedicated class?
 *   Centralising all process.env access in one place makes it trivial to:
 *     - Audit what the system reads from the environment (single grep target).
 *     - Replace env with test overrides in unit tests without touching the OS.
 *     - Add future high-priority sources (remote secrets manager) as overrides.
 *     - Enforce the "no direct env access" rule at review time.
 *
 * @see IConfigSource  — the contract this class implements
 * @see ConfigLoader   — the consumer that calls read() and merges results
 * @see .constitution/04-dependency-rules.md — dependency and isolation rules
 */

import type { IConfigSource, RawConfigMap } from './IConfigSource.js';

// ─── EnvironmentSource ────────────────────────────────────────────────────────

/**
 * Reads raw configuration from the process environment (process.env).
 *
 * Behaviour:
 *   - Takes a frozen snapshot of process.env at the moment read() is called.
 *   - Subsequent mutations to process.env are NOT reflected in the snapshot.
 *   - Call read() again (via ConfigProvider.reload()) if a fresh snapshot is needed.
 *   - The returned map is frozen — callers must not mutate it.
 *
 * Thread-safety:
 *   Node.js is single-threaded; no concurrent read/write races are possible.
 *   The snapshot pattern still prevents accidental downstream mutation.
 */
export class EnvironmentSource implements IConfigSource {
  /**
   * Stable identifier for this source.
   * Appears in diagnostic messages and ConfigLoader.sourceNames.
   */
  readonly name = 'environment' as const;

  /**
   * Capture a frozen snapshot of process.env.
   *
   * Implementation note: spreading into a new object breaks the live reference
   * to process.env. Object.freeze() prevents downstream mutation of the copy.
   * The cast to RawConfigMap is safe because process.env values are
   * string | undefined by Node.js type definitions.
   */
  async read(): Promise<RawConfigMap> {
    return Object.freeze({ ...process.env }) as RawConfigMap;
  }
}
