/**
 * @file IFacebookClient.ts
 * @description Contract for all communication with the Facebook Graph API.
 *
 * RULE: This is the ONLY interface through which any layer may send
 *       messages or interact with the Facebook platform.
 * RULE: Only the Facebook Layer implements this interface.
 * RULE: No layer other than Facebook Layer may import Facebook SDK types.
 *       All communication is through the domain types in this contract.
 *
 * @see 10-facebook-architecture.md
 */

import type {
  FacebookUserProfile,
  OutboundButtonTemplate,
  OutboundGenericTemplate,
  OutboundQuickReplies,
  OutboundTextMessage,
} from '../types/message.types.js';

// ─── Send Result ──────────────────────────────────────────────────────────────

/** The outcome of a send operation to Facebook. */
export interface FacebookSendResult {
  /** The Facebook-assigned message ID, if the send succeeded. */
  readonly messageId: string | null;

  /** The recipient's page-scoped user ID. */
  readonly recipientId: string;
}

// ─── IFacebookClient ──────────────────────────────────────────────────────────

/**
 * Contract for outbound Facebook Messenger interactions.
 *
 * All methods may throw FacebookError on API failure.
 * Rate limiting is handled internally — callers receive a FacebookError
 * with code FACEBOOK_RATE_LIMITED if retries are exhausted.
 */
export interface IFacebookClient {
  // ─── Messaging ─────────────────────────────────────────────────────────

  /** Send a plain text message to a recipient. */
  sendTextMessage(message: OutboundTextMessage): Promise<FacebookSendResult>;

  /** Send a message with quick-reply buttons. */
  sendQuickReplies(message: OutboundQuickReplies): Promise<FacebookSendResult>;

  /** Send a structured button template. */
  sendButtonTemplate(message: OutboundButtonTemplate): Promise<FacebookSendResult>;

  /** Send a generic (carousel) template. */
  sendGenericTemplate(message: OutboundGenericTemplate): Promise<FacebookSendResult>;

  /** Send an image by URL. */
  sendImage(recipientId: string, imageUrl: string): Promise<FacebookSendResult>;

  // ─── Typing Indicators ─────────────────────────────────────────────────

  /**
   * Show or hide the typing indicator for a recipient.
   * Best-effort — failures are logged but not thrown.
   */
  setTypingIndicator(recipientId: string, isTyping: boolean): Promise<void>;

  /** Send a "message seen" receipt to a recipient. */
  markMessageSeen(recipientId: string): Promise<void>;

  // ─── User Info ─────────────────────────────────────────────────────────

  /**
   * Fetch public profile information for a user by their PSID.
   * Returns null if the profile is not accessible.
   */
  getUserProfile(psid: string): Promise<FacebookUserProfile | null>;
}
