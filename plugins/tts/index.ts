import { Type } from '@sinclair/typebox';
import type { ToolDefinition } from '@mariozechner/pi-coding-agent';

const DEFAULT_TTS_URL = 'http://178.128.50.246:5000';

async function sendTelegramVoice(token: string, chatId: string, audioBuffer: Buffer): Promise<void> {
  const formData = new FormData();
  formData.append('chat_id', chatId);
  formData.append('voice', new File([audioBuffer], 'voice.ogg', { type: 'audio/ogg' }));

  const response = await fetch(`https://api.telegram.org/bot${token}/sendVoice`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram sendVoice failed (${response.status}): ${body}`);
  }
}

export const tool: ToolDefinition = {
  name: 'speak',
  label: 'Speak (TTS)',
  description: `Convert text to speech and send it as a voice message via Telegram. Use for:
- Adding warmth and personality by speaking instead of typing
- Reading out important messages or reminders aloud
- Expressing emotions that work better as audio
- Surprising the user with a spoken message
- When the user asks you to "say" or "speak" something`,
  parameters: Type.Object({
    text: Type.String({ description: 'Text to speak (max 1000 characters)' }),
    voice: Type.Optional(Type.String({
      description: 'Voice to use: Bella, Jasper, Luna, Bruno, Rosie, Hugo, Kiki, Leo (default: Jasper)',
      default: 'Jasper',
    })),
  }),
  execute: async (_toolCallId, params: { text: string; voice?: string }) => {
    const { text, voice = 'Jasper' } = params;

    const ttsUrl = process.env.TTS_API_URL ?? DEFAULT_TTS_URL;
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      return {
        content: [{ type: 'text' as const, text: '❌ TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set.' }],
        details: { error: 'Missing Telegram credentials' },
      };
    }

    if (text.length > 1000) {
      return {
        content: [{ type: 'text' as const, text: '❌ Text exceeds 1000 character limit.' }],
        details: { error: 'Text too long', length: text.length },
      };
    }

    try {
      const ttsResponse = await fetch(`${ttsUrl}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice }),
      });

      if (!ttsResponse.ok) {
        const body = await ttsResponse.text();
        return {
          content: [{ type: 'text' as const, text: `❌ TTS error (${ttsResponse.status}): ${body.slice(0, 300)}` }],
          details: { error: body },
        };
      }

      const audioBuffer = Buffer.from(await ttsResponse.arrayBuffer());

      await sendTelegramVoice(token, chatId, audioBuffer);

      return {
        content: [{ type: 'text' as const, text: `✅ Voice message sent! "${text.slice(0, 60)}${text.length > 60 ? '…' : ''}"` }],
        details: { voice, bytes: audioBuffer.length, textLength: text.length },
      };
    } catch (err: any) {
      return {
        content: [{ type: 'text' as const, text: `❌ TTS failed: ${err.message}` }],
        details: { error: err.message },
      };
    }
  },
};

export const metadata = {
  name: 'tts',
  version: '1.0.0',
  description: 'Text-to-speech voice messages via Kitten TTS',
  author: 'fabiana-core',
};
