// ============================================================================
// ENHANCED TWO-STEP COMPONENT GENERATION SYSTEM WITH SUPABASE INTEGRATION
// ============================================================================

import { AnalysisAndGenerationEngine } from '../filemodifier/component_analysis';
import { IntegrationEngine } from './component_integerator';

// ============================================================================
// ENHANCED INTERFACES WITH SUPABASE & CONTEXT SUPPORT
// ============================================================================

export interface ComponentTypeAnalysis {
  type: 'page' | 'component';
  name: string;
  confidence: number;
  reasoning: string;
  targetDirectory: string;
  fileName: string;
  needsRouting: boolean;
  description?: string;
  category?: string;
  fileExtension?: string;

  // 🔥 NEW: Database/Context functionality detection
  needsFullContext?: boolean;
  contextFiles?: string[];
  contextKeywords?: string[];
}

export interface GenerationResult {
  success: boolean;
  generatedContent: string;
  componentType: ComponentTypeAnalysis;
  elementTreeContext: string;
  supabaseSchemaContext: string;    // 🔥 NEW: Always included
  fullContextContent?: string;      // 🔥 NEW: Context file content
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
    navigationUpdated: boolean;        // From existing IntegrationEngine
    headerUpdated: boolean;            // From existing IntegrationEngine
    footerUpdated: boolean;            // From existing IntegrationEngine
    dependenciesResolved: boolean;
    usageExampleAdded: boolean;        // From existing IntegrationEngine
    pagesUpdated: string[];            // From existing IntegrationEngine
    routeAlreadyExisted: boolean;      // From existing IntegrationEngine
    navigationAlreadyExists: boolean;  // From existing IntegrationEngine
    supabaseIntegrated?: boolean;      // 🔥 NEW: Optional for backward compatibility
    contextFilesLinked?: boolean;      // 🔥 NEW: Optional for backward compatibility
  };
  error?: string;
}

// ============================================================================
// ENHANCED COORDINATOR INTERFACES
// ============================================================================

export interface TwoStepResult {
  success: boolean;
  step1: GenerationResult;
  step2: IntegrationResult;
  summary: string;
  totalDuration: number;
  enhancedFeatures: {              // 🔥 NEW: Feature tracking
    supabaseIntegration: boolean;
    contextIntegration: boolean;
    businessTypeDetected: string;
    tailwindQuality: 'basic' | 'advanced' | 'expert';
  };
  error?: string;
}

export interface TwoStepOptions {
  skipIntegration?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
  projectId?: number;
  forceSupabaseContext?: boolean;  // 🔥 NEW: Force Supabase even for simple components
  businessType?: string;           // 🔥 NEW: Override business type detection
}

// ============================================================================
// ENHANCED TWO-STEP COMPONENT GENERATION SYSTEM
// ============================================================================

export class TwoStepComponentGenerationSystem {
  private analysisEngine: AnalysisAndGenerationEngine;
  private integrationEngine: IntegrationEngine;
  private streamCallback?: (message: string) => void;
  private messageDB?: any;

  constructor(anthropic: any, reactBasePath: string, messageDB?: any) {
    this.analysisEngine = new AnalysisAndGenerationEngine(anthropic, reactBasePath, messageDB);
    this.integrationEngine = new IntegrationEngine(anthropic, reactBasePath);
    this.messageDB = messageDB;
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
   * 🔥 ENHANCED MAIN TWO-STEP WORKFLOW WITH SUPABASE & CONTEXT INTEGRATION
   */
  async generateComponent(
    userPrompt: string, 
    options: TwoStepOptions = {},
    projectId?: number
  ): Promise<TwoStepResult> {
    const startTime = Date.now();
    
    this.streamUpdate('🚀 Starting ENHANCED Two-Step Component Generation...');
    this.streamUpdate(`📋 User Prompt: "${userPrompt}"`);
    this.streamUpdate(`⚙️  Options: ${JSON.stringify(options)}`);
    this.streamUpdate(`🗄️  Supabase Integration: MANDATORY`);
    this.streamUpdate(`🔧 Context Detection: ENABLED`);

    try {
      // ========================================================================
      // STEP 1: ENHANCED ANALYSIS & GENERATION WITH SUPABASE
      // ========================================================================
      
      this.streamUpdate('\n' + '='.repeat(70));
      this.streamUpdate('🔍 STEP 1: ENHANCED ANALYSIS & GENERATION');
      this.streamUpdate('='.repeat(70));

      const projectIdToUse = projectId || options.projectId;
      
      this.streamUpdate(`📊 Project ID: ${projectIdToUse || 'None'}`);
      this.streamUpdate(`🗄️  Database Context: ${this.messageDB ? 'Available' : 'Unavailable'}`);
      
      const step1Result = await this.analysisEngine.analyzeAndGenerate(userPrompt, projectIdToUse);

      if (!step1Result.success) {
        throw new Error(`Step 1 failed: ${step1Result.error}`);
      }

      // 🔥 ENHANCED: Log detailed step 1 results
      this.streamUpdate(`✅ STEP 1 COMPLETE - ENHANCED ANALYSIS`);
      this.streamUpdate(`   📊 Component Type: ${step1Result.componentType.type.toUpperCase()}`);
      this.streamUpdate(`   📝 Component Name: ${step1Result.componentType.name}`);
      this.streamUpdate(`   📄 Generated Code: ${step1Result.generatedContent.length} characters`);
      this.streamUpdate(`   🗄️  Supabase Context: ${step1Result.supabaseSchemaContext.length > 100 ? 'INCLUDED ✅' : 'UNAVAILABLE ❌'}`);
      this.streamUpdate(`   🔧 Full Context: ${step1Result.componentType.needsFullContext ? 'ENABLED ✅' : 'DISABLED'}`);
      this.streamUpdate(`   📁 Context Files: ${step1Result.componentType.contextFiles?.length || 0}`);
      this.streamUpdate(`   🌳 Element Trees: ${step1Result.elementTreeContext.length > 0 ? 'Available' : 'None'}`);

      // Detect enhanced features
      const enhancedFeatures = this.detectEnhancedFeatures(step1Result, options);
      this.logEnhancedFeatures(enhancedFeatures);

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
              navigationUpdated: false,
              headerUpdated: false,
              footerUpdated: false,
              dependenciesResolved: false,
              usageExampleAdded: false,
              pagesUpdated: [],
              routeAlreadyExisted: false,
              navigationAlreadyExists: false,
              supabaseIntegrated: false,
              contextFilesLinked: false
            }
          },
          summary: this.createEnhancedSummary(step1Result, null, duration, enhancedFeatures, true),
          totalDuration: duration,
          enhancedFeatures
        };
      }

      // ========================================================================
      // STEP 2: ENHANCED INTEGRATION WITH CONTEXT SUPPORT
      // ========================================================================

      this.streamUpdate('\n' + '='.repeat(70));
      this.streamUpdate('🔗 STEP 2: ENHANCED INTEGRATION');
      this.streamUpdate('='.repeat(70));

      // 🔥 ENHANCED: Pass additional context to integration
      const enhancedIntegrationData = {
        ...step1Result,
        enhancedFeatures,
        options
      };

      const step2Result = await this.integrationEngine.integrateComponent(enhancedIntegrationData);

      if (!step2Result.success) {
        this.streamUpdate(`⚠️  Step 2 completed with issues: ${step2Result.error}`);
      } else {
        // 🔥 ENHANCED: Log detailed step 2 results
        this.streamUpdate(`✅ STEP 2 COMPLETE - ENHANCED INTEGRATION`);
        this.streamUpdate(`   📁 Created Files: ${step2Result.createdFiles.length}`);
        this.streamUpdate(`   📝 Modified Files: ${step2Result.modifiedFiles.length}`);
        this.streamUpdate(`   🛣️  Routing Updated: ${step2Result.integrationResults.routingUpdated}`);
        this.streamUpdate(`   📱 App File Updated: ${step2Result.integrationResults.appFileUpdated}`);
      }

      // ========================================================================
      // ENHANCED COMPLETION WITH DETAILED REPORTING
      // ========================================================================

      const duration = Date.now() - startTime;
      const summary = this.createEnhancedSummary(step1Result, step2Result, duration, enhancedFeatures);

      this.streamUpdate('\n' + '='.repeat(70));
      this.streamUpdate('🎉 ENHANCED TWO-STEP GENERATION COMPLETE!');
      this.streamUpdate('='.repeat(70));
      this.streamUpdate(summary);

      return {
        success: step1Result.success && step2Result.success,
        step1: step1Result,
        step2: step2Result,
        summary,
        totalDuration: duration,
        enhancedFeatures
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.streamUpdate(`\n❌ ENHANCED TWO-STEP GENERATION FAILED: ${errorMessage}`);
      
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
          supabaseSchemaContext: '',
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
            navigationUpdated: false,
            headerUpdated: false,
            footerUpdated: false,
            dependenciesResolved: false,
            usageExampleAdded: false,
            pagesUpdated: [],
            routeAlreadyExisted: false,
            navigationAlreadyExists: false,
            supabaseIntegrated: false,
            contextFilesLinked: false
          },
          error: errorMessage
        },
        summary: `Enhanced two-step generation failed: ${errorMessage}`,
        totalDuration: duration,
        enhancedFeatures: {
          supabaseIntegration: false,
          contextIntegration: false,
          businessTypeDetected: 'unknown',
          tailwindQuality: 'basic'
        },
        error: errorMessage
      };
    }
  }

  /**
   * 🔥 NEW: DETECT ENHANCED FEATURES FROM GENERATION RESULT
   */
  private detectEnhancedFeatures(step1Result: GenerationResult, options: TwoStepOptions): {
    supabaseIntegration: boolean;
    contextIntegration: boolean;
    businessTypeDetected: string;
    tailwindQuality: 'basic' | 'advanced' | 'expert';
  } {
    const supabaseIntegration = step1Result.supabaseSchemaContext.length > 100 || options.forceSupabaseContext || false;
    const contextIntegration = step1Result.componentType.needsFullContext || false;
    
    // Detect business type from reasoning or options
    let businessTypeDetected = options.businessType || 'Business';
    if (step1Result.componentType.reasoning) {
      const reasoning = step1Result.componentType.reasoning.toLowerCase();
      if (reasoning.includes('ecommerce') || reasoning.includes('shop')) businessTypeDetected = 'E-commerce';
      else if (reasoning.includes('booking') || reasoning.includes('appointment')) businessTypeDetected = 'Booking/Service';
      else if (reasoning.includes('saas') || reasoning.includes('dashboard')) businessTypeDetected = 'SaaS';
      else if (reasoning.includes('health')) businessTypeDetected = 'Healthcare';
    }
    
    // Detect Tailwind quality from generated content
    const generatedContent = step1Result.generatedContent.toLowerCase();
    let tailwindQuality: 'basic' | 'advanced' | 'expert' = 'basic';
    if (generatedContent.includes('gradient') && generatedContent.includes('hover:scale') && generatedContent.includes('transition-all')) {
      tailwindQuality = 'expert';
    } else if (generatedContent.includes('hover:') && generatedContent.includes('focus:')) {
      tailwindQuality = 'advanced';
    }

    return {
      supabaseIntegration,
      contextIntegration,
      businessTypeDetected,
      tailwindQuality
    };
  }

  /**
   * 🔥 NEW: LOG ENHANCED FEATURES
   */
  private logEnhancedFeatures(features: any): void {
    this.streamUpdate(`🔥 ENHANCED FEATURES DETECTED:`);
    this.streamUpdate(`   🗄️  Supabase Integration: ${features.supabaseIntegration ? 'ENABLED ✅' : 'DISABLED'}`);
    this.streamUpdate(`   🔧 Context Integration: ${features.contextIntegration ? 'ENABLED ✅' : 'DISABLED'}`);
    this.streamUpdate(`   🏢 Business Type: ${features.businessTypeDetected}`);
    this.streamUpdate(`   🎨 Tailwind Quality: ${features.tailwindQuality.toUpperCase()}`);
  }

  /**
   * 🔥 ENHANCED: CREATE DETAILED SUMMARY WITH SUPABASE & CONTEXT INFO
   */
  private createEnhancedSummary(
    step1Result: GenerationResult, 
    step2Result: IntegrationResult | null, 
    duration: number,
    enhancedFeatures: any,
    skippedIntegration: boolean = false
  ): string {
    const durationFormatted = duration > 1000 ? `${(duration / 1000).toFixed(1)}s` : `${duration}ms`;
    
    let summary = `
ENHANCED TWO-STEP COMPONENT GENERATION SUMMARY
=============================================
✅ Success: ${step1Result.success && (step2Result?.success !== false)}
⏱️  Duration: ${durationFormatted}
🔥 Enhanced Features: ${Object.values(enhancedFeatures).filter(Boolean).length}/4 enabled

STEP 1 - ENHANCED ANALYSIS & GENERATION:
📊 Component Type: ${step1Result.componentType.type.toUpperCase()}
📝 Component Name: ${step1Result.componentType.name}
📄 Generated Code: ${step1Result.generatedContent.length} characters
🎯 Confidence: ${step1Result.componentType.confidence}%
📁 Target: ${step1Result.componentType.targetDirectory}/${step1Result.componentType.fileName}

🔥 ENHANCED FEATURES:
🗄️  Supabase Integration: ${enhancedFeatures.supabaseIntegration ? 'ENABLED ✅' : 'DISABLED ❌'}
🔧 Context Integration: ${enhancedFeatures.contextIntegration ? 'ENABLED ✅' : 'DISABLED ❌'}
🏢 Business Type: ${enhancedFeatures.businessTypeDetected}
🎨 Tailwind Quality: ${enhancedFeatures.tailwindQuality.toUpperCase()}

ANALYSIS DETAILS:
🌳 Element Trees: ${step1Result.elementTreeContext.length > 0 ? 'Analyzed' : 'None'}
🛣️  Existing Routes: ${step1Result.existingRoutes.length}
🧩 Component Map: ${step1Result.componentMap.size} components
🗄️  Database Context: ${step1Result.supabaseSchemaContext.length > 100 ? 'Included' : 'Unavailable'}
🔧 Context Files: ${step1Result.componentType.contextFiles?.length || 0}
`;

    if (step1Result.componentType.contextFiles && step1Result.componentType.contextFiles.length > 0) {
      summary += `
📁 CONTEXT FILES USED:
${step1Result.componentType.contextFiles.map(f => `   📄 ${f}`).join('\n')}
`;
    }

    if (skippedIntegration) {
      summary += `
STEP 2 - INTEGRATION:
⏭️  Skipped per configuration
`;
    } else if (step2Result) {
      summary += `
STEP 2 - ENHANCED INTEGRATION:
📁 Created Files: ${step2Result.createdFiles.length}
📝 Modified Files: ${step2Result.modifiedFiles.length}
🛣️  Routing Updated: ${step2Result.integrationResults.routingUpdated}
📱 App File Updated: ${step2Result.integrationResults.appFileUpdated}
🔗 Dependencies Resolved: ${step2Result.integrationResults.dependenciesResolved}
🗄️  Supabase Integrated: ${step2Result.integrationResults.supabaseIntegrated || false}
🔧 Context Files Linked: ${step2Result.integrationResults.contextFilesLinked || false}

CREATED FILES:
${step2Result.createdFiles.map(f => `   🆕 ${f}`).join('\n')}

MODIFIED FILES:
${step2Result.modifiedFiles.map(f => `   ✏️  ${f}`).join('\n')}
`;
    }

    summary += `
COMPONENT ANALYSIS:
${step1Result.componentType.reasoning}

QUALITY ASSESSMENT:
🎨 Design Quality: ${enhancedFeatures.tailwindQuality === 'expert' ? 'Premium ⭐⭐⭐' : enhancedFeatures.tailwindQuality === 'advanced' ? 'Professional ⭐⭐' : 'Standard ⭐'}
🗄️  Database Ready: ${enhancedFeatures.supabaseIntegration ? 'Yes ✅' : 'No ❌'}
🔧 Context Aware: ${enhancedFeatures.contextIntegration ? 'Yes ✅' : 'No ❌'}
🏢 Business Focused: ${enhancedFeatures.businessTypeDetected !== 'Business' ? 'Yes ✅' : 'Generic ❌'}

${step1Result.success && (step2Result?.success !== false) ? '🎉 Enhanced two-step generation completed successfully!' : '❌ Enhanced two-step generation encountered issues.'}
`;

    return summary.trim();
  }

  /**
   * 🔥 ENHANCED: GET PROJECT ANALYSIS WITH SUPABASE INFO
   */
  async getProjectAnalysisSummary(): Promise<string> {
    try {
      const baseSummary = await this.analysisEngine.getProjectAnalysisSummary();
      
      return `${baseSummary}

🔥 ENHANCED CAPABILITIES:
✅ Mandatory Supabase schema integration
✅ Database context detection & file gathering
✅ Expert Tailwind CSS generation
✅ Business-specific design patterns
✅ Context file integration (Auth, Cart, etc.)
✅ Conversion optimization focus
✅ Mobile-first responsive design
✅ Accessibility compliance

🎯 QUALITY STANDARDS:
- Database queries use actual schema (no column errors)
- Generated code integrates with existing systems
- Professional design rivaling $10k+ agencies
- Production-ready TypeScript with proper interfaces
- Industry-specific features and content
`;
    } catch (error) {
      return `Failed to get enhanced project analysis summary: ${error}`;
    }
  }

  /**
   * 🔥 ENHANCED: REFRESH WITH SUPABASE SCANNING
   */
  async refreshFileStructure(): Promise<void> {
    try {
      this.streamUpdate('🔄 Refreshing enhanced file structure (including Supabase)...');
      await this.analysisEngine.refreshFileStructure();
      this.streamUpdate('✅ Enhanced file structure refreshed with Supabase integration');
    } catch (error) {
      this.streamUpdate(`⚠️ Failed to refresh enhanced file structure: ${error}`);
    }
  }

  /**
   * 🔥 ENHANCED: ANALYSIS ONLY WITH SUPABASE
   */
  async analyzeOnly(userPrompt: string, projectId?: number): Promise<GenerationResult> {
    this.streamUpdate('🔍 Running enhanced analysis-only workflow...');
    this.streamUpdate('🗄️  Supabase integration: ENABLED');
    this.streamUpdate('🔧 Context detection: ENABLED');
    
    return await this.analysisEngine.analyzeAndGenerate(userPrompt, projectId);
  }

  /**
   * INTEGRATION ONLY (unchanged)
   */
  async integrateOnly(generationResult: GenerationResult): Promise<IntegrationResult> {
    this.streamUpdate('🔗 Running integration-only workflow...');
    return await this.integrationEngine.integrateComponent(generationResult);
  }

  /**
   * 🔥 NEW: GET SUPABASE SCHEMA SUMMARY
   */
  async getSupabaseSchemaStatus(): Promise<{
    available: boolean;
    tables: number;
    files: number;
    status: string;
  }> {
    try {
      const summary = await this.analysisEngine.getProjectAnalysisSummary();
      const supabaseFiles = (summary.match(/Supabase files: (\d+)/)?.[1]) || '0';
      
      return {
        available: parseInt(supabaseFiles) > 0,
        tables: 0, // Would need to parse from actual summary
        files: parseInt(supabaseFiles),
        status: parseInt(supabaseFiles) > 0 ? 'Schema available - database integration enabled' : 'No schema found - using fallback patterns'
      };
    } catch (error) {
      return {
        available: false,
        tables: 0,
        files: 0,
        status: 'Schema check failed'
      };
    }
  }

  /**
   * 🔥 NEW: FORCE SUPABASE CONTEXT FOR SIMPLE COMPONENTS
   */
  async generateWithForcedSupabase(userPrompt: string, projectId?: number): Promise<TwoStepResult> {
    return await this.generateComponent(userPrompt, {
      forceSupabaseContext: true,
      verbose: true,
      projectId
    }, projectId);
  }
}