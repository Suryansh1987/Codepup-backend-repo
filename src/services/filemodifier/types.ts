// ============================================================================
// ENHANCED TYPES FOR NEW SCOPEANALYZER + TARGETEDNODES ARCHITECTURE
// ============================================================================

// ============================================================================
// NEW INTERFACES FOR ENHANCED SCOPE ANALYZER
// ============================================================================

export interface TargetNodeInfo {
  filePath: string;
  nodeId: string;
  reason: string;
}

export interface AnalysisNode {
  id: string;
  tagName: string;
  className?: string;
  startLine: number;
  endLine: number;
  displayText?: string;
  props?: Record<string, any>;
  isInteractive?: boolean;
}

export interface ImportInfo {
  source: string;
  importType: 'default' | 'named' | 'namespace' | 'side-effect';
  imports: string[];
  line: number;
  fullStatement: string;
}

export interface FileImportInfo {
  filePath: string;
  imports: ImportInfo[];
  hasLucideReact: boolean;
  hasReact: boolean;
  allImportSources: string[];
}

export interface FileStructureInfo {
  filePath: string;
  nodes: AnalysisNode[];
  imports?: FileImportInfo;
}

export interface TreeInformation {
  fileStructures: FileStructureInfo[];
  compactTree: string;
  totalFiles: number;
  totalNodes: number;
  totalImports: number;
}

export interface AnalysisResponse {
  needsModification: boolean;
  targetNodes: TargetNodeInfo[];
  reasoning: string;
}

// ============================================================================
// ENHANCED MODIFICATION SCOPE (UPDATED)
// ============================================================================

export interface ModificationScope {
  scope: 'FULL_FILE' | 'TARGETED_NODES' | 'COMPONENT_ADDITION' | 'TAILWIND_CHANGE' | 'TEXT_BASED_CHANGE';
  files: string[];
  reasoning: string;

  // NEW: For TARGETED_NODES (from enhanced ScopeAnalyzer)
  treeInformation?: TreeInformation;
  targetNodes?: TargetNodeInfo[];

  // Component addition specific
  componentName?: string;
  componentType?: 'component' | 'page' | 'app';
  dependencies?: string[];
  integrationLevel?: ComponentIntegrationLevel;

  // Tailwind change specific
  colorChanges?: ColorChange[];

  // Text-based change specific (ENHANCED)
  textChangeAnalysis?: {
    searchTerm: string;
    replacementTerm: string;
    searchVariations?: string[];
  };

  // Enhanced properties
  estimatedComplexity?: 'low' | 'medium' | 'high';
  requiresRouting?: boolean;
  affectedLevels?: number[];
}

// ============================================================================
// TOKEN TRACKING INTERFACES (ENHANCED)
// ============================================================================

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

export interface TokenStats {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  effectiveInputTokens?: number;
  apiCalls: number;
  averageInputPerCall: number;
  averageOutputPerCall: number;
  operationHistory?: Array<{
    operation: string;
    inputTokens: number;
    outputTokens: number;
    cacheCreation?: number;
    cacheRead?: number;
    timestamp: Date;
  }>;
}

// ============================================================================
// MODIFICATION NODE INTERFACES (for TargetedNodes)
// ============================================================================

export interface ModificationNode extends AnalysisNode {
  startColumn: number;
  endColumn: number;
  fullCode: string;
  fullAttributes: Record<string, any>;
  startPos: number;
  endPos: number;
  lineBasedStart: number;
  lineBasedEnd: number;
  originalCode: string;
  codeHash: string;
  contextBefore: string;
  contextAfter: string;
  parentNode?: {
    id: string;
    tagName: string;
    className?: string;
    startLine: number;
    endLine: number;
  };
}

export interface ModificationRequest {
  filePath: string;
  nodeId: string;
  newCode: string;
  reasoning: string;
  requiredImports?: ImportInfo[];
}

// ============================================================================
// PROCESSING RESULT INTERFACES (ENHANCED)
// ============================================================================

export interface ProcessingResult {
  success: boolean;
  projectFiles?: Map<string, ProjectFile>;
  updatedProjectFiles?: Map<string, ProjectFile>;
  changes?: Array<{
    type: string;
    file: string;
    description: string;
    success: boolean;
    details?: any;
  }>;
}

export interface FileModificationResult {
  filePath: string;
  success: boolean;
  modificationsApplied: number;
  error?: string;
}

// ============================================================================
// SCOPE DETERMINATION INTERFACES (ENHANCED)
// ============================================================================

export interface ScopeMethodResponse {
  scope: "FULL_FILE" | "TARGETED_NODES" | "COMPONENT_ADDITION" | "TAILWIND_CHANGE" | "TEXT_BASED_CHANGE";
  reasoning: string;
  componentName?: string;
  componentType?: 'component' | 'page' | 'app';
  colorChanges?: ColorChange[];
  textChangeAnalysis?: {
    searchTerm: string;
    replacementTerm: string;
    searchVariations: string[];
  };
}

// ============================================================================
// STREAM CALLBACK TYPE
// ============================================================================

export type StreamCallback = (message: string) => void;

// ============================================================================
// EXISTING INTERFACES (KEEP AS-IS)
// ============================================================================

export interface ProjectFile {
  // Basic file information
  name: string;
  path: string;
  relativePath: string;
  content: string;
  lines: number;
  size: number;
  snippet: string;
  
  // Component analysis
  componentName: string | null;
  hasButtons: boolean;
  hasSignin: boolean;
  isMainFile: boolean;
  
  // File metadata
  fileType: string; // e.g., 'tsx', 'ts', 'js', 'jsx', 'css', 'scss', 'json', 'md'
  lastModified: Date;
  encoding?: string; // e.g., 'utf8', 'ascii'
  
  // Content analysis
  imports?: string[]; // List of imported modules/libraries
  exports?: string[]; // List of exported functions/components
  dependencies?: string[]; // External dependencies used
  framework?: 'react' | 'vue' | 'angular' | 'svelte' | 'next' | 'nuxt' | 'vanilla' | null;
  
  // UI/UX detection
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
  
  // Styling information
  stylingMethod?: 'tailwind' | 'css-modules' | 'styled-components' | 'emotion' | 'sass' | 'vanilla-css' | 'none';
  hasInlineStyles?: boolean;
  cssClasses?: string[]; // List of CSS classes used
  
  // React/Component specific
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
  
  // API and data
  hasApiCalls?: boolean;
  hasFetch?: boolean;
  hasGraphQL?: boolean;
  hasDatabase?: boolean;
  dataFetching?: 'swr' | 'react-query' | 'apollo' | 'fetch' | 'axios' | 'none';
  
  // Routing
  isRoute?: boolean;
  routePath?: string;
  hasRouting?: boolean;
  
  // Configuration files
  isConfig?: boolean;
  configType?: 'webpack' | 'vite' | 'next' | 'tailwind' | 'typescript' | 'eslint' | 'package' | 'env' | null;
  
  // Testing
  isTest?: boolean;
  testFramework?: 'jest' | 'vitest' | 'cypress' | 'playwright' | 'testing-library' | null;
  
  // Performance and optimization
  hasLazyLoading?: boolean;
  hasMemoization?: boolean;
  hasVirtualization?: boolean;
  
  // Accessibility
  hasAriaLabels?: boolean;
  hasSemanticHTML?: boolean;
  accessibilityScore?: number; // 0-100
  
  // Code quality metrics
  complexity?: number; // Cyclomatic complexity
  maintainabilityIndex?: number; // 0-100
  technicalDebt?: 'low' | 'medium' | 'high';
  codeSmells?: string[]; // List of potential issues
  
  // Security
  hasSecurityIssues?: boolean;
  securityConcerns?: string[];
  
  // Internationalization
  hasI18n?: boolean;
  i18nFramework?: 'react-i18next' | 'next-i18next' | 'formatjs' | 'lingui' | null;
  
  // Build and deployment
  isBuildFile?: boolean;
  isPublic?: boolean;
  isStatic?: boolean;
  
  // Content analysis for text-based changes
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
  
  // Search optimization
  searchableText?: string; // Concatenated searchable content
  keywords?: string[]; // Extracted keywords for search
  
  // Modification tracking
  modificationHistory?: ModificationRecord[];
  
  // Analysis timestamps
  analyzedAt?: Date;
  analysisVersion?: string; // Version of analysis rules used
  
  // File relationships
  relatedFiles?: string[]; // Files that import/use this file
  childComponents?: string[]; // Components defined in this file
  parentComponents?: string[]; // Components that use this file
  
  // Performance metrics
  bundleSize?: number; // Estimated bundle size contribution
  renderTime?: number; // Estimated render time impact
  
  // Documentation
  hasDocumentation?: boolean;
  documentationQuality?: 'excellent' | 'good' | 'fair' | 'poor' | 'none';
  hasComments?: boolean;
  hasJSDoc?: boolean;
  
  // Error handling
  hasErrorBoundary?: boolean;
  hasErrorHandling?: boolean;
  errorPatterns?: string[];
  
  // State management
  stateManagement?: 'redux' | 'zustand' | 'context' | 'jotai' | 'valtio' | 'local' | 'none';
  hasGlobalState?: boolean;
  
  // Animation and interactions
  hasAnimations?: boolean;
  animationLibrary?: 'framer-motion' | 'react-spring' | 'lottie' | 'css' | 'none';
  hasInteractions?: boolean;
  
  // Mobile and responsive
  isResponsive?: boolean;
  hasMobileOptimizations?: boolean;
  breakpoints?: string[];
  
  // SEO
  hasSEO?: boolean;
  hasMetaTags?: boolean;
  hasStructuredData?: boolean;
  seoScore?: number; // 0-100
}

// Modification record for tracking changes
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

// Color change interface for TAILWIND_CHANGE scope
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
  approach?: 'FULL_FILE' | 'TARGETED_NODES' | 'COMPONENT_ADDITION' | 'TAILWIND_CHANGE' | 'TEXT_BASED_CHANGE';
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

  // Hybrid search stats
  hybridStats?: {
    filesScanned: number;
    nodesExtracted: number;
    batchesProcessed: number;
    totalBatches: number;
    strategy: string;
    processingTime: string;
  };

  // Optional: for returning full Claude batch output
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

// Integration strategies
export interface IntegrationStrategy {
  type: 'component-to-component' | 'component-to-page' | 'page-to-app';
  targetFile: string;
  method: 'import-and-use' | 'route-addition' | 'children-prop';
  confidence: number;
  reasoning: string;
}

// Enhanced AST node interface for component generation
export interface ComponentASTNode extends ASTNode {
  canAcceptNewChildren: boolean;
  componentType: 'container' | 'leaf' | 'layout';
  integrationPoints: Array<{
    line: number;
    type: 'children' | 'sibling' | 'wrapper';
    suitability: number;
  }>;
}

// Validation and structure interfaces
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

// Token tracking interfaces
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

// Project analytics interfaces
export interface ProjectAnalytics {
  totalFiles: number;
  analyzedFiles: number;
  potentialTargets?: Array<{
    filePath: string;
    elementCount: number;
    relevanceScore?: number;
  }>;
}

// Component generation analytics
export interface ComponentGenerationAnalytics {
  totalComponents: number;
  totalPages: number;
  hasRouting: boolean;
  availableForIntegration: number;
}

// File analysis result for forced analysis
export interface FileAnalysisResult {
  filePath: string;
  isRelevant: boolean;
  score: number;
  reasoning: string;
  targetNodes?: ASTNode[];
}

// Fallback mechanism interfaces
export interface FallbackResult {
  success: boolean;
  modifiedFiles: string[];
  approach: string;
  reasoning: string;
  error?: string;
}

// Dependency management interfaces
export interface DependencyInfo {
  file: string;
  dependencies: string[];
  dependents: string[];
  importChain: string[];
}

// Scope analysis interfaces
export interface ScopeAnalysisResult {
  scope: 'FULL_FILE' | 'TARGETED_NODES' | 'COMPONENT_ADDITION' | 'TAILWIND_CHANGE' | 'TEXT_BASED_CHANGE';
  reasoning: string;
  confidence: number;
  files: string[];
  estimatedComplexity: 'low' | 'medium' | 'high';
}

// ============================================================================
// TAILWIND-SPECIFIC TYPES AND INTERFACES
// ============================================================================

// Tailwind configuration modification interfaces
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
    tech: { primary: string; secondary: string; accent: string };
    healthcare: { primary: string; secondary: string; accent: string };
    finance: { primary: string; secondary: string; accent: string };
    ecommerce: { primary: string; secondary: string; accent: string };
    creative: { primary: string; secondary: string; accent: string };
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

// Enhanced modification tracking for Tailwind changes
export interface TailwindModificationSummary {
  addChange: (type: 'modified' | 'created' | 'updated', file: string, description: string, options?: any) => Promise<void>;
  getSummary: () => Promise<string>;
  getMostModifiedFiles: () => Promise<Array<{ file: string; count: number }>>;
}

// ============================================================================
// ENHANCED ANALYSIS AND PERFORMANCE TRACKING
// ============================================================================

export interface EnhancedScopeAnalysisResult {
  primaryScope: 'FULL_FILE' | 'TARGETED_NODES' | 'COMPONENT_ADDITION' | 'TAILWIND_CHANGE' | 'TEXT_BASED_CHANGE';
  confidence: number;
  alternatives: Array<{
    scope: 'FULL_FILE' | 'TARGETED_NODES' | 'COMPONENT_ADDITION' | 'TAILWIND_CHANGE' | 'TEXT_BASED_CHANGE';
    confidence: number;
    reasoning: string;
  }>;
  heuristicScore: {
    tailwindChange: number;
    targetedNodes: number;
    componentAddition: number;
    fullFile: number;
    textBasedChange: number;
  };
  extractedData: {
    componentName?: string;
    componentType?: 'component' | 'page' | 'app';
    colorChanges?: ColorChange[];
    targetElements?: string[];
    textChangeAnalysis?: {
      searchTerm: string;
      replacementTerm: string;
      searchVariations: string[];
    };
  };
  reasoning: string;
}

export interface DetailedModificationLog {
  sessionId: string;
  modifications: EnhancedModificationChange[];
  summary: {
    totalFiles: number;
    approaches: Record<'FULL_FILE' | 'TARGETED_NODES' | 'COMPONENT_ADDITION' | 'TAILWIND_CHANGE' | 'TEXT_BASED_CHANGE', number>;
    successRate: number;
    averageProcessingTime: number;
    mostModifiedFiles: Array<{ file: string; count: number }>;
  };
  timeline: Array<{
    timestamp: Date;
    event: string;
    approach: 'FULL_FILE' | 'TARGETED_NODES' | 'COMPONENT_ADDITION' | 'TAILWIND_CHANGE' | 'TEXT_BASED_CHANGE';
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
    efficiency: number; // tokens per successful modification
  };
  cacheMetrics: {
    hits: number;
    misses: number;
    hitRate: number;
  };
}

// ============================================================================
// UTILITY TYPES AND CONSTANTS
// ============================================================================

// Type aliases for better compatibility
export type ModificationApproach = 'FULL_FILE' | 'TARGETED_NODES' | 'COMPONENT_ADDITION' | 'TAILWIND_CHANGE' | "TEXT_BASED_CHANGE"
export type ComponentType = 'component' | 'page' | 'app';
export type FileType = 'component' | 'page' | 'hook' | 'util' | 'config' | 'style' | 'test' | 'other';
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cached';

// Constants for modification approaches
export const MODIFICATION_APPROACHES = [
  'TEXT_BASED_CHANGE',
  'TAILWIND_CHANGE',
  'TARGETED_NODES', 
  'COMPONENT_ADDITION',
  'FULL_FILE'
] as const;

export const COMPONENT_TYPES = ['component', 'page', 'app'] as const;

// Default color configurations for different industries
export const DEFAULT_TAILWIND_COLORS = {
  tech: {
    primary: '#3b82f6',
    secondary: '#8b5cf6', 
    accent: '#06b6d4'
  },
  healthcare: {
    primary: '#10b981',
    secondary: '#14b8a6',
    accent: '#0ea5e9'
  },
  finance: {
    primary: '#1e40af',
    secondary: '#f59e0b',
    accent: '#6b7280'
  },
  ecommerce: {
    primary: '#f97316',
    secondary: '#ec4899',
    accent: '#a855f7'
  },
  creative: {
    primary: '#ef4444',
    secondary: '#8b5cf6',
    accent: '#06b6d4'
  }
} as const;

// ============================================================================
// TYPE GUARDS AND HELPER FUNCTIONS
// ============================================================================

export function isTailwindChangeScope(scope: ModificationScope): scope is ModificationScope & { scope: 'TAILWIND_CHANGE' } {
  return scope.scope === 'TAILWIND_CHANGE';
}

export function isTargetedNodesScope(scope: ModificationScope): scope is ModificationScope & { 
  scope: 'TARGETED_NODES';
  treeInformation: TreeInformation;
  targetNodes: TargetNodeInfo[];
} {
  return scope.scope === 'TARGETED_NODES' && !!scope.treeInformation && !!scope.targetNodes;
}

export function isComponentAdditionScope(scope: ModificationScope): scope is ModificationScope & { scope: 'COMPONENT_ADDITION' } {
  return scope.scope === 'COMPONENT_ADDITION';
}

export function isTextBasedChangeScope(scope: ModificationScope): scope is ModificationScope & { 
  scope: 'TEXT_BASED_CHANGE';
  textChangeAnalysis: {
    searchTerm: string;
    replacementTerm: string;
    searchVariations?: string[];
  };
} {
  return scope.scope === 'TEXT_BASED_CHANGE' && !!scope.textChangeAnalysis;
}

export function hasColorChanges(scope: ModificationScope): scope is ModificationScope & { colorChanges: ColorChange[] } {
  return scope.scope === 'TAILWIND_CHANGE' && !!scope.colorChanges;
}

export function hasTargetNodes(scope: ModificationScope): scope is ModificationScope & { 
  targetNodes: TargetNodeInfo[];
  treeInformation: TreeInformation;
} {
  return scope.scope === 'TARGETED_NODES' && !!scope.targetNodes && !!scope.treeInformation;
}

export function hasTextChangeAnalysis(scope: ModificationScope): scope is ModificationScope & {
  textChangeAnalysis: {
    searchTerm: string;
    replacementTerm: string;
    searchVariations?: string[];
  };
} {
  return scope.scope === 'TEXT_BASED_CHANGE' && !!scope.textChangeAnalysis;
}

export function hasTailwindModification(result: ModificationResult): result is ModificationResult & { tailwindModification: NonNullable<ModificationResult['tailwindModification']> } {
  return result.approach === 'TAILWIND_CHANGE' && !!result.tailwindModification;
}

// ============================================================================
// HELPER TYPES FOR PROJECT FILE FILTERING
// ============================================================================

// Helper types for file filtering and querying
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

// Query builder for advanced file searches
export interface ProjectFileQuery {
  filter?: ProjectFileFilter;
  sortBy?: 'name' | 'size' | 'lines' | 'lastModified' | 'complexity' | 'maintainabilityIndex';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  includeContent?: boolean;
  searchableFields?: ('name' | 'content' | 'textContent' | 'keywords')[];
}

// Analysis result for project overview
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

// Text search result for TEXT_BASED_CHANGE operations
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

// Export utility functions type
export type ProjectFileUtils = {
  filterFiles: (files: ProjectFile[], filter: ProjectFileFilter) => ProjectFile[];
  searchText: (files: ProjectFile[], searchTerm: string) => TextSearchResult[];
  analyzeProject: (files: ProjectFile[]) => ProjectAnalysis;
  suggestTargetFiles: (searchTerm: string, files: ProjectFile[]) => string[];
  extractTextContent: (content: string, fileType: string) => ProjectFile['textContent'];
};

// ============================================================================
// BACKWARD COMPATIBILITY TYPES
// ============================================================================

// Legacy compatibility - for backward compatibility with existing code
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

// ============================================================================
// ENHANCED PROCESSOR INTERFACES
// ============================================================================

// Interface for processors that support the new architecture
export interface EnhancedProcessor {
  setStreamCallback(callback: StreamCallback): void;
  getTokenTracker?(): any;
  process?(
    prompt: string,
    projectFiles: Map<string, ProjectFile>,
    reactBasePath: string,
    streamCallback: StreamCallback,
    additionalData?: any
  ): Promise<ProcessingResult>;
}

// Interface for ScopeAnalyzer with enhanced capabilities
export interface EnhancedScopeAnalyzer extends EnhancedProcessor {
  analyzeScope(
    prompt: string,
    projectSummary?: string,
    conversationContext?: string,
    dbSummary?: string,
    projectFiles?: Map<string, ProjectFile>
  ): Promise<ModificationScope>;
  
  getTokenStats(): TokenStats;
  getTokenReport(): string;
}

// Interface for TargetedNodes processor (simplified)
export interface SimplifiedTargetedNodesProcessor extends EnhancedProcessor {
  processTargetedModification(
    prompt: string,
    projectFiles: Map<string, ProjectFile>,
    reactBasePath: string,
    streamCallback: StreamCallback,
    treeInformation?: TreeInformation,
    targetNodes?: TargetNodeInfo[]
  ): Promise<ProcessingResult>;
}

// ============================================================================
// CONFIGURATION AND SETTINGS
// ============================================================================

export interface ProcessorConfiguration {
  // Global settings
  reactBasePath: string;
  sessionId: string;
  
  // AI settings
  anthropicApiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  
  // Feature flags
  enableEnhancedScopeAnalysis?: boolean;
  enableTreeCaching?: boolean;
  enableTokenTracking?: boolean;
  enableDetailedLogging?: boolean;
  
  // Performance settings
  batchSize?: number;
  concurrencyLimit?: number;
  cacheTimeout?: number;
  
  // Processing options
  fallbackToFullFile?: boolean;
  validateResults?: boolean;
  createBackups?: boolean;
  
  // Tailwind specific
  tailwindConfigPath?: string;
  tailwindIndustry?: keyof typeof DEFAULT_TAILWIND_COLORS;
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

export interface ProcessingError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
  operation?: string;
  processor?: string;
  stackTrace?: string;
}

export interface ErrorRecoveryOptions {
  retryCount?: number;
  fallbackProcessor?: string;
  skipValidation?: boolean;
  useCache?: boolean;
}

// ============================================================================
// EXPORT ALL TYPES
// ============================================================================

