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
export declare class TwoStepComponentGenerationSystem {
    private analysisEngine;
    private integrationEngine;
    private streamCallback?;
    constructor(anthropic: any, reactBasePath: string);
    setStreamCallback(callback: (message: string) => void): void;
    private streamUpdate;
    /**
     * MAIN TWO-STEP WORKFLOW
     */
    generateComponent(userPrompt: string, options?: TwoStepOptions): Promise<TwoStepResult>;
    /**
     * CREATE SUMMARY
     */
    private createSummary;
    /**
     * GET PROJECT ANALYSIS SUMMARY
     */
    getProjectAnalysisSummary(): Promise<string>;
    /**
     * REFRESH FILE STRUCTURE
     */
    refreshFileStructure(): Promise<void>;
    /**
     * ANALYSIS ONLY
     */
    analyzeOnly(userPrompt: string): Promise<GenerationResult>;
    /**
     * INTEGRATION ONLY
     */
    integrateOnly(generationResult: GenerationResult): Promise<IntegrationResult>;
}
