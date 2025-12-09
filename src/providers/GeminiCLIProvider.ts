import { IAIProvider } from './IAIProvider';
import { ChatRequest, ChatResponse, StreamChunk, ProviderConfig } from '../types/provider';
import * as cp from 'child_process';
import * as util from 'util';

const exec = util.promisify(cp.exec);

export class GeminiCLIProvider implements IAIProvider {
    readonly id = 'gemini-cli';
    readonly name = 'Gemini CLI';
    readonly config: ProviderConfig;

    constructor() {
        this.config = {
            id: 'gemini-cli',
            name: 'Gemini CLI',
            baseUrl: '',
            apiKey: undefined,
            model: 'gemini-cli',
            timeout: 0,
            maxRetries: 0,
        };
    }

    async chat(request: ChatRequest): Promise<ChatResponse> {
        const lastMessage = request.messages[request.messages.length - 1];
        const prompt = lastMessage.content;

        try {
            // Escape double quotes in prompt to prevent shell issues
            const escapedPrompt = prompt.replace(/"/g, '\\"');
            const { stdout, stderr } = await exec(`gemini "${escapedPrompt}"`);

            if (stderr) {
                console.warn('Gemini CLI stderr:', stderr);
            }

            return {
                id: Date.now().toString(),
                content: stdout.trim(),
                model: 'gemini-cli',
                finishReason: 'stop',
                usage: {
                    promptTokens: 0,
                    completionTokens: 0,
                    totalTokens: 0,
                },
            };
        } catch (error) {
            throw new Error(`Gemini CLI failed: ${(error as Error).message}`);
        }
    }

    async *streamChat(request: ChatRequest): AsyncGenerator<StreamChunk> {
        // CLI doesn't easily support streaming in this simple wrapper
        // So we just await the full response and yield it as one chunk
        const response = await this.chat(request);
        yield {
            delta: response.content,
            done: true,
            finishReason: 'stop',
            model: 'gemini-cli'
        };
    }

    async isAvailable(): Promise<boolean> {
        try {
            await exec('gemini --version');
            return true;
        } catch {
            return false;
        }
    }

    async listModels(): Promise<string[]> {
        return ['gemini-cli'];
    }

    async validate(): Promise<void> {
        if (!(await this.isAvailable())) {
            throw new Error('Gemini CLI is not installed or not in PATH.');
        }
    }
}
