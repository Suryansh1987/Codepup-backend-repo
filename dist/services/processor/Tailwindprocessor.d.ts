import Anthropic from '@anthropic-ai/sdk';
import { ModificationScope, ProjectFile, ModificationResult } from '../filemodifier/types';
export interface ColorChange {
    type: string;
    color: string;
    target?: string;
}
export interface TailwindModificationSummary {
    addChange: (type: 'modified' | 'created' | 'updated', file: string, description: string, options?: any) => Promise<void>;
    getSummary: () => Promise<string>;
    getMostModifiedFiles: () => Promise<Array<{
        file: string;
        count: number;
    }>>;
}
export declare class TailwindChangeProcessor {
    private anthropic;
    private reactBasePath;
    private streamCallback?;
    constructor(anthropic: Anthropic, reactBasePath: string);
    setStreamCallback(callback: (message: string) => void): void;
    private streamUpdate;
    /**
     * Main method to handle tailwind configuration changes
     */
    handleTailwindChange(prompt: string, scope: ModificationScope, projectFiles: Map<string, ProjectFile>, modificationSummary: TailwindModificationSummary): Promise<ModificationResult>;
    /**
     * Find existing tailwind config file
     */
    private findTailwindConfig;
    /**
     * Read current tailwind config
     */
    private readTailwindConfig;
    /**
     * Generate modified config using AI
     */
    private generateModifiedConfig;
    /**
     * Write modified config to file
     */
    private writeTailwindConfig;
    /**
     * Create new tailwind config when none exists
     */
    private createNewTailwindConfig;
    /**
     * Generate default tailwind config with custom colors
     */
    private generateDefaultTailwindConfig;
    /**
     * Convert color name to hex
     */
    private convertToHex;
    /**
     * Generate color shade variations
     */
    private generateShade;
    /**
     * Count changes between two config strings
     */
    private countConfigChanges;
}
