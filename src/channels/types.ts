export interface IncomingMessage {
  text: string;
  senderId: string;    // platform-specific user ID
  channelId: string;   // platform-specific chat/channel ID
  threadId?: string;   // Slack thread_ts, Telegram message_id, etc.
  timestamp: Date;
  source: string;      // "telegram" | "slack"
}

export interface ChannelAdapter {
  readonly name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  /**
   * Send a message. For Telegram, channelId is ignored (uses configured chatId).
   * For Slack, channelId targets a specific channel/DM; omit to send to owner DM.
   */
  send(text: string, channelId?: string, threadId?: string): Promise<void>;
  drainQueue(): IncomingMessage[];
  hasMessages(): boolean;
  /**
   * Returns true if the senderId belongs to the owner.
   * Telegram: always true (chatId filter already applied).
   * Slack: compares against configured ownerUserId.
   */
  isOwner(senderId: string): boolean;
  logConversation(role: 'user' | 'fabiana', text: string, source?: string): Promise<void>;
}
