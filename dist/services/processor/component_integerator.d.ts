import { GenerationResult } from '../filemodifier/component_analysis';
export interface NavigationLinkAnalysis {
    link: string;
    type: 'page-route' | 'in-page-section' | 'external' | 'unknown';
    isPageRoute: boolean;
    isInPageSection: boolean;
    normalizedPath?: string;
    displayName?: string;
}
export interface NavigationFileInfo {
    filePath: string;
    type: 'header' | 'footer' | 'navbar' | 'sidebar' | 'menu' | 'custom';
    priority: number;
    existingLinks: string[];
    linkAnalysis: NavigationLinkAnalysis[];
    pageRouteCount: number;
    inPageSectionCount: number;
    canAddMorePages: boolean;
    needsRouteUpdate: boolean;
    existingRoutes: string[];
    hasMatchingRoute?: boolean;
}
export interface NavigationAnalysis {
    hasNavigation: boolean;
    navigationFiles: NavigationFileInfo[];
    hasHeader: boolean;
    hasFooter: boolean;
    hasNavbar: boolean;
    existingLinks: string[];
    headerCanAddPages: boolean;
    shouldUpdateAppOnly: boolean;
    existingPageRoutes: string[];
    routeAlreadyExists: boolean;
    matchingNavigationFile?: string;
}
export interface IntegrationPlan {
    filePath: string;
    exists: boolean;
    purpose: string;
    required: boolean;
    priority: number;
    integrationType: 'routing' | 'import' | 'context' | 'config' | 'creation' | 'navigation' | 'usage';
    navigationFileType?: 'header' | 'footer' | 'navbar' | 'sidebar' | 'menu' | 'custom';
    modifications?: string[];
    skipReason?: string;
}
export interface PageFileInfo {
    filePath: string;
    type: 'page' | 'layout' | 'component';
    priority: number;
    isMainPage: boolean;
    componentImports: string[];
    aiReason?: string;
}
export interface UsageAnalysis {
    hasPages: boolean;
    pageFiles: PageFileInfo[];
    targetPages: string[];
    aiAnalysis?: string;
}
export interface IntegrationAnalysis {
    mainComponentFile: IntegrationPlan;
    integrationFiles: IntegrationPlan[];
    navigationAnalysis: NavigationAnalysis;
    usageAnalysis: UsageAnalysis;
    projectPatterns: {
        exportPattern: 'default' | 'named' | 'mixed';
        importPattern: 'default' | 'named' | 'mixed';
        routingPattern: 'react-router' | 'next' | 'reach-router' | 'basic';
        appFilePath?: string;
        routeFilePath?: string;
    };
    existingRoutes: string[];
    componentMap: Map<string, string>;
    isPageComponent: boolean;
    componentDisplayName: string;
    componentRoutePath: string;
}
export interface IntegrationResult {
    success: boolean;
    createdFiles: string[];
    modifiedFiles: string[];
    skippedFiles: string[];
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
    };
    error?: string;
    warnings?: string[];
}
export declare class IntegrationEngine {
    private anthropic;
    private reactBasePath;
    private streamCallback?;
    constructor(anthropic: any, reactBasePath: string);
    setStreamCallback(callback: (message: string) => void): void;
    private streamUpdate;
    /**
     * 🔥 NEW: GENERATE CLEAN COMPONENT NAMES AND PATHS
     */
    private generateCleanNaming;
    /**
     * 🔥 ENHANCED: ANALYZE NAVIGATION WITH SMART ROUTE DETECTION & IN-PAGE UPGRADE
     */
    private analyzeNavigation;
    /**
     * 🔥 ENHANCED: ANALYZE NAVIGATION LINKS WITH BETTER ROUTE DETECTION
     */
    private analyzeNavigationLinks;
    /**
     * 🔥 NEW: NORMALIZE ROUTE PATH FOR COMPARISON
     */
    private normalizeRoutePath;
    /**
     * 🔥 NEW: EXTRACT DISPLAY NAME FROM NAVIGATION CONTEXT
     */
    private extractDisplayNameFromNavigation;
    /**
     * GET CONTEXT AROUND HOW A LINK IS USED
     */
    private getLinkUsageContext;
    /**
     * 🔥 ENHANCED: CREATE INTEGRATION PLAN WITH SMART NAMING AND ROUTE DETECTION
     */
    private createIntegrationPlan;
    /**
     * COMPLETE INTEGRATION WITH PROPER TYPE DISTINCTION
     */
    integrateComponent(generationResult: GenerationResult, userPrompt?: string): Promise<IntegrationResult>;
    /**
     * 🔥 ENHANCED: EXECUTE INTEGRATION WITH SMART SKIPPING
     */
    private executeIntegration;
    /**
     * 🔥 ENHANCED: PAGE INTEGRATION PROMPT WITH CLEAN NAMING
     */
    private createPageIntegrationPrompt;
    /**
     * 🔥 ENHANCED: COMPONENT INTEGRATION PROMPT WITH CLEAN NAMING
     */
    private createComponentIntegrationPrompt;
    /**
     * ANALYZE USAGE TARGETS (FOR COMPONENTS ONLY) - AI-DRIVEN
     */
    private analyzeUsageTargets;
    private findAllLayoutComponents;
    private findAllPageFiles;
    private looksLikePage;
    private getAIIntegrationAnalysis;
    private isNavigationComponent;
    private getFallbackRecommendations;
    private hasNavigationLinks;
    private extractNavigationLinks;
    private extractComponentImports;
    /**
     * PARSE GENERATED FILES FROM RESPONSE
     */
    private parseGeneratedFiles;
    /**
     * UTILITY METHODS
     */
    private writeFile;
    private fileExists;
    /**
     * 🔥 ENHANCED: GENERATE PROPER IMPORT PATH WITH CLEAN NAMING
     */
    private generateImportPath;
    /**
     * 🔥 ENHANCED: GET INTEGRATION SUMMARY WITH SMART FEATURES
     */
    getIntegrationSummary(result: IntegrationResult): string;
}
