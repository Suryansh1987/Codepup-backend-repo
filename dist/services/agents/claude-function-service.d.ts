export declare class ClaudeFunctionService {
    private client;
    constructor();
    analyzeDesign(userPrompt: string, userId: string): Promise<any>;
    handleUserFeedback(feedback: string, userId: string, currentDesign: any): Promise<any>;
    generateDesignFiles(finalDesign: any, userId: string): Promise<any>;
    generateFileStructurePlan(designChoices: any, userId: string): Promise<any>;
    updateDocumentationWithStructure(designChoices: any, structurePlan: any, userId: string): Promise<any>;
    generateBackendFiles(designChoices: any, structurePlan: any, userId: string): Promise<any>;
    private handleFunctionCall;
}
