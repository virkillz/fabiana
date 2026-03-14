export interface ConversationState {
  id: string;
  channel: string;             // "slack" | "telegram"
  externalUserId: string;      // platform-specific user ID
  externalDisplayName: string; // human-readable name
  threadId: string;            // Slack thread_ts / Telegram message_id
  channelId: string;           // platform-specific channel/DM ID
  purpose: string;             // what this conversation is about
  status: 'open' | 'resolved' | 'owner-notified';
  createdAt: string;           // ISO timestamp
  lastActivity: string;        // ISO timestamp
  initiatedBy: string;         // "owner-initiative" | "owner-chat"
  filePath: string;            // absolute path to the state file
}

export interface CreateConversationOpts {
  channel: string;
  externalUserId: string;
  externalDisplayName: string;
  threadId: string;
  channelId: string;
  purpose: string;
  initiatedBy: string;
}
