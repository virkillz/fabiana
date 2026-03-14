import type { ChannelAdapter } from './types.js';
import { TelegramAdapter } from './telegram.js';
import { SlackAdapter } from './slack.js';

export interface ChannelsConfig {
  primary?: string;
  telegram?: { enabled?: boolean };
  slack?: { enabled?: boolean; ownerUserId?: string };
}

export interface LoadedChannels {
  all: ChannelAdapter[];
  primary: ChannelAdapter;
}

export async function loadChannels(channels?: ChannelsConfig): Promise<LoadedChannels> {
  // Fallback for installs that don't have a channels block yet
  if (!channels) {
    channels = { primary: 'telegram', telegram: { enabled: true } };
  }

  const adapters: ChannelAdapter[] = [];

  // Telegram — enabled by default if the block exists or there is no channels config
  if (channels.telegram?.enabled !== false) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID
      ? parseInt(process.env.TELEGRAM_CHAT_ID)
      : undefined;
    if (!token || !chatId) {
      throw new Error('TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID required for the Telegram channel');
    }
    adapters.push(new TelegramAdapter(token, chatId));
  }

  // Slack — opt-in only
  if (channels.slack?.enabled) {
    const ownerUserId = channels.slack.ownerUserId;
    if (!ownerUserId) {
      throw new Error('channels.slack.ownerUserId is required in config.json when Slack is enabled');
    }
    adapters.push(new SlackAdapter(ownerUserId));
  }

  if (adapters.length === 0) {
    throw new Error('No channels enabled — enable at least one channel in config.json');
  }

  const primaryName = channels.primary ?? adapters[0].name;
  const primary = adapters.find((a) => a.name === primaryName);
  if (!primary) {
    throw new Error(
      `Primary channel "${primaryName}" is not among enabled channels: ${adapters.map((a) => a.name).join(', ')}`
    );
  }

  return { all: adapters, primary };
}
