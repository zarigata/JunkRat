import {
  PromptContext,
  PromptRole,
  PromptTemplate,
  RenderedPrompt,
  RenderedPromptMetadata,
} from '../types/prompts';

export class PromptEngine {
  private readonly _templates: Map<string, PromptTemplate> = new Map();
  private readonly _defaultTemplates: Map<PromptRole, string> = new Map();

  constructor() {
    this._loadDefaultTemplates();
  }

  renderPrompt(role: PromptRole, context: PromptContext): RenderedPrompt {
    const templateId = this._defaultTemplates.get(role);
    if (!templateId) {
      throw new Error(`No default template registered for role ${role}`);
    }

    const template = this._templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found for role ${role}`);
    }

    this._validateContextVariables(template, context);

    const systemMessage = this._renderTemplate(template.systemPrompt, context);
    const userMessage = template.userPromptTemplate
      ? this._renderTemplate(template.userPromptTemplate, context)
      : undefined;

    const renderedAt = Date.now();
    const estimatedTokens = this._estimateTokens(systemMessage + (userMessage ?? ''));

    const metadata: RenderedPromptMetadata = {
      templateId,
      renderedAt,
      estimatedTokens,
    };

    return {
      systemMessage,
      userMessage,
      role,
      metadata,
    };
  }

  getTemplate(templateId: string): PromptTemplate | undefined {
    return this._templates.get(templateId);
  }

  registerTemplate(template: PromptTemplate): void {
    if (!template.id) {
      throw new Error('Template must have an id');
    }

    this._templates.set(template.id, template);
  }

  setDefaultTemplate(role: PromptRole, templateId: string): void {
    if (!this._templates.has(templateId)) {
      throw new Error(`Template ${templateId} must be registered before use`);
    }

    this._defaultTemplates.set(role, templateId);
  }

  private _validateContextVariables(template: PromptTemplate, context: PromptContext): void {
    for (const variable of template.variables) {
      if (!(variable in context)) {
        throw new Error(`Missing required variable ${variable} for template ${template.id}`);
      }
    }
  }

  private _renderTemplate(template: string, context: PromptContext): string {
    return template.replace(/{{(\w+)}}/g, (match, key) => {
      const value = context[key];
      if (value === undefined || value === null) {
        return match;
      }

      if (Array.isArray(value)) {
        return value.join(', ');
      }

      return String(value);
    });
  }

  private _estimateTokens(text: string): number {
    // TODO: integrate gpt-tokenizer for accurate counts
    return Math.ceil(text.length / 4);
  }

  private _loadDefaultTemplates(): void {
    this._registerRequirementGathererTemplate();
    this._registerRequirementAnalyzerTemplate();
    this._registerPhasePlannerTemplate();
    this._registerSinglePhasePlannerTemplate();
    this._registerSummarizerTemplate();
  }

  private _registerRequirementGathererTemplate(): void {
    const template: PromptTemplate = {
      id: 'requirement-gatherer-v1',
      name: 'Requirement Gatherer',
      description: 'Asks strategic clarifying questions in a casual, friendly tone.',
      systemPrompt: `You're a chill software architect helping vibe coders plan their projects. Your goal is to gather enough info to create an EPIC, ACTIONABLE implementation plan.

## YOUR VIBE:
- Be friendly, encouraging, and conversational
- Use casual language (but stay professional)
- Show genuine excitement about their project
- Make them feel like you're on their team

## YOUR APPROACH:
1. Listen to what they want to build
2. Spot any gaps or unclear parts
3. Ask 2-3 smart questions at a time (don't overwhelm)
4. Focus on stuff that actually matters for building it

## KEY AREAS TO COVER:
- **The Big Idea**: What problem does this solve? Who's it for?
- **Must-Have Features**: What absolutely needs to be in v1?
- **Tech Preferences**: Any languages/frameworks they love or hate?
- **Scale**: Is this for 10 users or 10,000?
- **Integrations**: Does it need to talk to other services/APIs?
- **User Accounts**: Do people need to log in?
- **Data**: What needs to be saved?
- **Timeline**: MVP first or go all-in?

## WHEN YOU HAVE ENOUGH:
Say something like: "Alright, I think I've got the full picture! Ready for me to generate your phase plan?"

Keep it real, keep it helpful, and let's build something awesome! 🚀`,
      variables: ['conversationState'],
    };

    this.registerTemplate(template);
    this._defaultTemplates.set(PromptRole.REQUIREMENT_GATHERER, template.id);
  }

  private _registerRequirementAnalyzerTemplate(): void {
    const template: PromptTemplate = {
      id: 'requirement-analyzer-v1',
      name: 'Requirement Analyzer',
      description: 'Analyzes gathered requirements to extract structured information.',
      systemPrompt:
        'You are analyzing project requirements to prepare for phase planning. Extract key information: project type, technologies, features, constraints, and complexity. Output a structured summary in this format:\n\nProject Type: [type]\nTechnologies: [list]\nKey Features: [list]\nConstraints: [list]\nComplexity: [simple/moderate/complex/very-complex]\n\nBe concise and factual.',
      variables: ['conversationState', 'requirements'],
    };

    this.registerTemplate(template);
    this._defaultTemplates.set(PromptRole.REQUIREMENT_ANALYZER, template.id);
  }

  private _registerPhasePlannerTemplate(): void {
    const template: PromptTemplate = {
      id: 'phase-planner-v1',
      name: 'Phase Planner',
      description: 'Generates a detailed, deeply-researched phase plan with actionable single-prompt tasks.',
      systemPrompt: `You are an expert software architect and project planner. Your task is to create a COMPREHENSIVE, WELL-RESEARCHED implementation plan.

## YOUR PROCESS (Follow this exactly):

### Step 1: DEEP ANALYSIS
- What is the user actually trying to build?
- What are ALL the components needed?
- What technologies/frameworks are optimal?
- What are the dependencies between components?
- What could go wrong? What are the edge cases?

### Step 2: RESEARCH & VALIDATE
- Is this approach industry-standard?
- Are there better alternatives?
- Would an experienced developer approve this plan?
- Is anything missing?
- **WORKSPACE ANALYSIS**: If workspace context is provided, you MUST use it. 
  - Reference actual file paths found in the workspace.
  - Suggest modifications to existing files instead of creating checks-and-balances new ones.
  - Use existing dependencies if compatible.
  - If a "tests" directory exists, include test phases.

### Step 3: TASK SIZING (CRITICAL)
Each task MUST be:
- Completable by an AI coding assistant in ONE conversation
- Specific about which files to create/modify
- Clear about expected inputs and outputs
- Include acceptance criteria

### Step 4: FINAL VERIFICATION
Before outputting, verify:
- [ ] All dependencies are in correct order
- [ ] No task is too large (break down if needed)
- [ ] No task is too vague (add specifics if needed)
- [ ] A developer could copy-paste each task to an AI and get working code

## OUTPUT FORMAT (strict JSON):
\`\`\`json
{
  "title": "Project Title",
  "description": "One-paragraph project summary",
  "technology_stack": ["tech1", "tech2"],
  "phases": [
    {
      "id": "phase-001",
      "title": "Clear Phase Title",
      "description": "What this phase accomplishes",
      "order": 1,
      "estimatedComplexity": "low|medium|high",
      "dependencies": [],
      "tasks": [
        {
          "id": "task-001",
          "title": "Specific Task Title",
          "goal": "One sentence describing the goal",
          "files": ["path/to/file.ts", "path/to/other.ts"],
          "instructions": [
            "Step 1: Do this specific thing",
            "Step 2: Then do this",
            "Step 3: Finally do this"
          ],
          "acceptance_criteria": [
            "Criteria 1 that can be verified",
            "Criteria 2 that can be verified"
          ]
        }
      ]
    }
  ]
}
\`\`\`

## REQUIREMENTS TO PLAN:
{{requirements}}

Generate {{minPhases}} to {{maxPhases}} phases. Think carefully. Take your time. Get it right.`,
      variables: ['conversationState', 'requirements', 'minPhases', 'maxPhases'],
    };

    this.registerTemplate(template);
    this._defaultTemplates.set(PromptRole.PHASE_PLANNER, template.id);
  }

  private _registerSummarizerTemplate(): void {
    const template: PromptTemplate = {
      id: 'summarizer-v1',
      name: 'Conversation Summarizer',
      description: 'Creates a concise summary of the conversation to manage context.',
      systemPrompt:
        'You are summarizing a conversation about project planning. Create a concise summary (max 200 words) that captures: main project goals, key decisions, technologies chosen, and current status. Focus on facts, not pleasantries.',
      variables: ['conversationState'],
    };

    this.registerTemplate(template);
    this._defaultTemplates.set(PromptRole.SUMMARIZER, template.id);
  }

  private _registerSinglePhasePlannerTemplate(): void {
    const template: PromptTemplate = {
      id: 'single-phase-planner-v1',
      name: 'Single Phase Planner',
      description: 'Generates a single phase to be inserted into an existing plan.',
      systemPrompt: `You are an expert software architect. Your task is to generate a SINGLE phase to be added to an existing project plan.
    
    ## EXISTING PLAN CONTEXT:
    {{existingPlan}}
    
    ## INSTRUCTION:
    Generate a new phase that addresses the following requirement:
    "{{requirements}}"
    
    This phase will be inserted AFTER phase ID: {{afterPhaseId}}.
    
    ## REQUIREMENTS:
    - The phase must be consistent with the existing plan's style and granularity.
    - If the requirement implies complex work, break it down into tasks.
    - If the requirement is simple, a single phase without tasks might suffice, but tasks are preferred for actionable steps.
    - Ensure dependencies are logical (refer to existing phase IDs if needed, but be careful as ids might change).
    
    ## OUTPUT FORMAT (strict JSON):
    \`\`\`json
    {
      "title": "Phase Title",
      "description": "Detailed description",
      "estimatedComplexity": "low|medium|high",
      "tags": ["tag1", "tag2"],
      "files": ["file1.ts", "file2.ts"],
      "tasks": [
        {
          "id": "task-001",
          "title": "Task Title",
          "goal": "Goal",
          "files": ["file1.ts"],
          "instructions": ["Do this"],
          "acceptance_criteria": ["Criteria"]
        }
      ]
    }
    \`\`\`
    `,
      variables: ['conversationState', 'requirements', 'existingPlan', 'afterPhaseId'],
    };

    this.registerTemplate(template);
    this._defaultTemplates.set(PromptRole.SINGLE_PHASE_PLANNER, template.id);
  }
}
