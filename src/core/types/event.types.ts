/**
 * @file event.types.ts
 * @description Domain types for the internal event system.
 *
 * RULE: All events enter the system exclusively through the EventDispatcher.
 *       No component may call event handlers directly.
 * RULE: Plugin events are namespaced as `plugin.<pluginId>.<eventName>`.
 * RULE: Plugin events must be declared in the plugin manifest's `supportedEvents`.
 *
 * @see 14-event-system.md
 */

import type {
  ConversationId,
  CorrelationId,
  ISOTimestamp,
  PluginId,
  UserId,
} from './common.types.js';

// ─── Event Trust Level ────────────────────────────────────────────────────────

/**
 * Trust classification assigned to an event based on its source.
 * System events are trusted. Plugin events are untrusted.
 */
export type EventTrustLevel = 'SYSTEM' | 'FACEBOOK' | 'PLUGIN' | 'INTERNAL';

// ─── Event Priority ───────────────────────────────────────────────────────────

/** Dispatch priority for events in the priority queue. */
export type EventPriority = 'HIGH' | 'NORMAL' | 'LOW';

// ─── System Event Types ───────────────────────────────────────────────────────

/**
 * Catalog of all recognized Core system event type strings.
 * This is the authoritative list — any event type not listed here
 * must be added to this union before use.
 */
export type SystemEventType =
  // Connection events
  | 'system.connection.established'
  | 'system.connection.lost'
  | 'system.connection.restored'
  // Session events
  | 'system.session.created'
  | 'system.session.expired'
  | 'system.session.invalidated'
  | 'system.session.refreshed'
  // Plugin events
  | 'system.plugin.loaded'
  | 'system.plugin.disabled'
  | 'system.plugin.failed';

// ─── Facebook Event Types ─────────────────────────────────────────────────────

/**
 * Events originating from the Facebook platform, normalized by the Facebook Layer.
 */
export type FacebookEventType =
  | 'facebook.message.received'
  | 'facebook.message.delivered'
  | 'facebook.message.read'
  | 'facebook.typing.started'
  | 'facebook.typing.stopped'
  | 'facebook.presence.online'
  | 'facebook.presence.offline'
  | 'facebook.reaction.added'
  | 'facebook.reaction.removed';

// ─── Event Type Union ─────────────────────────────────────────────────────────

/**
 * All recognized event type strings.
 * Plugin event types follow the pattern `plugin.<pluginId>.<eventName>`
 * and are not statically enumerable here — they are validated at runtime.
 */
export type EventType = SystemEventType | FacebookEventType | `plugin.${string}.${string}`;

// ─── Base Event ───────────────────────────────────────────────────────────────

/**
 * The minimal shape every event must conform to.
 * Used by the EventDispatcher for routing and middleware.
 */
export interface BaseEvent {
  /** Unique event identifier — used for idempotency and tracing. */
  readonly eventId: string;

  /** The event type string — determines routing to handlers. */
  readonly type: EventType;

  /** When the event was emitted. */
  readonly occurredAt: ISOTimestamp;

  /**
   * Request correlation identifier for distributed tracing.
   * Propagated from the originating webhook request.
   */
  readonly correlationId: CorrelationId;

  /** Source trust level — assigned by the EventDispatcher. */
  readonly trustLevel: EventTrustLevel;

  /** Dispatch priority for the event queue. */
  readonly priority: EventPriority;
}

// ─── Event Context ────────────────────────────────────────────────────────────

/**
 * Enriched event context passed to every event handler.
 * Built by the EventDispatcher after middleware processing.
 *
 * RULE: Handlers MUST NOT modify EventContext — it is read-only.
 */
export interface EventContext<TPayload = unknown> extends BaseEvent {
  /** The normalized event payload. Shape depends on `type`. */
  readonly payload: TPayload;

  /** The user associated with this event, if resolvable. */
  readonly userId: UserId | null;

  /** The conversation associated with this event, if applicable. */
  readonly conversationId: ConversationId | null;

  /** The plugin ID that emitted this event, present only for plugin events. */
  readonly pluginId: PluginId | null;
}

// ─── Event Handler ────────────────────────────────────────────────────────────

/**
 * A function that handles a dispatched event.
 *
 * RULE: Handlers must be stateless.
 * RULE: Handlers must not call other handlers directly.
 * RULE: Handlers must not modify the EventContext.
 * RULE: Handlers must complete within the timeout for their event category.
 * RULE: Slow work must be initiated asynchronously — handler must return quickly.
 */
export type EventHandler<TPayload = unknown> = (
  context: EventContext<TPayload>,
) => Promise<void>;

// ─── Event Subscription ───────────────────────────────────────────────────────

/** A registration of a handler for a specific event type. */
export interface EventSubscription {
  readonly eventType: EventType;
  readonly handler: EventHandler;
  readonly subscriberId: string;
}
