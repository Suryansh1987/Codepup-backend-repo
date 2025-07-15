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
    needsFullContext?: boolean;
    contextFiles?: string[];
    contextKeywords?: string[];
}
export interface GenerationResult {
    success: boolean;
    generatedContent: string;
    componentType: ComponentTypeAnalysis;
    elementTreeContext: string;
    supabaseSchemaContext: string;
    fullContextContent?: string;
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
        navigationUpdated: boolean;
        headerUpdated: boolean;
        footerUpdated: boolean;
        dependenciesResolved: boolean;
        usageExampleAdded: boolean;
        pagesUpdated: string[];
        routeAlreadyExisted: boolean;
        navigationAlreadyExists: boolean;
        supabaseIntegrated?: boolean;
        contextFilesLinked?: boolean;
    };
    error?: string;
}
export interface TwoStepResult {
    success: boolean;
    step1: GenerationResult;
    step2: IntegrationResult;
    summary: string;
    totalDuration: number;
    enhancedFeatures: {
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
    forceSupabaseContext?: boolean;
    businessType?: string;
}
export declare class TwoStepComponentGenerationSystem {
    private analysisEngine;
    private integrationEngine;
    private streamCallback?;
    private messageDB?;
    constructor(anthropic: any, reactBasePath: string, messageDB?: any);
    setStreamCallback(callback: (message: string) => void): void;
    private streamUpdate;
    /**
     * 🔥 ENHANCED MAIN TWO-STEP WORKFLOW WITH SUPABASE & CONTEXT INTEGRATION
     */
    generateComponent(userPrompt: string, options?: TwoStepOptions, projectId?: number): Promise<TwoStepResult>;
    /**
     * 🔥 NEW: DETECT ENHANCED FEATURES FROM GENERATION RESULT
     */
    private detectEnhancedFeatures;
    /**
     * 🔥 NEW: LOG ENHANCED FEATURES
     */
    private logEnhancedFeatures;
    /**
     * 🔥 ENHANCED: CREATE DETAILED SUMMARY WITH SUPABASE & CONTEXT INFO
     */
    private createEnhancedSummary;
    /**
     * 🔥 ENHANCED: GET PROJECT ANALYSIS WITH SUPABASE INFO
     */
    getProjectAnalysisSummary(): Promise<string>;
    /**
     * 🔥 ENHANCED: REFRESH WITH SUPABASE SCANNING
     */
    refreshFileStructure(): Promise<void>;
    /**
     * 🔥 ENHANCED: ANALYSIS ONLY WITH SUPABASE
     */
    analyzeOnly(userPrompt: string, projectId?: number): Promise<GenerationResult>;
    /**
     * INTEGRATION ONLY (unchanged)
     */
    integrateOnly(generationResult: GenerationResult): Promise<IntegrationResult>;
    /**
     * 🔥 NEW: GET SUPABASE SCHEMA SUMMARY
     */
    getSupabaseSchemaStatus(): Promise<{
        available: boolean;
        tables: number;
        files: number;
        status: string;
    }>;
    /**
     * 🔥 NEW: FORCE SUPABASE CONTEXT FOR SIMPLE COMPONENTS
     */
    generateWithForcedSupabase(userPrompt: string, projectId?: number): Promise<TwoStepResult>;
}
