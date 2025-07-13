import Anthropic from '@anthropic-ai/sdk';
import { 
  ProjectFile, 
  ASTNode, 
  ModificationResult, 
  ModificationScope,
  ModificationChange
} from './filemodifier/types';
import { ScopeAnalyzer } from './filemodifier/scopeanalyzer';
import { promises as fs } from 'fs';;
import { DependencyManager } from './filemodifier/dependancy';
import { FallbackMechanism } from './filemodifier/fallback';

// Import the NEW Two-Step System (using your existing paths)
import { TwoStepComponentGenerationSystem, TwoStepResult } from './processor/two-step-component-system';
import { AnalysisAndGenerationEngine } from './filemodifier/component_analysis';
import { IntegrationEngine } from './processor/component_integerator';
import { EnhancedLLMRipgrepProcessor } from './processor/text-modifier';

// Import the NEW TailwindChangeProcessor
import { TailwindChangeProcessor } from './processor/Tailwindprocessor';

import { ASTAnalyzer } from './processor/Astanalyzer';
import { ProjectAnalyzer } from './processor/projectanalyzer';
import { FullFileProcessor } from './processor/Fullfileprocessor';
import { TargetedNodesProcessor } from './processor/TargettedNodes';
import { TokenTracker } from '../utils/TokenTracer';
import { RedisService } from './Redis';



interface HybridProcessingResult {
  success: boolean;
  filesModified: string[];
  totalReplacements: number;
  averageConfidence: number;
  processingTime: string;
  overallStrategy: string;
  stats: {
    filesScanned: number;
    nodesExtracted: number;
    batchesProcessed: number;
    totalBatches: number;
  };
  batchResults: Array<{
    modifications: Array<{
      originalContent: string;
      modifiedContent: string;
      confidence: number;
      shouldApply: boolean;
      reasoning: string;
    }>;
  }>;
  diffs: string[];
}

interface ContextualSearchResult {
  success: boolean;
  filesModified: string[];
  totalReplacements: number;
  changes?: Array<{
    filePath: string;
    originalText: string | undefined;
    modifiedText: string;
    modelUsed: string;
  }>;
}

interface DirectSearchResult {
  success: boolean;
  filesModified: string[];
  totalReplacements: number;
  changes?: Array<{
    filePath: string;
    originalText: string;
    modifiedText: string;
    modelUsed: string;
  }>;
}
export class EnhancedUnrestrictedIntelligentFileModifier {
  private anthropic: Anthropic;
  private reactBasePath: string;
  private redis: RedisService;
  private sessionId: string;
  private streamCallback?: (message: string) => void;
  
  // Original module instances (REMOVED componentGenerationSystem)
  private scopeAnalyzer: ScopeAnalyzer;
  private dependencyManager: DependencyManager;
  private fallbackMechanism: FallbackMechanism;

  private Textbasedprocessor: EnhancedLLMRipgrepProcessor;
  private astAnalyzer: ASTAnalyzer;
  private projectAnalyzer: ProjectAnalyzer;
  private fullFileProcessor: FullFileProcessor;
  private targetedNodesProcessor: TargetedNodesProcessor;
  private tokenTracker: TokenTracker;

  // Processors
  private tailwindChangeProcessor: TailwindChangeProcessor;

  // NEW: Two-Step Component Generation System (REPLACES componentGenerationSystem)
  private twoStepSystem: TwoStepComponentGenerationSystem;

  constructor(anthropic: Anthropic, reactBasePath: string, sessionId: string, redisUrl?: string) {
    console.log('[DEBUG] EnhancedUnrestrictedIntelligentFileModifier constructor starting...');
    console.log(`[DEBUG] reactBasePath: ${reactBasePath}`);
    
    this.anthropic = anthropic;
    this.reactBasePath = reactBasePath;
    this.sessionId = sessionId;
    this.redis = new RedisService(redisUrl);
    
    // Initialize original modules (REMOVED componentGenerationSystem)
    this.scopeAnalyzer = new ScopeAnalyzer(anthropic);
    this.dependencyManager = new DependencyManager(new Map());
    this.fallbackMechanism = new FallbackMechanism(anthropic);

    // Initialize existing processors
    this.tokenTracker = new TokenTracker();
    this.astAnalyzer = new ASTAnalyzer();
    this.projectAnalyzer = new ProjectAnalyzer(reactBasePath);
    
    console.log('[DEBUG] About to initialize FullFileProcessor...');
    this.fullFileProcessor = new FullFileProcessor(
      anthropic, 
      this.tokenTracker,
      reactBasePath
    );
    console.log('[DEBUG] FullFileProcessor initialized');
    
    console.log('[DEBUG] About to initialize TargetedNodesProcessor...');
    this.targetedNodesProcessor = new TargetedNodesProcessor(
      anthropic, 
      reactBasePath
    );
    console.log('[DEBUG] TargetedNodesProcessor initialized with reactBasePath');
TailwindChangeProcessor
    console.log('[DEBUG] About to initialize TailwindChangeProcessor...');
    this.tailwindChangeProcessor = new TailwindChangeProcessor(
      anthropic,
      reactBasePath
    );
    console.log('[DEBUG] TailwindChangeProcessor initialized');
   this.Textbasedprocessor = new EnhancedLLMRipgrepProcessor(
    reactBasePath,
      anthropic
      
    );
    // NEW: Initialize Two-Step Component Generation System (REPLACES componentGenerationSystem)
    console.log('[DEBUG] About to initialize TwoStepComponentGenerationSystem...');
    this.twoStepSystem = new TwoStepComponentGenerationSystem(anthropic, reactBasePath);
    console.log('[DEBUG] TwoStepComponentGenerationSystem initialized');
    
    console.log('[DEBUG] All processors initialized');
  }

  // Verify processor setup
  private verifyProcessorSetup(): void {
    console.log('[DEBUG] Verifying processor setup...');
    console.log(`[DEBUG] this.reactBasePath: ${this.reactBasePath}`);
    console.log(`[DEBUG] targetedNodesProcessor exists: ${!!this.targetedNodesProcessor}`);
    console.log(`[DEBUG] tailwindChangeProcessor exists: ${!!this.tailwindChangeProcessor}`);
    console.log(`[DEBUG] twoStepSystem exists: ${!!this.twoStepSystem}`);
    
    if (this.targetedNodesProcessor && (this.targetedNodesProcessor as any).reactBasePath) {
      console.log(`[DEBUG] targetedNodesProcessor.reactBasePath: ${(this.targetedNodesProcessor as any).reactBasePath}`);
    }
  }

  // ==============================================================
  // SESSION MANAGEMENT (simplified with error handling)
  // ==============================================================

  async initializeSession(): Promise<void> {
    try {
      const existingStartTime = await this.redis.getSessionStartTime(this.sessionId);
      if (!existingStartTime) {
        await this.redis.setSessionStartTime(this.sessionId, new Date().toISOString());
      }

      const hasCache = await this.redis.hasProjectFiles(this.sessionId);
      if (!hasCache) {
        this.streamUpdate('🔄 Building project tree (first time for this session)...');
        await this.buildProjectTree();
      } else {
        this.streamUpdate('📁 Loading cached project files from Redis...');
      }
    } catch (error) {
      this.streamUpdate('⚠️ Redis not available, proceeding without cache...');
      await this.buildProjectTree();
    }
  }

  async clearSession(): Promise<void> {
    try {
      await this.redis.clearSession(this.sessionId);
    } catch (error) {
      console.log('Redis clear session failed:', error);
    }
  }

  // ==============================================================
  // PROJECT FILES MANAGEMENT (with Redis fallbacks)
  // ==============================================================

  private async getProjectFiles(): Promise<Map<string, ProjectFile>> {
    try {
      const projectFiles = await this.redis.getProjectFiles(this.sessionId);
      return projectFiles || new Map();
    } catch (error) {
      this.streamUpdate('⚠️ Using fresh project scan...');
      return new Map();
    }
  }

  private async setProjectFiles(projectFiles: Map<string, ProjectFile>): Promise<void> {
    try {
      await this.redis.setProjectFiles(this.sessionId, projectFiles);
    } catch (error) {
      console.log('Redis set project files failed:', error);
    }
  }

  private async updateProjectFile(filePath: string, projectFile: ProjectFile): Promise<void> {
    try {
      await this.redis.updateProjectFile(this.sessionId, filePath, projectFile);
    } catch (error) {
      console.log('Redis update project file failed:', error);
    }
  }

  // ==============================================================
  // MODIFICATION SUMMARY (with Redis fallbacks)
  // ==============================================================

  private async addModificationChange(
    type: 'modified' | 'created' | 'updated',
    file: string,
    description: string,
    options?: {
      approach?: 'FULL_FILE' | 'TARGETED_NODES' | 'COMPONENT_ADDITION' | 'TAILWIND_CHANGE' | 'TWO_STEP_WORKFLOW' | "TEXT_BASED_CHANGE";
      success?: boolean;
      linesChanged?: number;
      componentsAffected?: string[];
      reasoning?: string;
    }
  ): Promise<void> {
    try {
      const change: ModificationChange = {
        type,
        file,
        description,
        timestamp: new Date().toISOString(),
        //@ts-ignore
        approach: options?.approach,
        success: options?.success,
        details: {
          linesChanged: options?.linesChanged,
          componentsAffected: options?.componentsAffected,
          reasoning: options?.reasoning
        }
      };

      await this.redis.addModificationChange(this.sessionId, change);
    } catch (error) {
      console.log('Redis add modification change failed:', error);
    }
  }

  private async getModificationContextualSummary(): Promise<string> {
    try {
      const changes = await this.redis.getModificationChanges(this.sessionId);
      
      if (changes.length === 0) {
        return "";
      }

      const recentChanges = changes.slice(-5);
      const uniqueFiles = new Set(changes.map(c => c.file));
      const sessionStartTime = await this.redis.getSessionStartTime(this.sessionId);
      
      const durationMs = new Date().getTime() - new Date(sessionStartTime || new Date()).getTime();
      const minutes = Math.floor(durationMs / 60000);
      const seconds = Math.floor((durationMs % 60000) / 1000);
      const duration = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

      return `
**RECENT MODIFICATIONS IN THIS SESSION:**
${recentChanges.map(change => {
  const icon = this.getChangeIcon(change);
  const status = change.success === false ? ' (failed)' : '';
  return `• ${icon} ${change.file}${status}: ${change.description}`;
}).join('\n')}

**Session Context:**
• Total files modified: ${uniqueFiles.size}
• Session duration: ${duration}
      `.trim();
    } catch (error) {
      return "";
    }
  }

  private async getMostModifiedFiles(): Promise<Array<{ file: string; count: number }>> {
    try {
      const changes = await this.redis.getModificationChanges(this.sessionId);
      const fileStats: Record<string, number> = {};
      
      changes.forEach(change => {
        fileStats[change.file] = (fileStats[change.file] || 0) + 1;
      });
      
      return Object.entries(fileStats)
        .map(([file, count]) => ({ file, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    } catch (error) {
      return [];
    }
  }

  // ==============================================================
  // PROJECT TREE BUILDING (simplified with error handling)
  // ==============================================================

  async buildProjectTree(): Promise<void> {
    this.streamUpdate('📂 Analyzing React project structure...');
    
    try {
      let projectFiles = new Map<string, ProjectFile>();
      
      const currentProjectFiles = await this.getProjectFiles();
      this.dependencyManager = new DependencyManager(currentProjectFiles);
      
      // Use the project analyzer
      const buildResult = await (this.projectAnalyzer as any).buildProjectTree(
        projectFiles, 
        this.dependencyManager,
        (message: string) => this.streamUpdate(message)
      );
      
      if (buildResult && buildResult.size > 0) {
        projectFiles = buildResult;
      }
      
      if (projectFiles.size === 0) {
        this.streamUpdate('⚠️ No React files found in project, creating basic structure...');
        // Continue anyway, component creation will work
      } else {
        await this.setProjectFiles(projectFiles);
        this.streamUpdate(`✅ Loaded ${projectFiles.size} React files into cache`);
      }
    } catch (error) {
      this.streamUpdate(`⚠️ Project tree building error: ${error}`);
      this.streamUpdate('Continuing with component creation anyway...');
    }
  }

  // ==============================================================
  // STREAM UPDATES
  // ==============================================================

  setStreamCallback(callback: (message: string) => void): void {
    this.streamCallback = callback;
    this.tailwindChangeProcessor.setStreamCallback(callback);
    // NEW: Set stream callback for two-step system
    this.twoStepSystem.setStreamCallback(callback);
  }

  private streamUpdate(message: string): void {
    if (this.streamCallback) {
      this.streamCallback(message);
    }
  }

  // ==============================================================
  // NEW: TAILWIND CHANGE HANDLER
  // ==============================================================

  private async handleTailwindChange(
    prompt: string,
    scope: ModificationScope
  ): Promise<ModificationResult> {
    
    this.streamUpdate(`🎨 TAILWIND_CHANGE: Starting Tailwind configuration modification...`);
    
    try {
      const projectFiles = await this.getProjectFiles();
      
      // Create modification summary interface
      const modificationSummary = {
        addChange: async (type: 'modified' | 'created' | 'updated', file: string, description: string, options?: any) => {
          await this.addModificationChange(type, file, description, {
            approach: 'TAILWIND_CHANGE',
            success: options?.success,
            linesChanged: options?.linesChanged,
            componentsAffected: options?.componentsAffected,
            reasoning: options?.reasoning
          });
        },
        getSummary: async () => await this.getModificationContextualSummary(),
        getMostModifiedFiles: async () => await this.getMostModifiedFiles()
      };

      // Use the tailwind change processor
      const result = await this.tailwindChangeProcessor.handleTailwindChange(
        prompt,
        scope,
        projectFiles,
        modificationSummary as any
      );

      // Update project files cache if successful
      if (result.success) {
        this.streamUpdate(`✅ TAILWIND_CHANGE: Tailwind configuration updated successfully!`);
        this.streamUpdate(`   🎨 Modified: ${result.selectedFiles?.length || 0} config files`);
        this.streamUpdate(`   📁 Created: ${result.addedFiles?.length || 0} config files`);
      }

      return result;

    } catch (error) {
      this.streamUpdate(`❌ TAILWIND_CHANGE: Tailwind modification failed: ${error}`);
      
      return {
        success: false,
        error: `Tailwind modification failed: ${error}`,
        selectedFiles: [],
        addedFiles: [],
        approach: 'TAILWIND_CHANGE',
        reasoning: scope.reasoning || 'Tailwind modification attempt failed'
      };
    }
  }

  // ==============================================================
  // NEW: TWO-STEP COMPONENT ADDITION HANDLER (REPLACES old componentGenerationSystem)
  // ==============================================================

  async handleComponentAddition(
    prompt: string,
    scope: any,
    projectSummaryCallback?: (summary: string, prompt: string) => Promise<string | null>
  ): Promise<any> {
    
    this.streamUpdate(`🚀 TWO-STEP WORKFLOW: Starting enhanced component generation...`);
    
    try {
      // Use the new two-step system directly
      const result: TwoStepResult = await this.twoStepSystem.generateComponent(prompt, {
        skipIntegration: false,
        dryRun: false,
        verbose: true
      });

      if (result.success) {
        // Extract files from both steps
        const createdFiles = [
          ...result.step2.createdFiles
        ];
        
        const modifiedFiles = [
          ...result.step2.modifiedFiles
        ];

        // Add changes to modification summary
        const modificationSummary = {
          addChange: async (type: 'modified' | 'created' | 'updated', file: string, description: string, options?: any) => {
            await this.addModificationChange(type, file, description, {
              approach: 'TWO_STEP_WORKFLOW',
              success: options?.success,
              linesChanged: options?.linesChanged,
              componentsAffected: options?.componentsAffected,
              reasoning: options?.reasoning
            });
          },
          getSummary: async () => await this.getModificationContextualSummary()
        };

        // Log all changes
        for (const filePath of createdFiles) {
          await modificationSummary.addChange(
            'created',
            filePath,
            `Created ${result.step1.componentType.type}: ${result.step1.componentType.name}`,
            { 
              approach: 'TWO_STEP_WORKFLOW',
              success: true,
              reasoning: `Step 1: Generated ${result.step1.componentType.type}, Step 2: Integrated successfully`
            }
          );
        }

        for (const filePath of modifiedFiles) {
          await modificationSummary.addChange(
            'updated', 
            filePath,
            `Integrated ${result.step1.componentType.type} into existing structure`,
            { 
              approach: 'TWO_STEP_WORKFLOW',
              success: true,
              reasoning: 'Step 2: Integration with existing files'
            }
          );
        }

        this.streamUpdate(`✅ TWO-STEP WORKFLOW: Component generation completed successfully!`);
        this.streamUpdate(`   📊 Component Type: ${result.step1.componentType.type.toUpperCase()}`);
        this.streamUpdate(`   📝 Component Name: ${result.step1.componentType.name}`);
        this.streamUpdate(`   📁 Created Files: ${createdFiles.length}`);
        this.streamUpdate(`   📝 Modified Files: ${modifiedFiles.length}`);
        this.streamUpdate(`   🛣️  Routing Updated: ${result.step2.integrationResults.routingUpdated}`);
        this.streamUpdate(`   📱 App File Updated: ${result.step2.integrationResults.appFileUpdated}`);
        this.streamUpdate(`   ⏱️  Total Duration: ${result.totalDuration}ms`);

        // Try to refresh cache
        try {
          await this.buildProjectTree();
        } catch (error) {
          this.streamUpdate('⚠️ Cache refresh failed, but operation succeeded');
        }

        return {
          success: true,
          selectedFiles: modifiedFiles,
          addedFiles: createdFiles,
          approach: 'TWO_STEP_COMPONENT_GENERATION',
          reasoning: `Two-step workflow completed successfully. Step 1: Analyzed and generated ${result.step1.componentType.type} '${result.step1.componentType.name}'. Step 2: Integrated with existing project structure. Created ${createdFiles.length} files, modified ${modifiedFiles.length} files. Integration results: routing=${result.step2.integrationResults.routingUpdated}, app=${result.step2.integrationResults.appFileUpdated}.`,
          modificationSummary: await modificationSummary.getSummary(),
          componentGenerationResult: {
            success: true,
            generatedFiles: createdFiles,
            updatedFiles: modifiedFiles,
            twoStepWorkflow: true,
            step1Result: {
              componentType: result.step1.componentType,
              generatedContent: result.step1.generatedContent.length,
              elementTreeContext: result.step1.elementTreeContext.length > 0
            },
            step2Result: {
              integrationResults: result.step2.integrationResults,
              createdFiles: result.step2.createdFiles,
              modifiedFiles: result.step2.modifiedFiles
            },
            totalDuration: result.totalDuration
          },
          tokenUsage: this.tokenTracker.getStats(),
          twoStepSummary: result.summary
        };
      } else {
        throw new Error(result.error || 'Two-step generation failed');
      }

    } catch (error) {
      this.streamUpdate(`❌ TWO-STEP WORKFLOW: Component generation failed: ${error}`);
      
      // Fallback to emergency creation
      this.streamUpdate('🚨 Trying emergency component creation...');
      return await this.createComponentEmergency(prompt);
    }
  }

  // ==============================================================
  // NEW: ADDITIONAL TWO-STEP WORKFLOW METHODS
  // ==============================================================

  async generateComponentTwoStep(
    prompt: string,
    options?: {
      skipIntegration?: boolean;
      dryRun?: boolean;
      verbose?: boolean;
    }
  ): Promise<TwoStepResult> {
    this.streamUpdate('🚀 Direct Two-Step Generation Access...');
    
    try {
      // Initialize session
      await this.initializeSession();
      
      // Use the two-step system directly
      const result = await this.twoStepSystem.generateComponent(prompt, options);
      
      // Update cache if successful
      if (result.success) {
        try {
          await this.buildProjectTree();
        } catch (error) {
          this.streamUpdate('⚠️ Cache refresh failed after two-step generation');
        }
      }
      
      return result;
    } catch (error) {
      this.streamUpdate(`❌ Direct two-step generation failed: ${error}`);
      throw error;
    }
  }

  async analyzeComponentOnly(prompt: string): Promise<any> {
    this.streamUpdate('🔍 Analysis-Only Workflow...');
    
    try {
      await this.initializeSession();
      
      const analysisEngine = new AnalysisAndGenerationEngine(this.anthropic, this.reactBasePath);
      analysisEngine.setStreamCallback(this.streamCallback || (() => {}));
      
      const result = await analysisEngine.analyzeAndGenerate(prompt);
      
      if (result.success) {
        this.streamUpdate('✅ Analysis completed successfully!');
        this.streamUpdate(`   📊 Component Type: ${result.componentType.type.toUpperCase()}`);
        this.streamUpdate(`   📝 Component Name: ${result.componentType.name}`);
        this.streamUpdate(`   📄 Generated Code: ${result.generatedContent.length} characters`);
        
        return {
          success: true,
          componentType: result.componentType,
          generatedContent: result.generatedContent,
          elementTreeContext: result.elementTreeContext,
          projectPatterns: result.projectPatterns,
          componentMap: result.componentMap,
          existingRoutes: result.existingRoutes,
          approach: 'ANALYSIS_ONLY'
        };
      } else {
        throw new Error(result.error || 'Analysis failed');
      }
      
    } catch (error) {
      this.streamUpdate(`❌ Analysis-only workflow failed: ${error}`);
      throw error;
    }
  }

  async integrateComponentOnly(generationResult: any): Promise<any> {
    this.streamUpdate('🔗 Integration-Only Workflow...');
    
    try {
      const integrationEngine = new IntegrationEngine(this.anthropic, this.reactBasePath);
      integrationEngine.setStreamCallback(this.streamCallback || (() => {}));
      
      const result = await integrationEngine.integrateComponent(generationResult);
      
      if (result.success) {
        this.streamUpdate('✅ Integration completed successfully!');
        this.streamUpdate(`   📁 Created Files: ${result.createdFiles.length}`);
        this.streamUpdate(`   📝 Modified Files: ${result.modifiedFiles.length}`);
        
        // Update cache
        try {
          await this.buildProjectTree();
        } catch (error) {
          this.streamUpdate('⚠️ Cache refresh failed after integration');
        }
        
        return {
          success: true,
          createdFiles: result.createdFiles,
          modifiedFiles: result.modifiedFiles,
          integrationResults: result.integrationResults,
          approach: 'INTEGRATION_ONLY'
        };
      } else {
        throw new Error(result.error || 'Integration failed');
      }
      
    } catch (error) {
      this.streamUpdate(`❌ Integration-only workflow failed: ${error}`);
      throw error;
    }
  }

  async getTwoStepProjectSummary(): Promise<string> {
    try {
      const analysisEngine = new AnalysisAndGenerationEngine(this.anthropic, this.reactBasePath);
      return await analysisEngine.getProjectAnalysisSummary();
    } catch (error) {
      return `Failed to get two-step project summary: ${error}`;
    }
  }

  // ==============================================================
  // EXISTING HANDLERS (unchanged)
  // ==============================================================

  private async handleFullFileModification(prompt: string): Promise<boolean> {
    const projectFiles = await this.getProjectFiles();
    
    try {
      const processor = this.fullFileProcessor as any;
      let result;
      
      if (processor.processFullFileModification) {
        result = await processor.processFullFileModification(
          prompt,
          projectFiles,
          this.reactBasePath,
          (message: string) => this.streamUpdate(message)
        );
      } else if (processor.process) {
        result = await processor.process(
          prompt,
          projectFiles,
          this.reactBasePath,
          (message: string) => this.streamUpdate(message)
        );
      } else if (processor.handleFullFileModification) {
        result = await processor.handleFullFileModification(
          prompt,
          projectFiles,
          this.reactBasePath,
          (message: string) => this.streamUpdate(message)
        );
      } else {
        this.streamUpdate('⚠️ No suitable method found on FullFileProcessor');
        return false;
      }

      if (result) {
        if (result.updatedProjectFiles) {
          await this.setProjectFiles(result.updatedProjectFiles);
        } else if (result.projectFiles) {
          await this.setProjectFiles(result.projectFiles);
        }

        if (result.changes && Array.isArray(result.changes)) {
          for (const change of result.changes) {
            await this.addModificationChange(
              change.type || 'modified',
              change.file,
              change.description || 'File modified',
              {
                approach: 'FULL_FILE',
                success: change.success !== false,
                linesChanged: change.details?.linesChanged,
                componentsAffected: change.details?.componentsAffected,
                reasoning: change.details?.reasoning
              }
            );
          }
        }

        return result.success !== false;
      }

      return false;
    } catch (error) {
      this.streamUpdate(`❌ Full file modification failed: ${error}`);
      return false;
    }
  }

  private async handleTargetedModification(prompt: string): Promise<boolean> {
    console.log('[DEBUG] handleTargetedModification: Starting...');
    
    try {
      console.log('[DEBUG] handleTargetedModification: Getting project files...');
      const projectFiles = await this.getProjectFiles();
      console.log(`[DEBUG] handleTargetedModification: Got ${projectFiles.size} project files`);
      
      console.log('[DEBUG] handleTargetedModification: Getting processor reference...');
      const processor = this.targetedNodesProcessor as any;
      console.log('[DEBUG] handleTargetedModification: Processor type:', typeof processor);
      console.log('[DEBUG] handleTargetedModification: Processor methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(processor)));
      
      let result;
      
      console.log('[DEBUG] handleTargetedModification: Checking for processTargetedModification method...');
      if (processor.processTargetedModification) {
        console.log('[DEBUG] handleTargetedModification: Calling processTargetedModification...');
        result = await processor.processTargetedModification(
          prompt,
          projectFiles,
          this.reactBasePath,
          (message: string) => {
            console.log('[DEBUG] TargetedProcessor Stream:', message);
            this.streamUpdate(message);
          }
        );
        console.log('[DEBUG] handleTargetedModification: processTargetedModification completed with result:', result);
        
      } else if (processor.process) {
        console.log('[DEBUG] handleTargetedModification: Calling process method...');
        result = await processor.process(
          prompt,
          projectFiles,
          this.reactBasePath,
          (message: string) => {
            console.log('[DEBUG] TargetedProcessor Stream:', message);
            this.streamUpdate(message);
          }
        );
        console.log('[DEBUG] handleTargetedModification: process method completed with result:', result);
        
      } else if (processor.handleTargetedModification) {
        console.log('[DEBUG] handleTargetedModification: Calling handleTargetedModification method...');
        result = await processor.handleTargetedModification(
          prompt,
          projectFiles,
          this.reactBasePath,
          (message: string) => {
            console.log('[DEBUG] TargetedProcessor Stream:', message);
            this.streamUpdate(message);
          }
        );
        console.log('[DEBUG] handleTargetedModification: handleTargetedModification method completed with result:', result);
        
      } else {
        console.log('[DEBUG] handleTargetedModification: No suitable method found');
        this.streamUpdate('⚠️ No suitable method found on TargetedNodesProcessor');
        return false;
      }

      console.log('[DEBUG] handleTargetedModification: Processing result...');
      if (result) {
        console.log('[DEBUG] handleTargetedModification: Result exists, checking properties...');
        console.log('[DEBUG] handleTargetedModification: Result keys:', Object.keys(result));
        
        if (result.updatedProjectFiles) {
          console.log('[DEBUG] handleTargetedModification: Updating project files with updatedProjectFiles...');
          await this.setProjectFiles(result.updatedProjectFiles);
        } else if (result.projectFiles) {
          console.log('[DEBUG] handleTargetedModification: Updating project files with projectFiles...');
          await this.setProjectFiles(result.projectFiles);
        }

        if (result.changes && Array.isArray(result.changes)) {
          console.log(`[DEBUG] handleTargetedModification: Processing ${result.changes.length} changes...`);
          for (const change of result.changes) {
            console.log('[DEBUG] handleTargetedModification: Processing change:', change);
            await this.addModificationChange(
              change.type || 'modified',
              change.file,
              change.description || 'File modified',
              {
                approach: 'TARGETED_NODES',
                success: change.success !== false,
                linesChanged: change.details?.linesChanged,
                componentsAffected: change.details?.componentsAffected,
                reasoning: change.details?.reasoning
              }
            );
          }
        } else {
          console.log('[DEBUG] handleTargetedModification: No changes array found in result');
        }

        const success = result.success !== false;
        console.log(`[DEBUG] handleTargetedModification: Returning success: ${success}`);
        return success;
      } else {
        console.log('[DEBUG] handleTargetedModification: No result returned from processor');
        return false;
      }

    } catch (error) {
      console.error('[DEBUG] handleTargetedModification: Error occurred:', error);
      this.streamUpdate(`❌ Targeted modification failed: ${error}`);
      return false;
    }
  }

  // ==============================================================
  // MAIN PROCESSING METHOD (enhanced with TWO-STEP support)
  // ==============================================================

// ==============================================================
// MAIN PROCESSING METHOD (enhanced with TWO-STEP support and better error handling)
// ==============================================================

async processModification(
    prompt: string, 
    conversationContext?: string,
    dbSummary?: string,
    projectSummaryCallback?: (summary: string, prompt: string) => Promise<string | null>
  ): Promise<ModificationResult> {
    const startTime = Date.now();
    
    try {
      this.streamUpdate('🚀 Starting ENHANCED intelligent modification workflow...');
      console.log(`[DEBUG] Starting processModification with prompt: "${prompt.substring(0, 100)}..."`);
      console.log(`[DEBUG] Timestamp: ${new Date().toISOString()}`);
      console.log(`[DEBUG] Has conversationContext: ${!!conversationContext}`);
      console.log(`[DEBUG] Has dbSummary: ${!!dbSummary}`);
      console.log(`[DEBUG] Has projectSummaryCallback: ${!!projectSummaryCallback}`);
      
      // Verify setup
      console.log('[DEBUG] Verifying processor setup...');
      this.verifyProcessorSetup();
      
      // Initialize session (but don't fail if Redis is down)
      this.streamUpdate('🔧 Initializing session...');
      console.log('[DEBUG] About to call initializeSession()');
      
      try {
        await this.initializeSession();
        console.log('[DEBUG] initializeSession() completed successfully');
      } catch (sessionError) {
        console.warn('[DEBUG] Session initialization failed, continuing without cache:', sessionError);
        this.streamUpdate('⚠️ Session initialization failed, proceeding without cache...');
      }
      
      this.streamUpdate('📁 Getting project files...');
      console.log('[DEBUG] About to call getProjectFiles()');
      
      let projectFiles: Map<string, ProjectFile>;
      try {
        projectFiles = await this.getProjectFiles();
        console.log(`[DEBUG] getProjectFiles() returned ${projectFiles.size} files`);
      } catch (filesError) {
        console.warn('[DEBUG] Failed to get project files, using empty map:', filesError);
        projectFiles = new Map();
        this.streamUpdate('⚠️ Failed to get project files, proceeding with empty cache...');
      }
      
      if (projectFiles.size === 0) {
        this.streamUpdate('⚠️ No project files found, but proceeding with modification...');
        console.log('[DEBUG] No project files available, attempting to build project tree...');
        try {
          await this.buildProjectTree();
          projectFiles = await this.getProjectFiles();
          console.log(`[DEBUG] After buildProjectTree(), got ${projectFiles.size} files`);
        } catch (buildError) {
          console.warn('[DEBUG] buildProjectTree() failed:', buildError);
          this.streamUpdate('⚠️ Could not build project tree, proceeding anyway...');
        }
      }

      // Build project summary with error handling
      this.streamUpdate('📊 Building project summary...');
      console.log('[DEBUG] About to build project summary');
      
      let projectSummary: string;
      try {
        projectSummary = dbSummary || this.projectAnalyzer.buildProjectSummary(projectFiles);
        console.log(`[DEBUG] Project summary length: ${projectSummary.length}`);
      } catch (summaryError) {
        console.warn('[DEBUG] Failed to build project summary:', summaryError);
        projectSummary = "Project summary unavailable";
        this.streamUpdate('⚠️ Could not build project summary, using fallback...');
      }
      
      let contextWithSummary: string;
      try {
        const modificationSummary = await this.getModificationContextualSummary();
        contextWithSummary = (conversationContext || '') + '\n\n' + modificationSummary;
        console.log(`[DEBUG] Context with summary length: ${contextWithSummary.length}`);
      } catch (contextError) {
        console.warn('[DEBUG] Failed to get modification summary:', contextError);
        contextWithSummary = conversationContext || '';
        this.streamUpdate('⚠️ Could not get modification context, using basic context...');
      }
      
      // Analyze scope with comprehensive error handling
      this.streamUpdate('🔍 Analyzing scope...');
      console.log('[DEBUG] About to call analyzeScope()');
      
      let scope: ModificationScope;
      try {
        scope = await this.scopeAnalyzer.analyzeScope(
          prompt, 
          projectSummary, 
          contextWithSummary,
          dbSummary
        );
        console.log(`[DEBUG] Scope analysis completed: ${scope.scope}`);
        console.log(`[DEBUG] Scope reasoning: ${scope.reasoning}`);
      } catch (scopeError) {
        console.error('[DEBUG] Scope analysis failed:', scopeError);
        this.streamUpdate(`❌ Scope analysis failed: ${scopeError}`);
        
        // Fallback scope determination
        scope = {
          scope: 'TARGETED_NODES', // Safe fallback
          files: [],
          reasoning: `Scope analysis failed, defaulting to TARGETED_NODES. Error: ${scopeError}`
        };
        this.streamUpdate('🔄 Using fallback scope: TARGETED_NODES');
      }
      
      this.streamUpdate(`📋 Modification method: ${scope.scope}`);

      // Initialize result variables
      let success = false;
      let selectedFiles: string[] = [];
      let addedFiles: string[] = [];
      let modificationResult: ModificationResult;

      // Execute based on scope with enhanced error handling
      console.log(`[DEBUG] About to execute scope: ${scope.scope}`);
      console.log(`[DEBUG] Execution started at: ${Date.now() - startTime}ms`);
      
      try {
        switch (scope.scope) {
          case 'TEXT_BASED_CHANGE':
            this.streamUpdate('📝 Executing text-based content modification...');
            console.log('[DEBUG] About to call handleTextBasedChange()');
            
            try {
              modificationResult = await this.handleTextBasedChange(prompt, projectFiles, scope);
              console.log(`[DEBUG] handleTextBasedChange() completed with success: ${modificationResult.success}`);
              return modificationResult;
            } catch (textError) {
              console.error('[DEBUG] handleTextBasedChange() failed:', textError);
              this.streamUpdate(`❌ Text-based change failed: ${textError}`);
              throw textError;
            }
            
          case 'TAILWIND_CHANGE':
            this.streamUpdate('🎨 Executing Tailwind configuration modification...');
            console.log('[DEBUG] About to call handleTailwindChange()');
            
            try {
              modificationResult = await this.handleTailwindChange(prompt, scope);
              console.log(`[DEBUG] handleTailwindChange() completed with success: ${modificationResult.success}`);
              return modificationResult;
            } catch (tailwindError) {
              console.error('[DEBUG] handleTailwindChange() failed:', tailwindError);
              this.streamUpdate(`❌ Tailwind change failed: ${tailwindError}`);
              throw tailwindError;
            }
            
          case 'COMPONENT_ADDITION':
            this.streamUpdate('🚀 Executing two-step component addition...');
            console.log('[DEBUG] About to call handleComponentAddition() with two-step workflow');
            
            try {
              modificationResult = await this.handleComponentAddition(prompt, scope, projectSummaryCallback);
              console.log(`[DEBUG] handleComponentAddition() completed with success: ${modificationResult.success}`);
              return modificationResult;
            } catch (componentError) {
              console.error('[DEBUG] handleComponentAddition() failed:', componentError);
              this.streamUpdate(`❌ Component addition failed: ${componentError}`);
              throw componentError;
            }
            
          case 'FULL_FILE':
            this.streamUpdate('🚀 Executing full file modification...');
            console.log('[DEBUG] About to call handleFullFileModification()');
            
            try {
              success = await this.handleFullFileModification(prompt);
              console.log(`[DEBUG] handleFullFileModification() completed with success: ${success}`);
              
              if (success) {
                const fullFileModifications = await this.getMostModifiedFiles();
                selectedFiles = fullFileModifications.map(item => item.file);
              }
            } catch (fullFileError) {
              console.error('[DEBUG] handleFullFileModification() failed:', fullFileError);
              this.streamUpdate(`❌ Full file modification failed: ${fullFileError}`);
              success = false;
            }
            break;
            
          case 'TARGETED_NODES':
            this.streamUpdate('🚀 Executing targeted modification...');
            console.log('[DEBUG] About to call handleTargetedModification()');
            
            try {
              success = await this.handleTargetedModification(prompt);
              console.log(`[DEBUG] handleTargetedModification() completed with success: ${success}`);
              
              if (success) {
                const targetedModifications = await this.getMostModifiedFiles();
                selectedFiles = targetedModifications.map(item => item.file);
              }
            } catch (targetedError) {
              console.error('[DEBUG] handleTargetedModification() failed:', targetedError);
              this.streamUpdate(`❌ Targeted modification failed: ${targetedError}`);
              success = false;
            }
            break;
            
          default:
            this.streamUpdate(`⚠️ Unknown scope: ${scope.scope}, attempting two-step component addition fallback...`);
            console.log(`[DEBUG] Unknown scope: ${scope.scope}, using two-step fallback`);
            
            try {
              modificationResult = await this.handleComponentAddition(prompt, scope, projectSummaryCallback);
              console.log(`[DEBUG] Two-step fallback completed with success: ${modificationResult.success}`);
              return modificationResult;
            } catch (fallbackError) {
              console.error('[DEBUG] Two-step fallback failed:', fallbackError);
              this.streamUpdate(`❌ Fallback failed: ${fallbackError}`);
              throw fallbackError;
            }
        }
        
      } catch (executionError) {
        console.error('[DEBUG] Scope execution failed:', executionError);
        this.streamUpdate(`❌ Execution failed for scope ${scope.scope}: ${executionError}`);
        
        // Try final emergency fallback
        if (scope.scope !== 'COMPONENT_ADDITION') {
          this.streamUpdate('🚨 Attempting emergency component creation fallback...');
          try {
            const emergencyResult = await this.createComponentEmergency(prompt);
            console.log(`[DEBUG] Emergency fallback completed with success: ${emergencyResult.success}`);
            return emergencyResult;
          } catch (emergencyError) {
            console.error('[DEBUG] Emergency fallback failed:', emergencyError);
            this.streamUpdate(`❌ Emergency fallback failed: ${emergencyError}`);
          }
        }
        
        // If all else fails, return error result
        success = false;
      }
      
      // Return results for FULL_FILE and TARGETED_NODES
      console.log(`[DEBUG] About to return results. Success: ${success}`);
      console.log(`[DEBUG] Total execution time: ${Date.now() - startTime}ms`);
      
      let modificationSummary: string;
      try {
        modificationSummary = await this.getModificationContextualSummary();
      } catch (summaryError) {
        console.warn('[DEBUG] Failed to get final modification summary:', summaryError);
        modificationSummary = `Modification attempted for scope: ${scope.scope}`;
      }
      
      let tokenUsage: any;
      try {
        tokenUsage = this.tokenTracker.getStats();
      } catch (tokenError) {
        console.warn('[DEBUG] Failed to get token usage:', tokenError);
        tokenUsage = { totalTokens: 0 };
      }
      
      if (success) {
        return {
          success: true,
          selectedFiles,
          addedFiles,
          approach: scope.scope,
          reasoning: `${scope.reasoning} Enhanced AST analysis identified ${selectedFiles.length} files for modification.`,
          modificationSummary,
          tokenUsage
        };
      } else {
        return {
          success: false,
          error: `Modification process failed for scope: ${scope.scope}`,
          selectedFiles: [],
          addedFiles: [],
          approach: scope.scope,
          reasoning: scope.reasoning,
          tokenUsage
        };
      }
      
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`[DEBUG] processModification error after ${totalTime}ms:`, error);
      console.error(`[DEBUG] Error stack:`, (error as Error).stack);
      this.streamUpdate(`❌ Modification process failed: ${error}`);
      
      // Final fallback - try two-step component creation for any request
      this.streamUpdate('🚨 Final fallback: Two-step component creation...');
      console.log('[DEBUG] About to try two-step component creation as final fallback');
      
      try {
        const fallbackResult = await this.handleComponentAddition(prompt, { scope: 'COMPONENT_ADDITION', reasoning: 'Final fallback attempt', files: [] }, undefined);
        console.log(`[DEBUG] Final two-step fallback completed with success: ${fallbackResult.success}`);
        return fallbackResult;
      } catch (fallbackError) {
        console.error('[DEBUG] Final two-step fallback failed:', fallbackError);
        console.log('[DEBUG] About to try emergency creation as last resort');
        
        try {
          const emergencyResult = await this.createComponentEmergency(prompt);
          console.log(`[DEBUG] Emergency creation completed with success: ${emergencyResult.success}`);
          return emergencyResult;
        } catch (emergencyError) {
          console.error('[DEBUG] Emergency creation failed:', emergencyError);
          
          // Absolute final fallback
          return {
            success: false,
            error: `All modification attempts failed. Original error: ${error}. Fallback errors: ${fallbackError}, ${emergencyError}`,
            selectedFiles: [],
            addedFiles: [],
            approach: 'FULL_FILE',
            reasoning: 'Complete failure - all methods exhausted'
          };
        }
      }
    }
  }

// ==============================================================
// ENHANCED TEXT BASED CHANGE HANDLER (with comprehensive error handling)
// ==============================================================

// ==============================================================
// ENHANCED TEXT BASED CHANGE HANDLER (using EnhancedLLMRipgrepProcessor)
// ==============================================================

// FIXED VERSION - Replace your current handleTextBasedChange method with this
// This version bypasses the project cache and searches files directly

// FIXED VERSION: Enhanced Text-Based Change Handler
// This version properly extracts the first word and performs contextual search

// Use your existing EnhancedLLMRipgrepProcessor class
// Replace your handleTextBasedChange method with this:



// NEW METHOD: Extract first word with better logging and error handling




// ==============================================================
// ENHANCED TEXT BASED CHANGE HANDLER - Complete Implementation
// ==============================================================

// Import necessary types and processors


// ==============================================================
// MAIN TEXT BASED CHANGE HANDLER
// ==============================================================

// ==============================================================
// CORRECTED TEXT BASED CHANGE HANDLER - Uses ModificationScope
// ==============================================================

// HYBRID APPROACH COMPATIBLE: handleTextBasedChange method
// This works with your EnhancedLLMRipgrepProcessor that uses fast-glob + Babel AST + Claude batch processing

// ============================================================================
// MINIMAL FIXES FOR YOUR EXISTING handleTextBasedChange AND HYBRID PROCESSOR
// ============================================================================

// 1. FIX FOR YOUR EXISTING handleTextBasedChange method
// Replace your current handleTextBasedChange method with this COMPATIBLE version:

// ============================================================================
// EXTENSIVE LOGGING FOR HYBRID PROCESSOR AND HANDLETEXTBASEDCHANGE
// ============================================================================

// 1. ENHANCED handleTextBasedChange with extensive logging
// Replace your current handleTextBasedChange method with this version:

private async handleTextBasedChange(
  prompt: string,
  projectFiles: Map<string, ProjectFile>,
  scope: ModificationScope
): Promise<ModificationResult> {
  const startTime = Date.now();
  
  try {
    console.log(`\n=== EXTENSIVE LOGGING: TEXT BASED CHANGE START ===`);
    console.log(`[TEXT-CHANGE] Timestamp: ${new Date().toISOString()}`);
    console.log(`[TEXT-CHANGE] Prompt: "${prompt}"`);
    console.log(`[TEXT-CHANGE] Scope: ${scope.scope}`);
    console.log(`[TEXT-CHANGE] Project files count: ${projectFiles.size}`);
    console.log(`[TEXT-CHANGE] React base path: ${this.reactBasePath}`);
    console.log(`[TEXT-CHANGE] Scope reasoning: ${scope.reasoning}`);

    this.streamUpdate('📝 Starting EXTENSIVE LOGGING for text-based modification...');

    // STEP 1: Extract terms with extensive logging
    console.log(`\n=== STEP 1: TERM EXTRACTION ===`);
    let searchTerm = '';
    let replacementTerm = '';

    // Method 1: Try scope analysis first
    console.log(`[TERM-EXTRACT] Checking scope analysis...`);
    if (scope?.textChangeAnalysis?.searchTerm && scope?.textChangeAnalysis?.replacementTerm) {
      searchTerm = scope.textChangeAnalysis.searchTerm;
      replacementTerm = scope.textChangeAnalysis.replacementTerm;
      console.log(`[TERM-EXTRACT] ✅ Scope analysis found: "${searchTerm}" → "${replacementTerm}"`);
    } else {
      console.log(`[TERM-EXTRACT] ❌ No scope analysis available`);
      console.log(`[TERM-EXTRACT] scope.textChangeAnalysis: ${JSON.stringify(scope.textChangeAnalysis)}`);
    }
    
    // Method 2: Static method extraction
    if (!searchTerm || !replacementTerm) {
      console.log(`[TERM-EXTRACT] Trying static extraction method...`);
      try {
        console.log(`[TERM-EXTRACT] Textbasedprocessor exists: ${!!this.Textbasedprocessor}`);
        console.log(`[TERM-EXTRACT] Constructor exists: ${!!this.Textbasedprocessor.constructor}`);
        
        const extracted = (this.Textbasedprocessor.constructor as any).extractTermsFromPrompt(prompt);
        console.log(`[TERM-EXTRACT] Static extraction result: ${JSON.stringify(extracted)}`);
        
        if (extracted && extracted.searchTerm && extracted.replacementTerm) {
          searchTerm = extracted.searchTerm;
          replacementTerm = extracted.replacementTerm;
          console.log(`[TERM-EXTRACT] ✅ Static extraction: "${searchTerm}" → "${replacementTerm}"`);
          console.log(`[TERM-EXTRACT] Extraction method: ${extracted.extractionMethod}`);
          console.log(`[TERM-EXTRACT] Confidence: ${extracted.confidence}`);
        } else {
          console.log(`[TERM-EXTRACT] ❌ Static extraction failed or incomplete`);
        }
      } catch (staticError) {
        console.error(`[TERM-EXTRACT] Static extraction error:`, staticError);
      }
    }

    // Method 3: Pattern matching fallback
    if (!searchTerm || !replacementTerm) {
      console.log(`[TERM-EXTRACT] Trying pattern matching fallback...`);
      const patterns = [
        { pattern: /change\s+"([^"]+)"\s+to\s+"([^"]+)"/i, name: 'quoted_change' },
        { pattern: /replace\s+"([^"]+)"\s+with\s+"([^"]+)"/i, name: 'quoted_replace' },
        { pattern: /change\s+'([^']+)'\s+to\s+'([^']+)'/i, name: 'single_quoted' },
        { pattern: /change\s+([^\s]+(?:\s+[^\s]+)*)\s+to\s+(.+)/i, name: 'unquoted_change' }
      ];
      
      for (const { pattern, name } of patterns) {
        console.log(`[TERM-EXTRACT] Testing pattern: ${name}`);
        const match = prompt.match(pattern);
        console.log(`[TERM-EXTRACT] Pattern match result: ${!!match}`);
        
        if (match && match[1] && match[2]) {
          searchTerm = match[1].trim();
          replacementTerm = match[2].trim();
          console.log(`[TERM-EXTRACT] ✅ Pattern extraction (${name}): "${searchTerm}" → "${replacementTerm}"`);
          break;
        }
      }
    }

    // Validate terms
    console.log(`\n=== TERM VALIDATION ===`);
    console.log(`[TERM-VALIDATE] Search term: "${searchTerm}" (length: ${searchTerm.length})`);
    console.log(`[TERM-VALIDATE] Replacement term: "${replacementTerm}" (length: ${replacementTerm.length})`);
    console.log(`[TERM-VALIDATE] Terms identical: ${searchTerm === replacementTerm}`);
    
    if (!searchTerm || !replacementTerm || searchTerm === replacementTerm) {
      const errorMsg = !searchTerm || !replacementTerm ? 
        `Could not extract search/replacement terms from: "${prompt}"` :
        `Search and replacement terms are identical: "${searchTerm}"`;
      
      console.log(`[TERM-VALIDATE] ❌ Validation failed: ${errorMsg}`);
      
      return {
        success: false,
        selectedFiles: [],
        addedFiles: [],
        approach: 'TEXT_BASED_CHANGE',
        reasoning: errorMsg,
        modificationSummary: 'Failed: Invalid terms',
        tokenUsage: this.tokenTracker?.getStats() || { totalTokens: 0, totalInputTokens: 0, totalOutputTokens: 0, apiCalls: 0, estimatedCost: 0 }
      };
    }

    console.log(`[TERM-VALIDATE] ✅ Terms validated successfully`);

    // STEP 2: Setup hybrid processor with extensive logging
    console.log(`\n=== STEP 2: HYBRID PROCESSOR SETUP ===`);
    console.log(`[HYBRID-SETUP] Textbasedprocessor exists: ${!!this.Textbasedprocessor}`);
    console.log(`[HYBRID-SETUP] setStreamCallback method exists: ${typeof this.Textbasedprocessor.setStreamCallback === 'function'}`);
    
    if (this.Textbasedprocessor && typeof this.Textbasedprocessor.setStreamCallback === 'function') {
      console.log(`[HYBRID-SETUP] Setting up stream callback...`);
      this.Textbasedprocessor.setStreamCallback((message: string) => {
        console.log(`[HYBRID-PROCESSOR] ${message}`);
        this.streamUpdate(message);
      });
      console.log(`[HYBRID-SETUP] ✅ Stream callback configured`);
    } else {
      console.log(`[HYBRID-SETUP] ❌ Cannot set stream callback`);
    }

    // STEP 3: Execute hybrid approach with extensive logging
    console.log(`\n=== STEP 3: HYBRID EXECUTION ===`);
    this.streamUpdate(`🚀 Using HYBRID approach: fast-glob + Babel AST + Claude batch processing`);
    
    let hybridResult: any = null;
    console.log(`[HYBRID-EXEC] About to call processText method...`);
    console.log(`[HYBRID-EXEC] Method exists: ${typeof this.Textbasedprocessor.processText === 'function'}`);
    
    try {
      if (this.Textbasedprocessor && typeof this.Textbasedprocessor.processText === 'function') {
        console.log(`[HYBRID-EXEC] Calling processText with:`);
        console.log(`[HYBRID-EXEC]   userPrompt: "${prompt}"`);
        console.log(`[HYBRID-EXEC]   searchTerm: "${searchTerm}"`);
        console.log(`[HYBRID-EXEC]   replacementTerm: "${replacementTerm}"`);
        
        const processStartTime = Date.now();
        
        hybridResult = await this.Textbasedprocessor.processText(
          prompt,
          searchTerm,
          replacementTerm
        );
        
        const processEndTime = Date.now();
        console.log(`[HYBRID-EXEC] processText completed in ${processEndTime - processStartTime}ms`);
        
        console.log(`[HYBRID-EXEC] Result summary:`);
        console.log(`[HYBRID-EXEC]   success: ${hybridResult?.success}`);
        console.log(`[HYBRID-EXEC]   filesModified: ${hybridResult?.filesModified?.length || 0}`);
        console.log(`[HYBRID-EXEC]   totalReplacements: ${hybridResult?.totalReplacements || 0}`);
        console.log(`[HYBRID-EXEC]   overallStrategy: ${hybridResult?.overallStrategy || 'N/A'}`);
        console.log(`[HYBRID-EXEC]   error: ${hybridResult?.error || 'None'}`);
        console.log(`[HYBRID-EXEC]   stats: ${JSON.stringify(hybridResult?.stats || {})}`);
        
        if (hybridResult?.filesModified) {
          console.log(`[HYBRID-EXEC] Modified files:`);
          hybridResult.filesModified.forEach((file: string, index: number) => {
            console.log(`[HYBRID-EXEC]   ${index + 1}. ${file}`);
          });
        }
        
      } else {
        console.log(`[HYBRID-EXEC] ❌ processText method not available`);
        console.log(`[HYBRID-EXEC] Available methods: ${Object.getOwnPropertyNames(Object.getPrototypeOf(this.Textbasedprocessor))}`);
      }
    } catch (hybridError) {
      console.error(`[HYBRID-EXEC] ❌ processText failed:`, hybridError);
      console.error(`[HYBRID-EXEC] Error stack:`, (hybridError as Error).stack);
      hybridResult = null;
    }

    // Check hybrid result with extensive logging
    console.log(`\n=== STEP 4: HYBRID RESULT ANALYSIS ===`);
    console.log(`[HYBRID-RESULT] hybridResult exists: ${!!hybridResult}`);
    console.log(`[HYBRID-RESULT] hybridResult.success: ${hybridResult?.success}`);
    console.log(`[HYBRID-RESULT] hybridResult.filesModified exists: ${!!hybridResult?.filesModified}`);
    console.log(`[HYBRID-RESULT] hybridResult.filesModified.length: ${hybridResult?.filesModified?.length || 0}`);
    
    if (hybridResult && hybridResult.success && hybridResult.filesModified && hybridResult.filesModified.length > 0) {
      console.log(`[HYBRID-RESULT] ✅ Hybrid approach successful!`);
      console.log(`[HYBRID-RESULT] Processing time: ${hybridResult.processingTime}`);
      console.log(`[HYBRID-RESULT] Average confidence: ${(hybridResult.averageConfidence * 100).toFixed(1)}%`);
      
      // Track modifications with logging
      console.log(`[HYBRID-RESULT] Tracking modifications...`);
      for (const filePath of hybridResult.filesModified) {
        console.log(`[HYBRID-RESULT] Tracking modification for: ${filePath}`);
        try {
          await this.addModificationChange(
            'modified',
            filePath,
            `Hybrid text replacement: "${searchTerm}" → "${replacementTerm}"`,
            {
              approach: 'TEXT_BASED_CHANGE',
              success: true,
              linesChanged: hybridResult.batchResults?.reduce((sum: number, batch: any) => 
                sum + (batch.modifications?.length || 0), 0) || 0,
              reasoning: `${hybridResult.overallStrategy}. Processed ${hybridResult.stats?.nodesExtracted || 0} AST nodes in ${hybridResult.stats?.batchesProcessed || 0} batches`
            }
          );
          console.log(`[HYBRID-RESULT] ✅ Modification tracked for: ${filePath}`);
        } catch (trackingError) {
          console.warn(`[HYBRID-RESULT] ❌ Failed to track modification for ${filePath}:`, trackingError);
        }
      }

      const executionTime = Date.now() - startTime;
      console.log(`[HYBRID-RESULT] Total execution time: ${executionTime}ms`);
      console.log(`[HYBRID-RESULT] Returning successful result`);

      return {
        success: true,
        selectedFiles: hybridResult.filesModified,
        addedFiles: [],
        approach: 'TEXT_BASED_CHANGE',
        reasoning: hybridResult.overallStrategy || `Hybrid replacement: ${hybridResult.totalReplacements} replacements in ${hybridResult.filesModified.length} files`,
        modificationSummary: `Hybrid: "${searchTerm}" → "${replacementTerm}" (${hybridResult.totalReplacements} replacements, ${hybridResult.processingTime})`,
        tokenUsage: this.tokenTracker?.getStats() || { totalTokens: 0, totalInputTokens: 0, totalOutputTokens: 0, apiCalls: 0, estimatedCost: 0 }
      };
    }

    // FALLBACK: Direct file search with extensive logging
    console.log(`\n=== STEP 5: FALLBACK EXECUTION ===`);
    console.log(`[FALLBACK] Hybrid approach failed or returned no results`);
    console.log(`[FALLBACK] Starting direct file search...`);
    this.streamUpdate(`🔄 Hybrid failed, trying direct file search...`);

    const directResult = await this.performDirectFileSearchWithLogging(searchTerm, replacementTerm);
    
    console.log(`[FALLBACK] Direct search result:`);
    console.log(`[FALLBACK]   success: ${directResult.success}`);
    console.log(`[FALLBACK]   filesModified: ${directResult.filesModified.length}`);
    console.log(`[FALLBACK]   totalReplacements: ${directResult.totalReplacements}`);

    if (directResult.success && directResult.filesModified.length > 0) {
      console.log(`[FALLBACK] ✅ Direct file search successful!`);
      
      // Track modifications with logging
      for (const filePath of directResult.filesModified) {
        console.log(`[FALLBACK] Tracking modification for: ${filePath}`);
        try {
          await this.addModificationChange(
            'modified',
            filePath,
            `Direct file search: "${searchTerm}" → "${replacementTerm}"`,
            {
              approach: 'TEXT_BASED_CHANGE',
              success: true,
              linesChanged: directResult.changes?.filter((c: any) => c.filePath === filePath).length || 0,
              reasoning: 'Direct file system search fallback'
            }
          );
          console.log(`[FALLBACK] ✅ Modification tracked for: ${filePath}`);
        } catch (trackingError) {
          console.warn(`[FALLBACK] ❌ Failed to track modification for ${filePath}:`, trackingError);
        }
      }

      const executionTime = Date.now() - startTime;
      console.log(`[FALLBACK] Total execution time: ${executionTime}ms`);
      console.log(`[FALLBACK] Returning successful fallback result`);

      return {
        success: true,
        selectedFiles: directResult.filesModified,
        addedFiles: [],
        approach: 'TEXT_BASED_CHANGE',
        reasoning: `Direct file search fallback: ${directResult.totalReplacements} replacements in ${directResult.filesModified.length} files`,
        modificationSummary: `Fallback: "${searchTerm}" → "${replacementTerm}" (${directResult.totalReplacements} replacements)`,
        tokenUsage: this.tokenTracker?.getStats() || { totalTokens: 0 }
      };
    }

    // All methods failed
    console.log(`\n=== FINAL RESULT: FAILURE ===`);
    console.log(`[FINAL] All search methods failed`);
    console.log(`[FINAL] Hybrid result: ${hybridResult ? 'existed but failed' : 'null'}`);
    console.log(`[FINAL] Direct result: ${directResult ? 'existed but failed' : 'null'}`);
    this.streamUpdate(`❌ No matches found for "${searchTerm}" using any approach`);
    
    const executionTime = Date.now() - startTime;
    console.log(`[FINAL] Total execution time: ${executionTime}ms`);
    console.log(`[FINAL] Returning failure result`);
    
    return {
      success: false,
      selectedFiles: [],
      addedFiles: [],
      approach: 'TEXT_BASED_CHANGE',
      reasoning: `No matches found for "${searchTerm}" using hybrid approach or direct search`,
      modificationSummary: 'Failed: No matches found with any approach',
      tokenUsage: this.tokenTracker?.getStats() || { totalTokens: 0 }
    };

  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`\n=== CRITICAL ERROR ===`);
    console.error(`[CRITICAL] Error after ${executionTime}ms:`, error);
    console.error(`[CRITICAL] Error stack:`, (error as Error).stack);
    console.error(`[CRITICAL] Error name: ${(error as Error).name}`);
    console.error(`[CRITICAL] Error message: ${(error as Error).message}`);
    this.streamUpdate(`❌ Critical error in text search: ${error}`);
    
    return {
      success: false,
      selectedFiles: [],
      addedFiles: [],
      approach: 'TEXT_BASED_CHANGE',
      reasoning: `Critical error: ${error}`,
      modificationSummary: `Failed: Critical error`,
      tokenUsage: this.tokenTracker?.getStats() || { totalTokens: 0 },
      error: String(error)
    };
  }
}

// Enhanced direct file search with extensive logging
private async performDirectFileSearchWithLogging(
  searchTerm: string,
  replacementTerm: string
): Promise<{
  success: boolean;
  filesModified: string[];
  totalReplacements: number;
  changes: Array<{
    filePath: string;
    originalText: string;
    modifiedText: string;
    modelUsed: string;
  }>;
}> {
  console.log(`\n=== DIRECT FILE SEARCH WITH LOGGING ===`);
  console.log(`[DIRECT-SEARCH] Search term: "${searchTerm}"`);
  console.log(`[DIRECT-SEARCH] Replacement term: "${replacementTerm}"`);
  console.log(`[DIRECT-SEARCH] React base path: ${this.reactBasePath}`);
  
  try {
    const fg = require('fast-glob');
    const fs = require('fs').promises;
    const path = require('path');
    
    console.log(`[DIRECT-SEARCH] Loading required modules...`);
    console.log(`[DIRECT-SEARCH] fast-glob loaded: ${!!fg}`);
    console.log(`[DIRECT-SEARCH] fs.promises loaded: ${!!fs}`);
    console.log(`[DIRECT-SEARCH] path loaded: ${!!path}`);
    
    const patterns = [
      '**/*.{tsx,ts,jsx,js,css,html,scss,sass}',
      '!node_modules/**',
      '!.git/**',
      '!dist/**',
      '!build/**',
      '!.next/**'
    ];
    
    console.log(`[DIRECT-SEARCH] Search patterns: ${patterns.join(', ')}`);

    const globStartTime = Date.now();
    const files = await fg(patterns, {
      cwd: this.reactBasePath,
      absolute: true,
      onlyFiles: true,
      suppressErrors: true
    });
    const globEndTime = Date.now();
    
    console.log(`[DIRECT-SEARCH] Glob scan completed in ${globEndTime - globStartTime}ms`);
    console.log(`[DIRECT-SEARCH] Found ${files.length} files to search`);
    
    // Show sample files
    console.log(`[DIRECT-SEARCH] Sample files (first 5):`);
    (files.slice(0, 5)).forEach((file: string, index: number) => {
  console.log(`[DIRECT-SEARCH]   ${index + 1}. ${file}`);
});


    const filesModified: string[] = [];
    const changes: Array<{
      filePath: string;
      originalText: string;
      modifiedText: string;
      modelUsed: string;
    }> = [];
    let totalReplacements = 0;
    let filesProcessed = 0;
    let filesWithContent = 0;
    let filesWithMatches = 0;

    for (const file of files) {
      filesProcessed++;
      console.log(`[DIRECT-SEARCH] Processing file ${filesProcessed}/${files.length}: ${path.basename(file)}`);
      
      try {
        const content = await fs.readFile(file, 'utf8');
        
        if (content.length > 0) {
          filesWithContent++;
        }
        
        console.log(`[DIRECT-SEARCH]   File size: ${content.length} characters`);
        
        // Try multiple search strategies with logging
        let modified = false;
        let newContent = content;
        let strategy = '';
        
        // Strategy 1: Exact match
        console.log(`[DIRECT-SEARCH]   Testing exact match...`);
        if (content.includes(searchTerm)) {
          console.log(`[DIRECT-SEARCH]   ✅ Exact match found`);
          newContent = content.replace(new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacementTerm);
          modified = true;
          strategy = 'exact';
        }
        // Strategy 2: Case-insensitive match
        else {
          console.log(`[DIRECT-SEARCH]   Testing case-insensitive match...`);
          if (content.toLowerCase().includes(searchTerm.toLowerCase())) {
            console.log(`[DIRECT-SEARCH]   ✅ Case-insensitive match found`);
            newContent = content.replace(new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), replacementTerm);
            modified = true;
            strategy = 'case-insensitive';
          } else {
            console.log(`[DIRECT-SEARCH]   ❌ No match found`);
          }
        }
        
        if (modified && newContent !== content) {
          filesWithMatches++;
          console.log(`[DIRECT-SEARCH]   ✅ Modification successful (${strategy})`);
          console.log(`[DIRECT-SEARCH]   Writing modified content...`);
          
          await fs.writeFile(file, newContent, 'utf8');
          
          const relativePath = path.relative(this.reactBasePath, file);
          filesModified.push(relativePath);
          totalReplacements++;

          changes.push({
            filePath: relativePath,
            originalText: searchTerm,
            modifiedText: replacementTerm,
            modelUsed: `direct-search-${strategy}`
          });
          
          console.log(`[DIRECT-SEARCH]   ✅ File written: ${relativePath}`);
        } else {
          console.log(`[DIRECT-SEARCH]   ❌ No modification made`);
        }

      } catch (fileError) {
        console.warn(`[DIRECT-SEARCH] ❌ Error processing file ${file}:`, fileError);
      }
    }
    
    console.log(`\n=== DIRECT SEARCH SUMMARY ===`);
    console.log(`[DIRECT-SUMMARY] Files processed: ${filesProcessed}`);
    console.log(`[DIRECT-SUMMARY] Files with content: ${filesWithContent}`);
    console.log(`[DIRECT-SUMMARY] Files with matches: ${filesWithMatches}`);
    console.log(`[DIRECT-SUMMARY] Files modified: ${filesModified.length}`);
    console.log(`[DIRECT-SUMMARY] Total replacements: ${totalReplacements}`);
    console.log(`[DIRECT-SUMMARY] Success: ${totalReplacements > 0}`);

    return {
      success: totalReplacements > 0,
      filesModified,
      totalReplacements,
      changes
    };

  } catch (error) {
    console.error(`[DIRECT-SEARCH] ❌ Direct file search failed:`, error);
    console.error(`[DIRECT-SEARCH] Error stack:`, (error as Error).stack);
    return {
      success: false,
      filesModified: [],
      totalReplacements: 0,
      changes: []
    };
  }
}









// Advanced term extraction with better pattern

// Infer search term from context when only replacement is specified


// Advanced search variations generation


// Advanced regex escaping


// Safe file writing with fallback



  // ==============================================================
  // UTILITY METHODS
  // ==============================================================

  private getChangeIcon(change: ModificationChange): string {
    switch (change.type) {
      case 'created': return '📝';
      case 'modified': return '🔄';
      case 'updated': return '⚡';
      default: return '🔧';
    }
  }

  async getRedisStats(): Promise<any> {
    try {
      return await this.redis.getStats();
    } catch (error) {
      return { error: 'Redis not available', message: error };
    }
  }

  async cleanup(): Promise<void> {
    try {
      await this.redis.disconnect();
    } catch (error) {
      console.log('Cleanup failed:', error);
    }
  }

  // ==============================================================
  // DIRECT FILE OPERATIONS (Emergency methods)
  // ==============================================================

  async createFileDirectly(filePath: string, content: string): Promise<boolean> {
    try {
      const { promises: fs } = require('fs');
      const path = require('path');
      
      const fullPath = path.join(this.reactBasePath, filePath);
      const dir = path.dirname(fullPath);
      
      this.streamUpdate(`📁 Creating directory: ${dir}`);
      await fs.mkdir(dir, { recursive: true });
      
      this.streamUpdate(`💾 Writing file: ${fullPath}`);
      await fs.writeFile(fullPath, content, 'utf8');
      
      this.streamUpdate(`✅ File created directly: ${fullPath}`);
      return true;
    } catch (error) {
      this.streamUpdate(`❌ Direct file creation failed: ${error}`);
      return false;
    }
  }

  async updateFileDirectly(filePath: string, content: string): Promise<boolean> {
    try {
      const { promises: fs } = require('fs');
      const path = require('path');
      
      const fullPath = path.join(this.reactBasePath, filePath);
      
      this.streamUpdate(`🔄 Updating file directly: ${fullPath}`);
      await fs.writeFile(fullPath, content, 'utf8');
      
      this.streamUpdate(`✅ File updated directly: ${fullPath}`);
      return true;
    } catch (error) {
      this.streamUpdate(`❌ Direct file update failed: ${error}`);
      return false;
    }
  }

  // ==============================================================
  // EMERGENCY COMPONENT CREATION (Final fallback)
  // ==============================================================

  async createComponentEmergency(prompt: string): Promise<ModificationResult> {
    this.streamUpdate('🚨 EMERGENCY: Using direct component creation (final fallback)...');
    
    try {
      // Simple component name extraction
      const words = prompt.split(/\s+/);
      let componentName = 'NewComponent';
      
      for (const word of words) {
        const clean = word.replace(/[^a-zA-Z]/g, '');
        if (clean.length > 2 && !['the', 'and', 'create', 'add', 'make', 'new', 'for'].includes(clean.toLowerCase())) {
          componentName = clean.charAt(0).toUpperCase() + clean.slice(1);
          break;
        }
      }

      // Determine if it's a page or component
      const promptLower = prompt.toLowerCase();
      const isPage = promptLower.includes('page') || 
                    promptLower.includes('about') ||
                    promptLower.includes('contact') ||
                    promptLower.includes('dashboard') ||
                    promptLower.includes('home');

      const type = isPage ? 'page' : 'component';
      const folder = isPage ? 'pages' : 'components';
      const filePath = `src/${folder}/${componentName}.tsx`;

      // Generate simple component content
      const content = this.generateSimpleComponent(componentName, type, prompt);

      // Create the file directly
      const success = await this.createFileDirectly(filePath, content);

      if (success) {
        // Log the change
        await this.addModificationChange(
          'created',
          filePath,
          `Emergency created ${type}: ${componentName}`,
          { 
            approach: 'COMPONENT_ADDITION', 
            success: true,
            reasoning: 'Emergency fallback component creation'
          }
        );

        return {
          success: true,
          selectedFiles: [],
          addedFiles: [filePath],
          approach: 'COMPONENT_ADDITION',
          reasoning: `Emergency component creation successful: Created ${componentName} ${type} using direct file operations.`,
          modificationSummary: await this.getModificationContextualSummary(),
          componentGenerationResult: {
            success: true,
            generatedFile: filePath,
            updatedFiles: [],
            integrationPath: type,
            projectSummary: ''
          },
          tokenUsage: this.tokenTracker.getStats()
        };
      } else {
        throw new Error('Direct file creation failed in emergency mode');
      }

    } catch (error) {
      this.streamUpdate(`❌ Emergency component creation failed: ${error}`);
      
      return {
        success: false,
        error: `All fallback methods failed. Original error: ${error}`,
        selectedFiles: [],
        addedFiles: [],
        tokenUsage: this.tokenTracker.getStats()
      };
    }
  }

  private generateSimpleComponent(name: string, type: string, prompt: string): string {
    if (type === 'page') {
      return `import React from 'react';

const ${name} = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">
          ${name}
        </h1>
        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-lg text-gray-600 mb-4">
            Welcome to the ${name} page.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h2 className="text-xl font-semibold text-blue-900 mb-2">Section 1</h2>
              <p className="text-blue-700">This is the first section of your ${name.toLowerCase()} page.</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <h2 className="text-xl font-semibold text-green-900 mb-2">Section 2</h2>
              <p className="text-green-700">This is the second section of your ${name.toLowerCase()} page.</p>
            </div>
          </div>
        </div>
        <div className="mt-8 text-center">
          <button className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded">
            Get Started
          </button>
        </div>
        <div className="mt-8 text-sm text-gray-400 text-center">
          Generated from prompt: "${prompt}"
        </div>
      </div>
    </div>
  );
};

export default ${name};`;
    } else {
      return `import React from 'react';

interface ${name}Props {
  title?: string;
  className?: string;
  children?: React.ReactNode;
}

const ${name}: React.FC<${name}Props> = ({ 
  title = '${name}',
  className = '',
  children 
}) => {
  return (
    <div className={\`${name.toLowerCase()} bg-white border border-gray-200 rounded-lg shadow-sm p-6 \${className}\`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
      </div>
      <div className="space-y-4">
        <p className="text-gray-600">
          This is the ${name} component. It's ready to be customized for your needs.
        </p>
        {children && (
          <div className="mt-4">
            {children}
          </div>
        )}
        <div className="flex gap-2 mt-4">
          <button className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200">
            Action 1
          </button>
          <button className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200">
            Action 2
          </button>
        </div>
      </div>
      <div className="mt-6 pt-4 border-t border-gray-100 text-xs text-gray-400">
        Generated from: "${prompt}"
      </div>
    </div>
  )
};

export default ${name};`;
    }
  }
}

export { EnhancedUnrestrictedIntelligentFileModifier as StatelessIntelligentFileModifier };