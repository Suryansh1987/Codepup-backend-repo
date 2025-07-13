interface AnalysisResult {
    files_to_modify?: string[];
    files_to_create?: string[];
    reasoning?: string;
    dependencies?: string[];
    notes?: string;
}
interface FileContent {
    path: string;
    content: string | null;
    type: "modify" | "create";
    exists: boolean;
}
interface ParseResult {
    success: boolean;
    files: FileContent[];
    metadata: {
        total_files: number;
        files_to_modify: number;
        files_to_create: number;
        reasoning?: string;
        dependencies?: string[];
        notes?: string;
        timestamp: string;
    };
}
export declare class FileContentParser {
    private projectRoot;
    constructor(projectRoot: string);
    parseFromAnalysis(analysisResult: AnalysisResult): Promise<ParseResult>;
    readFileContent(filePath: string): Promise<string | null>;
    fileExists(filePath: string): Promise<boolean>;
}
export {};
