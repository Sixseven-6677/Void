/**
 * @file container.ts
 * @description Lightweight DI Container for Void.
 *
 * A purpose-built, zero-dependency container. Intentionally minimal —
 * it resolves singletons by token. No reflection, no decorators,
 * no circular dependency magic. All bindings are explicit.
 *
 * RULE: Every injectable is registered as a singleton.
 * RULE: The container is configured once at startup and never mutated at runtime.
 * RULE: Circular dependencies are a design error — fix the architecture, not the container.
 * RULE: Only the Bootstrap layer may call container.bind(). Application code resolves only.
 *
 * Why a custom container and not inversify/awilix?
 * Core must have zero external dependencies. A third-party DI library would
 * create a transitive dependency that all layers inherit — violating the
 * Core isolation principle. This container does exactly what Void needs and nothing more.
 */

import { InternalError } from '../errors/InternalError.js';
import type { Token } from './tokens.js';

// ─── Binding ──────────────────────────────────────────────────────────────────

/** A factory function that receives the container for recursive resolution. */
export type BindingFactory<T> = (container: VoidContainer) => T;

// ─── VoidContainer ────────────────────────────────────────────────────────────

/**
 * The Void DI Container.
 *
 * All registered bindings are singleton-scoped: the factory is called once
 * on the first resolve, and the resulting instance is cached for all
 * subsequent resolves of the same token.
 */
export class VoidContainer {
  /** Factory functions registered for each token. */
  private readonly factories = new Map<symbol, BindingFactory<unknown>>();

  /** Resolved singleton instances, cached after first resolution. */
  private readonly singletons = new Map<symbol, unknown>();

  /** Tokens currently in the resolution stack — used to detect cycles. */
  private readonly resolutionStack: symbol[] = [];

  // ─── Registration ─────────────────────────────────────────────────────

  /**
   * Register a factory for a token.
   * The factory is called lazily on the first resolve.
   *
   * @throws InternalError (CONTAINER_TOKEN_ALREADY_REGISTERED) if the token
   *         is already registered. Call rebind() to intentionally replace.
   */
  bind<T>(token: Token, factory: BindingFactory<T>): this {
    if (this.factories.has(token)) {
      throw new InternalError(
        'CONTAINER_TOKEN_ALREADY_REGISTERED',
        `Token ${String(token)} is already registered in the DI container. ` +
        'Call rebind() to intentionally replace an existing registration.',
        { context: { token: String(token) } },
      );
    }
    this.factories.set(token, factory as BindingFactory<unknown>);
    return this;
  }

  /**
   * Replace an existing binding — for testing or conditional configuration.
   * Unlike bind(), rebind() does not throw if the token is already registered.
   * It also clears any cached singleton instance for this token.
   */
  rebind<T>(token: Token, factory: BindingFactory<T>): this {
    this.factories.set(token, factory as BindingFactory<unknown>);
    this.singletons.delete(token);
    return this;
  }

  /**
   * Register a pre-constructed instance directly (no factory needed).
   * Equivalent to: bind(token, () => instance).
   */
  bindInstance<T>(token: Token, instance: T): this {
    return this.bind(token, () => instance);
  }

  // ─── Resolution ───────────────────────────────────────────────────────

  /**
   * Resolve a registered binding by token.
   * The instance is constructed once and cached for subsequent calls.
   *
   * @throws InternalError (CONTAINER_TOKEN_NOT_FOUND) if the token is not registered.
   * @throws InternalError (CONTAINER_CIRCULAR_DEPENDENCY) if a cycle is detected.
   */
  resolve<T>(token: Token): T {
    // Return cached singleton if already constructed
    if (this.singletons.has(token)) {
      return this.singletons.get(token) as T;
    }

    // Guard against circular dependencies
    if (this.resolutionStack.includes(token)) {
      const cycle = [...this.resolutionStack, token]
        .map((t) => String(t))
        .join(' → ');
      throw new InternalError(
        'CONTAINER_CIRCULAR_DEPENDENCY',
        `Circular dependency detected in the DI container: ${cycle}. ` +
        'Redesign the dependency graph — circular dependencies are a Core architecture violation.',
        { context: { cycle } },
      );
    }

    // Ensure the token is registered
    const factory = this.factories.get(token);
    if (!factory) {
      throw new InternalError(
        'CONTAINER_TOKEN_NOT_FOUND',
        `No binding found for token ${String(token)} in the DI container. ` +
        'Register it with container.bind() before calling resolve().',
        { context: { token: String(token) } },
      );
    }

    // Construct the instance, tracking the resolution stack for cycle detection
    this.resolutionStack.push(token);
    let instance: T;
    try {
      instance = factory(this) as T;
    } finally {
      this.resolutionStack.pop();
    }

    // Cache as singleton
    this.singletons.set(token, instance);
    return instance;
  }

  /**
   * Check whether a token has a registered binding.
   */
  has(token: Token): boolean {
    return this.factories.has(token);
  }

  /**
   * Check whether a token's instance has already been constructed.
   */
  isResolved(token: Token): boolean {
    return this.singletons.has(token);
  }

  /**
   * Diagnostic snapshot of all registered token symbols.
   * For testing and startup health checks only.
   */
  registeredTokens(): readonly symbol[] {
    return [...this.factories.keys()];
  }
}
