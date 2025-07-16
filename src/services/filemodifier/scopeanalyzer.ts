// ============================================================================
// SIMPLIFIED SCOPE ANALYZER - CLAUDE-ONLY ANALYSIS
// ============================================================================

import Anthropic from '@anthropic-ai/sdk';
import { ModificationScope } from './types';

// Token tracking interfaces
interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  Usage?: number;
}

// Token Tracker class
class TokenTracker {
  private totalInputTokens = 0;
  private totalOutputTokens = 0;
  private totalCacheCreationTokens = 0;
  private totalCacheReadTokens = 0;
  private apiCalls = 0;
  private operationHistory: Array<{
    operation: string;
    inputTokens: number;
    outputTokens: number;
    cacheCreation?: number;
    cacheRead?: number;
    timestamp: Date;
  }> = [];

  logUsage(usage: TokenUsage, operation: string): void {
    const inputTokens = usage.input_tokens || 0;
    const outputTokens = usage.output_tokens || 0;
    const cacheCreation = usage.cache_creation_input_tokens || 0;
    const cacheRead = usage.cache_read_input_tokens || 0;

    this.totalInputTokens += inputTokens;
    this.totalOutputTokens += outputTokens;
    this.totalCacheCreationTokens += cacheCreation;
    this.totalCacheReadTokens += cacheRead;
    this.apiCalls++;

    // Log operation
    this.operationHistory.push({
      operation,
      inputTokens,
      outputTokens,
      cacheCreation: cacheCreation > 0 ? cacheCreation : undefined,
      cacheRead: cacheRead > 0 ? cacheRead : undefined,
      timestamp: new Date()
    });

    console.log(`[SCOPE-TOKEN] ${operation}: ${inputTokens} in, ${outputTokens} out${cacheCreation > 0 ? `, ${cacheCreation} cache` : ''}${cacheRead > 0 ? `, ${cacheRead} cache-read` : ''}`);
  }

  getStats() {
    return {
      totalTokens: this.totalInputTokens + this.totalOutputTokens,
      inputTokens: this.totalInputTokens,
      outputTokens: this.totalOutputTokens,
      cacheCreationTokens: this.totalCacheCreationTokens,
      cacheReadTokens: this.totalCacheReadTokens,
      effectiveInputTokens: this.totalInputTokens - this.totalCacheReadTokens,
      apiCalls: this.apiCalls,
      averageInputPerCall: this.apiCalls > 0 ? Math.round(this.totalInputTokens / this.apiCalls) : 0,
      averageOutputPerCall: this.apiCalls > 0 ? Math.round(this.totalOutputTokens / this.apiCalls) : 0,
      operationHistory: this.operationHistory
    };
  }

  getDetailedReport(): string {
    const stats = this.getStats();
    const report = [
      `📊 SCOPE ANALYZER TOKEN USAGE REPORT`,
      `═══════════════════════════════════════`,
      `🔢 Total API Calls: ${stats.apiCalls}`,
      `📥 Total Input Tokens: ${stats.inputTokens.toLocaleString()}`,
      `📤 Total Output Tokens: ${stats.outputTokens.toLocaleString()}`,
      `🎯 Total Tokens Used: ${stats.totalTokens.toLocaleString()}`,
      ``
    ];

    if (stats.cacheCreationTokens > 0 || stats.cacheReadTokens > 0) {
      report.push(
        `💾 CACHE EFFICIENCY:`,
        `   Cache Creation: ${stats.cacheCreationTokens.toLocaleString()} tokens`,
        `   Cache Reads: ${stats.cacheReadTokens.toLocaleString()} tokens`,
        `   Effective Input: ${stats.effectiveInputTokens.toLocaleString()} tokens`,
        `   Cache Savings: ${((stats.cacheReadTokens / stats.totalTokens) * 100).toFixed(1)}%`,
        ``
      );
    }

    report.push(
      `📈 AVERAGES:`,
      `   Input per call: ${stats.averageInputPerCall} tokens`,
      `   Output per call: ${stats.averageOutputPerCall} tokens`,
      ``
    );

    if (stats.operationHistory.length > 0) {
      report.push(`🔍 OPERATION BREAKDOWN:`);
      const operationSummary = new Map<string, { calls: number; totalInput: number; totalOutput: number }>();
      
      stats.operationHistory.forEach(op => {
        if (!operationSummary.has(op.operation)) {
          operationSummary.set(op.operation, { calls: 0, totalInput: 0, totalOutput: 0 });
        }
        const summary = operationSummary.get(op.operation)!;
        summary.calls++;
        summary.totalInput += op.inputTokens;
        summary.totalOutput += op.outputTokens;
      });

      operationSummary.forEach((summary, operation) => {
        const avgInput = Math.round(summary.totalInput / summary.calls);
        const avgOutput = Math.round(summary.totalOutput / summary.calls);
        report.push(`   ${operation}: ${summary.calls} calls, avg ${avgInput}/${avgOutput} tokens`);
      });
    }

    return report.join('\n');
  }

  reset(): void {
    this.totalInputTokens = 0;
    this.totalOutputTokens = 0;
    this.totalCacheCreationTokens = 0;
    this.totalCacheReadTokens = 0;
    this.apiCalls = 0;
    this.operationHistory = [];
  }
}

export class ScopeAnalyzer {
  private anthropic: Anthropic;
  private streamCallback?: (message: string) => void;
  private tokenTracker: TokenTracker;

  constructor(anthropic: Anthropic) {
    this.anthropic = anthropic;
    this.tokenTracker = new TokenTracker();
  }

  setStreamCallback(callback: (message: string) => void) {
    this.streamCallback = callback;
  }

  private streamUpdate(message: string) {
    if (this.streamCallback) {
      this.streamCallback(message);
    }
  }

  // Public method to get token tracker
  getTokenTracker(): TokenTracker {
    return this.tokenTracker;
  }

  // Public method to get token stats
  getTokenStats() {
    return this.tokenTracker.getStats();
  }

  // Public method to get detailed token report
  getTokenReport(): string {
    return this.tokenTracker.getDetailedReport();
  }

  /**
   * Main scope analysis - Claude-only approach
   */
  async analyzeScope(
    prompt: string, 
    projectSummary?: string, 
    conversationContext?: string,
    dbSummary?: string
  ): Promise<ModificationScope> {
    this.streamUpdate('🤖 Starting Claude-only scope analysis...');

    // Single AI call to determine modification method
    const method = await this.determineModificationMethod(prompt, conversationContext);

    const finalScope: ModificationScope = {
      scope: method.scope,
      files: [], // No files selected here - will be determined by AST analysis later
      reasoning: method.reasoning,
      ...(method.scope === "COMPONENT_ADDITION" && {
        componentName: method.componentName || this.extractComponentName(prompt),
        componentType: method.componentType || this.determineComponentType(prompt),
        dependencies: [] // Dependencies will be determined later
      }),
      ...(method.scope === "TAILWIND_CHANGE" && {
        colorChanges: method.colorChanges || this.extractColorChanges(prompt)
      }),
      ...(method.scope === "TEXT_BASED_CHANGE" && method.textChangeAnalysis && {
        textChangeAnalysis: method.textChangeAnalysis
      })
    };

    this.streamUpdate(`✅ Final scope determination: ${finalScope.scope}`);
    
    // Log token summary
    const tokenStats = this.tokenTracker.getStats();
    this.streamUpdate(`💰 Scope Analysis Tokens: ${tokenStats.totalTokens} total (${tokenStats.apiCalls} API calls)`);

    return finalScope;
  }

  /**
   * Single Claude call to determine modification method
   */
  private async determineModificationMethod(
    prompt: string,
    conversationContext?: string
  ): Promise<{ 
    scope: "FULL_FILE" | "TARGETED_NODES" | "COMPONENT_ADDITION" | "TAILWIND_CHANGE" | "TEXT_BASED_CHANGE", 
    reasoning: string,
    componentName?: string,
    componentType?: 'component' | 'page' | 'app',
    colorChanges?: Array<{type: string; color: string; target?: string}>,
    textChangeAnalysis?: { searchTerm: string, replacementTerm: string, searchVariations: string[] }
  }> {
    
    const methodPrompt = `
**USER REQUEST:** "${prompt}"

${conversationContext ? `**CONVERSATION CONTEXT:**\n${conversationContext}\n` : ''}

**TASK:** Analyze the request and determine the MOST SPECIFIC modification method.

**METHOD OPTIONS (in order of preference - choose the most specific that applies):**

1. **TEXT_BASED_CHANGE** – For pure content replacement:
✅ CHOOSE THIS IF the request involves:
- Only changing text content (no styling, positioning, or visual changes)
- Simple word/phrase replacements
- Content updates without any visual modifications
- Examples: "change 'Welcome' to 'Hello'", "replace 'Contact Us' with 'Get in Touch'"

2. **TAILWIND_CHANGE** – For global color/theme changes:
✅ CHOOSE THIS IF the request involves:
- Global color changes without specifying exact elements
- Theme color modifications (primary, secondary, accent colors)
- Background color changes for the entire site
- Examples: "change background color to blue", "make the primary color red"

3. **TARGETED_NODES** – For specific element modifications:
✅ CHOOSE THIS IF the request targets:
- Specific existing elements with any kind of modification
- Descriptive targeting of particular UI components
- Changes that specify WHERE the modification should happen
- Examples: "change this button's color", "make that title larger", "update the footer"

4. **COMPONENT_ADDITION** – For creating new UI elements:
✅ CHOOSE THIS IF the request involves:
- Adding new components, pages, or UI elements
- Creating something that doesn't exist yet
- Examples: "add a button", "create a card", "make a new page"

5. **FULL_FILE** – For comprehensive changes (LAST RESORT):
✅ CHOOSE THIS ONLY IF the request requires:
- Multiple related changes across files
- Complete restructuring or redesign
- Examples: "redesign the entire page", "add dark mode"

**DECISION PRIORITY:**
1. If it's a simple TEXT replacement → TEXT_BASED_CHANGE
2. If it's about GLOBAL COLORS without specific targets → TAILWIND_CHANGE
3. If it's about ONE specific thing → TARGETED_NODES
4. If it's creating something NEW → COMPONENT_ADDITION  
5. If it needs MULTIPLE changes → FULL_FILE

**RESPOND WITH JSON:**

For TEXT_BASED_CHANGE:
\`\`\`json
{
  "scope": "TEXT_BASED_CHANGE",
  "reasoning": "This is a simple text replacement request.",
  "textChangeAnalysis": {
    "searchTerm": "exact text to search for",
    "replacementTerm": "exact text to replace with",
    "searchVariations": ["variation1", "variation2", "UPPERCASE", "lowercase"]
  }
}
\`\`\`

For TAILWIND_CHANGE:
\`\`\`json
{
  "scope": "TAILWIND_CHANGE",
  "reasoning": "This request involves global color changes.",
  "colorChanges": [
    {"type": "background", "color": "blue"},
    {"type": "primary", "color": "red"}
  ]
}
\`\`\`

For COMPONENT_ADDITION:
\`\`\`json
{
  "scope": "COMPONENT_ADDITION",
  "reasoning": "This request involves creating a new UI element.",
  "componentName": "ExtractedComponentName",
  "componentType": "component"
}
\`\`\`

For TARGETED_NODES or FULL_FILE:
\`\`\`json
{
  "scope": "TARGETED_NODES",
  "reasoning": "This request targets specific existing elements."
}
\`\`\`
    `.trim();

    try {
      this.streamUpdate('🤖 Sending scope determination request to Claude...');
      
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 600,
        temperature: 0,
        messages: [{ role: 'user', content: methodPrompt }],
      });

      // Track token usage
      this.tokenTracker.logUsage(response.usage, 'Scope Determination');

      const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
      return this.parseMethodResponse(text);
    } catch (error) {
      this.streamUpdate(`❌ Scope determination failed: ${error}`);
      // Fallback to FULL_FILE
      return { 
        scope: "FULL_FILE", 
        reasoning: `API error - using fallback: ${error}` 
      };
    }
  }

  /**
   * Parse Claude's response for method determination
   */
  private parseMethodResponse(text: string): { 
    scope: "FULL_FILE" | "TARGETED_NODES" | "COMPONENT_ADDITION" | "TAILWIND_CHANGE" | "TEXT_BASED_CHANGE", 
    reasoning: string,
    componentName?: string,
    componentType?: 'component' | 'page' | 'app',
    colorChanges?: Array<{type: string; color: string; target?: string}>,
    textChangeAnalysis?: { searchTerm: string, replacementTerm: string, searchVariations: string[] }
  } {
    try {
      // Extract JSON from the response
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[1]);
      
      // Validate scope
      const validScopes = ["FULL_FILE", "TARGETED_NODES", "COMPONENT_ADDITION", "TAILWIND_CHANGE", "TEXT_BASED_CHANGE"];
      if (!validScopes.includes(parsed.scope)) {
        throw new Error(`Invalid scope: ${parsed.scope}`);
      }

      const result: any = {
        scope: parsed.scope,
        reasoning: parsed.reasoning || "No reasoning provided"
      };

      // Add scope-specific data
      if (parsed.scope === "TEXT_BASED_CHANGE" && parsed.textChangeAnalysis) {
        result.textChangeAnalysis = parsed.textChangeAnalysis;
      }

      if (parsed.scope === "TAILWIND_CHANGE" && parsed.colorChanges) {
        result.colorChanges = parsed.colorChanges;
      }

      if (parsed.scope === "COMPONENT_ADDITION") {
        result.componentName = parsed.componentName;
        result.componentType = parsed.componentType;
      }

      return result;
    } catch (error) {
      this.streamUpdate(`❌ Failed to parse method response: ${error}`);
      
      // Fallback to FULL_FILE
      return { 
        scope: "FULL_FILE", 
        reasoning: `Parse error - using fallback: ${error}` 
      };
    }
  }

  /**
   * Extract color changes from prompt (fallback method)
   */
  private extractColorChanges(prompt: string): Array<{type: string; color: string; target?: string}> {
    const changes: Array<{type: string; color: string; target?: string}> = [];
    const promptLower = prompt.toLowerCase();

    // Color extraction patterns
    const colorPatterns = [
      /(?:change|make|set)\s+(?:the\s+)?(?:background|bg)\s+(?:color\s+)?(?:to\s+)?([a-zA-Z]+|#[0-9a-fA-F]{3,6})/g,
      /(?:change|make|set)\s+(?:the\s+)?(?:primary|secondary|accent)\s+color\s+(?:to\s+)?([a-zA-Z]+|#[0-9a-fA-F]{3,6})/g,
      /make\s+it\s+([a-zA-Z]+)/g,
    ];

    colorPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(promptLower)) !== null) {
        const color = match[1];
        let type = 'general';
        
        if (match[0].includes('background') || match[0].includes('bg')) {
          type = 'background';
        } else if (match[0].includes('primary')) {
          type = 'primary';
        } else if (match[0].includes('secondary')) {
          type = 'secondary';
        } else if (match[0].includes('accent')) {
          type = 'accent';
        }
        
        changes.push({ type, color });
      }
    });

    // If no specific changes found, extract general color
    if (changes.length === 0) {
      const generalColorMatch = promptLower.match(/\b(red|blue|green|yellow|purple|orange|pink|black|white|gray|grey)\b/);
      if (generalColorMatch) {
        changes.push({ type: 'general', color: generalColorMatch[1] });
      }
    }

    return changes;
  }

  /**
   * Extract component name from prompt (fallback method)
   */
  private extractComponentName(prompt: string): string {
    const patterns = [
      /(?:add|create|build|make|new)\s+(?:a\s+)?([A-Z][a-zA-Z]+)/i,
      /([A-Z][a-zA-Z]+)\s+(?:component|page)/i,
      /(?:component|page)\s+(?:called|named)\s+([A-Z][a-zA-Z]+)/i
    ];

    for (const pattern of patterns) {
      const match = prompt.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        return name.charAt(0).toUpperCase() + name.slice(1);
      }
    }

    return 'NewComponent'; // Default name
  }

  /**
   * Determine component type (fallback method)
   */
  private determineComponentType(prompt: string): 'component' | 'page' | 'app' {
    const promptLower = prompt.toLowerCase();
    
    if (promptLower.includes('page') || promptLower.includes('route') || promptLower.includes('screen')) {
      return 'page';
    }
    
    if (promptLower.includes('app') || promptLower.includes('main') || promptLower.includes('application')) {
      return 'app';
    }
    
    return 'component';
  }

  /**
   * Generate reasoning text for the scope decision
   */
  generateReasoningText(
    prompt: string,
    scope: 'FULL_FILE' | 'TARGETED_NODES' | 'COMPONENT_ADDITION' | 'TAILWIND_CHANGE' | 'TEXT_BASED_CHANGE',
    files: string[],
    componentInfo?: { name?: string; type?: string },
    colorChanges?: Array<{type: string; color: string; target?: string}>,
    textChangeAnalysis?: { searchTerm: string; replacementTerm: string; searchVariations: string[] }
  ): string {
    const baseReasoning = `Claude-determined scope: ${scope} approach selected for request: "${prompt}"`;
    
    if (scope === 'COMPONENT_ADDITION' && componentInfo) {
      return `${baseReasoning}. Will create new ${componentInfo.type}: ${componentInfo.name}`;
    }
    
    if (scope === 'TAILWIND_CHANGE' && colorChanges && colorChanges.length > 0) {
      const colorSummary = colorChanges.map(change => `${change.type}: ${change.color}`).join(', ');
      return `${baseReasoning}. Will modify tailwind.config.ts to update colors: ${colorSummary}`;
    }

    if (scope === 'TEXT_BASED_CHANGE' && textChangeAnalysis) {
      return `${baseReasoning}. Will perform text replacement: "${textChangeAnalysis.searchTerm}" → "${textChangeAnalysis.replacementTerm}"`;
    }
    
    return `${baseReasoning}. File analysis and element tree generation will determine specific targets.`;
  }
}