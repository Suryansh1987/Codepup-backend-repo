import Anthropic from '@anthropic-ai/sdk';
import { 
  ProjectFile, 
  ModificationResult, 
  ModificationScope,
  ModificationChange,
  TargetNodeInfo,
  TreeInformation
} from './filemodifier/types';
import { promises as fs } from 'fs';

// Import the ENHANCED ScopeAnalyzer (with tree building and analysis)
import { ScopeAnalyzer } from './filemodifier/scopeanalyzer';

// Import the SIMPLIFIED TargetedNodes processor (Step 2 only)
import { TargetedNodesProcessor } from './processor/TargettedNodes';

// Import other existing processors (unchanged)
import { DependencyManager } from './filemodifier/dependancy';
import { FallbackMechanism } from './filemodifier/fallback';
import { TwoStepComponentGenerationSystem, TwoStepResult } from './processor/two-step-component-system';
import { AnalysisAndGenerationEngine } from './filemodifier/component_analysis';
import { IntegrationEngine } from './processor/component_integerator';
import { EnhancedLLMRipgrepProcessor } from './processor/text-modifier';
import { TailwindChangeProcessor } from './processor/Tailwindprocessor';
import { ProjectAnalyzer } from './processor/projectanalyzer';
import { FullFileProcessor } from './processor/Fullfileprocessor';
import { TokenTracker } from '../utils/TokenTracer';
import { RedisService } from './Redis';
import { ConversationService } from '../services/conversation-service';

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

export class EnhancedUnrestrictedIntelligentFileModifier {
  private anthropic: Anthropic;
  private reactBasePath: string;
  private redis: RedisService;
  private sessionId: string;
  private streamCallback?: (message: string) => void;
  
  // ENHANCED: ScopeAnalyzer now does tree building and analysis
  private scopeAnalyzer: ScopeAnalyzer;
  
  // SIMPLIFIED: TargetedNodes now only does Step 2 (execution)
  private targetedNodesProcessor: TargetedNodesProcessor;
  
  // Original module instances
  private dependencyManager: DependencyManager;
  private fallbackMechanism: FallbackMechanism;

  // Other processors remain unchanged
  private textBasedProcessor: EnhancedLLMRipgrepProcessor;
  private tailwindChangeProcessor: TailwindChangeProcessor;
  private twoStepSystem: TwoStepComponentGenerationSystem;
  private projectAnalyzer: ProjectAnalyzer;
  private fullFileProcessor: FullFileProcessor;
  private tokenTracker: TokenTracker;

  constructor(anthropic: Anthropic, reactBasePath: string, sessionId: string, redisUrl?: string, messageDB?: any, conversationService?: ConversationService) {
    console.log('[DEBUG] Enhanced FileModifier constructor starting...');
    console.log(`[DEBUG] reactBasePath: ${reactBasePath}`);
    
    this.anthropic = anthropic;
    this.reactBasePath = reactBasePath;
    this.sessionId = sessionId;
    this.redis = new RedisService(redisUrl);
    
    // ENHANCED: Initialize ScopeAnalyzer with reactBasePath for tree building
    console.log('[DEBUG] About to initialize Enhanced ScopeAnalyzer...');
    this.scopeAnalyzer = new ScopeAnalyzer(anthropic, reactBasePath);
    console.log('[DEBUG] Enhanced ScopeAnalyzer initialized with tree building capabilities');
    
    // SIMPLIFIED: Initialize TargetedNodes processor (Step 2 only)
    console.log('[DEBUG] About to initialize Simplified TargetedNodesProcessor...');
    this.targetedNodesProcessor = new TargetedNodesProcessor(anthropic, reactBasePath);
    console.log('[DEBUG] Simplified TargetedNodesProcessor initialized');

    // Initialize original modules
    this.dependencyManager = new DependencyManager(new Map());
    this.fallbackMechanism = new FallbackMechanism(anthropic);

    // Initialize other processors (unchanged)
    this.tokenTracker = new TokenTracker();
    this.projectAnalyzer = new ProjectAnalyzer(reactBasePath);
    
    console.log('[DEBUG] About to initialize FullFileProcessor...');
    this.fullFileProcessor = new FullFileProcessor(
      anthropic, 
      this.tokenTracker,
      reactBasePath
    );
    console.log('[DEBUG] FullFileProcessor initialized');
    
    console.log('[DEBUG] About to initialize TailwindChangeProcessor...');
    
    // Only initialize TailwindChangeProcessor if conversationService is provided
    if (conversationService) {
      this.tailwindChangeProcessor = new TailwindChangeProcessor(
        anthropic,
        reactBasePath,
        conversationService
      );
      console.log('[DEBUG] TailwindChangeProcessor initialized');
    } else {
      console.log('[DEBUG] TailwindChangeProcessor not initialized - no conversationService provided');
      // Create a placeholder that will throw if used
      this.tailwindChangeProcessor = null as any;
    }
   
    this.textBasedProcessor = new EnhancedLLMRipgrepProcessor(
      reactBasePath,
      anthropic
    );
    
    // Initialize Two-Step Component Generation System
    console.log('[DEBUG] About to initialize TwoStepComponentGenerationSystem...');
    this.twoStepSystem = new TwoStepComponentGenerationSystem(anthropic, reactBasePath, messageDB);
    console.log('[DEBUG] TwoStepComponentGenerationSystem initialized');
    
    console.log('[DEBUG] All processors initialized with enhanced architecture');
  }

  // Verify processor setup
  private verifyProcessorSetup(): void {
    console.log('[DEBUG] Verifying enhanced processor setup...');
    console.log(`[DEBUG] this.reactBasePath: ${this.reactBasePath}`);
    console.log(`[DEBUG] Enhanced scopeAnalyzer exists: ${!!this.scopeAnalyzer}`);
    console.log(`[DEBUG] Simplified targetedNodesProcessor exists: ${!!this.targetedNodesProcessor}`);
    console.log(`[DEBUG] tailwindChangeProcessor exists: ${!!this.tailwindChangeProcessor}`);
    console.log(`[DEBUG] twoStepSystem exists: ${!!this.twoStepSystem}`);
  }

  // ============================================================================
  // SESSION MANAGEMENT (unchanged)
  // ============================================================================

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

  // ============================================================================
  // PROJECT FILES MANAGEMENT (unchanged)
  // ============================================================================

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

  // ============================================================================
  // MODIFICATION SUMMARY (unchanged)
  // ============================================================================

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

  // ============================================================================
  // PROJECT TREE BUILDING (unchanged)
  // ============================================================================

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
      } else {
        await this.setProjectFiles(projectFiles);
        this.streamUpdate(`✅ Loaded ${projectFiles.size} React files into cache`);
      }
    } catch (error) {
      this.streamUpdate(`⚠️ Project tree building error: ${error}`);
      this.streamUpdate('Continuing with component creation anyway...');
    }
  }

  // ============================================================================
  // STREAM UPDATES
  // ============================================================================

  setStreamCallback(callback: (message: string) => void): void {
    this.streamCallback = callback;
    this.scopeAnalyzer.setStreamCallback(callback);           // Enhanced ScopeAnalyzer
    this.targetedNodesProcessor.setStreamCallback(callback);  // Simplified TargetedNodes
    this.tailwindChangeProcessor.setStreamCallback(callback);
    this.twoStepSystem.setStreamCallback(callback);
  }

  private streamUpdate(message: string): void {
    if (this.streamCallback) {
      this.streamCallback(message);
    }
  }

  // ============================================================================
  // ENHANCED TARGETED NODES HANDLER (NEW ARCHITECTURE)
  // ============================================================================

  private async handleTargetedModification(
    prompt: string,
    treeInformation: TreeInformation,
    targetNodes: TargetNodeInfo[]
  ): Promise<ModificationResult> {
    
    this.streamUpdate(`🎯 TARGETED_NODES: Processing ${targetNodes.length} target nodes...`);
    
    try {
      const projectFiles = await this.getProjectFiles();
      
      // SIMPLIFIED: Pass tree information and target nodes to TargetedNodes processor
      // No more tree building or analysis in TargetedNodes - it's all done by ScopeAnalyzer
      const result = await this.targetedNodesProcessor.processTargetedModification(
        prompt,
        projectFiles,
        this.reactBasePath,
        (message: string) => this.streamUpdate(message),
        treeInformation,  
        targetNodes      
      );

      // Update project files cache if successful
      if (result.success && result.updatedProjectFiles) {
        //@ts-ignore
        await this.setProjectFiles(result.updatedProjectFiles);
      }

      // Track modifications
      if (result.changes) {
        for (const change of result.changes) {
          await this.addModificationChange(
            change.type as any,
            change.file,
            change.description,
            {
              approach: 'TARGETED_NODES',
              success: change.success,
              reasoning: change.details?.reasoning
            }
          );
        }
      }

      if (result.success) {
        this.streamUpdate(`✅ TARGETED_NODES: Successfully processed target nodes!`);
        this.streamUpdate(`   📊 Tree: ${treeInformation.totalFiles} files, ${treeInformation.totalNodes} nodes`);
        this.streamUpdate(`   🎯 Targets: ${targetNodes.length} nodes processed`);
      }

      return {
        success: result.success,
        selectedFiles: result.changes?.filter(c => c.success).map(c => c.file) || [],
        addedFiles: [],
        approach: 'TARGETED_NODES',
        reasoning: `Enhanced targeted modification: ScopeAnalyzer identified ${targetNodes.length} target nodes across ${treeInformation.totalFiles} files. TargetedNodes processor applied modifications successfully.`,
        modificationSummary: await this.getModificationContextualSummary(),
        tokenUsage: this.tokenTracker.getStats()
      };

    } catch (error) {
      this.streamUpdate(`❌ TARGETED_NODES: Processing failed: ${error}`);
      
      return {
        success: false,
        error: `Targeted modification failed: ${error}`,
        selectedFiles: [],
        addedFiles: [],
        approach: 'TARGETED_NODES',
        reasoning: `Enhanced targeted modification failed: ${error}`,
        tokenUsage: this.tokenTracker.getStats()
      };
    }
  }

  // ============================================================================
  // ENHANCED TEXT BASED CHANGE HANDLER (UPDATED)
  // ============================================================================

  private async handleTextBasedChange(
    prompt: string,
    scope: ModificationScope
  ): Promise<ModificationResult> {
    this.streamUpdate(`📝 TEXT_BASED_CHANGE: Starting text-based modification...`);
    
    try {
      // CHANGE: Extract from enhanced scope
      const searchTerm = scope.textChangeAnalysis?.searchTerm || '';
      const replacementTerm = scope.textChangeAnalysis?.replacementTerm || '';
      const searchVariations = scope.textChangeAnalysis?.searchVariations || [];
      
      if (!searchTerm || !replacementTerm) {
        return {
          success: false,
          selectedFiles: [],
          addedFiles: [],
          approach: 'TEXT_BASED_CHANGE',
          reasoning: 'No search/replacement terms provided by enhanced ScopeAnalyzer',
          error: 'Missing search or replacement terms from scope analysis'
        };
      }

      this.streamUpdate(`🔍 Enhanced Analysis: "${searchTerm}" → "${replacementTerm}"`);
      if (searchVariations.length > 0) {
        this.streamUpdate(`🔄 Variations: ${searchVariations.join(', ')}`);
      }
      
      // Use existing text processor with enhanced data
      const result = await this.textBasedProcessor.processText(
        prompt,
        searchTerm,
        replacementTerm
      );

      if (result.success) {
        // Track modifications
        for (const filePath of result.filesModified) {
          await this.addModificationChange(
            'modified',
            filePath,
            `Enhanced text replacement: "${searchTerm}" → "${replacementTerm}"`,
            {
              approach: 'TEXT_BASED_CHANGE',
              success: true,
              reasoning: `Enhanced scope analysis with ${searchVariations.length} variations identified`
            }
          );
        }

        this.streamUpdate(`✅ TEXT_BASED_CHANGE: Successfully modified ${result.filesModified.length} files!`);
      }

      return {
        success: result.success,
        selectedFiles: result.filesModified,
        addedFiles: [],
        approach: 'TEXT_BASED_CHANGE',
        reasoning: result.overallStrategy || `Enhanced text replacement: ${result.totalReplacements} replacements`,
        modificationSummary: await this.getModificationContextualSummary(),
        tokenUsage: this.tokenTracker.getStats()
      };

    } catch (error) {
      this.streamUpdate(`❌ TEXT_BASED_CHANGE: Processing failed: ${error}`);
      
      return {
        success: false,
        error: `Enhanced text-based change failed: ${error}`,
        selectedFiles: [],
        addedFiles: [],
        approach: 'TEXT_BASED_CHANGE',
        reasoning: `Enhanced text-based change failed: ${error}`,
        tokenUsage: this.tokenTracker.getStats()
      };
    }
  }

  // ============================================================================
  // TAILWIND HANDLER (FIXED)
  // ============================================================================

  private async handleTailwindChange(
    prompt: string,
    scope: ModificationScope,
    projectId?: number
  ): Promise<ModificationResult> {
    
    this.streamUpdate(`🎨 TAILWIND_CHANGE: Starting Tailwind configuration modification...`);
    
    // Check if TailwindChangeProcessor is available
    if (!this.tailwindChangeProcessor) {
      return {
        success: false,
        error: 'TailwindChangeProcessor not available - ConversationService not provided',
        selectedFiles: [],
        addedFiles: [],
        approach: 'TAILWIND_CHANGE',
        reasoning: 'TailwindChangeProcessor requires ConversationService for design system integration'
      };
    }

    // Check if projectId is provided for design system access
    if (!projectId) {
      return {
        success: false,
        error: 'ProjectId required for Tailwind changes with design system integration',
        selectedFiles: [],
        addedFiles: [],
        approach: 'TAILWIND_CHANGE',
        reasoning: 'ProjectId is required to access design system files'
      };
    }
    
    try {
      const projectFiles = await this.getProjectFiles();
      
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

      const result = await this.tailwindChangeProcessor.handleTailwindChange(
        prompt,
        scope,
        projectFiles,
        modificationSummary as any,
        projectId
      );

      if (result.success) {
        this.streamUpdate(`✅ TAILWIND_CHANGE: Tailwind configuration updated successfully!`);
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

  // ============================================================================
  // COMPONENT ADDITION HANDLER (unchanged)
  // ============================================================================

  async handleComponentAddition(
    prompt: string,
    scope: any,
    projectId?: number,
    projectSummaryCallback?: (summary: string, prompt: string) => Promise<string | null>
  ): Promise<any> {
    
    this.streamUpdate(`🚀 COMPONENT_ADDITION: Starting component generation...`);
    
    try {
      const result: TwoStepResult = await this.twoStepSystem.generateComponent(prompt, {
        skipIntegration: false,
        dryRun: false,
        verbose: true,
        projectId: projectId
      });

      if (result.success) {
        const createdFiles = [
          ...result.step2.createdFiles
        ];
        
        const modifiedFiles = [
          ...result.step2.modifiedFiles
        ];

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

        this.streamUpdate(`✅ COMPONENT_ADDITION: Component generation completed successfully!`);

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
          reasoning: `Two-step workflow completed successfully.`,
          modificationSummary: await modificationSummary.getSummary(),
          componentGenerationResult: {
            success: true,
            generatedFiles: createdFiles,
            updatedFiles: modifiedFiles,
            twoStepWorkflow: true
          },
          tokenUsage: this.tokenTracker.getStats()
        };
      } else {
        throw new Error(result.error || 'Two-step generation failed');
      }

    } catch (error) {
      this.streamUpdate(`❌ COMPONENT_ADDITION: Component generation failed: ${error}`);
      
      this.streamUpdate('🚨 Trying emergency component creation...');
      return await this.createComponentEmergency(prompt);
    }
  }

  // ============================================================================
  // FULL FILE HANDLER (unchanged)
  // ============================================================================

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

  // ============================================================================
  // MAIN PROCESSING METHOD (ENHANCED)
  // ============================================================================

  async processModification(
    prompt: string, 
    conversationContext?: string,
    dbSummary?: string,
    projectId?: number,
    projectSummaryCallback?: (summary: string, prompt: string) => Promise<string | null>
  ): Promise<ModificationResult> {
    const startTime = Date.now();
    
    try {
      this.streamUpdate('🚀 Starting ENHANCED intelligent modification workflow...');
      console.log(`[DEBUG] Starting enhanced processModification with prompt: "${prompt.substring(0, 100)}..."`);
      
      // Verify setup
      console.log('[DEBUG] Verifying enhanced processor setup...');
      this.verifyProcessorSetup();
      
      // Initialize session
      this.streamUpdate('🔧 Initializing session...');
      
      try {
        await this.initializeSession();
        console.log('[DEBUG] Session initialization completed successfully');
      } catch (sessionError) {
        console.warn('[DEBUG] Session initialization failed, continuing without cache:', sessionError);
        this.streamUpdate('⚠️ Session initialization failed, proceeding without cache...');
      }
      
      this.streamUpdate('📁 Getting project files...');
      
      let projectFiles: Map<string, ProjectFile>;
      try {
        projectFiles = await this.getProjectFiles();
        console.log(`[DEBUG] Got ${projectFiles.size} project files`);
      } catch (filesError) {
        console.warn('[DEBUG] Failed to get project files, using empty map:', filesError);
        projectFiles = new Map();
        this.streamUpdate('⚠️ Failed to get project files, proceeding with empty cache...');
      }
      
      if (projectFiles.size === 0) {
        this.streamUpdate('⚠️ No project files found, attempting to build project tree...');
        try {
          await this.buildProjectTree();
          projectFiles = await this.getProjectFiles();
          console.log(`[DEBUG] After buildProjectTree(), got ${projectFiles.size} files`);
        } catch (buildError) {
          console.warn('[DEBUG] buildProjectTree() failed:', buildError);
          this.streamUpdate('⚠️ Could not build project tree, proceeding anyway...');
        }
      }

      // Build project summary
      this.streamUpdate('📊 Building project summary...');
      
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
      
      // ENHANCED: Analyze scope with tree building and analysis
      this.streamUpdate('🔍 Enhanced scope analysis with tree building...');
      console.log('[DEBUG] About to call enhanced analyzeScope()');
      
      let scope: ModificationScope;
      try {
        // CHANGE: Pass projectFiles to analyzeScope for tree building
        scope = await this.scopeAnalyzer.analyzeScope(
          prompt, 
          projectSummary, 
          contextWithSummary,
          dbSummary,
          projectFiles  // NEW: Pass project files for tree building and analysis
        );
        console.log(`[DEBUG] Enhanced scope analysis completed: ${scope.scope}`);
        console.log(`[DEBUG] Scope reasoning: ${scope.reasoning}`);
        
        // NEW: Log enhanced scope data
        if (scope.scope === 'TARGETED_NODES') {
          console.log(`[DEBUG] Tree information: ${scope.treeInformation ? 'Available' : 'Missing'}`);
          console.log(`[DEBUG] Target nodes: ${scope.targetNodes?.length || 0}`);
        }
        if (scope.scope === 'TEXT_BASED_CHANGE') {
          console.log(`[DEBUG] Text analysis: ${scope.textChangeAnalysis ? 'Available' : 'Missing'}`);
          console.log(`[DEBUG] Search term: ${scope.textChangeAnalysis?.searchTerm || 'N/A'}`);
        }
        
      } catch (scopeError) {
        console.error('[DEBUG] Enhanced scope analysis failed:', scopeError);
        this.streamUpdate(`❌ Enhanced scope analysis failed: ${scopeError}`);
        
        // Fallback scope determination
        scope = {
          scope: 'TARGETED_NODES', // Safe fallback
          files: [],
          reasoning: `Enhanced scope analysis failed, defaulting to TARGETED_NODES. Error: ${scopeError}`
        };
        this.streamUpdate('🔄 Using fallback scope: TARGETED_NODES');
      }
      
      this.streamUpdate(`📋 Enhanced modification method: ${scope.scope}`);

      // Initialize result variables
      let success = false;
      let selectedFiles: string[] = [];
      let addedFiles: string[] = [];
      let modificationResult: ModificationResult;

      // ENHANCED: Execute based on scope with new architecture
      console.log(`[DEBUG] About to execute enhanced scope: ${scope.scope}`);
      console.log(`[DEBUG] Execution started at: ${Date.now() - startTime}ms`);
      
      try {
        switch (scope.scope) {
          case 'TEXT_BASED_CHANGE':
            this.streamUpdate('📝 Executing enhanced text-based content modification...');
            console.log('[DEBUG] About to call enhanced handleTextBasedChange()');
            
            try {
              modificationResult = await this.handleTextBasedChange(prompt, scope);
              console.log(`[DEBUG] Enhanced handleTextBasedChange() completed with success: ${modificationResult.success}`);
              return modificationResult;
            } catch (textError) {
              console.error('[DEBUG] Enhanced handleTextBasedChange() failed:', textError);
              this.streamUpdate(`❌ Enhanced text-based change failed: ${textError}`);
              throw textError;
            }
            
          case 'TAILWIND_CHANGE':
            this.streamUpdate('🎨 Executing Tailwind configuration modification...');
            console.log('[DEBUG] About to call handleTailwindChange()');
            
            try {
              modificationResult = await this.handleTailwindChange(prompt, scope, projectId);
              console.log(`[DEBUG] handleTailwindChange() completed with success: ${modificationResult.success}`);
              return modificationResult;
            } catch (tailwindError) {
              console.error('[DEBUG] handleTailwindChange() failed:', tailwindError);
              this.streamUpdate(`❌ Tailwind change failed: ${tailwindError}`);
              throw tailwindError;
            }
            
          case 'TARGETED_NODES':
            this.streamUpdate('🎯 Executing enhanced targeted modification...');
            console.log('[DEBUG] About to call enhanced handleTargetedModification()');
            
            // ENHANCED: Check for required data from ScopeAnalyzer
            if (!scope.treeInformation || !scope.targetNodes || scope.targetNodes.length === 0) {
              this.streamUpdate('⚠️ Enhanced ScopeAnalyzer did not provide tree information, using fallback...');
              console.log('[DEBUG] Missing tree information or target nodes, falling back to FULL_FILE');
              
              success = await this.handleFullFileModification(prompt);
              if (success) {
                const fullFileModifications = await this.getMostModifiedFiles();
                selectedFiles = fullFileModifications.map(item => item.file);
              }
              break;
            }
            
            try {
              // NEW: Use enhanced handler with tree information and target nodes
              modificationResult = await this.handleTargetedModification(
                prompt, 
                scope.treeInformation,  // NEW: Tree info from enhanced ScopeAnalyzer
                scope.targetNodes       // NEW: Target nodes from enhanced ScopeAnalyzer
              );
              console.log(`[DEBUG] Enhanced handleTargetedModification() completed with success: ${modificationResult.success}`);
              return modificationResult;
            } catch (targetedError) {
              console.error('[DEBUG] Enhanced handleTargetedModification() failed:', targetedError);
              this.streamUpdate(`❌ Enhanced targeted modification failed: ${targetedError}`);
              throw targetedError;
            }
            
          case 'COMPONENT_ADDITION':
            this.streamUpdate('🚀 Executing two-step component addition...');
            console.log('[DEBUG] About to call handleComponentAddition()');
            
            try {
              modificationResult = await this.handleComponentAddition(prompt, scope, projectId);
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
            
          default:
            this.streamUpdate(`⚠️ Unknown scope: ${scope.scope}, attempting component addition fallback...`);
            console.log(`[DEBUG] Unknown scope: ${scope.scope}, using component addition fallback`);
            
            try {
              modificationResult = await this.handleComponentAddition(prompt, scope, projectId);
              console.log(`[DEBUG] Component addition fallback completed with success: ${modificationResult.success}`);
              return modificationResult;
            } catch (fallbackError) {
              console.error('[DEBUG] Component addition fallback failed:', fallbackError);
              this.streamUpdate(`❌ Fallback failed: ${fallbackError}`);
              throw fallbackError;
            }
        }
        
      } catch (executionError) {
        console.error('[DEBUG] Enhanced scope execution failed:', executionError);
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
        
        success = false;
      }
      
      // Return results for FULL_FILE scope
      console.log(`[DEBUG] About to return results. Success: ${success}`);
      console.log(`[DEBUG] Total execution time: ${Date.now() - startTime}ms`);
      
      let modificationSummary: string;
      try {
        modificationSummary = await this.getModificationContextualSummary();
      } catch (summaryError) {
        console.warn('[DEBUG] Failed to get final modification summary:', summaryError);
        modificationSummary = `Enhanced modification attempted for scope: ${scope.scope}`;
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
          reasoning: `${scope.reasoning} Enhanced analysis identified ${selectedFiles.length} files for modification.`,
          modificationSummary,
          tokenUsage
        };
      } else {
        return {
          success: false,
          error: `Enhanced modification process failed for scope: ${scope.scope}`,
          selectedFiles: [],
          addedFiles: [],
          approach: scope.scope,
          reasoning: scope.reasoning,
          tokenUsage
        };
      }
      
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`[DEBUG] Enhanced processModification error after ${totalTime}ms:`, error);
      this.streamUpdate(`❌ Enhanced modification process failed: ${error}`);
      
      // Final fallback - try component creation
      this.streamUpdate('🚨 Final fallback: Component creation...');
      
      try {
        const fallbackResult = await this.handleComponentAddition(prompt, { scope: 'COMPONENT_ADDITION', reasoning: 'Final fallback attempt', files: [] }, projectId);
        console.log(`[DEBUG] Final component fallback completed with success: ${fallbackResult.success}`);
        return fallbackResult;
      } catch (fallbackError) {
        console.error('[DEBUG] Final component fallback failed:', fallbackError);
        
        try {
          const emergencyResult = await this.createComponentEmergency(prompt);
          console.log(`[DEBUG] Emergency creation completed with success: ${emergencyResult.success}`);
          return emergencyResult;
        } catch (emergencyError) {
          console.error('[DEBUG] Emergency creation failed:', emergencyError);
          
          return {
            success: false,
            error: `All enhanced modification attempts failed. Original error: ${error}`,
            selectedFiles: [],
            addedFiles: [],
            approach: 'FULL_FILE',
            reasoning: 'Complete failure - all enhanced methods exhausted'
          };
        }
      }
    }
  }

  // ============================================================================
  // TWO-STEP WORKFLOW METHODS (unchanged)
  // ============================================================================

  async generateComponentTwoStep(
    prompt: string,
    options?: {
      skipIntegration?: boolean;
      dryRun?: boolean;
      verbose?: boolean;
    },
    projectId?: number
  ): Promise<TwoStepResult> {
    this.streamUpdate('🚀 Direct Two-Step Generation Access...');
    
    try {
      await this.initializeSession();
      const result = await this.twoStepSystem.generateComponent(prompt, options, projectId);
      
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

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

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

  // ============================================================================
  // DIRECT FILE OPERATIONS (Emergency methods)
  // ============================================================================

  async createFileDirectly(filePath: string, content: string): Promise<boolean> {
    try {
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

  // ============================================================================
  // EMERGENCY COMPONENT CREATION (Final fallback)
  // ============================================================================

  async createComponentEmergency(prompt: string): Promise<ModificationResult> {
    this.streamUpdate('🚨 EMERGENCY: Using direct component creation (final fallback)...');
    
    try {
      const words = prompt.split(/\s+/);
      let componentName = 'NewComponent';
      
      for (const word of words) {
        const clean = word.replace(/[^a-zA-Z]/g, '');
        if (clean.length > 2 && !['the', 'and', 'create', 'add', 'make', 'new', 'for'].includes(clean.toLowerCase())) {
          componentName = clean.charAt(0).toUpperCase() + clean.slice(1);
          break;
        }
      }

      const promptLower = prompt.toLowerCase();
      const isPage = promptLower.includes('page') || 
                    promptLower.includes('about') ||
                    promptLower.includes('contact') ||
                    promptLower.includes('dashboard') ||
                    promptLower.includes('home');

      const type = isPage ? 'page' : 'component';
      const folder = isPage ? 'pages' : 'components';
      const filePath = `src/${folder}/${componentName}.tsx`;

      const content = this.generateSimpleComponent(componentName, type, prompt);

      const success = await this.createFileDirectly(filePath, content);

      if (success) {
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