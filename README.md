# JunkRat AI 🐀

> **Plan smarter, code faster.** AI-powered phase planning for your coding projects.

![VS Code Version](https://img.shields.io/badge/VS%20Code-1.85+-blue)
![License](https://img.shields.io/badge/license-MIT-green)

JunkRat is a VS Code extension that transforms your coding ideas into structured, actionable implementation plans. It uses advanced AI to break down complex tasks into manageable phases, complete with file-specific instructions and verification steps.

## ✨ Features

### 🧠 Intelligent Phase Planning
- **Deep Analysis**: Transforms vague requirements into technical specifications.
- **Phased Approach**: Breaks work into logical phases (e.g., Backend, Frontend, Integration).
- **Task Granularity**: Generates specific tasks with goals, file targets, and step-by-step instructions.

### 📋 Traycer-Style Task Execution
- **Interactive UI**: Clean, modern interface inspired by top-tier planning tools.
- **Task Cards**: Clear visualization of each task's complexity and status.
- **One-Click Execution**:
  - **Copy to Clipboard**: Formatted perfectly for pasting into ChatGPT, Claude, or other AI assistants.
  - **Gemini CLI**: Execute tasks directly in your terminal (requires `@anthropic-ai/gemini-cli`).

### 🔄 Multi-Provider Support
| Provider | Description | Best For |
|----------|-------------|----------|
| **Ollama** | Local LLMs (Llama 3, Mistral, etc.) | Privacy & cost-free usage |
| **Gemini** | Google's AI models | fast inference, huge context window |
| **OpenRouter** | Aggregator for GPT-4, Claude 3, etc. | Accessing top-tier models |
| **Custom** | Any OpenAI-compatible endpoint | Enterprise or custom setups |

### ⚡ Smart Productivity
- **Conversation Management**: Save, load, and manage multiple planning sessions.
- **Phase Plan Export**: Export your plans to Markdown or JSON for documentation or external use.
- **Auto-Refresh**: Automatically detects when local providers (like Ollama) come online.

### 🏃 Run & Analyze
- **Intelligent Verification**: Execute project commands (like `npm test`) directly from the sidebar.
- **AI Analysis**: Captures stdout/stderr, analyzes failures, and identifies which phases are affected.
- **Auto-Verification**: Automatically marks phases as verified if tests pass.
- **Actionable Insights**: Provides suggestions and reasonings for test results.

## 📦 Installation

### From VS Code Marketplace
1. Open VS Code.
2. Go to Extensions (`Ctrl+Shift+X`).
3. Search for "JunkRat".
4. Click **Install**.

### Manual Installation (VSIX)
1. Download the latest `.vsix` file from the [Releases](https://github.com/zarigata/JunkRat/releases) page.
2. Open VS Code.
3. Go to Extensions -> `...` (Menu) -> **Install from VSIX...**
4. Select the downloaded file.

### Building from Source
```bash
git clone https://github.com/zarigata/JunkRat.git
cd JunkRat
npm install
npm run package
# This generates a junkrat-x.x.x.vsix file
```

## ⚙️ Configuration

JunkRat is highly configurable. Open VS Code Settings (`Ctrl+,`) and search for `junkrat`.

| Setting | Default | Description |
|---------|---------|-------------|
| `junkrat.activeProvider` | `ollama` | The AI provider to use. Options: `ollama`, `gemini`, `openrouter`, `custom`. |
| `junkrat.ollama.baseUrl` | `http://localhost:11434` | URL for your local Ollama instance. |
| `junkrat.ollama.model` | `llama3` | The model to use with Ollama. |
| `junkrat.gemini.apiKey` | - | Your Google AI Studio API key. |
| `junkrat.gemini.model` | `gemini-pro` | Gemini model name. |
| `junkrat.openrouter.apiKey` | - | Your OpenRouter API key. |
| `junkrat.openrouter.model` | `anthropic/claude-3-opus` | Model ID string for OpenRouter. |
| `junkrat.custom.baseUrl` | - | Custom OpenAI-compatible API endpoint. |
| `junkrat.custom.apiKey` | - | API key for custom endpoint. |
| `junkrat.telemetry.enabled`| `false` | Enable anonymous usage telemetry (optional). |
| `junkrat.runAnalysis.enabled` | `false` | Enable the Run & Analyze feature. |
| `junkrat.runAnalysis.command` | `npm test` | Shell command to execute for analysis. |
| `junkrat.runAnalysis.autoVerifyOnSuccess` | `false` | Auto-verify passing phases. |

## 🚀 Usage Guide

### Starting a Plan
1. Click the **JunkRat** icon in the sidebar.
2. Select your provider from the dropdown (e.g., `Ollama`).
3. Type your project idea in the chat (e.g., *"I want to build a React todo app with local storage persistence"*).
4. JunkRat will analyze requirements (Status: `Gathering Requirements`).
5. Provide more details if asked, or say *"Ready to plan"*.

### Working with Phase Plans
Once the plan is generated:
- **View Phase Cards**: Scroll through the generated phases.
- **Execute Tasks**:
  - Click **Copy All** to copy the entire markdown plan.
  - On individual tasks, click **Execute** -> **Copy to Clipboard** to paste the specific task instruction into another AI tool.
  - Or click **Execute** -> **Run in Gemini CLI** to have an agent attempt to code it immediately.
- **Export**:
  - Click **Export Markdown** to save the plan as a documentation file.
  - Click **Export JSON** to save structured data.
- **Run & Analyze**:
  - Click **Run & Analyze** to execute your test suite.
  - View AI analysis of results and suggestions.
  - Auto-verify phases if tests pass.

### Conversation Management
- **History**: Click the history icon (clock) to switch between planning sessions.
- **New Chat**: Click the `+` icon to start fresh.
- **Persistence**: Your conversations are automatically saved locally.

## 🔧 Troubleshooting

### Ollama Not Connecting
- Ensure Ollama is running (`ollama serve`).
- Verify the URL is correct (default `http://localhost:11434`).
- Check CORS settings if running in a containerized environment.

### API Key Errors
- Double-check your API keys for Gemini or OpenRouter.
- Ensure you have sufficient credits/quota for the selected provider.

### "Model Not Found"
- For Ollama: Run `ollama pull <model-name>` in your terminal to ensure the model exists.
- For API providers: Verify the model string is correct in settings.

## 🤝 Contributing

We welcome contributions!
1. Fork the repository.
2. Create `feature/your-feature` branch.
3. Commit changes.
4. Open a Pull Request.

See [CONTRIBUTING.md](CONTRIBUTING.md) for more details.

## Development Workflow

Before committing changes, always run:
```bash
npm run validate
```
This ensures code quality by running both typecheck and linting (including duplicate case detection).

## 🛣️ Roadmap
- [ ] VS Code Workspace Integration (read local files for context)
- [ ] Direct File Editing (apply changes without CLI)
- [ ] Team Collaboration features

## 📄 License
MIT © [zarigata](https://github.com/zarigata)

---
**Made with ❤️ for developers who plan before they code.**
