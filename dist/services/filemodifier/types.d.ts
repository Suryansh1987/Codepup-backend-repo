export interface ProjectFile {
    name: string;
    path: string;
    relativePath: string;
    content: string;
    lines: number;
    size: number;
    snippet: string;
    componentName: string | null;
    hasButtons: boolean;
    hasSignin: boolean;
    isMainFile: boolean;
    fileType: string;
    lastModified: Date;
    encoding?: string;
    imports?: string[];
    exports?: string[];
    dependencies?: string[];
    framework?: 'react' | 'vue' | 'angular' | 'svelte' | 'next' | 'nuxt' | 'vanilla' | null;
    hasNavigation?: boolean;
    hasFooter?: boolean;
    hasHeader?: boolean;
    hasSidebar?: boolean;
    hasModal?: boolean;
    hasForm?: boolean;
    hasTable?: boolean;
    hasChart?: boolean;
    hasImages?: boolean;
    hasIcons?: boolean;
    stylingMethod?: 'tailwind' | 'css-modules' | 'styled-components' | 'emotion' | 'sass' | 'vanilla-css' | 'none';
    hasInlineStyles?: boolean;
    cssClasses?: string[];
    isPage?: boolean;
    isComponent?: boolean;
    isLayout?: boolean;
    isHook?: boolean;
    isProvider?: boolean;
    isContext?: boolean;
    componentType?: 'functional' | 'class' | 'hoc' | 'render-prop' | null;
    hasState?: boolean;
    hasProps?: boolean;
    hasEffects?: boolean;
    hasApiCalls?: boolean;
    hasFetch?: boolean;
    hasGraphQL?: boolean;
    hasDatabase?: boolean;
    dataFetching?: 'swr' | 'react-query' | 'apollo' | 'fetch' | 'axios' | 'none';
    isRoute?: boolean;
    routePath?: string;
    hasRouting?: boolean;
    isConfig?: boolean;
    configType?: 'webpack' | 'vite' | 'next' | 'tailwind' | 'typescript' | 'eslint' | 'package' | 'env' | null;
    isTest?: boolean;
    testFramework?: 'jest' | 'vitest' | 'cypress' | 'playwright' | 'testing-library' | null;
    hasLazyLoading?: boolean;
    hasMemoization?: boolean;
    hasVirtualization?: boolean;
    hasAriaLabels?: boolean;
    hasSemanticHTML?: boolean;
    accessibilityScore?: number;
    complexity?: number;
    maintainabilityIndex?: number;
    technicalDebt?: 'low' | 'medium' | 'high';
    codeSmells?: string[];
    hasSecurityIssues?: boolean;
    securityConcerns?: string[];
    hasI18n?: boolean;
    i18nFramework?: 'react-i18next' | 'next-i18next' | 'formatjs' | 'lingui' | null;
    isBuildFile?: boolean;
    isPublic?: boolean;
    isStatic?: boolean;
    textContent?: {
        headings: string[];
        paragraphs: string[];
        buttonTexts: string[];
        linkTexts: string[];
        labels: string[];
        placeholders: string[];
        titles: string[];
        altTexts: string[];
        errorMessages: string[];
        successMessages: string[];
        tooltips: string[];
        breadcrumbs: string[];
    };
    searchableText?: string;
    keywords?: string[];
    modificationHistory?: ModificationRecord[];
    analyzedAt?: Date;
    analysisVersion?: string;
    relatedFiles?: string[];
    childComponents?: string[];
    parentComponents?: string[];
    bundleSize?: number;
    renderTime?: number;
    hasDocumentation?: boolean;
    documentationQuality?: 'excellent' | 'good' | 'fair' | 'poor' | 'none';
    hasComments?: boolean;
    hasJSDoc?: boolean;
    hasErrorBoundary?: boolean;
    hasErrorHandling?: boolean;
    errorPatterns?: string[];
    stateManagement?: 'redux' | 'zustand' | 'context' | 'jotai' | 'valtio' | 'local' | 'none';
    hasGlobalState?: boolean;
    hasAnimations?: boolean;
    animationLibrary?: 'framer-motion' | 'react-spring' | 'lottie' | 'css' | 'none';
    hasInteractions?: boolean;
    isResponsive?: boolean;
    hasMobileOptimizations?: boolean;
    breakpoints?: string[];
    hasSEO?: boolean;
    hasMetaTags?: boolean;
    hasStructuredData?: boolean;
    seoScore?: number;
}
export interface ModificationRecord {
    timestamp: Date;
    type: 'TEXT_BASED_CHANGE' | 'TARGETED_NODES' | 'FULL_FILE' | 'COMPONENT_ADDITION' | 'TAILWIND_CHANGE';
    description: string;
    linesChanged: number;
    searchTerm?: string;
    replacementTerm?: string;
    confidence?: number;
    user?: string;
    sessionId?: string;
}
export type ProjectFileFilter = {
    fileType?: string | string[];
    framework?: ProjectFile['framework'];
    hasComponent?: boolean;
    isPage?: boolean;
    isConfig?: boolean;
    hasButtons?: boolean;
    hasForm?: boolean;
    stylingMethod?: ProjectFile['stylingMethod'];
    componentType?: ProjectFile['componentType'];
    hasApiCalls?: boolean;
    isTest?: boolean;
    hasNavigation?: boolean;
    hasFooter?: boolean;
    searchTerm?: string;
    modifiedSince?: Date;
    minComplexity?: number;
    maxComplexity?: number;
    technicalDebt?: ProjectFile['technicalDebt'];
    hasSecurityIssues?: boolean;
};
export interface ProjectFileQuery {
    filter?: ProjectFileFilter;
    sortBy?: 'name' | 'size' | 'lines' | 'lastModified' | 'complexity' | 'maintainabilityIndex';
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
    includeContent?: boolean;
    searchableFields?: ('name' | 'content' | 'textContent' | 'keywords')[];
}
export interface ProjectAnalysis {
    totalFiles: number;
    filesByType: Record<string, number>;
    frameworksUsed: string[];
    stylingMethods: string[];
    componentCount: number;
    pageCount: number;
    testCoverage: number;
    averageComplexity: number;
    technicalDebtSummary: {
        low: number;
        medium: number;
        high: number;
    };
    securityIssues: number;
    performanceScore: number;
    accessibilityScore: number;
    seoScore: number;
    maintenanceRecommendations: string[];
}
export interface TextSearchResult {
    file: string;
    matches: {
        line: number;
        column: number;
        text: string;
        context: string;
        confidence: number;
    }[];
    totalMatches: number;
    searchTerm: string;
    variations: string[];
}
export type ProjectFileUtils = {
    filterFiles: (files: ProjectFile[], filter: ProjectFileFilter) => ProjectFile[];
    searchText: (files: ProjectFile[], searchTerm: string) => TextSearchResult[];
    analyzeProject: (files: ProjectFile[]) => ProjectAnalysis;
    suggestTargetFiles: (searchTerm: string, files: ProjectFile[]) => string[];
    extractTextContent: (content: string, fileType: string) => ProjectFile['textContent'];
};
export interface TailwindConfig {
    colors: Record<string, any>;
    availableColors: string[];
    colorClasses: string[];
}
export interface ASTNode {
    id: string;
    type: string;
    tagName?: string;
    textContent: string;
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
    codeSnippet: string;
    fullContext: string;
    isButton: boolean;
    hasSigninText: boolean;
    attributes?: string[];
}
export interface CodeRange {
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
    originalCode: string;
}
export interface FileStructure {
    imports: string[];
    exports: string[];
    componentName: string | null;
    hasDefaultExport: boolean;
    fileHeader: string;
    fileFooter: string;
    preservationPrompt: string;
    components: string[];
    hooks?: string[];
}
export interface FileRelevanceResult {
    isRelevant: boolean;
    reasoning: string;
    relevanceScore: number;
    targetNodes?: ASTNode[];
}
export interface PageInfo {
    name: string;
    path: string;
    isImported: boolean;
    isUsedInRouting: boolean;
    suggestedRoute: string;
}
export interface ColorChange {
    type: string;
    color: string;
    target?: string;
}
export interface ModificationChange {
    type: 'modified' | 'created' | 'updated';
    file: string;
    description: string;
    timestamp: string;
    approach?: 'FULL_FILE' | 'TARGETED_NODES' | 'COMPONENT_ADDITION' | 'TAILWIND_CHANGE';
    success?: boolean;
    details?: {
        linesChanged?: number;
        componentsAffected?: string[];
        reasoning?: string;
    };
}
export interface ModificationSessionSummary {
    changes: ModificationChange[];
    totalFiles: number;
    totalChanges: number;
    approach: string;
    sessionDuration: number;
    successRate: number;
    startTime: string;
    endTime: string;
}
export interface ComponentSpec {
    name: string;
    type: 'component' | 'page';
    description: string;
    userRequest: string;
}
export interface FileStructureSummary {
    components: Array<{
        name: string;
        path: string;
        exports: string[];
        canAcceptChildren: boolean;
        level: number;
    }>;
    pages: Array<{
        name: string;
        path: string;
        exports: string[];
        level: number;
        elementTree?: string;
    }>;
    appStructure: {
        path: string;
        hasRouting: boolean;
        existingRoutes: string[];
        importedPages: string[];
    };
}
export interface GeneratedFile {
    filePath: string;
    content: string;
    operation: 'create' | 'update';
    success: boolean;
    error?: string;
}
export interface ComponentGenerationResult {
    success: boolean;
    generatedFile?: string;
    updatedFiles: string[];
    componentContent?: string;
    integrationPath: 'component' | 'page' | 'app';
    error?: string;
    projectSummary?: string;
}
export interface ComponentIntegrationLevel {
    level: number;
    type: 'component' | 'page' | 'app';
    description: string;
    compatibleWith: string[];
}
export interface ModificationScope {
    scope: 'FULL_FILE' | 'TARGETED_NODES' | 'COMPONENT_ADDITION' | 'TAILWIND_CHANGE' | 'TEXT_BASED_CHANGE';
    files: string[];
    reasoning: string;
    componentName?: string;
    componentType?: 'component' | 'page' | 'app';
    dependencies?: string[];
    integrationLevel?: ComponentIntegrationLevel;
    colorChanges?: ColorChange[];
    textChangeAnalysis?: {
        searchTerm: string;
        replacementTerm: string;
    };
    estimatedComplexity?: 'low' | 'medium' | 'high';
    requiresRouting?: boolean;
    affectedLevels?: number[];
}
export interface ModificationResult {
    success: boolean;
    selectedFiles?: string[];
    addedFiles?: string[];
    approach?: 'FULL_FILE' | 'TARGETED_NODES' | 'COMPONENT_ADDITION' | 'TAILWIND_CHANGE' | "TEXT_BASED_CHANGE";
    reasoning?: string;
    error?: string;
    modificationSummary?: string;
    modifiedRanges?: Array<{
        file: string;
        range: CodeRange;
        modifiedCode: string;
    }>;
    componentGenerationResult?: ComponentGenerationResult;
    integrationSummary?: {
        level: number;
        integratedWith: string[];
        routingUpdated: boolean;
        newRoutes: string[];
    };
    tailwindModification?: {
        configPath: string;
        changesApplied: ColorChange[];
        configUpdated: boolean;
        backupCreated?: boolean;
        originalConfig?: string;
    };
    extractionMethod?: string;
    tokenUsage?: {
        totalInputTokens: number;
        totalOutputTokens: number;
        apiCalls: number;
        totalTokens: number;
        estimatedCost: number;
    };
    totalReplacements?: number;
    changes?: CodeChange[];
    confidence?: number;
    analysisSource?: string;
    executionTime?: number;
    diffPatches?: DiffPatch[];
    hybridStats?: {
        filesScanned: number;
        nodesExtracted: number;
        batchesProcessed: number;
        totalBatches: number;
        strategy: string;
        processingTime: string;
    };
    batchResults?: any[];
}
export interface CodeChange {
    filePath: string;
    originalText: string;
    modifiedText: string;
    modelUsed: string;
    [key: string]: any;
}
export interface DiffPatch {
    filePath: string;
    diff: string;
}
export interface FileRequirement {
    filePath: string;
    required: boolean;
    exists: boolean;
    purpose: string;
    priority: 'high' | 'medium' | 'low';
    operation: 'create' | 'update' | 'skip';
}
export interface ComponentAnalysis {
    type: 'component' | 'page';
    name: string;
    confidence: number;
    reasoning: string;
    fileRequirements: FileRequirement[];
    layoutRequirements: {
        needsLayout: boolean;
        needsHeader: boolean;
        needsFooter: boolean;
        layoutStrategy: 'wrapper' | 'embedded' | 'create' | 'reuse';
        existingHeaderPath?: string;
        existingFooterPath?: string;
        reuseExistingLayout: boolean;
    };
    colorScheme: {
        primary: string;
        secondary: string;
        accent: string;
        neutral: string;
    };
}
export interface LayoutStructure {
    hasLayout: boolean;
    layoutPath?: string;
    headerPath?: string;
    footerPath?: string;
    layoutType: 'wrapper' | 'embedded' | 'none';
}
export interface ProjectStructureAnalysis {
    totalComponents: number;
    totalPages: number;
    hasAppRouter: boolean;
    routingType: 'react-router' | 'next-router' | 'none';
    componentHierarchy: Map<string, ComponentAnalysis>;
    integrationOpportunities: Array<{
        parentComponent: string;
        level: number;
        compatibility: number;
    }>;
}
export interface IntegrationStrategy {
    type: 'component-to-component' | 'component-to-page' | 'page-to-app';
    targetFile: string;
    method: 'import-and-use' | 'route-addition' | 'children-prop';
    confidence: number;
    reasoning: string;
}
export interface ComponentASTNode extends ASTNode {
    canAcceptNewChildren: boolean;
    componentType: 'container' | 'leaf' | 'layout';
    integrationPoints: Array<{
        line: number;
        type: 'children' | 'sibling' | 'wrapper';
        suitability: number;
    }>;
}
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    score: number;
}
export interface StructureAnalysis {
    hasImports: boolean;
    hasExports: boolean;
    hasDefaultExport: boolean;
    componentNames: string[];
    importPaths: string[];
    exportTypes: string[];
    jsxElements: string[];
    hooks: string[];
    complexity: 'low' | 'medium' | 'high';
}
export interface RepairResult {
    success: boolean;
    repairedContent?: string;
    appliedFixes: string[];
    unresolvedIssues: string[];
}
export interface TokenUsageStats {
    totalInputTokens: number;
    totalOutputTokens: number;
    apiCalls: number;
    totalTokens: number;
    estimatedCost: number;
}
export interface TokenUsageLog {
    timestamp: Date;
    operation: string;
    inputTokens: number;
    outputTokens: number;
    model: string;
    cost: number;
}
export interface SessionStats {
    sessionStart: Date;
    sessionDuration: number;
    operationsPerformed: string[];
    averageTokensPerOperation: number;
    costBreakdown: {
        inputCost: number;
        outputCost: number;
        totalCost: number;
    };
}
export interface ProjectAnalytics {
    totalFiles: number;
    analyzedFiles: number;
    potentialTargets?: Array<{
        filePath: string;
        elementCount: number;
        relevanceScore?: number;
    }>;
}
export interface ComponentGenerationAnalytics {
    totalComponents: number;
    totalPages: number;
    hasRouting: boolean;
    availableForIntegration: number;
}
export interface FileAnalysisResult {
    filePath: string;
    isRelevant: boolean;
    score: number;
    reasoning: string;
    targetNodes?: ASTNode[];
}
export interface FallbackResult {
    success: boolean;
    modifiedFiles: string[];
    approach: string;
    reasoning: string;
    error?: string;
}
export interface DependencyInfo {
    file: string;
    dependencies: string[];
    dependents: string[];
    importChain: string[];
}
export interface ScopeAnalysisResult {
    scope: 'FULL_FILE' | 'TARGETED_NODES' | 'COMPONENT_ADDITION' | 'TAILWIND_CHANGE';
    reasoning: string;
    confidence: number;
    files: string[];
    estimatedComplexity: 'low' | 'medium' | 'high';
}
export interface TailwindConfigModificationRequest {
    configPath: string;
    colorChanges: ColorChange[];
    prompt: string;
    preserveStructure: boolean;
}
export interface TailwindColorConfig {
    primary: TailwindColorShades;
    secondary: TailwindColorShades;
    accent: TailwindColorShades;
    background: string;
    foreground: string;
    border: string;
    ring: string;
}
export interface TailwindColorShades {
    DEFAULT: string;
    foreground: string;
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
}
export interface TailwindModificationPlan {
    configPath: string;
    originalConfig: string;
    modifiedConfig: string;
    colorChanges: ColorChange[];
    backupCreated: boolean;
    validationPassed: boolean;
}
export interface TailwindProcessorOptions {
    preserveStructure: boolean;
    createBackup: boolean;
    validateConfig: boolean;
    industryColors?: {
        tech: {
            primary: string;
            secondary: string;
            accent: string;
        };
        healthcare: {
            primary: string;
            secondary: string;
            accent: string;
        };
        finance: {
            primary: string;
            secondary: string;
            accent: string;
        };
        ecommerce: {
            primary: string;
            secondary: string;
            accent: string;
        };
        creative: {
            primary: string;
            secondary: string;
            accent: string;
        };
    };
}
export interface ColorExtractionResult {
    detectedColors: ColorChange[];
    confidence: number;
    extractionMethod: 'pattern' | 'keyword' | 'semantic';
    suggestedApproach: 'TAILWIND_CHANGE' | 'TARGETED_NODES';
}
export interface TailwindValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    suggestions: string[];
    configStructure: {
        hasTheme: boolean;
        hasExtend: boolean;
        hasColors: boolean;
        usesVariables: boolean;
    };
}
export interface TailwindModificationSummary {
    addChange: (type: 'modified' | 'created' | 'updated', file: string, description: string, options?: any) => Promise<void>;
    getSummary: () => Promise<string>;
    getMostModifiedFiles: () => Promise<Array<{
        file: string;
        count: number;
    }>>;
}
export interface EnhancedScopeAnalysisResult {
    primaryScope: 'FULL_FILE' | 'TARGETED_NODES' | 'COMPONENT_ADDITION' | 'TAILWIND_CHANGE';
    confidence: number;
    alternatives: Array<{
        scope: 'FULL_FILE' | 'TARGETED_NODES' | 'COMPONENT_ADDITION' | 'TAILWIND_CHANGE';
        confidence: number;
        reasoning: string;
    }>;
    heuristicScore: {
        tailwindChange: number;
        targetedNodes: number;
        componentAddition: number;
        fullFile: number;
    };
    extractedData: {
        componentName?: string;
        componentType?: 'component' | 'page' | 'app';
        colorChanges?: ColorChange[];
        targetElements?: string[];
    };
    reasoning: string;
}
export interface DetailedModificationLog {
    sessionId: string;
    modifications: EnhancedModificationChange[];
    summary: {
        totalFiles: number;
        approaches: Record<'FULL_FILE' | 'TARGETED_NODES' | 'COMPONENT_ADDITION' | 'TAILWIND_CHANGE', number>;
        successRate: number;
        averageProcessingTime: number;
        mostModifiedFiles: Array<{
            file: string;
            count: number;
        }>;
    };
    timeline: Array<{
        timestamp: Date;
        event: string;
        approach: 'FULL_FILE' | 'TARGETED_NODES' | 'COMPONENT_ADDITION' | 'TAILWIND_CHANGE';
        success: boolean;
    }>;
}
export interface EnhancedModificationChange extends ModificationChange {
    processingTime?: number;
    tokenUsage?: TokenUsageStats;
    errorDetails?: {
        code: string;
        message: string;
        stack?: string;
    };
    rollbackInfo?: {
        canRollback: boolean;
        backupPath?: string;
        originalContent?: string;
    };
}
export interface PerformanceMetrics {
    processingTime: {
        scopeAnalysis: number;
        fileOperations: number;
        aiCalls: number;
        total: number;
    };
    memoryUsage: {
        peak: number;
        average: number;
        current: number;
    };
    tokenMetrics: {
        totalTokens: number;
        costEstimate: number;
        efficiency: number;
    };
    cacheMetrics: {
        hits: number;
        misses: number;
        hitRate: number;
    };
}
export type ModificationApproach = 'FULL_FILE' | 'TARGETED_NODES' | 'COMPONENT_ADDITION' | 'TAILWIND_CHANGE' | "TEXT_BASED_CHANGE";
export type ComponentType = 'component' | 'page' | 'app';
export type FileType = 'component' | 'page' | 'hook' | 'util' | 'config' | 'style' | 'test' | 'other';
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cached';
export declare const MODIFICATION_APPROACHES: readonly ["TAILWIND_CHANGE", "TARGETED_NODES", "COMPONENT_ADDITION", "FULL_FILE"];
export declare const COMPONENT_TYPES: readonly ["component", "page", "app"];
export declare const DEFAULT_TAILWIND_COLORS: {
    readonly tech: {
        readonly primary: "#3b82f6";
        readonly secondary: "#8b5cf6";
        readonly accent: "#06b6d4";
    };
    readonly healthcare: {
        readonly primary: "#10b981";
        readonly secondary: "#14b8a6";
        readonly accent: "#0ea5e9";
    };
    readonly finance: {
        readonly primary: "#1e40af";
        readonly secondary: "#f59e0b";
        readonly accent: "#6b7280";
    };
    readonly ecommerce: {
        readonly primary: "#f97316";
        readonly secondary: "#ec4899";
        readonly accent: "#a855f7";
    };
    readonly creative: {
        readonly primary: "#ef4444";
        readonly secondary: "#8b5cf6";
        readonly accent: "#06b6d4";
    };
};
export declare function isTailwindChangeScope(scope: ModificationScope): scope is ModificationScope & {
    scope: 'TAILWIND_CHANGE';
};
export declare function isComponentAdditionScope(scope: ModificationScope): scope is ModificationScope & {
    scope: 'COMPONENT_ADDITION';
};
export declare function hasColorChanges(scope: ModificationScope): scope is ModificationScope & {
    colorChanges: ColorChange[];
};
export declare function hasTailwindModification(result: ModificationResult): result is ModificationResult & {
    tailwindModification: NonNullable<ModificationResult['tailwindModification']>;
};
export interface LegacyModificationScope {
    scope: 'FULL_FILE' | 'TARGETED_NODES' | 'COMPONENT_ADDITION';
    files: string[];
    reasoning: string;
    componentName?: string;
    componentType?: 'component' | 'page' | 'app';
    dependencies?: string[];
}
export interface LegacyModificationResult {
    success: boolean;
    selectedFiles?: string[];
    addedFiles?: string[];
    error?: string;
    approach?: 'FULL_FILE' | 'TARGETED_NODES' | 'COMPONENT_ADDITION';
    reasoning?: string;
    modificationSummary?: string;
    componentGenerationResult?: ComponentGenerationResult;
    tokenUsage?: TokenUsageStats;
}
