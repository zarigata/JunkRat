import { IAIProvider } from '../providers/IAIProvider';
import { ChatRequest, ChatResponse } from '../types/provider';
import {
  ConversationState,
  Phase,
  PhasePlan,
  PhasePlanMetadata,
} from '../types/conversation';
import { PromptEngine } from './PromptEngine';
import { PromptRole } from '../types/prompts';

interface PhaseCountRange {
  minPhases: number;
  maxPhases: number;
}

interface ParsedPhasePlan {
  title: string;
  description: string;
  phases: Array<Partial<Phase>>;
}

export interface PhasePlanAnalysis {
  totalPhases: number;
  complexityDistribution: Record<'low' | 'medium' | 'high', number>;
  dependencyGraph: Map<string, string[]>;
  criticalPath: string[];
  estimatedDuration: string;
}

export class PhaseGenerator {
  constructor(private readonly _promptEngine: PromptEngine) { }

  async generatePhasePlan(
    requirements: string,
    conversationId: string,
    provider: IAIProvider
  ): Promise<PhasePlan> {
    const phaseCountRange = this._determinePhaseCount(requirements);

    const renderedPrompt = this._promptEngine.renderPrompt(PromptRole.PHASE_PLANNER, {
      conversationState: ConversationState.GENERATING_PHASES,
      requirements,
      minPhases: phaseCountRange.minPhases,
      maxPhases: phaseCountRange.maxPhases,
      additionalContext: {},
    });

    const initialResponse = await this._requestPhasePlan(provider, renderedPrompt);

    try {
      return this._buildPhasePlan(initialResponse, conversationId, phaseCountRange, requirements);
    } catch (error) {
      const retryResponse = await this._requestPhasePlan(provider, renderedPrompt, true);
      return this._buildPhasePlan(retryResponse, conversationId, phaseCountRange, requirements);
    }
  }

  analyzePhasePlan(plan: PhasePlan): PhasePlanAnalysis {
    const complexityDistribution: Record<'low' | 'medium' | 'high', number> = {
      low: 0,
      medium: 0,
      high: 0,
    };

    const dependencyGraph = new Map<string, string[]>();

    plan.phases.forEach((phase) => {
      if (phase.estimatedComplexity) {
        complexityDistribution[phase.estimatedComplexity] += 1;
      }
      dependencyGraph.set(phase.id, [...phase.dependencies]);
    });

    const criticalPath = this._calculateCriticalPath(dependencyGraph);
    const estimatedDuration = this._estimateDuration(plan);

    return {
      totalPhases: plan.totalPhases,
      complexityDistribution,
      dependencyGraph,
      criticalPath,
      estimatedDuration,
    };
  }

  private async _requestPhasePlan(
    provider: IAIProvider,
    renderedPrompt: ReturnType<PromptEngine['renderPrompt']>,
    isRetry = false
  ): Promise<ChatResponse> {
    const messages: ChatRequest['messages'] = [
      { role: 'system', content: renderedPrompt.systemMessage },
    ];

    if (renderedPrompt.userMessage) {
      messages.push({ role: 'user', content: renderedPrompt.userMessage });
    }

    const baseInstruction = 'Generate the phase plan based on the requirements above.';
    const retryInstruction =
      'The previous response could not be parsed. Return strict JSON only following the required schema.';

    messages.push({ role: 'user', content: isRetry ? retryInstruction : baseInstruction });

    const request: ChatRequest = {
      messages,
      model: undefined,
      temperature: undefined,
      maxTokens: undefined,
      stream: false,
      signal: undefined,
    };

    return provider.chat(request);
  }

  private _buildPhasePlan(
    response: ChatResponse,
    conversationId: string,
    phaseCountRange: PhaseCountRange,
    requirements: string
  ): PhasePlan {
    const parsed = this._parsePhasePlanJSON(response.content);

    this._validatePhasePlan(parsed, phaseCountRange);

    const phases: Phase[] = parsed.phases.map((phase, index) => {
      const id = phase.id ?? this._formatPhaseId(index + 1);
      const order = phase.order ?? index + 1;

      return {
        id,
        title: phase.title ?? `Phase ${order}`,
        description: phase.description ?? 'No description provided.',
        order,
        estimatedComplexity: phase.estimatedComplexity ?? 'medium',
        dependencies: phase.dependencies ?? [],
        tags: phase.tags ?? [],
        files: phase.files ?? [],
        status: 'pending',
      };
    });

    const metadata: PhasePlanMetadata = {
      estimatedDuration: this._estimateDurationFromPhases(phases),
      complexity: this._assessPlanComplexity(phases.length),
      technologies: this._extractTechnologies(requirements),
    };

    const plan: PhasePlan = {
      id: this._generateId('plan'),
      conversationId,
      title: parsed.title ?? 'Phase Plan',
      description: parsed.description ?? 'Automatically generated phase plan.',
      phases,
      totalPhases: phases.length,
      createdAt: Date.now(),
      metadata,
    };

    return plan;
  }

  private _determinePhaseCount(requirements: string): PhaseCountRange {
    const wordCount = requirements.trim().split(/\s+/).length;
    const lowerRequirements = requirements.toLowerCase();

    let minPhases = 3;
    let maxPhases = 10;

    if (wordCount >= 100 && wordCount < 500) {
      minPhases = 10;
      maxPhases = 50;
    } else if (wordCount >= 500 && wordCount < 1000) {
      minPhases = 50;
      maxPhases = 200;
    } else if (wordCount >= 1000) {
      minPhases = 100;
      maxPhases = 1000;
    }

    if (
      lowerRequirements.includes('microservices') ||
      lowerRequirements.includes('full-stack') ||
      lowerRequirements.includes('enterprise')
    ) {
      minPhases = Math.max(minPhases, 20);
      maxPhases = Math.max(maxPhases, 100);
    }

    const technologyMatches = requirements.match(/react|angular|vue|node|python|java|.net|graphql/gi);
    if (technologyMatches && technologyMatches.length > 3) {
      maxPhases = Math.min(1000, maxPhases + 50);
    }

    return {
      minPhases,
      maxPhases: Math.min(1000, maxPhases),
    };
  }

  private _parsePhasePlanJSON(content: string): ParsedPhasePlan {
    const trimmed = content.trim();

    const codeBlockMatch = trimmed.match(/```json\s*([\s\S]*?)```/i);
    const jsonString = codeBlockMatch ? codeBlockMatch[1].trim() : this._extractJson(trimmed);

    if (!jsonString) {
      throw new Error('Unable to locate JSON in AI response.');
    }

    try {
      return JSON.parse(jsonString) as ParsedPhasePlan;
    } catch (error) {
      throw new Error(`Failed to parse JSON phase plan: ${(error as Error).message}`);
    }
  }

  private _extractJson(text: string): string | undefined {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? jsonMatch[0] : undefined;
  }

  private _validatePhasePlan(plan: ParsedPhasePlan, phaseCountRange: PhaseCountRange): void {
    if (!plan || typeof plan !== 'object') {
      throw new Error('Phase plan is not an object.');
    }

    if (!plan.title || !plan.description) {
      throw new Error('Phase plan must include title and description.');
    }

    if (!Array.isArray(plan.phases) || plan.phases.length === 0) {
      throw new Error('Phase plan must include at least one phase.');
    }

    if (plan.phases.length > 1000) {
      throw new Error('Phase plan exceeds maximum supported phases (1000).');
    }

    plan.phases.forEach((phase, index) => {
      if (!phase.title || !phase.description) {
        throw new Error(`Phase at index ${index} is missing title or description.`);
      }
    });

    const phaseIds = new Set<string>();
    plan.phases.forEach((phase, index) => {
      const id = phase.id ?? this._formatPhaseId(index + 1);
      if (phaseIds.has(id)) {
        throw new Error(`Duplicate phase id detected: ${id}`);
      }
      phaseIds.add(id);
    });

    plan.phases.forEach((phase) => {
      const dependencies = phase.dependencies ?? [];
      dependencies.forEach((dependency) => {
        if (!phaseIds.has(dependency)) {
          throw new Error(`Phase dependency not found: ${dependency}`);
        }
      });
    });

    if (plan.phases.length < phaseCountRange.minPhases) {
      throw new Error('Generated plan contains fewer phases than requested minimum.');
    }

    if (plan.phases.length > phaseCountRange.maxPhases) {
      throw new Error('Generated plan contains more phases than requested maximum.');
    }
  }

  private _calculateCriticalPath(graph: Map<string, string[]>): string[] {
    let longestPath: string[] = [];

    const visit = (node: string, path: string[], visited: Set<string>): void => {
      const newPath = [...path, node];
      if (newPath.length > longestPath.length) {
        longestPath = newPath;
      }

      const dependencies = graph.get(node) ?? [];
      dependencies.forEach((dependency) => {
        if (!visited.has(dependency)) {
          const nextVisited = new Set(visited);
          nextVisited.add(dependency);
          visit(dependency, newPath, nextVisited);
        }
      });
    };

    Array.from(graph.keys()).forEach((node) => visit(node, [], new Set([node])));

    return longestPath;
  }

  private _estimateDuration(plan: PhasePlan): string {
    const complexityWeights: Record<string, number> = {
      low: 1,
      medium: 2,
      high: 3,
    };

    const totalWeight = plan.phases.reduce((acc, phase) => {
      const weight = complexityWeights[phase.estimatedComplexity ?? 'medium'] ?? 2;
      return acc + weight;
    }, 0);

    const estimatedWeeks = Math.max(1, Math.round(totalWeight / 2));
    return `${estimatedWeeks} week${estimatedWeeks === 1 ? '' : 's'}`;
  }

  private _estimateDurationFromPhases(phases: Phase[]): string | undefined {
    const plan: PhasePlan = {
      id: 'temp',
      conversationId: 'temp',
      title: 'temp',
      description: 'temp',
      phases,
      totalPhases: phases.length,
      createdAt: Date.now(),
      metadata: {
        complexity: 'moderate',
        technologies: [],
      },
    };

    return this._estimateDuration(plan);
  }

  private _assessPlanComplexity(totalPhases: number): 'simple' | 'moderate' | 'complex' | 'very-complex' {
    if (totalPhases <= 10) {
      return 'simple';
    }
    if (totalPhases <= 40) {
      return 'moderate';
    }
    if (totalPhases <= 150) {
      return 'complex';
    }
    return 'very-complex';
  }

  private _extractTechnologies(requirements: string): string[] {
    const technologies = new Set<string>();
    const matches = requirements.match(/([a-z0-9+.#-]{2,})/gi) ?? [];
    const normalized = matches.map((token) => token.toLowerCase());

    const techKeywords = [
      'react',
      'angular',
      'vue',
      'svelte',
      'node',
      'express',
      'nestjs',
      'python',
      'django',
      'flask',
      'fastapi',
      'java',
      'spring',
      'kotlin',
      'swift',
      'go',
      'rust',
      'c#',
      '.net',
      'graphql',
      'postgres',
      'mysql',
      'mongodb',
      'redis',
      'docker',
      'kubernetes',
      'aws',
      'azure',
      'gcp',
      'tailwind',
      'storybook',
      'next.js',
      'nuxt',
      'remix',
      'react native',
      'flutter',
    ];

    techKeywords.forEach((keyword) => {
      const normalizedKeyword = keyword.toLowerCase();
      if (normalized.includes(normalizedKeyword)) {
        technologies.add(keyword);
      }
    });

    return Array.from(technologies);
  }

  private _formatPhaseId(order: number): string {
    return `phase-${String(order).padStart(3, '0')}`;
  }

  private _generateId(prefix: string): string {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }

    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
  }
}
