# LLM Providers

Fabiana runs on [Pi SDK](https://github.com/mariozechner/pi), which supports a wide range of model providers out of the box. You choose the provider and model in `config.json` — no code changes needed.

```json
{
  "model": {
    "provider": "anthropic",
    "modelId": "claude-sonnet-4-6",
    "thinkingLevel": "low"
  }
}
```

---

## Providers

### OpenRouter

The easiest starting point. One API key gives you access to 240+ models from every major lab — Anthropic, OpenAI, Google, Meta, Mistral, and more. Good for trying different models without setting up multiple accounts.

**Env var:** `OPENROUTER_API_KEY`
**Get one:** [openrouter.ai/keys](https://openrouter.ai/keys)

```json
{ "provider": "openrouter", "modelId": "anthropic/claude-sonnet-4-5" }
{ "provider": "openrouter", "modelId": "moonshotai/kimi-k2.5" }
{ "provider": "openrouter", "modelId": "google/gemini-2.5-flash" }
{ "provider": "openrouter", "modelId": "meta-llama/llama-4-maverick" }
```

---

### Anthropic (direct)

Direct access to Claude models. Usually cheaper than OpenRouter for Claude, and slightly faster.

**Env var:** `ANTHROPIC_API_KEY`
**Get one:** [console.anthropic.com](https://console.anthropic.com)

```json
{ "provider": "anthropic", "modelId": "claude-sonnet-4-6" }
{ "provider": "anthropic", "modelId": "claude-opus-4-6" }
{ "provider": "anthropic", "modelId": "claude-haiku-4-5" }
```

---

### OpenAI (direct)

Direct access to GPT and o-series models.

**Env var:** `OPENAI_API_KEY`
**Get one:** [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

```json
{ "provider": "openai", "modelId": "gpt-4o" }
{ "provider": "openai", "modelId": "gpt-4.1" }
{ "provider": "openai", "modelId": "gpt-4o-mini" }
```

---

### Google Gemini (direct)

Direct access to Gemini models via API key. Fast and cost-effective, especially Gemini Flash.

**Env var:** `GEMINI_API_KEY`
**Get one:** [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

```json
{ "provider": "google", "modelId": "gemini-2.5-flash" }
{ "provider": "google", "modelId": "gemini-2.5-pro" }
{ "provider": "google", "modelId": "gemini-2.0-flash" }
```

---

### Google Gemini CLI (OAuth)

Uses your existing Gemini CLI login — no API key needed. Useful if you're already authenticated via `gcloud` or the Gemini CLI.

**Auth:** Run `gemini` or `gcloud auth login` first
**No env var needed**

```json
{ "provider": "google-gemini-cli", "modelId": "gemini-2.5-pro" }
```

---

### Google Vertex AI

Enterprise Google Cloud access. Requires a GCP project with the Vertex AI API enabled and Application Default Credentials configured.

**Auth:** `gcloud auth application-default login`
**Env vars:** `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`

```json
{ "provider": "google-vertex", "modelId": "gemini-2.5-pro" }
{ "provider": "google-vertex", "modelId": "claude-sonnet-4-6" }
```

---

### Amazon Bedrock

Access models via your AWS account. Supports Claude (via Anthropic on Bedrock), Mistral, Amazon Nova, and others.

**Auth:** Any standard AWS credential method:
- `AWS_PROFILE` (named profile)
- `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY`
- `AWS_BEARER_TOKEN_BEDROCK`
- IAM roles, ECS task roles, IRSA

```json
{ "provider": "amazon-bedrock", "modelId": "anthropic.claude-sonnet-4-6" }
{ "provider": "amazon-bedrock", "modelId": "amazon.nova-premier-v1:0" }
```

---

### Mistral (direct)

Direct access to Mistral models, including Codestral and Magistral.

**Env var:** `MISTRAL_API_KEY`
**Get one:** [console.mistral.ai](https://console.mistral.ai)

```json
{ "provider": "mistral", "modelId": "magistral-medium-latest" }
{ "provider": "mistral", "modelId": "mistral-large-latest" }
```

---

### Groq

Extremely fast inference, often free for common open models. Great if you want low-latency responses. Rate limits apply on free tier.

**Env var:** `GROQ_API_KEY`
**Get one:** [console.groq.com](https://console.groq.com)

```json
{ "provider": "groq", "modelId": "llama-3.3-70b-versatile" }
{ "provider": "groq", "modelId": "moonshotai/kimi-k2-instruct" }
{ "provider": "groq", "modelId": "qwen-qwq-32b" }
```

---

### xAI (Grok)

xAI's Grok models, including vision-capable variants.

**Env var:** `XAI_API_KEY`
**Get one:** [console.x.ai](https://console.x.ai)

```json
{ "provider": "xai", "modelId": "grok-3" }
{ "provider": "xai", "modelId": "grok-3-fast" }
```

---

### GitHub Copilot

Uses your existing GitHub Copilot subscription — no separate API key.

**Auth:** `GH_TOKEN`, `GITHUB_TOKEN`, or `COPILOT_GITHUB_TOKEN`

```json
{ "provider": "github-copilot", "modelId": "claude-sonnet-4-5" }
{ "provider": "github-copilot", "modelId": "gpt-4o" }
```

---

### Azure OpenAI

OpenAI models deployed on Azure. Requires an Azure OpenAI resource.

**Env var:** `AZURE_OPENAI_API_KEY`

```json
{ "provider": "azure-openai-responses", "modelId": "gpt-4o" }
```

---

## Thinking levels

The `thinkingLevel` field controls how much reasoning budget the model gets before responding. Not all models support it — it's silently ignored for models that don't.

| Level | Description |
|---|---|
| `"minimal"` | Fastest, least reasoning |
| `"low"` | Light reasoning (default for most use) |
| `"medium"` | Balanced |
| `"high"` | Extended reasoning |
| `"xhigh"` | Maximum (supported by select models only) |

---

## Full `config.json` reference

```json
{
  "model": {
    "provider": "openrouter",
    "modelId": "anthropic/claude-sonnet-4-5",
    "thinkingLevel": "low"
  }
}
```

Only one model is active at a time. Change it and restart the daemon for it to take effect.
