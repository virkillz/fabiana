import { Telegraf } from 'telegraf';
import fs from 'fs/promises';

export interface IncomingMessage {
  text: string;
  chatId: number;
  fromId: number;
  timestamp: Date;
  messageId: number;
}

export class TelegramPoller {
  private bot: Telegraf;
  private chatId: number;
  private queue: IncomingMessage[] = [];
  private running = false;

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
        chatId: ctx.chat.id,
        fromId: ctx.from.id,
        timestamp: new Date(ctx.message.date * 1000),
        messageId: ctx.message.message_id,
      });

      console.log(`📨 Message queued: "${text.slice(0, 50)}"`);
    });

    this.bot.catch((err) => {
      console.error('Telegram error:', err);
    });
  }

  async start(): Promise<void> {
    this.running = true;
    // Don't await - launch starts the polling loop which runs forever
    this.bot.launch({
      dropPendingUpdates: false,
    }).catch((err) => {
      console.error('Telegram launch error:', err);
    });
    // Give it a moment to connect
    await new Promise((r) => setTimeout(r, 1000));
    console.log('✓ Telegram polling started');
  }

  async stop(): Promise<void> {
    this.running = false;
    this.bot.stop();
  }

  async send(text: string): Promise<void> {
    await this.bot.telegram.sendMessage(this.chatId, text, {
      parse_mode: 'Markdown',
    });
  }

  drainQueue(): IncomingMessage[] {
    const messages = [...this.queue];
    this.queue = [];
    return messages;
  }

  hasMessages(): boolean {
    return this.queue.length > 0;
  }

  // Log conversation to file for consolidation
  async logConversation(role: 'user' | 'fabiana', text: string): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ${role === 'user' ? '👤 You' : '🌸 Fabiana'}: ${text}\n`;
    await fs.appendFile(`.fabiana/data/logs/conversation-${today}.log`, entry, 'utf-8').catch(() => {});
  }
}
