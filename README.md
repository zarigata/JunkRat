# JunkRat - AI Phase Planner

AI-powered phase planning tool for VS Code with multi-provider AI support for intelligent coding assistance and project planning.

## Description

JunkRat is an intelligent VS Code extension designed to help developers plan and execute complex coding tasks through AI-powered assistance. Break down large projects into manageable phases and get AI help throughout your development workflow using local LLM models via Ollama.

## Features

- 💬 **Interactive sidebar chat interface** for conversing with AI
- 🎨 **Modern, theme-aware UI** that adapts to VS Code's color scheme
- ⚡ **Real-time message passing** between UI and extension
- 🤖 **AI-powered chat with multiple provider support**
- 🔄 **Streaming and non-streaming response modes**
- 🔌 **Extensible provider architecture** for multiple AI backends
- ⚡ **Automatic retry with exponential backoff** for reliability
- 🛡️ **Robust error handling and timeout management**
- ⚙️ **Native VS Code settings for provider configuration**
- 🔁 **Instant provider switching from the chat interface**
- ✅ **Built-in validation for API keys, endpoints, and connectivity**
- 📊 **Configuration helper view with real-time provider status**

### Supported Providers

- 🏠 **Ollama** - Local LLM support (default, no API key required)
- 🌟 **Google Gemini** - Latest Gemini models via Google AI Studio
- 🌐 **OpenRouter** - Access to 100+ models from multiple providers
- 🔧 **Custom** - Any OpenAI-compatible endpoint (LM Studio, LocalAI, vLLM, etc.)

## Installation

### From Marketplace (Coming Soon)
Search for "JunkRat" in the VS Code Extensions marketplace.

### From VSIX
1. Download the latest `.vsix` file from releases
2. Open VS Code
## Usage

## Configuration

### Opening Settings
- Open the Command Palette and run `JunkRat: Open Settings`.
- Or open **Settings > Extensions > JunkRat**.
- You can also click **Refresh** in the chat provider dropdown or the gear button in the **Configuration** view to jump directly into settings.

### Configuring Providers
- **Select an active provider** via `junkrat.activeProvider` in Settings or the chat dropdown.
- **Ollama**: configure `junkrat.ollama.baseUrl`, `junkrat.ollama.model`, and timeout. No API key required.
- **Gemini**: set `junkrat.gemini.enabled`, paste your API key (machine-scoped), and pick the default model.
- **OpenRouter**: enable the provider, add your API key, and choose a hosted model (e.g., `openai/gpt-4o`).
- **Custom**: point to any OpenAI-compatible URL, optionally set an API key, and define the default model.

All provider settings live under the `junkrat.*` namespace, support VS Code's Settings UI, and respect `ignoreSync` for secrets.

### Switching Providers
- Use the dropdown at the top of the chat webview to switch instantly.
- Run the `JunkRat: Switch Provider` command to pick from a quick list.
- The currently active provider is stored in `junkrat.activeProvider` and persists across sessions.

### Validation & Status
- The **Configuration** view in the JunkRat sidebar shows provider availability, validation errors, and warnings.
- Run `JunkRat: Validate Configuration` to check all providers at once.
- Use the **Test** buttons in the Configuration view to validate individual providers.
- Validation ensures required fields are present, URLs are valid, and connectivity checks succeed.

## Usage

### Using the Chat Interface
1. Configure your desired provider in Settings (see above) or keep Ollama as default.
2. Click the JunkRat icon in the Activity Bar (left sidebar) to open the AI Chat panel.
3. Pick an active provider from the dropdown if needed.
4. Type your message in the input field at the bottom.
5. Press Enter to send (Shift+Enter for new lines).
6. The AI assistant responds using the selected provider.

**Note**: If your chosen provider is unavailable, the status indicator shows the issue. Launch Ollama with `ollama serve` or verify remote API credentials as required.

### Alternative: Command Palette
1. Open Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
2. Type "JunkRat: Open Chat" to open the chat interface
3. Type "JunkRat: Open Settings" to jump into provider configuration
4. Type "JunkRat: Switch Provider" to toggle providers without opening Settings
5. Type "JunkRat: Validate Configuration" to run health checks

## Troubleshooting

### Common Issues

- **Ollama: "Ollama is not running" Warning**
- **Ollama: "Model not found" Error**
- **Ollama: Connection Timeout**
- **Ollama: Slow Responses**
- **Provider not available** — Check the Configuration view for status details and rerun validation.
- **API key rejected** — Re-enter the key in Settings (machine-scoped and not synced) and validate again.
- **Can't switch providers** — Ensure the provider is enabled and passes validation before selecting it.
- **Gemini: Invalid API key** — Verify the key from Google AI Studio.
- **Gemini: Quota exceeded** — Check usage limits in the AI Studio console.
- **Gemini: Model not found** — Ensure the request uses a supported Gemini model name.
- **OpenRouter: Insufficient credits** — Add balance at https://openrouter.ai/credits.
- **OpenRouter: Model not available** — Confirm the model exists and is accessible from OpenRouter.
- **OpenRouter: Rate limited** — Reduce request frequency or upgrade your plan.
- **Custom: Connection refused** — Ensure the OpenAI-compatible server is running and reachable.
- **Custom: Model not found** — Verify the server exposes the specified model.
- **Custom: Incompatible API** — Confirm the server implements the OpenAI `/chat/completions` and `/models` endpoints.

## Development

### Prerequisites (Provider-Specific)
- Node.js (v18 or higher)
- npm
- Visual Studio Code
- Ollama (for default provider testing) — configure via Settings after installation

#### Ollama
- Install from https://ollama.ai
- Start the service with `ollama serve`
- Pull models such as `ollama pull llama3`

#### Gemini
- Obtain an API key from https://aistudio.google.com/apikey
- Free tier available with generous limits
- Supports Gemini 2.0 Flash and Pro models

#### OpenRouter
- Generate an API key at https://openrouter.ai/keys
- Pay-per-use pricing with access to GPT-4, Claude, and more
- No subscription required

#### Custom Provider
- Works with any OpenAI-compatible server (LM Studio, LocalAI, vLLM, text-generation-webui, etc.)
- Configure the base URL and model to match your server
- API key is optional depending on the server

### Setup
```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes
npm run watch
```

### Testing
1. Press F5 in VS Code to launch Extension Development Host
2. A new VS Code window will open with the extension loaded
3. Test AI features by starting Ollama: `ollama serve` in a separate terminal
4. Test commands in the Command Palette

### Build Commands
- `npm run compile` - Build the extension once
- `npm run watch` - Watch for changes and rebuild automatically
- `npm run package` - Create production build
- `npm run typecheck` - Run TypeScript type checking
- `npm run lint` - Run ESLint

### Provider Comparison

| Provider | API Key Required | Cost | Latency | Models |
| --- | --- | --- | --- | --- |
| Ollama | No | Free | Fast (local) | Any Ollama model |
| Gemini | Yes | Free tier + paid | Medium | Gemini 2.0 Flash, Pro |
| OpenRouter | Yes | Pay-per-use | Varies | 100+ hosted models |
| Custom | Optional | Varies | Varies | Depends on server |

## Architecture

### Provider Abstraction Layer
- **IAIProvider Interface**: Core contract for AI provider implementations
- **ProviderFactory**: Factory pattern for creating provider instances
- **ProviderRegistry**: Service locator for managing multiple providers
- **ChatService**: Orchestration layer between UI and AI providers
- **Providers**: `OllamaProvider`, `GeminiProvider`, `OpenRouterProvider`, and `CustomProvider`

### Key Components
- **ChatViewProvider**: Manages webview lifecycle and message handling
- **Retry Logic**: Exponential backoff with jitter for resilient API calls
- **Error Handling**: Structured error types with retry capabilities
- **Streaming Support**: Real-time response streaming from AI providers

### Future Extensibility
The architecture supports easy addition of new AI providers through the provider interface pattern and shared OpenAI-compatible request format.

## Settings Reference

| Setting | Description | Default | Scope |
| --- | --- | --- | --- |
| `junkrat.activeProvider` | Active provider for chat and planning | `ollama` | Window |
| `junkrat.ollama.enabled` | Toggle Ollama provider availability | `true` | Window |
| `junkrat.ollama.baseUrl` | Ollama server URL | `http://127.0.0.1:11434` | Window |
| `junkrat.ollama.model` | Default Ollama model name | `llama3` | Window |
| `junkrat.ollama.timeout` | Request timeout (ms) | `30000` | Window |
| `junkrat.gemini.enabled` | Toggle Gemini provider | `false` | Window |
| `junkrat.gemini.apiKey` | Gemini API key (not synced) | `` | Machine-overridable |
| `junkrat.gemini.model` | Default Gemini model | `gemini-2.0-flash-exp` | Window |
| `junkrat.gemini.timeout` | Gemini request timeout (ms) | `60000` | Window |
| `junkrat.openrouter.enabled` | Toggle OpenRouter provider | `false` | Window |
| `junkrat.openrouter.apiKey` | OpenRouter API key (not synced) | `` | Machine-overridable |
| `junkrat.openrouter.model` | Default OpenRouter model | `openai/gpt-4o` | Window |
| `junkrat.openrouter.timeout` | OpenRouter request timeout (ms) | `60000` | Window |
| `junkrat.custom.enabled` | Toggle custom OpenAI-compatible provider | `false` | Window |
| `junkrat.custom.baseUrl` | Custom provider base URL | `http://localhost:8080/v1` | Window |
| `junkrat.custom.apiKey` | Custom provider API key | `` | Machine-overridable |
| `junkrat.custom.model` | Default custom model | `gpt-3.5-turbo` | Window |
| `junkrat.custom.timeout` | Custom provider request timeout (ms) | `60000` | Window |

## Roadmap

- ✅ Phase 1: Project scaffolding and basic extension setup
- ✅ Phase 2: Chat interface implementation
- ✅ Phase 3: AI provider integration (Ollama)
- 📅 Phase 4: Phase generation and planning logic
- 📅 Phase 5: Context analysis and code understanding
- 📅 Phase 6: Multi-provider support (Gemini, OpenRouter)
- 📅 Phase 7: Advanced configuration management

## License

MIT License - see [LICENSE](LICENSE) file for details

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

### Development Guidelines
- Follow TypeScript best practices
- Maintain test coverage
- Update documentation for new features
- Follow the existing code style
