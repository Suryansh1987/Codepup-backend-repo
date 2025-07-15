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
export interface ElementNode {
    tag: string;
    isComponent: boolean;
    children: ElementNode[];
    props?: string[];
}
export interface ImportInfo {
    name: string;
    source: string;
    type: 'default' | 'named' | 'namespace';
    isComponent: boolean;
}
export interface ExportInfo {
    name: string;
    type: 'default' | 'named';
    isComponent: boolean;
}
export interface ProjectFile {
    path: string;
    relativePath: string;
    content: string;
    lines: number;
    fileType: string;
    exportPattern?: 'default' | 'named' | 'mixed';
    importPattern?: 'default' | 'named' | 'mixed';
    elementTree?: ElementNode;
    imports?: ImportInfo[];
    exports?: ExportInfo[];
    mainComponent?: string;
    dependencies?: string[];
    isAppFile?: boolean;
    isRouteFile?: boolean;
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
    projectFiles: Map<string, ProjectFile>;
    existingRoutes: string[];
    error?: string;
}
export declare class EnhancedBabelAnalyzer {
    private componentMap;
    analyzeFile(content: string, filePath: string): {
        elementTree?: ElementNode;
        imports: ImportInfo[];
        exports: ExportInfo[];
        mainComponent?: string;
        dependencies: string[];
        isAppFile: boolean;
        isRouteFile: boolean;
        routingInfo?: {
            hasRouter: boolean;
            routeComponents: string[];
            routingLibrary?: string;
        };
    };
    private analyzeImport;
    private analyzeDefaultExport;
    private analyzeNamedExport;
    private analyzeJSXForRouting;
    private buildElementTreeFromFunction;
    private buildElementTreeFromArrow;
    private parseJSXElement;
    private createElementNode;
    private getJSXMemberExpressionName;
    private isAppFile;
    private isRouteFile;
    private isReactComponent;
    private isReactArrowComponent;
    private isComponentName;
    private isCustomComponent;
    private isComponentImport;
    getComponentMap(): Map<string, string>;
    createElementTreeSummary(filePath: string, elementTree: ElementNode): string;
    private elementTreeToString;
}
export declare class AnalysisAndGenerationEngine {
    private anthropic;
    private reactBasePath;
    private streamCallback?;
    private babelAnalyzer;
    private messageDB?;
    constructor(anthropic: any, reactBasePath: string, messageDB?: any);
    setStreamCallback(callback: (message: string) => void): void;
    private streamUpdate;
    private getProjectStructureContext;
    private scanProjectFiles;
    private scanSupabaseMigrations;
    private scanSupabaseDirectory;
    private isSupabaseRelevantFile;
    private determineSupabaseFileType;
    private scanRootConfigFiles;
    private scanMainProject;
    private logScanResults;
    private getSupabaseSchemaContext;
    private extractTableInfo;
    private analyzeComponentTypeWithContext;
    private getFullContextFromFiles;
    private generateComponentContentWithContext;
    private detectBusinessType;
    private getDesignInspiration;
    private getBusinessSpecificTailwindPatterns;
    analyzeAndGenerate(userPrompt: string, projectId?: number): Promise<GenerationResult>;
    private createElementTreeContext;
    private analyzeProjectPatterns;
    private extractExistingRoutes;
    private analyzeFilePatterns;
    private shouldSkipDirectory;
    private isRelevantFile;
    private isReactFile;
    private shouldSkipUIComponentFile;
    private determineFileType;
    refreshFileStructure(): Promise<void>;
    getProjectAnalysisSummary(): Promise<string>;
}
