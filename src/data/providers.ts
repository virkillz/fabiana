export interface ProviderModel {
  id: string;
  name: string;
}

export interface Provider {
  id: string;
  name: string;
  description: string;
  envVar: string | null;
  authNote: string;
  models: ProviderModel[];
}

export const providers: Provider[] = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'One API key, 240+ models (easiest starting point)',
    envVar: 'OPENROUTER_API_KEY',
    authNote: 'Get one at openrouter.ai/keys',
    models: [
      { id: 'anthropic/claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
      { id: 'moonshotai/kimi-k2.5', name: 'Kimi K2.5' },
      { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'meta-llama/llama-4-maverick', name: 'Llama 4 Maverick' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic (direct)',
    description: 'Direct Claude access — usually cheaper and faster than OpenRouter for Claude',
    envVar: 'ANTHROPIC_API_KEY',
    authNote: 'Get one at console.anthropic.com',
    models: [
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
      { id: 'claude-opus-4-6', name: 'Claude Opus 4.6' },
      { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5 (fast & cheap)' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI (direct)',
    description: 'Direct GPT and o-series model access',
    envVar: 'OPENAI_API_KEY',
    authNote: 'Get one at platform.openai.com/api-keys',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4.1', name: 'GPT-4.1' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini (fast & cheap)' },
    ],
  },
  {
    id: 'google',
    name: 'Google Gemini (direct)',
    description: 'Fast and cost-effective, especially Gemini Flash',
    envVar: 'GEMINI_API_KEY',
    authNote: 'Get one at aistudio.google.com/apikey',
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (fast & cheap)' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    ],
  },
  {
    id: 'google-gemini-cli',
    name: 'Google Gemini CLI (OAuth)',
    description: 'Uses existing Gemini CLI login — no API key needed',
    envVar: null,
    authNote: "Run 'gemini' or 'gcloud auth login' first — no API key required",
    models: [{ id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' }],
  },
  {
    id: 'google-vertex',
    name: 'Google Vertex AI',
    description: 'Enterprise Google Cloud access — requires GCP project with Vertex AI enabled',
    envVar: 'GOOGLE_CLOUD_PROJECT',
    authNote: "Run 'gcloud auth application-default login' first",
    models: [
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6 (via Vertex)' },
    ],
  },
  {
    id: 'amazon-bedrock',
    name: 'Amazon Bedrock',
    description: 'AWS-hosted models — Claude, Mistral, Amazon Nova, and more',
    envVar: 'AWS_ACCESS_KEY_ID',
    authNote: 'Use AWS_PROFILE, AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY, or IAM roles',
    models: [
      { id: 'anthropic.claude-sonnet-4-6', name: 'Claude Sonnet 4.6 (via Bedrock)' },
      { id: 'amazon.nova-premier-v1:0', name: 'Amazon Nova Premier' },
    ],
  },
  {
    id: 'mistral',
    name: 'Mistral (direct)',
    description: 'Direct Mistral models, including Codestral and Magistral',
    envVar: 'MISTRAL_API_KEY',
    authNote: 'Get one at console.mistral.ai',
    models: [
      { id: 'magistral-medium-latest', name: 'Magistral Medium' },
      { id: 'mistral-large-latest', name: 'Mistral Large' },
    ],
  },
  {
    id: 'groq',
    name: 'Groq',
    description: 'Extremely fast inference, often free for common open models',
    envVar: 'GROQ_API_KEY',
    authNote: 'Get one at console.groq.com',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
      { id: 'moonshotai/kimi-k2-instruct', name: 'Kimi K2 Instruct' },
      { id: 'qwen-qwq-32b', name: 'Qwen QwQ 32B' },
    ],
  },
  {
    id: 'xai',
    name: 'xAI (Grok)',
    description: 'Grok models with vision capabilities',
    envVar: 'XAI_API_KEY',
    authNote: 'Get one at console.x.ai',
    models: [
      { id: 'grok-3', name: 'Grok 3' },
      { id: 'grok-3-fast', name: 'Grok 3 Fast' },
    ],
  },
  {
    id: 'github-copilot',
    name: 'GitHub Copilot',
    description: 'Uses your existing GitHub Copilot subscription — no separate API key',
    envVar: 'GH_TOKEN',
    authNote: 'Use GH_TOKEN, GITHUB_TOKEN, or COPILOT_GITHUB_TOKEN',
    models: [
      { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
      { id: 'gpt-4o', name: 'GPT-4o' },
    ],
  },
  {
    id: 'azure-openai-responses',
    name: 'Azure OpenAI',
    description: 'OpenAI models deployed on Azure — requires an Azure OpenAI resource',
    envVar: 'AZURE_OPENAI_API_KEY',
    authNote: 'Requires an Azure OpenAI resource and deployment',
    models: [{ id: 'gpt-4o', name: 'GPT-4o (via Azure)' }],
  },
];
