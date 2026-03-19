import { Type } from '@sinclair/typebox';
import type { ToolDefinition } from '@mariozechner/pi-coding-agent';
import fs from 'fs/promises';
import path from 'path';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MODEL = 'gemini-2.0-flash-preview-image-generation';

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
  }>;
}

async function sendTelegramPhoto(
  token: string,
  chatId: string,
  imageBuffer: Buffer,
  mimeType: string,
  caption?: string,
): Promise<void> {
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/gif' ? 'gif' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const formData = new FormData();
  formData.append('chat_id', chatId);
  formData.append('photo', new File([new Uint8Array(imageBuffer)], `image.${ext}`, { type: mimeType }));
  if (caption) formData.append('caption', caption);

  const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram sendPhoto failed (${response.status}): ${body}`);
  }
}

export const tool: ToolDefinition = {
  name: 'generate_image_gemini',
  label: 'Generate / Edit Image (Gemini)',
  description: `Generate or edit images using Google Gemini. Use for work-related visual tasks:
- Creating diagrams, flowcharts, architecture overviews, or wireframes
- Generating design mockups, UI sketches, or visual layouts
- Editing or annotating an existing photo (pass input_image_path)
- Producing realistic or informational images for work context
- Visualizing data, processes, or technical concepts

For creative art and personal self-expression, use generate_image (Stable Diffusion) instead.`,
  parameters: Type.Object({
    prompt: Type.String({ description: 'Describe what to generate or how to edit the input image' }),
    input_image_path: Type.Optional(Type.String({ description: 'Absolute path to an existing image to edit or use as reference' })),
    caption: Type.Optional(Type.String({ description: 'Caption to send with the generated image via Telegram' })),
  }),
  execute: async (_toolCallId, params: {
    prompt: string;
    input_image_path?: string;
    caption?: string;
  }) => {
    const { prompt, input_image_path, caption } = params;

    const apiKey = process.env.GEMINI_API_KEY;
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!apiKey) {
      return {
        content: [{ type: 'text' as const, text: '❌ GEMINI_API_KEY is not set.' }],
        details: { error: 'Missing GEMINI_API_KEY' },
      };
    }
    if (!token || !chatId) {
      return {
        content: [{ type: 'text' as const, text: '❌ TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set.' }],
        details: { error: 'Missing Telegram credentials' },
      };
    }

    try {
      const parts: GeminiPart[] = [];

      if (input_image_path) {
        const imageData = await fs.readFile(input_image_path);
        const ext = path.extname(input_image_path).toLowerCase().replace('.', '');
        const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' };
        parts.push({ inlineData: { mimeType: mimeMap[ext] ?? 'image/jpeg', data: imageData.toString('base64') } });
      }

      parts.push({ text: prompt });

      const response = await fetch(
        `${API_BASE}/models/${MODEL}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts }],
            generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
          }),
        },
      );

      if (!response.ok) {
        const body = await response.text();
        return {
          content: [{ type: 'text' as const, text: `❌ Gemini API error (${response.status}): ${body.slice(0, 300)}` }],
          details: { error: body },
        };
      }

      const data = await response.json() as GeminiResponse;
      const parts_out = data.candidates?.[0]?.content?.parts ?? [];

      const imagePart = parts_out.find(p => p.inlineData);
      if (!imagePart?.inlineData) {
        const text = parts_out.find(p => p.text)?.text ?? '';
        return {
          content: [{ type: 'text' as const, text: `❌ Gemini returned no image.${text ? ` Response: ${text}` : ''}` }],
          details: { error: 'No image in response', text },
        };
      }

      const { mimeType, data: b64 } = imagePart.inlineData;
      const imageBuffer = Buffer.from(b64, 'base64');

      await sendTelegramPhoto(token, chatId, imageBuffer, mimeType, caption);

      const mode = input_image_path ? 'edited' : 'generated';
      return {
        content: [{ type: 'text' as const, text: `✅ Image ${mode} and sent! Prompt: "${prompt}"` }],
        details: { prompt, mode, bytes: imageBuffer.length, mimeType },
      };
    } catch (err: any) {
      return {
        content: [{ type: 'text' as const, text: `❌ Gemini image generation failed: ${err.message}` }],
        details: { error: err.message },
      };
    }
  },
};

export const metadata = {
  name: 'gemini-image',
  version: '1.0.0',
  description: 'Work-focused image generation and editing via Google Gemini REST API',
  author: 'fabiana-core',
};
