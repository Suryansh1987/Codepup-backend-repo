import { ProjectFile } from './types';
export declare class DependencyManager {
    private projectFiles;
    private streamCallback?;
    constructor(projectFiles: Map<string, ProjectFile>);
    setStreamCallback(callback: (message: string) => void): void;
    private streamUpdate;
    /**
     * Plan dependency updates for a new component
     */
    planDependencyUpdates(newComponentPath: string, componentName: string, componentType: 'component' | 'page' | 'app'): Promise<string[]>;
    /**
     * Get modification order based on dependency hierarchy
     */
    getModificationOrder(files: string[]): string[];
    /**
     * Analyze import relationships between files
     */
    analyzeImportRelationships(): Map<string, string[]>;
    /**
     * Find circular dependencies in the project
     */
    findCircularDependencies(): Array<{
        cycle: string[];
        severity: 'warning' | 'error';
    }>;
    /**
     * Calculate dependency depth for each file
     */
    calculateDependencyDepth(): Map<string, number>;
    /**
     * Find potential parent components for a new component
     */
    private findPotentialParentComponents;
    /**
     * Find layout-related components
     */
    private findLayoutComponents;
    /**
     * Determine if a file might need a new component
     */
    private mightNeedComponent;
    /**
     * Check for semantic relationships between content and component
     */
    private hasSemanticRelationship;
    /**
     * Extract import statements from file content
     */
    private extractImports;
    /**
     * Get file type based on path and content
     */
    private getFileType;
    /**
     * Get directory type from file path
     */
    private getDirectoryType;
    /**
     * Generate import statement for a component
     */
    generateImportStatement(componentName: string, componentPath: string, targetFilePath: string, isDefaultImport?: boolean): string;
    /**
     * Calculate relative path between two files
     */
    private calculateRelativePath;
    /**
     * Validate that all dependencies can be resolved
     */
    validateDependencies(): Array<{
        file: string;
        missingDependencies: string[];
    }>;
    /**
     * Check if an import can be resolved
     */
    private canResolveImport;
    /**
     * Resolve import path to absolute project path
     */
    private resolveImportPath;
    /**
     * Get dependency statistics for the project
     */
    getDependencyStats(): {
        totalFiles: number;
        averageImportsPerFile: number;
        mostImportedFiles: Array<{
            file: string;
            importCount: number;
        }>;
        filesWithMostImports: Array<{
            file: string;
            importCount: number;
        }>;
        circularDependencies: number;
    };
}
