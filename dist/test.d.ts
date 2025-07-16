type ModificationScope = "FULL_FILE" | "TARGETED_NODES" | "COMPONENT_ADDITION" | "TAILWIND_CHANGE" | "TEXT_BASED_CHANGE";
interface ScopeResult {
    scope: ModificationScope;
    reasoning: string;
    textChangeAnalysis?: {
        searchTerm: string;
        replacementTerm: string;
        searchVariations: string[];
    };
    colorChanges?: Array<{
        type: string;
        color: string;
        target?: string;
    }>;
    componentName?: string;
    componentType?: 'component' | 'page' | 'app';
}
export declare class ScopeTest {
    private anthropic;
    constructor();
    /**
     * Test scope determination for a given prompt
     */
    testScope(prompt: string): Promise<ScopeResult>;
    /**
     * AI-based scope determination
     */
    private determineScope;
    /**
     * Parse AI response into structured result
     */
    private parseResponse;
}
export default ScopeTest;
