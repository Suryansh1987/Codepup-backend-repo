// ============================================================================
// TWO-STEP COMPONENT GENERATION SYSTEM COORDINATOR
// ============================================================================

import { AnalysisAndGenerationEngine } from '../filemodifier/component_analysis';
import { IntegrationEngine } from './component_integerator';

// ============================================================================
// SHARED INTERFACES
// ============================================================================

export interface ComponentTypeAnalysis {
  type: 'page' | 'component';
  name: string;
  confidence: number;
  reasoning: string;
  targetDirectory: string;
  fileName: string;
  needsRouting: boolean;
}

export interface GenerationResult {
  success: boolean;
  generatedContent: string;
  componentType: ComponentTypeAnalysis;
  elementTreeContext: string;
  projectPatterns: {
    exportPattern: 'default' | 'named' | 'mixed';
    importPattern: 'default' | 'named' | 'mixed';
    routingPattern: 'react-router' | 'next' | 'reach-router' | 'basic';
    appFilePath?: string;
    routeFilePath?: string;
  };
  componentMap: Map<string, string>;
  projectFiles: Map<string, any>;
  existingRoutes: string[];
  error?: string;
}

export interface IntegrationResult {
  success: boolean;
  createdFiles: string[];
  modifiedFiles: string[];
  integrationResults: {
    routingUpdated: boolean;
    appFileUpdated: boolean;
    dependenciesResolved: boolean;
  };
  error?: string;
}

// ============================================================================
// COORDINATOR INTERFACES
// ============================================================================

export interface TwoStepResult {
  success: boolean;
  step1: GenerationResult;
  step2: IntegrationResult;
  summary: string;
  totalDuration: number;
  error?: string;
}

export interface TwoStepOptions {
  skipIntegration?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
}

// ============================================================================
// TWO-STEP COMPONENT GENERATION SYSTEM
// ============================================================================

export class TwoStepComponentGenerationSystem {
  private analysisEngine: AnalysisAndGenerationEngine;
  private integrationEngine: IntegrationEngine;
  private streamCallback?: (message: string) => void;

  constructor(anthropic: any, reactBasePath: string) {
    this.analysisEngine = new AnalysisAndGenerationEngine(anthropic, reactBasePath);
    this.integrationEngine = new IntegrationEngine(anthropic, reactBasePath);
  }

  setStreamCallback(callback: (message: string) => void): void {
    this.streamCallback = callback;
    this.analysisEngine.setStreamCallback(callback);
    this.integrationEngine.setStreamCallback(callback);
  }

  private streamUpdate(message: string): void {
    if (this.streamCallback) {
      this.streamCallback(message);
    }
    console.log(message);
  }

  /**
   * MAIN TWO-STEP WORKFLOW
   */
  async generateComponent(
    userPrompt: string, 
    options: TwoStepOptions = {}
  ): Promise<TwoStepResult> {
    const startTime = Date.now();
    
    this.streamUpdate('🚀 Starting Two-Step Component Generation System...');
    this.streamUpdate(`📋 User Prompt: "${userPrompt}"`);
    this.streamUpdate(`⚙️  Options: ${JSON.stringify(options)}`);

    try {
      // ========================================================================
      // STEP 1: ANALYSIS & GENERATION
      // ========================================================================
      
      this.streamUpdate('\n' + '='.repeat(60));
      this.streamUpdate('🔍 STEP 1: ANALYSIS & GENERATION');
      this.streamUpdate('='.repeat(60));

      const step1Result = await this.analysisEngine.analyzeAndGenerate(userPrompt);

      if (!step1Result.success) {
        throw new Error(`Step 1 failed: ${step1Result.error}`);
      }

      this.streamUpdate(`✅ STEP 1 COMPLETE`);
      this.streamUpdate(`   📊 Component Type: ${step1Result.componentType.type.toUpperCase()}`);
      this.streamUpdate(`   📝 Component Name: ${step1Result.componentType.name}`);
      this.streamUpdate(`   📄 Generated Code: ${step1Result.generatedContent.length} characters`);
      this.streamUpdate(`   🌳 Element Trees: ${step1Result.elementTreeContext.length > 0 ? 'Available' : 'None'}`);

      // Check if we should skip integration
      if (options.skipIntegration) {
        this.streamUpdate('\n⏭️  Skipping Step 2 (Integration) per options');
        
        const duration = Date.now() - startTime;
        return {
          success: true,
          step1: step1Result,
          step2: {
            success: true,
            createdFiles: [],
            modifiedFiles: [],
            integrationResults: {
              routingUpdated: false,
              appFileUpdated: false,
              dependenciesResolved: false
            }
          },
          summary: this.createSummary(step1Result, null, duration, true),
          totalDuration: duration
        };
      }

      // ========================================================================
      // STEP 2: INTEGRATION
      // ========================================================================

      this.streamUpdate('\n' + '='.repeat(60));
      this.streamUpdate('🔗 STEP 2: INTEGRATION');
      this.streamUpdate('='.repeat(60));

      const step2Result = await this.integrationEngine.integrateComponent(step1Result);

      if (!step2Result.success) {
        this.streamUpdate(`⚠️  Step 2 completed with issues: ${step2Result.error}`);
      } else {
        this.streamUpdate(`✅ STEP 2 COMPLETE`);
        this.streamUpdate(`   📁 Created Files: ${step2Result.createdFiles.length}`);
        this.streamUpdate(`   📝 Modified Files: ${step2Result.modifiedFiles.length}`);
        this.streamUpdate(`   🛣️  Routing Updated: ${step2Result.integrationResults.routingUpdated}`);
        this.streamUpdate(`   📱 App File Updated: ${step2Result.integrationResults.appFileUpdated}`);
      }

      // ========================================================================
      // COMPLETION
      // ========================================================================

      const duration = Date.now() - startTime;
      const summary = this.createSummary(step1Result, step2Result, duration);

      this.streamUpdate('\n' + '='.repeat(60));
      this.streamUpdate('🎉 TWO-STEP GENERATION COMPLETE!');
      this.streamUpdate('='.repeat(60));
      this.streamUpdate(summary);

      return {
        success: step1Result.success && step2Result.success,
        step1: step1Result,
        step2: step2Result,
        summary,
        totalDuration: duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.streamUpdate(`\n❌ TWO-STEP GENERATION FAILED: ${errorMessage}`);
      
      return {
        success: false,
        step1: {
          success: false,
          generatedContent: '',
          componentType: {
            type: 'component',
            name: 'Unknown',
            confidence: 0,
            reasoning: 'Failed',
            targetDirectory: 'src/components',
            fileName: 'Unknown.tsx',
            needsRouting: false
          },
          elementTreeContext: '',
          projectPatterns: {
            exportPattern: 'default',
            importPattern: 'default',
            routingPattern: 'basic'
          },
          componentMap: new Map(),
          projectFiles: new Map(),
          existingRoutes: [],
          error: errorMessage
        },
        step2: {
          success: false,
          createdFiles: [],
          modifiedFiles: [],
          integrationResults: {
            routingUpdated: false,
            appFileUpdated: false,
            dependenciesResolved: false
          },
          error: errorMessage
        },
        summary: `Two-step generation failed: ${errorMessage}`,
        totalDuration: duration,
        error: errorMessage
      };
    }
  }

  /**
   * CREATE SUMMARY
   */
  private createSummary(
    step1Result: GenerationResult, 
    step2Result: IntegrationResult | null, 
    duration: number,
    skippedIntegration: boolean = false
  ): string {
    const durationFormatted = duration > 1000 ? `${(duration / 1000).toFixed(1)}s` : `${duration}ms`;
    
    let summary = `
TWO-STEP COMPONENT GENERATION SUMMARY
====================================
✅ Success: ${step1Result.success && (step2Result?.success !== false)}
⏱️  Duration: ${durationFormatted}

STEP 1 - ANALYSIS & GENERATION:
📊 Component Type: ${step1Result.componentType.type.toUpperCase()}
📝 Component Name: ${step1Result.componentType.name}
📄 Generated Code: ${step1Result.generatedContent.length} characters
🎯 Confidence: ${step1Result.componentType.confidence}%
📁 Target: ${step1Result.componentType.targetDirectory}/${step1Result.componentType.fileName}
🌳 Element Trees: ${step1Result.elementTreeContext.length > 0 ? 'Analyzed' : 'None'}
🛣️  Existing Routes: ${step1Result.existingRoutes.length}
🧩 Component Map: ${step1Result.componentMap.size} components
`;

    if (skippedIntegration) {
      summary += `
STEP 2 - INTEGRATION:
⏭️  Skipped per configuration
`;
    } else if (step2Result) {
      summary += `
STEP 2 - INTEGRATION:
📁 Created Files: ${step2Result.createdFiles.length}
📝 Modified Files: ${step2Result.modifiedFiles.length}
🛣️  Routing Updated: ${step2Result.integrationResults.routingUpdated}
📱 App File Updated: ${step2Result.integrationResults.appFileUpdated}
🔗 Dependencies Resolved: ${step2Result.integrationResults.dependenciesResolved}

CREATED FILES:
${step2Result.createdFiles.map(f => `   🆕 ${f}`).join('\n')}

MODIFIED FILES:
${step2Result.modifiedFiles.map(f => `   ✏️  ${f}`).join('\n')}
`;
    }

    summary += `
REASONING:
${step1Result.componentType.reasoning}

${step1Result.success && (step2Result?.success !== false) ? '✅ Two-step generation completed successfully!' : '❌ Two-step generation encountered issues.'}
`;

    return summary.trim();
  }

  /**
   * GET PROJECT ANALYSIS SUMMARY
   */
  async getProjectAnalysisSummary(): Promise<string> {
    try {
      return await this.analysisEngine.getProjectAnalysisSummary();
    } catch (error) {
      return `Failed to get project analysis summary: ${error}`;
    }
  }

  /**
   * REFRESH FILE STRUCTURE
   */
  async refreshFileStructure(): Promise<void> {
    try {
      await this.analysisEngine.refreshFileStructure();
    } catch (error) {
      this.streamUpdate(`⚠️ Failed to refresh file structure: ${error}`);
    }
  }

  /**
   * ANALYSIS ONLY
   */
  async analyzeOnly(userPrompt: string): Promise<GenerationResult> {
    this.streamUpdate('🔍 Running analysis-only workflow...');
    return await this.analysisEngine.analyzeAndGenerate(userPrompt);
  }

  /**
   * INTEGRATION ONLY
   */
  async integrateOnly(generationResult: GenerationResult): Promise<IntegrationResult> {
    this.streamUpdate('🔗 Running integration-only workflow...');
    return await this.integrationEngine.integrateComponent(generationResult);
  }
}