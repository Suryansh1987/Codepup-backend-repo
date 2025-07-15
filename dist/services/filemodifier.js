"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatelessIntelligentFileModifier = exports.EnhancedUnrestrictedIntelligentFileModifier = void 0;
const scopeanalyzer_1 = require("./filemodifier/scopeanalyzer");
;
const dependancy_1 = require("./filemodifier/dependancy");
const fallback_1 = require("./filemodifier/fallback");
// Import the NEW Two-Step System (using your existing paths)
const two_step_component_system_1 = require("./processor/two-step-component-system");
const component_analysis_1 = require("./filemodifier/component_analysis");
const component_integerator_1 = require("./processor/component_integerator");
const text_modifier_1 = require("./processor/text-modifier");
// Import the NEW TailwindChangeProcessor
const Tailwindprocessor_1 = require("./processor/Tailwindprocessor");
const Astanalyzer_1 = require("./processor/Astanalyzer");
const projectanalyzer_1 = require("./processor/projectanalyzer");
const Fullfileprocessor_1 = require("./processor/Fullfileprocessor");
const TargettedNodes_1 = require("./processor/TargettedNodes");
const TokenTracer_1 = require("../utils/TokenTracer");
const Redis_1 = require("./Redis");
class EnhancedUnrestrictedIntelligentFileModifier {
    constructor(anthropic, reactBasePath, sessionId, redisUrl, messageDB) {
        console.log('[DEBUG] EnhancedUnrestrictedIntelligentFileModifier constructor starting...');
        console.log(`[DEBUG] reactBasePath: ${reactBasePath}`);
        this.anthropic = anthropic;
        this.reactBasePath = reactBasePath;
        this.sessionId = sessionId;
        this.redis = new Redis_1.RedisService(redisUrl);
        // Initialize original modules (REMOVED componentGenerationSystem)
        this.scopeAnalyzer = new scopeanalyzer_1.ScopeAnalyzer(anthropic);
        this.dependencyManager = new dependancy_1.DependencyManager(new Map());
        this.fallbackMechanism = new fallback_1.FallbackMechanism(anthropic);
        // Initialize existing processors
        this.tokenTracker = new TokenTracer_1.TokenTracker();
        this.astAnalyzer = new Astanalyzer_1.ASTAnalyzer();
        this.projectAnalyzer = new projectanalyzer_1.ProjectAnalyzer(reactBasePath);
        console.log('[DEBUG] About to initialize FullFileProcessor...');
        this.fullFileProcessor = new Fullfileprocessor_1.FullFileProcessor(anthropic, this.tokenTracker, reactBasePath);
        console.log('[DEBUG] FullFileProcessor initialized');
        console.log('[DEBUG] About to initialize TargetedNodesProcessor...');
        this.targetedNodesProcessor = new TargettedNodes_1.TargetedNodesProcessor(anthropic, reactBasePath);
        console.log('[DEBUG] TargetedNodesProcessor initialized with reactBasePath');
        Tailwindprocessor_1.TailwindChangeProcessor;
        console.log('[DEBUG] About to initialize TailwindChangeProcessor...');
        this.tailwindChangeProcessor = new Tailwindprocessor_1.TailwindChangeProcessor(anthropic, reactBasePath);
        console.log('[DEBUG] TailwindChangeProcessor initialized');
        this.Textbasedprocessor = new text_modifier_1.EnhancedLLMRipgrepProcessor(reactBasePath, anthropic);
        // NEW: Initialize Two-Step Component Generation System (REPLACES componentGenerationSystem)
        console.log('[DEBUG] About to initialize TwoStepComponentGenerationSystem...');
        this.twoStepSystem = new two_step_component_system_1.TwoStepComponentGenerationSystem(anthropic, reactBasePath, messageDB);
        console.log('[DEBUG] TwoStepComponentGenerationSystem initialized');
        console.log('[DEBUG] All processors initialized');
    }
    // Verify processor setup
    verifyProcessorSetup() {
        console.log('[DEBUG] Verifying processor setup...');
        console.log(`[DEBUG] this.reactBasePath: ${this.reactBasePath}`);
        console.log(`[DEBUG] targetedNodesProcessor exists: ${!!this.targetedNodesProcessor}`);
        console.log(`[DEBUG] tailwindChangeProcessor exists: ${!!this.tailwindChangeProcessor}`);
        console.log(`[DEBUG] twoStepSystem exists: ${!!this.twoStepSystem}`);
        if (this.targetedNodesProcessor && this.targetedNodesProcessor.reactBasePath) {
            console.log(`[DEBUG] targetedNodesProcessor.reactBasePath: ${this.targetedNodesProcessor.reactBasePath}`);
        }
    }
    // ==============================================================
    // SESSION MANAGEMENT (simplified with error handling)
    // ==============================================================
    initializeSession() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const existingStartTime = yield this.redis.getSessionStartTime(this.sessionId);
                if (!existingStartTime) {
                    yield this.redis.setSessionStartTime(this.sessionId, new Date().toISOString());
                }
                const hasCache = yield this.redis.hasProjectFiles(this.sessionId);
                if (!hasCache) {
                    this.streamUpdate('🔄 Building project tree (first time for this session)...');
                    yield this.buildProjectTree();
                }
                else {
                    this.streamUpdate('📁 Loading cached project files from Redis...');
                }
            }
            catch (error) {
                this.streamUpdate('⚠️ Redis not available, proceeding without cache...');
                yield this.buildProjectTree();
            }
        });
    }
    clearSession() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.redis.clearSession(this.sessionId);
            }
            catch (error) {
                console.log('Redis clear session failed:', error);
            }
        });
    }
    // ==============================================================
    // PROJECT FILES MANAGEMENT (with Redis fallbacks)
    // ==============================================================
    getProjectFiles() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const projectFiles = yield this.redis.getProjectFiles(this.sessionId);
                return projectFiles || new Map();
            }
            catch (error) {
                this.streamUpdate('⚠️ Using fresh project scan...');
                return new Map();
            }
        });
    }
    setProjectFiles(projectFiles) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.redis.setProjectFiles(this.sessionId, projectFiles);
            }
            catch (error) {
                console.log('Redis set project files failed:', error);
            }
        });
    }
    updateProjectFile(filePath, projectFile) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.redis.updateProjectFile(this.sessionId, filePath, projectFile);
            }
            catch (error) {
                console.log('Redis update project file failed:', error);
            }
        });
    }
    // ==============================================================
    // MODIFICATION SUMMARY (with Redis fallbacks)
    // ==============================================================
    addModificationChange(type, file, description, options) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const change = {
                    type,
                    file,
                    description,
                    timestamp: new Date().toISOString(),
                    //@ts-ignore
                    approach: options === null || options === void 0 ? void 0 : options.approach,
                    success: options === null || options === void 0 ? void 0 : options.success,
                    details: {
                        linesChanged: options === null || options === void 0 ? void 0 : options.linesChanged,
                        componentsAffected: options === null || options === void 0 ? void 0 : options.componentsAffected,
                        reasoning: options === null || options === void 0 ? void 0 : options.reasoning
                    }
                };
                yield this.redis.addModificationChange(this.sessionId, change);
            }
            catch (error) {
                console.log('Redis add modification change failed:', error);
            }
        });
    }
    getModificationContextualSummary() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const changes = yield this.redis.getModificationChanges(this.sessionId);
                if (changes.length === 0) {
                    return "";
                }
                const recentChanges = changes.slice(-5);
                const uniqueFiles = new Set(changes.map(c => c.file));
                const sessionStartTime = yield this.redis.getSessionStartTime(this.sessionId);
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
            }
            catch (error) {
                return "";
            }
        });
    }
    getMostModifiedFiles() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const changes = yield this.redis.getModificationChanges(this.sessionId);
                const fileStats = {};
                changes.forEach(change => {
                    fileStats[change.file] = (fileStats[change.file] || 0) + 1;
                });
                return Object.entries(fileStats)
                    .map(([file, count]) => ({ file, count }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 10);
            }
            catch (error) {
                return [];
            }
        });
    }
    // ==============================================================
    // PROJECT TREE BUILDING (simplified with error handling)
    // ==============================================================
    buildProjectTree() {
        return __awaiter(this, void 0, void 0, function* () {
            this.streamUpdate('📂 Analyzing React project structure...');
            try {
                let projectFiles = new Map();
                const currentProjectFiles = yield this.getProjectFiles();
                this.dependencyManager = new dependancy_1.DependencyManager(currentProjectFiles);
                // Use the project analyzer
                const buildResult = yield this.projectAnalyzer.buildProjectTree(projectFiles, this.dependencyManager, (message) => this.streamUpdate(message));
                if (buildResult && buildResult.size > 0) {
                    projectFiles = buildResult;
                }
                if (projectFiles.size === 0) {
                    this.streamUpdate('⚠️ No React files found in project, creating basic structure...');
                    // Continue anyway, component creation will work
                }
                else {
                    yield this.setProjectFiles(projectFiles);
                    this.streamUpdate(`✅ Loaded ${projectFiles.size} React files into cache`);
                }
            }
            catch (error) {
                this.streamUpdate(`⚠️ Project tree building error: ${error}`);
                this.streamUpdate('Continuing with component creation anyway...');
            }
        });
    }
    // ==============================================================
    // STREAM UPDATES
    // ==============================================================
    setStreamCallback(callback) {
        this.streamCallback = callback;
        this.tailwindChangeProcessor.setStreamCallback(callback);
        // NEW: Set stream callback for two-step system
        this.twoStepSystem.setStreamCallback(callback);
    }
    streamUpdate(message) {
        if (this.streamCallback) {
            this.streamCallback(message);
        }
    }
    // ==============================================================
    // NEW: TAILWIND CHANGE HANDLER
    // ==============================================================
    handleTailwindChange(prompt, scope) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            this.streamUpdate(`🎨 TAILWIND_CHANGE: Starting Tailwind configuration modification...`);
            try {
                const projectFiles = yield this.getProjectFiles();
                // Create modification summary interface
                const modificationSummary = {
                    addChange: (type, file, description, options) => __awaiter(this, void 0, void 0, function* () {
                        yield this.addModificationChange(type, file, description, {
                            approach: 'TAILWIND_CHANGE',
                            success: options === null || options === void 0 ? void 0 : options.success,
                            linesChanged: options === null || options === void 0 ? void 0 : options.linesChanged,
                            componentsAffected: options === null || options === void 0 ? void 0 : options.componentsAffected,
                            reasoning: options === null || options === void 0 ? void 0 : options.reasoning
                        });
                    }),
                    getSummary: () => __awaiter(this, void 0, void 0, function* () { return yield this.getModificationContextualSummary(); }),
                    getMostModifiedFiles: () => __awaiter(this, void 0, void 0, function* () { return yield this.getMostModifiedFiles(); })
                };
                // Use the tailwind change processor
                const result = yield this.tailwindChangeProcessor.handleTailwindChange(prompt, scope, projectFiles, modificationSummary);
                // Update project files cache if successful
                if (result.success) {
                    this.streamUpdate(`✅ TAILWIND_CHANGE: Tailwind configuration updated successfully!`);
                    this.streamUpdate(`   🎨 Modified: ${((_a = result.selectedFiles) === null || _a === void 0 ? void 0 : _a.length) || 0} config files`);
                    this.streamUpdate(`   📁 Created: ${((_b = result.addedFiles) === null || _b === void 0 ? void 0 : _b.length) || 0} config files`);
                }
                return result;
            }
            catch (error) {
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
        });
    }
    // ==============================================================
    // NEW: TWO-STEP COMPONENT ADDITION HANDLER (REPLACES old componentGenerationSystem)
    // ==============================================================
    handleComponentAddition(prompt, scope, projectId, projectSummaryCallback) {
        return __awaiter(this, void 0, void 0, function* () {
            this.streamUpdate(`🚀 TWO-STEP WORKFLOW: Starting enhanced component generation...`);
            try {
                // Use the new two-step system directly
                const result = yield this.twoStepSystem.generateComponent(prompt, {
                    skipIntegration: false,
                    dryRun: false,
                    verbose: true,
                    projectId: projectId
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
                        addChange: (type, file, description, options) => __awaiter(this, void 0, void 0, function* () {
                            yield this.addModificationChange(type, file, description, {
                                approach: 'TWO_STEP_WORKFLOW',
                                success: options === null || options === void 0 ? void 0 : options.success,
                                linesChanged: options === null || options === void 0 ? void 0 : options.linesChanged,
                                componentsAffected: options === null || options === void 0 ? void 0 : options.componentsAffected,
                                reasoning: options === null || options === void 0 ? void 0 : options.reasoning
                            });
                        }),
                        getSummary: () => __awaiter(this, void 0, void 0, function* () { return yield this.getModificationContextualSummary(); })
                    };
                    // Log all changes
                    for (const filePath of createdFiles) {
                        yield modificationSummary.addChange('created', filePath, `Created ${result.step1.componentType.type}: ${result.step1.componentType.name}`, {
                            approach: 'TWO_STEP_WORKFLOW',
                            success: true,
                            reasoning: `Step 1: Generated ${result.step1.componentType.type}, Step 2: Integrated successfully`
                        });
                    }
                    for (const filePath of modifiedFiles) {
                        yield modificationSummary.addChange('updated', filePath, `Integrated ${result.step1.componentType.type} into existing structure`, {
                            approach: 'TWO_STEP_WORKFLOW',
                            success: true,
                            reasoning: 'Step 2: Integration with existing files'
                        });
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
                        yield this.buildProjectTree();
                    }
                    catch (error) {
                        this.streamUpdate('⚠️ Cache refresh failed, but operation succeeded');
                    }
                    return {
                        success: true,
                        selectedFiles: modifiedFiles,
                        addedFiles: createdFiles,
                        approach: 'TWO_STEP_COMPONENT_GENERATION',
                        reasoning: `Two-step workflow completed successfully. Step 1: Analyzed and generated ${result.step1.componentType.type} '${result.step1.componentType.name}'. Step 2: Integrated with existing project structure. Created ${createdFiles.length} files, modified ${modifiedFiles.length} files. Integration results: routing=${result.step2.integrationResults.routingUpdated}, app=${result.step2.integrationResults.appFileUpdated}.`,
                        modificationSummary: yield modificationSummary.getSummary(),
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
                }
                else {
                    throw new Error(result.error || 'Two-step generation failed');
                }
            }
            catch (error) {
                this.streamUpdate(`❌ TWO-STEP WORKFLOW: Component generation failed: ${error}`);
                // Fallback to emergency creation
                this.streamUpdate('🚨 Trying emergency component creation...');
                return yield this.createComponentEmergency(prompt);
            }
        });
    }
    // ==============================================================
    // NEW: ADDITIONAL TWO-STEP WORKFLOW METHODS
    // ==============================================================
    generateComponentTwoStep(prompt, options, projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            this.streamUpdate('🚀 Direct Two-Step Generation Access...');
            try {
                // Initialize session
                yield this.initializeSession();
                // Use the two-step system directly
                const result = yield this.twoStepSystem.generateComponent(prompt, options, projectId);
                // Update cache if successful
                if (result.success) {
                    try {
                        yield this.buildProjectTree();
                    }
                    catch (error) {
                        this.streamUpdate('⚠️ Cache refresh failed after two-step generation');
                    }
                }
                return result;
            }
            catch (error) {
                this.streamUpdate(`❌ Direct two-step generation failed: ${error}`);
                throw error;
            }
        });
    }
    analyzeComponentOnly(prompt) {
        return __awaiter(this, void 0, void 0, function* () {
            this.streamUpdate('🔍 Analysis-Only Workflow...');
            try {
                yield this.initializeSession();
                const analysisEngine = new component_analysis_1.AnalysisAndGenerationEngine(this.anthropic, this.reactBasePath);
                analysisEngine.setStreamCallback(this.streamCallback || (() => { }));
                const result = yield analysisEngine.analyzeAndGenerate(prompt);
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
                }
                else {
                    throw new Error(result.error || 'Analysis failed');
                }
            }
            catch (error) {
                this.streamUpdate(`❌ Analysis-only workflow failed: ${error}`);
                throw error;
            }
        });
    }
    integrateComponentOnly(generationResult) {
        return __awaiter(this, void 0, void 0, function* () {
            this.streamUpdate('🔗 Integration-Only Workflow...');
            try {
                const integrationEngine = new component_integerator_1.IntegrationEngine(this.anthropic, this.reactBasePath);
                integrationEngine.setStreamCallback(this.streamCallback || (() => { }));
                const result = yield integrationEngine.integrateComponent(generationResult);
                if (result.success) {
                    this.streamUpdate('✅ Integration completed successfully!');
                    this.streamUpdate(`   📁 Created Files: ${result.createdFiles.length}`);
                    this.streamUpdate(`   📝 Modified Files: ${result.modifiedFiles.length}`);
                    // Update cache
                    try {
                        yield this.buildProjectTree();
                    }
                    catch (error) {
                        this.streamUpdate('⚠️ Cache refresh failed after integration');
                    }
                    return {
                        success: true,
                        createdFiles: result.createdFiles,
                        modifiedFiles: result.modifiedFiles,
                        integrationResults: result.integrationResults,
                        approach: 'INTEGRATION_ONLY'
                    };
                }
                else {
                    throw new Error(result.error || 'Integration failed');
                }
            }
            catch (error) {
                this.streamUpdate(`❌ Integration-only workflow failed: ${error}`);
                throw error;
            }
        });
    }
    getTwoStepProjectSummary() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const analysisEngine = new component_analysis_1.AnalysisAndGenerationEngine(this.anthropic, this.reactBasePath);
                return yield analysisEngine.getProjectAnalysisSummary();
            }
            catch (error) {
                return `Failed to get two-step project summary: ${error}`;
            }
        });
    }
    // ==============================================================
    // EXISTING HANDLERS (unchanged)
    // ==============================================================
    handleFullFileModification(prompt) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const projectFiles = yield this.getProjectFiles();
            try {
                const processor = this.fullFileProcessor;
                let result;
                if (processor.processFullFileModification) {
                    result = yield processor.processFullFileModification(prompt, projectFiles, this.reactBasePath, (message) => this.streamUpdate(message));
                }
                else if (processor.process) {
                    result = yield processor.process(prompt, projectFiles, this.reactBasePath, (message) => this.streamUpdate(message));
                }
                else if (processor.handleFullFileModification) {
                    result = yield processor.handleFullFileModification(prompt, projectFiles, this.reactBasePath, (message) => this.streamUpdate(message));
                }
                else {
                    this.streamUpdate('⚠️ No suitable method found on FullFileProcessor');
                    return false;
                }
                if (result) {
                    if (result.updatedProjectFiles) {
                        yield this.setProjectFiles(result.updatedProjectFiles);
                    }
                    else if (result.projectFiles) {
                        yield this.setProjectFiles(result.projectFiles);
                    }
                    if (result.changes && Array.isArray(result.changes)) {
                        for (const change of result.changes) {
                            yield this.addModificationChange(change.type || 'modified', change.file, change.description || 'File modified', {
                                approach: 'FULL_FILE',
                                success: change.success !== false,
                                linesChanged: (_a = change.details) === null || _a === void 0 ? void 0 : _a.linesChanged,
                                componentsAffected: (_b = change.details) === null || _b === void 0 ? void 0 : _b.componentsAffected,
                                reasoning: (_c = change.details) === null || _c === void 0 ? void 0 : _c.reasoning
                            });
                        }
                    }
                    return result.success !== false;
                }
                return false;
            }
            catch (error) {
                this.streamUpdate(`❌ Full file modification failed: ${error}`);
                return false;
            }
        });
    }
    handleTargetedModification(prompt) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            console.log('[DEBUG] handleTargetedModification: Starting...');
            try {
                console.log('[DEBUG] handleTargetedModification: Getting project files...');
                const projectFiles = yield this.getProjectFiles();
                console.log(`[DEBUG] handleTargetedModification: Got ${projectFiles.size} project files`);
                console.log('[DEBUG] handleTargetedModification: Getting processor reference...');
                const processor = this.targetedNodesProcessor;
                console.log('[DEBUG] handleTargetedModification: Processor type:', typeof processor);
                console.log('[DEBUG] handleTargetedModification: Processor methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(processor)));
                let result;
                console.log('[DEBUG] handleTargetedModification: Checking for processTargetedModification method...');
                if (processor.processTargetedModification) {
                    console.log('[DEBUG] handleTargetedModification: Calling processTargetedModification...');
                    result = yield processor.processTargetedModification(prompt, projectFiles, this.reactBasePath, (message) => {
                        console.log('[DEBUG] TargetedProcessor Stream:', message);
                        this.streamUpdate(message);
                    });
                    console.log('[DEBUG] handleTargetedModification: processTargetedModification completed with result:', result);
                }
                else if (processor.process) {
                    console.log('[DEBUG] handleTargetedModification: Calling process method...');
                    result = yield processor.process(prompt, projectFiles, this.reactBasePath, (message) => {
                        console.log('[DEBUG] TargetedProcessor Stream:', message);
                        this.streamUpdate(message);
                    });
                    console.log('[DEBUG] handleTargetedModification: process method completed with result:', result);
                }
                else if (processor.handleTargetedModification) {
                    console.log('[DEBUG] handleTargetedModification: Calling handleTargetedModification method...');
                    result = yield processor.handleTargetedModification(prompt, projectFiles, this.reactBasePath, (message) => {
                        console.log('[DEBUG] TargetedProcessor Stream:', message);
                        this.streamUpdate(message);
                    });
                    console.log('[DEBUG] handleTargetedModification: handleTargetedModification method completed with result:', result);
                }
                else {
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
                        yield this.setProjectFiles(result.updatedProjectFiles);
                    }
                    else if (result.projectFiles) {
                        console.log('[DEBUG] handleTargetedModification: Updating project files with projectFiles...');
                        yield this.setProjectFiles(result.projectFiles);
                    }
                    if (result.changes && Array.isArray(result.changes)) {
                        console.log(`[DEBUG] handleTargetedModification: Processing ${result.changes.length} changes...`);
                        for (const change of result.changes) {
                            console.log('[DEBUG] handleTargetedModification: Processing change:', change);
                            yield this.addModificationChange(change.type || 'modified', change.file, change.description || 'File modified', {
                                approach: 'TARGETED_NODES',
                                success: change.success !== false,
                                linesChanged: (_a = change.details) === null || _a === void 0 ? void 0 : _a.linesChanged,
                                componentsAffected: (_b = change.details) === null || _b === void 0 ? void 0 : _b.componentsAffected,
                                reasoning: (_c = change.details) === null || _c === void 0 ? void 0 : _c.reasoning
                            });
                        }
                    }
                    else {
                        console.log('[DEBUG] handleTargetedModification: No changes array found in result');
                    }
                    const success = result.success !== false;
                    console.log(`[DEBUG] handleTargetedModification: Returning success: ${success}`);
                    return success;
                }
                else {
                    console.log('[DEBUG] handleTargetedModification: No result returned from processor');
                    return false;
                }
            }
            catch (error) {
                console.error('[DEBUG] handleTargetedModification: Error occurred:', error);
                this.streamUpdate(`❌ Targeted modification failed: ${error}`);
                return false;
            }
        });
    }
    // ==============================================================
    // MAIN PROCESSING METHOD (enhanced with TWO-STEP support)
    // ==============================================================
    // ==============================================================
    // MAIN PROCESSING METHOD (enhanced with TWO-STEP support and better error handling)
    // ==============================================================
    processModification(prompt, conversationContext, dbSummary, projectId, projectSummaryCallback) {
        return __awaiter(this, void 0, void 0, function* () {
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
                    yield this.initializeSession();
                    console.log('[DEBUG] initializeSession() completed successfully');
                }
                catch (sessionError) {
                    console.warn('[DEBUG] Session initialization failed, continuing without cache:', sessionError);
                    this.streamUpdate('⚠️ Session initialization failed, proceeding without cache...');
                }
                this.streamUpdate('📁 Getting project files...');
                console.log('[DEBUG] About to call getProjectFiles()');
                let projectFiles;
                try {
                    projectFiles = yield this.getProjectFiles();
                    console.log(`[DEBUG] getProjectFiles() returned ${projectFiles.size} files`);
                }
                catch (filesError) {
                    console.warn('[DEBUG] Failed to get project files, using empty map:', filesError);
                    projectFiles = new Map();
                    this.streamUpdate('⚠️ Failed to get project files, proceeding with empty cache...');
                }
                if (projectFiles.size === 0) {
                    this.streamUpdate('⚠️ No project files found, but proceeding with modification...');
                    console.log('[DEBUG] No project files available, attempting to build project tree...');
                    try {
                        yield this.buildProjectTree();
                        projectFiles = yield this.getProjectFiles();
                        console.log(`[DEBUG] After buildProjectTree(), got ${projectFiles.size} files`);
                    }
                    catch (buildError) {
                        console.warn('[DEBUG] buildProjectTree() failed:', buildError);
                        this.streamUpdate('⚠️ Could not build project tree, proceeding anyway...');
                    }
                }
                // Build project summary with error handling
                this.streamUpdate('📊 Building project summary...');
                console.log('[DEBUG] About to build project summary');
                let projectSummary;
                try {
                    projectSummary = dbSummary || this.projectAnalyzer.buildProjectSummary(projectFiles);
                    console.log(`[DEBUG] Project summary length: ${projectSummary.length}`);
                }
                catch (summaryError) {
                    console.warn('[DEBUG] Failed to build project summary:', summaryError);
                    projectSummary = "Project summary unavailable";
                    this.streamUpdate('⚠️ Could not build project summary, using fallback...');
                }
                let contextWithSummary;
                try {
                    const modificationSummary = yield this.getModificationContextualSummary();
                    contextWithSummary = (conversationContext || '') + '\n\n' + modificationSummary;
                    console.log(`[DEBUG] Context with summary length: ${contextWithSummary.length}`);
                }
                catch (contextError) {
                    console.warn('[DEBUG] Failed to get modification summary:', contextError);
                    contextWithSummary = conversationContext || '';
                    this.streamUpdate('⚠️ Could not get modification context, using basic context...');
                }
                // Analyze scope with comprehensive error handling
                this.streamUpdate('🔍 Analyzing scope...');
                console.log('[DEBUG] About to call analyzeScope()');
                let scope;
                try {
                    scope = yield this.scopeAnalyzer.analyzeScope(prompt, projectSummary, contextWithSummary, dbSummary);
                    console.log(`[DEBUG] Scope analysis completed: ${scope.scope}`);
                    console.log(`[DEBUG] Scope reasoning: ${scope.reasoning}`);
                }
                catch (scopeError) {
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
                let selectedFiles = [];
                let addedFiles = [];
                let modificationResult;
                // Execute based on scope with enhanced error handling
                console.log(`[DEBUG] About to execute scope: ${scope.scope}`);
                console.log(`[DEBUG] Execution started at: ${Date.now() - startTime}ms`);
                try {
                    switch (scope.scope) {
                        case 'TEXT_BASED_CHANGE':
                            this.streamUpdate('📝 Executing text-based content modification...');
                            console.log('[DEBUG] About to call handleTextBasedChange()');
                            try {
                                modificationResult = yield this.handleTextBasedChange(prompt, projectFiles, scope);
                                console.log(`[DEBUG] handleTextBasedChange() completed with success: ${modificationResult.success}`);
                                return modificationResult;
                            }
                            catch (textError) {
                                console.error('[DEBUG] handleTextBasedChange() failed:', textError);
                                this.streamUpdate(`❌ Text-based change failed: ${textError}`);
                                throw textError;
                            }
                        case 'TAILWIND_CHANGE':
                            this.streamUpdate('🎨 Executing Tailwind configuration modification...');
                            console.log('[DEBUG] About to call handleTailwindChange()');
                            try {
                                modificationResult = yield this.handleTailwindChange(prompt, scope);
                                console.log(`[DEBUG] handleTailwindChange() completed with success: ${modificationResult.success}`);
                                return modificationResult;
                            }
                            catch (tailwindError) {
                                console.error('[DEBUG] handleTailwindChange() failed:', tailwindError);
                                this.streamUpdate(`❌ Tailwind change failed: ${tailwindError}`);
                                throw tailwindError;
                            }
                        case 'COMPONENT_ADDITION':
                            this.streamUpdate('🚀 Executing two-step component addition...');
                            console.log('[DEBUG] About to call handleComponentAddition() with two-step workflow');
                            try {
                                modificationResult = yield this.handleComponentAddition(prompt, scope, projectId);
                                console.log(`[DEBUG] handleComponentAddition() completed with success: ${modificationResult.success}`);
                                return modificationResult;
                            }
                            catch (componentError) {
                                console.error('[DEBUG] handleComponentAddition() failed:', componentError);
                                this.streamUpdate(`❌ Component addition failed: ${componentError}`);
                                throw componentError;
                            }
                        case 'FULL_FILE':
                            this.streamUpdate('🚀 Executing full file modification...');
                            console.log('[DEBUG] About to call handleFullFileModification()');
                            try {
                                success = yield this.handleFullFileModification(prompt);
                                console.log(`[DEBUG] handleFullFileModification() completed with success: ${success}`);
                                if (success) {
                                    const fullFileModifications = yield this.getMostModifiedFiles();
                                    selectedFiles = fullFileModifications.map(item => item.file);
                                }
                            }
                            catch (fullFileError) {
                                console.error('[DEBUG] handleFullFileModification() failed:', fullFileError);
                                this.streamUpdate(`❌ Full file modification failed: ${fullFileError}`);
                                success = false;
                            }
                            break;
                        case 'TARGETED_NODES':
                            this.streamUpdate('🚀 Executing targeted modification...');
                            console.log('[DEBUG] About to call handleTargetedModification()');
                            try {
                                success = yield this.handleTargetedModification(prompt);
                                console.log(`[DEBUG] handleTargetedModification() completed with success: ${success}`);
                                if (success) {
                                    const targetedModifications = yield this.getMostModifiedFiles();
                                    selectedFiles = targetedModifications.map(item => item.file);
                                }
                            }
                            catch (targetedError) {
                                console.error('[DEBUG] handleTargetedModification() failed:', targetedError);
                                this.streamUpdate(`❌ Targeted modification failed: ${targetedError}`);
                                success = false;
                            }
                            break;
                        default:
                            this.streamUpdate(`⚠️ Unknown scope: ${scope.scope}, attempting two-step component addition fallback...`);
                            console.log(`[DEBUG] Unknown scope: ${scope.scope}, using two-step fallback`);
                            try {
                                modificationResult = yield this.handleComponentAddition(prompt, scope, projectId);
                                console.log(`[DEBUG] Two-step fallback completed with success: ${modificationResult.success}`);
                                return modificationResult;
                            }
                            catch (fallbackError) {
                                console.error('[DEBUG] Two-step fallback failed:', fallbackError);
                                this.streamUpdate(`❌ Fallback failed: ${fallbackError}`);
                                throw fallbackError;
                            }
                    }
                }
                catch (executionError) {
                    console.error('[DEBUG] Scope execution failed:', executionError);
                    this.streamUpdate(`❌ Execution failed for scope ${scope.scope}: ${executionError}`);
                    // Try final emergency fallback
                    if (scope.scope !== 'COMPONENT_ADDITION') {
                        this.streamUpdate('🚨 Attempting emergency component creation fallback...');
                        try {
                            const emergencyResult = yield this.createComponentEmergency(prompt);
                            console.log(`[DEBUG] Emergency fallback completed with success: ${emergencyResult.success}`);
                            return emergencyResult;
                        }
                        catch (emergencyError) {
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
                let modificationSummary;
                try {
                    modificationSummary = yield this.getModificationContextualSummary();
                }
                catch (summaryError) {
                    console.warn('[DEBUG] Failed to get final modification summary:', summaryError);
                    modificationSummary = `Modification attempted for scope: ${scope.scope}`;
                }
                let tokenUsage;
                try {
                    tokenUsage = this.tokenTracker.getStats();
                }
                catch (tokenError) {
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
                }
                else {
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
            }
            catch (error) {
                const totalTime = Date.now() - startTime;
                console.error(`[DEBUG] processModification error after ${totalTime}ms:`, error);
                console.error(`[DEBUG] Error stack:`, error.stack);
                this.streamUpdate(`❌ Modification process failed: ${error}`);
                // Final fallback - try two-step component creation for any request
                this.streamUpdate('🚨 Final fallback: Two-step component creation...');
                console.log('[DEBUG] About to try two-step component creation as final fallback');
                try {
                    const fallbackResult = yield this.handleComponentAddition(prompt, { scope: 'COMPONENT_ADDITION', reasoning: 'Final fallback attempt', files: [] }, undefined);
                    console.log(`[DEBUG] Final two-step fallback completed with success: ${fallbackResult.success}`);
                    return fallbackResult;
                }
                catch (fallbackError) {
                    console.error('[DEBUG] Final two-step fallback failed:', fallbackError);
                    console.log('[DEBUG] About to try emergency creation as last resort');
                    try {
                        const emergencyResult = yield this.createComponentEmergency(prompt);
                        console.log(`[DEBUG] Emergency creation completed with success: ${emergencyResult.success}`);
                        return emergencyResult;
                    }
                    catch (emergencyError) {
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
        });
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
    handleTextBasedChange(prompt, projectFiles, scope) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
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
                if (((_a = scope === null || scope === void 0 ? void 0 : scope.textChangeAnalysis) === null || _a === void 0 ? void 0 : _a.searchTerm) && ((_b = scope === null || scope === void 0 ? void 0 : scope.textChangeAnalysis) === null || _b === void 0 ? void 0 : _b.replacementTerm)) {
                    searchTerm = scope.textChangeAnalysis.searchTerm;
                    replacementTerm = scope.textChangeAnalysis.replacementTerm;
                    console.log(`[TERM-EXTRACT] ✅ Scope analysis found: "${searchTerm}" → "${replacementTerm}"`);
                }
                else {
                    console.log(`[TERM-EXTRACT] ❌ No scope analysis available`);
                    console.log(`[TERM-EXTRACT] scope.textChangeAnalysis: ${JSON.stringify(scope.textChangeAnalysis)}`);
                }
                // Method 2: Static method extraction
                if (!searchTerm || !replacementTerm) {
                    console.log(`[TERM-EXTRACT] Trying static extraction method...`);
                    try {
                        console.log(`[TERM-EXTRACT] Textbasedprocessor exists: ${!!this.Textbasedprocessor}`);
                        console.log(`[TERM-EXTRACT] Constructor exists: ${!!this.Textbasedprocessor.constructor}`);
                        const extracted = this.Textbasedprocessor.constructor.extractTermsFromPrompt(prompt);
                        console.log(`[TERM-EXTRACT] Static extraction result: ${JSON.stringify(extracted)}`);
                        if (extracted && extracted.searchTerm && extracted.replacementTerm) {
                            searchTerm = extracted.searchTerm;
                            replacementTerm = extracted.replacementTerm;
                            console.log(`[TERM-EXTRACT] ✅ Static extraction: "${searchTerm}" → "${replacementTerm}"`);
                            console.log(`[TERM-EXTRACT] Extraction method: ${extracted.extractionMethod}`);
                            console.log(`[TERM-EXTRACT] Confidence: ${extracted.confidence}`);
                        }
                        else {
                            console.log(`[TERM-EXTRACT] ❌ Static extraction failed or incomplete`);
                        }
                    }
                    catch (staticError) {
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
                        tokenUsage: ((_c = this.tokenTracker) === null || _c === void 0 ? void 0 : _c.getStats()) || { totalTokens: 0, totalInputTokens: 0, totalOutputTokens: 0, apiCalls: 0, estimatedCost: 0 }
                    };
                }
                console.log(`[TERM-VALIDATE] ✅ Terms validated successfully`);
                // STEP 2: Setup hybrid processor with extensive logging
                console.log(`\n=== STEP 2: HYBRID PROCESSOR SETUP ===`);
                console.log(`[HYBRID-SETUP] Textbasedprocessor exists: ${!!this.Textbasedprocessor}`);
                console.log(`[HYBRID-SETUP] setStreamCallback method exists: ${typeof this.Textbasedprocessor.setStreamCallback === 'function'}`);
                if (this.Textbasedprocessor && typeof this.Textbasedprocessor.setStreamCallback === 'function') {
                    console.log(`[HYBRID-SETUP] Setting up stream callback...`);
                    this.Textbasedprocessor.setStreamCallback((message) => {
                        console.log(`[HYBRID-PROCESSOR] ${message}`);
                        this.streamUpdate(message);
                    });
                    console.log(`[HYBRID-SETUP] ✅ Stream callback configured`);
                }
                else {
                    console.log(`[HYBRID-SETUP] ❌ Cannot set stream callback`);
                }
                // STEP 3: Execute hybrid approach with extensive logging
                console.log(`\n=== STEP 3: HYBRID EXECUTION ===`);
                this.streamUpdate(`🚀 Using HYBRID approach: fast-glob + Babel AST + Claude batch processing`);
                let hybridResult = null;
                console.log(`[HYBRID-EXEC] About to call processText method...`);
                console.log(`[HYBRID-EXEC] Method exists: ${typeof this.Textbasedprocessor.processText === 'function'}`);
                try {
                    if (this.Textbasedprocessor && typeof this.Textbasedprocessor.processText === 'function') {
                        console.log(`[HYBRID-EXEC] Calling processText with:`);
                        console.log(`[HYBRID-EXEC]   userPrompt: "${prompt}"`);
                        console.log(`[HYBRID-EXEC]   searchTerm: "${searchTerm}"`);
                        console.log(`[HYBRID-EXEC]   replacementTerm: "${replacementTerm}"`);
                        const processStartTime = Date.now();
                        hybridResult = yield this.Textbasedprocessor.processText(prompt, searchTerm, replacementTerm);
                        const processEndTime = Date.now();
                        console.log(`[HYBRID-EXEC] processText completed in ${processEndTime - processStartTime}ms`);
                        console.log(`[HYBRID-EXEC] Result summary:`);
                        console.log(`[HYBRID-EXEC]   success: ${hybridResult === null || hybridResult === void 0 ? void 0 : hybridResult.success}`);
                        console.log(`[HYBRID-EXEC]   filesModified: ${((_d = hybridResult === null || hybridResult === void 0 ? void 0 : hybridResult.filesModified) === null || _d === void 0 ? void 0 : _d.length) || 0}`);
                        console.log(`[HYBRID-EXEC]   totalReplacements: ${(hybridResult === null || hybridResult === void 0 ? void 0 : hybridResult.totalReplacements) || 0}`);
                        console.log(`[HYBRID-EXEC]   overallStrategy: ${(hybridResult === null || hybridResult === void 0 ? void 0 : hybridResult.overallStrategy) || 'N/A'}`);
                        console.log(`[HYBRID-EXEC]   error: ${(hybridResult === null || hybridResult === void 0 ? void 0 : hybridResult.error) || 'None'}`);
                        console.log(`[HYBRID-EXEC]   stats: ${JSON.stringify((hybridResult === null || hybridResult === void 0 ? void 0 : hybridResult.stats) || {})}`);
                        if (hybridResult === null || hybridResult === void 0 ? void 0 : hybridResult.filesModified) {
                            console.log(`[HYBRID-EXEC] Modified files:`);
                            hybridResult.filesModified.forEach((file, index) => {
                                console.log(`[HYBRID-EXEC]   ${index + 1}. ${file}`);
                            });
                        }
                    }
                    else {
                        console.log(`[HYBRID-EXEC] ❌ processText method not available`);
                        console.log(`[HYBRID-EXEC] Available methods: ${Object.getOwnPropertyNames(Object.getPrototypeOf(this.Textbasedprocessor))}`);
                    }
                }
                catch (hybridError) {
                    console.error(`[HYBRID-EXEC] ❌ processText failed:`, hybridError);
                    console.error(`[HYBRID-EXEC] Error stack:`, hybridError.stack);
                    hybridResult = null;
                }
                // Check hybrid result with extensive logging
                console.log(`\n=== STEP 4: HYBRID RESULT ANALYSIS ===`);
                console.log(`[HYBRID-RESULT] hybridResult exists: ${!!hybridResult}`);
                console.log(`[HYBRID-RESULT] hybridResult.success: ${hybridResult === null || hybridResult === void 0 ? void 0 : hybridResult.success}`);
                console.log(`[HYBRID-RESULT] hybridResult.filesModified exists: ${!!(hybridResult === null || hybridResult === void 0 ? void 0 : hybridResult.filesModified)}`);
                console.log(`[HYBRID-RESULT] hybridResult.filesModified.length: ${((_e = hybridResult === null || hybridResult === void 0 ? void 0 : hybridResult.filesModified) === null || _e === void 0 ? void 0 : _e.length) || 0}`);
                if (hybridResult && hybridResult.success && hybridResult.filesModified && hybridResult.filesModified.length > 0) {
                    console.log(`[HYBRID-RESULT] ✅ Hybrid approach successful!`);
                    console.log(`[HYBRID-RESULT] Processing time: ${hybridResult.processingTime}`);
                    console.log(`[HYBRID-RESULT] Average confidence: ${(hybridResult.averageConfidence * 100).toFixed(1)}%`);
                    // Track modifications with logging
                    console.log(`[HYBRID-RESULT] Tracking modifications...`);
                    for (const filePath of hybridResult.filesModified) {
                        console.log(`[HYBRID-RESULT] Tracking modification for: ${filePath}`);
                        try {
                            yield this.addModificationChange('modified', filePath, `Hybrid text replacement: "${searchTerm}" → "${replacementTerm}"`, {
                                approach: 'TEXT_BASED_CHANGE',
                                success: true,
                                linesChanged: ((_f = hybridResult.batchResults) === null || _f === void 0 ? void 0 : _f.reduce((sum, batch) => { var _a; return sum + (((_a = batch.modifications) === null || _a === void 0 ? void 0 : _a.length) || 0); }, 0)) || 0,
                                reasoning: `${hybridResult.overallStrategy}. Processed ${((_g = hybridResult.stats) === null || _g === void 0 ? void 0 : _g.nodesExtracted) || 0} AST nodes in ${((_h = hybridResult.stats) === null || _h === void 0 ? void 0 : _h.batchesProcessed) || 0} batches`
                            });
                            console.log(`[HYBRID-RESULT] ✅ Modification tracked for: ${filePath}`);
                        }
                        catch (trackingError) {
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
                        tokenUsage: ((_j = this.tokenTracker) === null || _j === void 0 ? void 0 : _j.getStats()) || { totalTokens: 0, totalInputTokens: 0, totalOutputTokens: 0, apiCalls: 0, estimatedCost: 0 }
                    };
                }
                // FALLBACK: Direct file search with extensive logging
                console.log(`\n=== STEP 5: FALLBACK EXECUTION ===`);
                console.log(`[FALLBACK] Hybrid approach failed or returned no results`);
                console.log(`[FALLBACK] Starting direct file search...`);
                this.streamUpdate(`🔄 Hybrid failed, trying direct file search...`);
                const directResult = yield this.performDirectFileSearchWithLogging(searchTerm, replacementTerm);
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
                            yield this.addModificationChange('modified', filePath, `Direct file search: "${searchTerm}" → "${replacementTerm}"`, {
                                approach: 'TEXT_BASED_CHANGE',
                                success: true,
                                linesChanged: ((_k = directResult.changes) === null || _k === void 0 ? void 0 : _k.filter((c) => c.filePath === filePath).length) || 0,
                                reasoning: 'Direct file system search fallback'
                            });
                            console.log(`[FALLBACK] ✅ Modification tracked for: ${filePath}`);
                        }
                        catch (trackingError) {
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
                        tokenUsage: ((_l = this.tokenTracker) === null || _l === void 0 ? void 0 : _l.getStats()) || { totalTokens: 0 }
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
                    tokenUsage: ((_m = this.tokenTracker) === null || _m === void 0 ? void 0 : _m.getStats()) || { totalTokens: 0 }
                };
            }
            catch (error) {
                const executionTime = Date.now() - startTime;
                console.error(`\n=== CRITICAL ERROR ===`);
                console.error(`[CRITICAL] Error after ${executionTime}ms:`, error);
                console.error(`[CRITICAL] Error stack:`, error.stack);
                console.error(`[CRITICAL] Error name: ${error.name}`);
                console.error(`[CRITICAL] Error message: ${error.message}`);
                this.streamUpdate(`❌ Critical error in text search: ${error}`);
                return {
                    success: false,
                    selectedFiles: [],
                    addedFiles: [],
                    approach: 'TEXT_BASED_CHANGE',
                    reasoning: `Critical error: ${error}`,
                    modificationSummary: `Failed: Critical error`,
                    tokenUsage: ((_o = this.tokenTracker) === null || _o === void 0 ? void 0 : _o.getStats()) || { totalTokens: 0 },
                    error: String(error)
                };
            }
        });
    }
    // Enhanced direct file search with extensive logging
    performDirectFileSearchWithLogging(searchTerm, replacementTerm) {
        return __awaiter(this, void 0, void 0, function* () {
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
                const files = yield fg(patterns, {
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
                (files.slice(0, 5)).forEach((file, index) => {
                    console.log(`[DIRECT-SEARCH]   ${index + 1}. ${file}`);
                });
                const filesModified = [];
                const changes = [];
                let totalReplacements = 0;
                let filesProcessed = 0;
                let filesWithContent = 0;
                let filesWithMatches = 0;
                for (const file of files) {
                    filesProcessed++;
                    console.log(`[DIRECT-SEARCH] Processing file ${filesProcessed}/${files.length}: ${path.basename(file)}`);
                    try {
                        const content = yield fs.readFile(file, 'utf8');
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
                            }
                            else {
                                console.log(`[DIRECT-SEARCH]   ❌ No match found`);
                            }
                        }
                        if (modified && newContent !== content) {
                            filesWithMatches++;
                            console.log(`[DIRECT-SEARCH]   ✅ Modification successful (${strategy})`);
                            console.log(`[DIRECT-SEARCH]   Writing modified content...`);
                            yield fs.writeFile(file, newContent, 'utf8');
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
                        }
                        else {
                            console.log(`[DIRECT-SEARCH]   ❌ No modification made`);
                        }
                    }
                    catch (fileError) {
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
            }
            catch (error) {
                console.error(`[DIRECT-SEARCH] ❌ Direct file search failed:`, error);
                console.error(`[DIRECT-SEARCH] Error stack:`, error.stack);
                return {
                    success: false,
                    filesModified: [],
                    totalReplacements: 0,
                    changes: []
                };
            }
        });
    }
    // Advanced term extraction with better pattern
    // Infer search term from context when only replacement is specified
    // Advanced search variations generation
    // Advanced regex escaping
    // Safe file writing with fallback
    // ==============================================================
    // UTILITY METHODS
    // ==============================================================
    getChangeIcon(change) {
        switch (change.type) {
            case 'created': return '📝';
            case 'modified': return '🔄';
            case 'updated': return '⚡';
            default: return '🔧';
        }
    }
    getRedisStats() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.redis.getStats();
            }
            catch (error) {
                return { error: 'Redis not available', message: error };
            }
        });
    }
    cleanup() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.redis.disconnect();
            }
            catch (error) {
                console.log('Cleanup failed:', error);
            }
        });
    }
    // ==============================================================
    // DIRECT FILE OPERATIONS (Emergency methods)
    // ==============================================================
    createFileDirectly(filePath, content) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { promises: fs } = require('fs');
                const path = require('path');
                const fullPath = path.join(this.reactBasePath, filePath);
                const dir = path.dirname(fullPath);
                this.streamUpdate(`📁 Creating directory: ${dir}`);
                yield fs.mkdir(dir, { recursive: true });
                this.streamUpdate(`💾 Writing file: ${fullPath}`);
                yield fs.writeFile(fullPath, content, 'utf8');
                this.streamUpdate(`✅ File created directly: ${fullPath}`);
                return true;
            }
            catch (error) {
                this.streamUpdate(`❌ Direct file creation failed: ${error}`);
                return false;
            }
        });
    }
    updateFileDirectly(filePath, content) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { promises: fs } = require('fs');
                const path = require('path');
                const fullPath = path.join(this.reactBasePath, filePath);
                this.streamUpdate(`🔄 Updating file directly: ${fullPath}`);
                yield fs.writeFile(fullPath, content, 'utf8');
                this.streamUpdate(`✅ File updated directly: ${fullPath}`);
                return true;
            }
            catch (error) {
                this.streamUpdate(`❌ Direct file update failed: ${error}`);
                return false;
            }
        });
    }
    // ==============================================================
    // EMERGENCY COMPONENT CREATION (Final fallback)
    // ==============================================================
    createComponentEmergency(prompt) {
        return __awaiter(this, void 0, void 0, function* () {
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
                const success = yield this.createFileDirectly(filePath, content);
                if (success) {
                    // Log the change
                    yield this.addModificationChange('created', filePath, `Emergency created ${type}: ${componentName}`, {
                        approach: 'COMPONENT_ADDITION',
                        success: true,
                        reasoning: 'Emergency fallback component creation'
                    });
                    return {
                        success: true,
                        selectedFiles: [],
                        addedFiles: [filePath],
                        approach: 'COMPONENT_ADDITION',
                        reasoning: `Emergency component creation successful: Created ${componentName} ${type} using direct file operations.`,
                        modificationSummary: yield this.getModificationContextualSummary(),
                        componentGenerationResult: {
                            success: true,
                            generatedFile: filePath,
                            updatedFiles: [],
                            integrationPath: type,
                            projectSummary: ''
                        },
                        tokenUsage: this.tokenTracker.getStats()
                    };
                }
                else {
                    throw new Error('Direct file creation failed in emergency mode');
                }
            }
            catch (error) {
                this.streamUpdate(`❌ Emergency component creation failed: ${error}`);
                return {
                    success: false,
                    error: `All fallback methods failed. Original error: ${error}`,
                    selectedFiles: [],
                    addedFiles: [],
                    tokenUsage: this.tokenTracker.getStats()
                };
            }
        });
    }
    generateSimpleComponent(name, type, prompt) {
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
        }
        else {
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
exports.EnhancedUnrestrictedIntelligentFileModifier = EnhancedUnrestrictedIntelligentFileModifier;
exports.StatelessIntelligentFileModifier = EnhancedUnrestrictedIntelligentFileModifier;
//# sourceMappingURL=filemodifier.js.map