"use strict";
// ============================================================================
// ENHANCED TWO-STEP COMPONENT GENERATION SYSTEM WITH SUPABASE INTEGRATION
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
// ENHANCED TWO-STEP COMPONENT GENERATION SYSTEM
// ============================================================================
class TwoStepComponentGenerationSystem {
    constructor(anthropic, reactBasePath, messageDB) {
        this.analysisEngine = new component_analysis_1.AnalysisAndGenerationEngine(anthropic, reactBasePath, messageDB);
        this.integrationEngine = new component_integerator_1.IntegrationEngine(anthropic, reactBasePath);
        this.messageDB = messageDB;
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
     * 🔥 ENHANCED MAIN TWO-STEP WORKFLOW WITH SUPABASE & CONTEXT INTEGRATION
     */
    generateComponent(userPrompt_1) {
        return __awaiter(this, arguments, void 0, function* (userPrompt, options = {}, projectId) {
            var _a;
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
                const step1Result = yield this.analysisEngine.analyzeAndGenerate(userPrompt, projectIdToUse);
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
                this.streamUpdate(`   📁 Context Files: ${((_a = step1Result.componentType.contextFiles) === null || _a === void 0 ? void 0 : _a.length) || 0}`);
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
                const enhancedIntegrationData = Object.assign(Object.assign({}, step1Result), { enhancedFeatures,
                    options });
                const step2Result = yield this.integrationEngine.integrateComponent(enhancedIntegrationData);
                if (!step2Result.success) {
                    this.streamUpdate(`⚠️  Step 2 completed with issues: ${step2Result.error}`);
                }
                else {
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
            }
            catch (error) {
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
        });
    }
    /**
     * 🔥 NEW: DETECT ENHANCED FEATURES FROM GENERATION RESULT
     */
    detectEnhancedFeatures(step1Result, options) {
        const supabaseIntegration = step1Result.supabaseSchemaContext.length > 100 || options.forceSupabaseContext || false;
        const contextIntegration = step1Result.componentType.needsFullContext || false;
        // Detect business type from reasoning or options
        let businessTypeDetected = options.businessType || 'Business';
        if (step1Result.componentType.reasoning) {
            const reasoning = step1Result.componentType.reasoning.toLowerCase();
            if (reasoning.includes('ecommerce') || reasoning.includes('shop'))
                businessTypeDetected = 'E-commerce';
            else if (reasoning.includes('booking') || reasoning.includes('appointment'))
                businessTypeDetected = 'Booking/Service';
            else if (reasoning.includes('saas') || reasoning.includes('dashboard'))
                businessTypeDetected = 'SaaS';
            else if (reasoning.includes('health'))
                businessTypeDetected = 'Healthcare';
        }
        // Detect Tailwind quality from generated content
        const generatedContent = step1Result.generatedContent.toLowerCase();
        let tailwindQuality = 'basic';
        if (generatedContent.includes('gradient') && generatedContent.includes('hover:scale') && generatedContent.includes('transition-all')) {
            tailwindQuality = 'expert';
        }
        else if (generatedContent.includes('hover:') && generatedContent.includes('focus:')) {
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
    logEnhancedFeatures(features) {
        this.streamUpdate(`🔥 ENHANCED FEATURES DETECTED:`);
        this.streamUpdate(`   🗄️  Supabase Integration: ${features.supabaseIntegration ? 'ENABLED ✅' : 'DISABLED'}`);
        this.streamUpdate(`   🔧 Context Integration: ${features.contextIntegration ? 'ENABLED ✅' : 'DISABLED'}`);
        this.streamUpdate(`   🏢 Business Type: ${features.businessTypeDetected}`);
        this.streamUpdate(`   🎨 Tailwind Quality: ${features.tailwindQuality.toUpperCase()}`);
    }
    /**
     * 🔥 ENHANCED: CREATE DETAILED SUMMARY WITH SUPABASE & CONTEXT INFO
     */
    createEnhancedSummary(step1Result, step2Result, duration, enhancedFeatures, skippedIntegration = false) {
        var _a;
        const durationFormatted = duration > 1000 ? `${(duration / 1000).toFixed(1)}s` : `${duration}ms`;
        let summary = `
ENHANCED TWO-STEP COMPONENT GENERATION SUMMARY
=============================================
✅ Success: ${step1Result.success && ((step2Result === null || step2Result === void 0 ? void 0 : step2Result.success) !== false)}
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
🔧 Context Files: ${((_a = step1Result.componentType.contextFiles) === null || _a === void 0 ? void 0 : _a.length) || 0}
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
        }
        else if (step2Result) {
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

${step1Result.success && ((step2Result === null || step2Result === void 0 ? void 0 : step2Result.success) !== false) ? '🎉 Enhanced two-step generation completed successfully!' : '❌ Enhanced two-step generation encountered issues.'}
`;
        return summary.trim();
    }
    /**
     * 🔥 ENHANCED: GET PROJECT ANALYSIS WITH SUPABASE INFO
     */
    getProjectAnalysisSummary() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const baseSummary = yield this.analysisEngine.getProjectAnalysisSummary();
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
            }
            catch (error) {
                return `Failed to get enhanced project analysis summary: ${error}`;
            }
        });
    }
    /**
     * 🔥 ENHANCED: REFRESH WITH SUPABASE SCANNING
     */
    refreshFileStructure() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.streamUpdate('🔄 Refreshing enhanced file structure (including Supabase)...');
                yield this.analysisEngine.refreshFileStructure();
                this.streamUpdate('✅ Enhanced file structure refreshed with Supabase integration');
            }
            catch (error) {
                this.streamUpdate(`⚠️ Failed to refresh enhanced file structure: ${error}`);
            }
        });
    }
    /**
     * 🔥 ENHANCED: ANALYSIS ONLY WITH SUPABASE
     */
    analyzeOnly(userPrompt, projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            this.streamUpdate('🔍 Running enhanced analysis-only workflow...');
            this.streamUpdate('🗄️  Supabase integration: ENABLED');
            this.streamUpdate('🔧 Context detection: ENABLED');
            return yield this.analysisEngine.analyzeAndGenerate(userPrompt, projectId);
        });
    }
    /**
     * INTEGRATION ONLY (unchanged)
     */
    integrateOnly(generationResult) {
        return __awaiter(this, void 0, void 0, function* () {
            this.streamUpdate('🔗 Running integration-only workflow...');
            return yield this.integrationEngine.integrateComponent(generationResult);
        });
    }
    /**
     * 🔥 NEW: GET SUPABASE SCHEMA SUMMARY
     */
    getSupabaseSchemaStatus() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const summary = yield this.analysisEngine.getProjectAnalysisSummary();
                const supabaseFiles = ((_a = summary.match(/Supabase files: (\d+)/)) === null || _a === void 0 ? void 0 : _a[1]) || '0';
                return {
                    available: parseInt(supabaseFiles) > 0,
                    tables: 0, // Would need to parse from actual summary
                    files: parseInt(supabaseFiles),
                    status: parseInt(supabaseFiles) > 0 ? 'Schema available - database integration enabled' : 'No schema found - using fallback patterns'
                };
            }
            catch (error) {
                return {
                    available: false,
                    tables: 0,
                    files: 0,
                    status: 'Schema check failed'
                };
            }
        });
    }
    /**
     * 🔥 NEW: FORCE SUPABASE CONTEXT FOR SIMPLE COMPONENTS
     */
    generateWithForcedSupabase(userPrompt, projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.generateComponent(userPrompt, {
                forceSupabaseContext: true,
                verbose: true,
                projectId
            }, projectId);
        });
    }
}
exports.TwoStepComponentGenerationSystem = TwoStepComponentGenerationSystem;
//# sourceMappingURL=two-step-component-system.js.map