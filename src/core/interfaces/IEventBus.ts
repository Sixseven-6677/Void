/**
 * @file IEventBus.ts
 * @description Contract for the internal event dispatching system.
 *
 * RULE: ALL events enter the system through the EventDispatcher — no exceptions.
 * RULE: Handlers are called by the EventDispatcher — never called directly.
 * RULE: Emission is non-blocking — emitters do not await handler completion.
 * RULE: Plugin events must be declared in the plugin manifest before emission.
 *
 * @see 14-event-system.md
 */

import type {
  EventContext,
  EventHandler,
  EventType,
} from '../types/event.types.js';
import type { PluginId } from '../types/common.types.js';

// ─── Emit Options ─────────────────────────────────────────────────────────────

/** Options controlling how an event is emitted. */
export interface EmitOptions {
  /**
   * Correlation ID to propagate for distributed tracing.
   * If absent, a new correlation ID is generated.
   */
  readonly correlationId?: string;

  /**
   * The plugin ID emitting the event.
   * Required when the event type follows the `plugin.<id>.<name>` pattern.
   */
  readonly pluginId?: PluginId;
}

// ─── Subscription Options ─────────────────────────────────────────────────────

/** Options for registering an event subscription. */
export interface SubscriptionOptions {
  /**
   * A stable identifier for the subscribing component.
   * Used for diagnostics and deregistration tracking.
   */
  readonly subscriberId: string;
}

// ─── IEventBus ────────────────────────────────────────────────────────────────

/**
 * Contract for the Void internal event bus.
 *
 * The implementation (EventDispatcher) maintains a priority queue,
 * middleware pipeline, and isolated handler execution. This interface
 * exposes only the surface that other layers may use.
 */
export interface IEventBus {
  /**
   * Emit an event into the system.
   *
   * - Enqueues the event into the priority queue.
   * - Non-blocking: returns before any handler executes.
   * - The event passes through the middleware pipeline before delivery.
   *
   * @throws PluginError with PLUGIN_EVENT_NOT_DECLARED if a plugin
   *         attempts to emit an event type not in its manifest.
   */
  emit(
    type: EventType,
    payload: unknown,
    options?: EmitOptions,
  ): void;

  /**
   * Subscribe to an event type.
   *
   * Returns an unsubscribe function that MUST be called when the
   * subscribing component is destroyed — to prevent memory leaks
   * and phantom handler invocations.
   *
   * @param type     - The event type to listen for.
   * @param handler  - The handler function (must be stateless).
   * @param options  - Subscription metadata.
   * @returns        - An unsubscribe function.
   */
  on<TPayload = unknown>(
    type: EventType,
    handler: EventHandler<TPayload>,
    options?: SubscriptionOptions,
  ): () => void;

  /**
   * Subscribe to an event type for a single invocation.
   * The subscription is automatically removed after the first delivery.
   *
   * @returns An unsubscribe function (no-op if already fired).
   */
  once<TPayload = unknown>(
    type: EventType,
    handler: EventHandler<TPayload>,
    options?: SubscriptionOptions,
  ): () => void;

  /**
   * Remove all subscriptions registered by a given subscriber ID.
   * Called during component teardown to ensure clean deregistration.
   */
  removeAllSubscriptions(subscriberId: string): void;

  /**
   * Returns a snapshot of the current handler count for a given event type.
   * For diagnostics and testing — not for production branching logic.
   */
  listenerCount(type: EventType): number;

  /**
   * Drain all pending events from the queue and wait for their handlers
   * to complete. Used during graceful shutdown to ensure in-flight events
   * are processed before the system exits.
   */
  drain(): Promise<void>;
}

// ─── Dead Letter Entry ────────────────────────────────────────────────────────

/**
 * An event that failed delivery after all retry attempts.
 * Stored in the Dead Letter Queue for diagnostics.
 */
export interface DeadLetterEntry {
  readonly eventContext: EventContext;
  readonly failureReason: string;
  readonly failedAt: string;
  readonly attemptCount: number;
}
