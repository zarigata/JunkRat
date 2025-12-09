# JunkRat AI 🐀

> **Plan smarter, code faster.** AI-powered phase planning for your coding projects.

![VS Code Version](https://img.shields.io/badge/VS%20Code-1.85+-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Features

### 🧠 Intelligent Phase Planning
Transform vague project ideas into detailed, actionable implementation plans with AI-powered analysis.

### 📋 Traycer-Style Task Execution
- **Phase cards** with complexity badges
- **Task breakdown** with step-by-step instructions
- **One-click execution** via Gemini CLI or clipboard

### 🔄 Multi-Provider Support
- **Ollama** (local models)
- **Gemini** (Google AI)
- **OpenRouter** (multiple providers)
- **Gemini CLI** (autonomous coding)
- **Custom endpoints**

### ⚡ Smart Features
- Auto-refresh when providers become available
- Model selector for Ollama
- Deep reasoning prompts for better plans

## 📦 Installation

1. Install from VS Code Marketplace *(coming soon)*
2. Or install manually:
   ```bash
   git clone https://github.com/zarigata/JunkRat.git
   cd JunkRat
   npm install
   npm run compile
   ```
3. Press `F5` to launch Extension Development Host

## 🚀 Quick Start

1. Open the JunkRat sidebar (rat icon)
2. Select your AI provider
3. Describe your project idea
4. Get a detailed implementation plan
5. Execute tasks with one click!

## ⚙️ Configuration

| Setting | Description |
|---------|-------------|
| `junkrat.activeProvider` | Default AI provider |
| `junkrat.ollama.baseUrl` | Ollama server URL |
| `junkrat.gemini.apiKey` | Google AI API key |
| `junkrat.openrouter.apiKey` | OpenRouter API key |

## 🛠️ Development

```bash
# Install dependencies
npm install

# Type check
npm run typecheck

# Build
npm run compile

# Watch mode
npm run watch
```

## 📄 License

MIT © [zarigata](https://github.com/zarigata)

---

**Made with ❤️ for developers who plan before they code.**
