export declare class ClaudeFunctionService {
    private client;
    constructor();
    analyzeDesign(userPrompt: string, userId: string, imageData?: Array<{
        buffer: Buffer;
        mimetype: string;
        originalname: string;
        size: number;
        estimatedTokens: number;
    }>): Promise<any>;
    private buildVisionPrompt;
    private buildVisionSystemPrompt;
    handleUserFeedback(feedback: string, userId: string, currentDesign: any): Promise<any>;
    generateDesignFiles(finalDesign: any, userId: string): Promise<any>;
    generateFileStructurePlan(designChoices: any, userId: string): Promise<any>;
    updateDocumentationWithStructure(designChoices: any, structurePlan: any, userId: string): Promise<any>;
    generateBackendFiles(designChoices: any, structurePlan: any, userId: string): Promise<any>;
    generateFrontendFiles(designChoices: any, fileStructure: any, backendFiles: any, userId: string): Promise<any>;
    private handleFunctionCall;
}
