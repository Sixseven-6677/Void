/**
 * @file message.types.ts
 * @description Domain types for messages exchanged between users and the bot.
 *
 * RULE: These are normalized domain types — not raw Facebook API payloads.
 *       Facebook Layer translates raw payloads into these types.
 * RULE: Message types must remain platform-agnostic at the domain level.
 */

import type { ConversationId, ISOTimestamp, MessageId, UserId } from './common.types.js';

// ─── Message Direction ────────────────────────────────────────────────────────

/** Whether the message was sent by a user or by the bot. */
export type MessageDirection = 'INBOUND' | 'OUTBOUND';

// ─── Message Type ─────────────────────────────────────────────────────────────

/** The structural type of the message content. */
export type MessageType =
  | 'TEXT'
  | 'IMAGE'
  | 'QUICK_REPLY'
  | 'POSTBACK'
  | 'BUTTON_TEMPLATE'
  | 'GENERIC_TEMPLATE'
  | 'TYPING_INDICATOR'
  | 'DELIVERY_RECEIPT'
  | 'READ_RECEIPT';

// ─── Message ──────────────────────────────────────────────────────────────────

/**
 * Normalized domain message — the common shape for all messages
 * regardless of their Facebook-specific transport details.
 */
export interface Message {
  readonly id: MessageId;
  readonly conversationId: ConversationId;
  readonly userId: UserId;
  readonly direction: MessageDirection;
  readonly type: MessageType;

  /**
   * Plain text content, present for TEXT messages.
   * Absent for non-text types.
   */
  readonly text: string | null;

  /**
   * Structured payload for non-text message types.
   * Exact shape depends on `type`.
   */
  readonly payload: unknown | null;

  readonly timestamp: ISOTimestamp;
}

// ─── Quick Reply ──────────────────────────────────────────────────────────────

/** A quick reply option presented to the user. */
export interface QuickReply {
  readonly title: string;
  readonly payload: string;
  readonly imageUrl?: string;
}

// ─── Postback ─────────────────────────────────────────────────────────────────

/** Postback data from a button or persistent menu action. */
export interface Postback {
  readonly title: string;
  readonly payload: string;
}

// ─── Outbound Message Builders ────────────────────────────────────────────────

/**
 * Intent to send a text message.
 * Passed to IFacebookClient — the Facebook Layer handles the API details.
 */
export interface OutboundTextMessage {
  readonly recipientId: string;
  readonly text: string;
}

/** Intent to send quick replies. */
export interface OutboundQuickReplies {
  readonly recipientId: string;
  readonly text: string;
  readonly replies: readonly QuickReply[];
}

/** A single button in a button template. */
export interface TemplateButton {
  readonly type: 'postback' | 'web_url';
  readonly title: string;
  readonly payload?: string;
  readonly url?: string;
}

/** Intent to send a button template. */
export interface OutboundButtonTemplate {
  readonly recipientId: string;
  readonly text: string;
  readonly buttons: readonly TemplateButton[];
}

/** A single element in a generic template carousel. */
export interface GenericTemplateElement {
  readonly title: string;
  readonly subtitle?: string;
  readonly imageUrl?: string;
  readonly buttons?: readonly TemplateButton[];
}

/** Intent to send a generic (carousel) template. */
export interface OutboundGenericTemplate {
  readonly recipientId: string;
  readonly elements: readonly GenericTemplateElement[];
}
