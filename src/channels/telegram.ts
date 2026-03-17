import { Telegraf } from 'telegraf';
import fs from 'fs/promises';
import type { ChannelAdapter, IncomingMessage } from './types.js';
import { paths } from '../paths.js';

export class TelegramAdapter implements ChannelAdapter {
  readonly name = 'telegram';
  private bot: Telegraf;
  private chatId: number;
  private queue: IncomingMessage[] = [];

  constructor(token: string, chatId: number) {
    this.bot = new Telegraf(token);
    this.chatId = chatId;
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.bot.on('text', (ctx) => {
      // Only accept messages from the configured chat
      if (ctx.chat.id !== this.chatId) return;

      // Normalize Telegram system commands (e.g. /start from clearing chat history)
      const rawText = ctx.message.text;
      const text = rawText === '/start' ? "hey, what's up?" : rawText;

      this.queue.push({
        text,
        senderId: String(ctx.from.id),
        channelId: String(ctx.chat.id),
        threadId: String(ctx.message.message_id),
        timestamp: new Date(ctx.message.date * 1000),
        source: 'telegram',
      });

      console.log(`📨 [telegram] Message queued: "${text.slice(0, 50)}"`);
    });

    this.bot.on('photo', async (ctx) => {
      if (ctx.chat.id !== this.chatId) return;

      // Pick the largest available size (last in array)
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      const caption = ctx.message.caption ?? '';

      try {
        const fileLink = await this.bot.telegram.getFileLink(photo.file_id);
        const response = await fetch(fileLink.href);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const buffer = Buffer.from(await response.arrayBuffer());

        await fs.mkdir(paths.imagesDir, { recursive: true });
        const filename = `photo-${Date.now()}.jpg`;
        const imagePath = paths.images(filename);
        await fs.writeFile(imagePath, buffer);

        const text = caption || '[sent a photo]';
        this.queue.push({
          text,
          senderId: String(ctx.from.id),
          channelId: String(ctx.chat.id),
          threadId: String(ctx.message.message_id),
          timestamp: new Date(ctx.message.date * 1000),
          source: 'telegram',
          imagePaths: [imagePath],
        });

        console.log(`📨 [telegram] Photo queued → ${imagePath}`);
      } catch (err: any) {
        console.error('❌ Failed to download Telegram photo:', err.message);
      }
    });

    this.bot.catch((err) => {
      console.error('Telegram error:', err);
    });
  }

  async start(): Promise<void> {
    this.bot.launch({ dropPendingUpdates: false }).catch((err) => {
      console.error('Telegram launch error:', err);
    });
    await new Promise((r) => setTimeout(r, 1000));
    console.log('✓ Telegram polling started');
  }

  async stop(): Promise<void> {
    this.bot.stop();
  }

  // channelId and threadId are ignored — Telegram always replies to the configured chatId
  async send(text: string, _channelId?: string, _threadId?: string): Promise<void> {
    try {
      await this.bot.telegram.sendMessage(this.chatId, text, {
        parse_mode: 'Markdown',
      });
    } catch (err: any) {
      // Markdown parse error — retry as plain text
      if (err?.message?.includes("can't parse entities")) {
        await this.bot.telegram.sendMessage(this.chatId, text);
      } else {
        throw err;
      }
    }
  }

  drainQueue(): IncomingMessage[] {
    const messages = [...this.queue];
    this.queue = [];
    return messages;
  }

  hasMessages(): boolean {
    return this.queue.length > 0;
  }

  // All Telegram messages are from the owner — chatId filter already applied
  isOwner(_senderId: string): boolean {
    return true;
  }

  async logConversation(role: 'user' | 'fabiana', text: string, source = 'telegram'): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] [${source}] ${role === 'user' ? '👤 You' : '🌸 Fabiana'}: ${text}\n`;
    await fs.appendFile(paths.logs(`conversation-${today}.log`), entry, 'utf-8').catch(() => {});
  }
}
