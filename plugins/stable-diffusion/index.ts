import { Type } from '@sinclair/typebox';
import type { ToolDefinition } from '@mariozechner/pi-coding-agent';

const DEFAULT_SD_URL = 'https://kitten-well-lemur.ngrok-free.app';

interface Txt2ImgResponse {
  images: string[];
  info?: string;
}

async function sendTelegramPhoto(token: string, chatId: string, imageBuffer: Buffer, caption?: string): Promise<void> {
  const formData = new FormData();
  formData.append('chat_id', chatId);
  formData.append('photo', new File([imageBuffer], 'image.png', { type: 'image/png' }));
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
  name: 'generate_image',
  label: 'Generate Image',
  description: `Generate an image using Stable Diffusion and send it via Telegram. Use for:
- Creating visual art, illustrations, or scenes to share
- Expressing creativity beyond words
- Visualizing ideas, moods, or topics you're discussing
- Surprising the user with an unexpected image related to the conversation
- Responding to image requests or creative prompts`,
  parameters: Type.Object({
    prompt: Type.String({ description: 'Text prompt describing the image to generate' }),
    negative_prompt: Type.Optional(Type.String({ description: 'What to avoid in the image' })),
    steps: Type.Optional(Type.Number({ description: 'Sampling steps (default: 20, range: 10-50)', default: 20 })),
    width: Type.Optional(Type.Number({ description: 'Image width in pixels (default: 512)', default: 512 })),
    height: Type.Optional(Type.Number({ description: 'Image height in pixels (default: 512)', default: 512 })),
    cfg_scale: Type.Optional(Type.Number({ description: 'How closely to follow the prompt (default: 7, range: 1-20)', default: 7 })),
    caption: Type.Optional(Type.String({ description: 'Caption to send with the image' })),
  }),
  execute: async (_toolCallId, params: {
    prompt: string;
    negative_prompt?: string;
    steps?: number;
    width?: number;
    height?: number;
    cfg_scale?: number;
    caption?: string;
  }) => {
    const {
      prompt,
      negative_prompt = '',
      steps = 20,
      width = 512,
      height = 512,
      cfg_scale = 7,
      caption,
    } = params;

    const sdUrl = process.env.SD_API_URL ?? DEFAULT_SD_URL;
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      return {
        content: [{ type: 'text' as const, text: '❌ TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set.' }],
        details: { error: 'Missing Telegram credentials' },
      };
    }

    try {
      // Call Stable Diffusion txt2img API
      const sdResponse = await fetch(`${sdUrl}/sdapi/v1/txt2img`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({
          prompt,
          negative_prompt,
          steps: Math.min(Math.max(steps, 10), 50),
          width,
          height,
          cfg_scale,
          sampler_name: 'DPM++ 2M',
        }),
      });

      if (!sdResponse.ok) {
        const body = await sdResponse.text();
        return {
          content: [{ type: 'text' as const, text: `❌ Stable Diffusion error (${sdResponse.status}): ${body.slice(0, 300)}` }],
          details: { error: body },
        };
      }

      const data = await sdResponse.json() as Txt2ImgResponse;

      if (!data.images || data.images.length === 0) {
        return {
          content: [{ type: 'text' as const, text: '❌ No images returned from Stable Diffusion.' }],
          details: { error: 'Empty images array' },
        };
      }

      // Decode base64 image
      const base64 = data.images[0];
      const imageBuffer = Buffer.from(base64, 'base64');

      // Send via Telegram
      await sendTelegramPhoto(token, chatId, imageBuffer, caption);

      return {
        content: [{ type: 'text' as const, text: `✅ Image generated and sent! Prompt: "${prompt}"` }],
        details: { prompt, size: `${width}x${height}`, steps, bytes: imageBuffer.length },
      };
    } catch (err: any) {
      return {
        content: [{ type: 'text' as const, text: `❌ Image generation failed: ${err.message}` }],
        details: { error: err.message },
      };
    }
  },
};

export const metadata = {
  name: 'stable-diffusion',
  version: '1.0.0',
  description: 'Image generation via Stable Diffusion WebUI API',
  author: 'fabiana-core',
};
