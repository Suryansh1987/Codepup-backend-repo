"use strict";
// ============================================================================
// TWO-STEP COMPONENT GENERATION SYSTEM COORDINATOR
// ============================================================================
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
exports.TwoStepComponentGenerationSystem = void 0;
const component_analysis_1 = require("../filemodifier/component_analysis");
const component_integerator_1 = require("./component_integerator");
// ============================================================================
// TWO-STEP COMPONENT GENERATION SYSTEM
// ============================================================================
class TwoStepComponentGenerationSystem {
    constructor(anthropic, reactBasePath) {
        this.analysisEngine = new component_analysis_1.AnalysisAndGenerationEngine(anthropic, reactBasePath);
        this.integrationEngine = new component_integerator_1.IntegrationEngine(anthropic, reactBasePath);
    }
    setStreamCallback(callback) {
        this.streamCallback = callback;
        this.analysisEngine.setStreamCallback(callback);
        this.integrationEngine.setStreamCallback(callback);
    }
    streamUpdate(message) {
        if (this.streamCallback) {
            this.streamCallback(message);
        }
        console.log(message);
    }
    /**
     * MAIN TWO-STEP WORKFLOW
     */
    generateComponent(userPrompt_1) {
        return __awaiter(this, arguments, void 0, function* (userPrompt, options = {}) {
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
                const step1Result = yield this.analysisEngine.analyzeAndGenerate(userPrompt);
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
                const step2Result = yield this.integrationEngine.integrateComponent(step1Result);
                if (!step2Result.success) {
                    this.streamUpdate(`⚠️  Step 2 completed with issues: ${step2Result.error}`);
                }
                else {
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
            }
            catch (error) {
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
        });
    }
    /**
     * CREATE SUMMARY
     */
    createSummary(step1Result, step2Result, duration, skippedIntegration = false) {
        const durationFormatted = duration > 1000 ? `${(duration / 1000).toFixed(1)}s` : `${duration}ms`;
        let summary = `
TWO-STEP COMPONENT GENERATION SUMMARY
====================================
✅ Success: ${step1Result.success && ((step2Result === null || step2Result === void 0 ? void 0 : step2Result.success) !== false)}
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
        }
        else if (step2Result) {
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

${step1Result.success && ((step2Result === null || step2Result === void 0 ? void 0 : step2Result.success) !== false) ? '✅ Two-step generation completed successfully!' : '❌ Two-step generation encountered issues.'}
`;
        return summary.trim();
    }
    /**
     * GET PROJECT ANALYSIS SUMMARY
     */
    getProjectAnalysisSummary() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.analysisEngine.getProjectAnalysisSummary();
            }
            catch (error) {
                return `Failed to get project analysis summary: ${error}`;
            }
        });
    }
    /**
     * REFRESH FILE STRUCTURE
     */
    refreshFileStructure() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.analysisEngine.refreshFileStructure();
            }
            catch (error) {
                this.streamUpdate(`⚠️ Failed to refresh file structure: ${error}`);
            }
        });
    }
    /**
     * ANALYSIS ONLY
     */
    analyzeOnly(userPrompt) {
        return __awaiter(this, void 0, void 0, function* () {
            this.streamUpdate('🔍 Running analysis-only workflow...');
            return yield this.analysisEngine.analyzeAndGenerate(userPrompt);
        });
    }
    /**
     * INTEGRATION ONLY
     */
    integrateOnly(generationResult) {
        return __awaiter(this, void 0, void 0, function* () {
            this.streamUpdate('🔗 Running integration-only workflow...');
            return yield this.integrationEngine.integrateComponent(generationResult);
        });
    }
}
exports.TwoStepComponentGenerationSystem = TwoStepComponentGenerationSystem;
//# sourceMappingURL=two-step-component-system.js.map