// ============================================================================
// STEP 2: ENHANCED INTEGRATION ENGINE WITH PROPER NAMING & ROUTE DETECTION
// ============================================================================

import { join, dirname, resolve } from 'path';
import { promises as fs } from 'fs';
import { 
  GenerationResult, 
  ProjectFile, 
  ComponentTypeAnalysis 
} from '../filemodifier/component_analysis';

export interface NavigationLinkAnalysis {
  link: string;
  type: 'page-route' | 'in-page-section' | 'external' | 'unknown';
  isPageRoute: boolean;
  isInPageSection: boolean;
  normalizedPath?: string; // Added for route comparison
  displayName?: string;    // Added for display name extraction
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
  existingRoutes: string[]; // NEW: Normalized route paths for comparison
  hasMatchingRoute?: boolean; // NEW: If component route already exists
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
  existingPageRoutes: string[]; // NEW: All existing page routes found in navigation
  routeAlreadyExists: boolean;  // NEW: If the component route already exists
  matchingNavigationFile?: string; // NEW: Which nav file already has the route
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
  skipReason?: string; // NEW: Why this integration step was skipped
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
  componentDisplayName: string; // NEW: Clean display name for UI
  componentRoutePath: string;   // NEW: Clean route path
}

export interface IntegrationResult {
  success: boolean;
  createdFiles: string[];
  modifiedFiles: string[];
  skippedFiles: string[]; // NEW: Files that were skipped with reasons
  integrationResults: {
    routingUpdated: boolean;
    appFileUpdated: boolean;
    navigationUpdated: boolean;
    headerUpdated: boolean;
    footerUpdated: boolean;
    dependenciesResolved: boolean;
    usageExampleAdded: boolean;
    pagesUpdated: string[];
    routeAlreadyExisted: boolean; // NEW: If route was already present
    navigationAlreadyExists: boolean; // NEW: If nav link already exists
  };
  error?: string;
  warnings?: string[]; // NEW: Non-fatal warnings
}

// ============================================================================
// ENHANCED INTEGRATION ENGINE
// ============================================================================

export class IntegrationEngine {
  private anthropic: any;
  private reactBasePath: string;
  private streamCallback?: (message: string) => void;

  constructor(anthropic: any, reactBasePath: string) {
    this.anthropic = anthropic;
    this.reactBasePath = resolve(reactBasePath);
  }

  setStreamCallback(callback: (message: string) => void): void {
    this.streamCallback = callback;
  }

  private streamUpdate(message: string): void {
    if (this.streamCallback) {
      this.streamCallback(message);
    }
    console.log(message);
  }

  /**
   * 🔥 NEW: GENERATE CLEAN COMPONENT NAMES AND PATHS
   */
  private generateCleanNaming(componentType: ComponentTypeAnalysis, userPrompt: string): {
    displayName: string;
    routePath: string;
    fileName: string;
  } {
    const originalName = componentType.name;
    
    // 🔥 FIX: Remove "Page" suffix and common redundant words
    let cleanName = originalName
      .replace(/Page$/i, '')           // ContactPage -> Contact
      .replace(/Component$/i, '')      // HeaderComponent -> Header
      .replace(/Section$/i, '')        // AboutSection -> About
      .replace(/View$/i, '')           // ProfileView -> Profile
      .replace(/^(.)/, (match) => match.toUpperCase()); // Ensure first letter is capitalized

    // Extract meaningful names from user prompt if available
    const promptWords = userPrompt
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !['page', 'component', 'create', 'make', 'build', 'add'].includes(word));
    
    // If user prompt has meaningful words, use the first one as basis
    if (promptWords.length > 0 && !cleanName.toLowerCase().includes(promptWords[0])) {
      const promptBasedName = promptWords[0].charAt(0).toUpperCase() + promptWords[0].slice(1);
      // Only use prompt-based name if it's different and meaningful
      if (promptBasedName.length > 2) {
        cleanName = promptBasedName;
      }
    }

    // Generate clean route path (lowercase, no special chars)
    const routePath = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '');

    // File name should match the clean component name
    const fileName = `${cleanName}.${componentType.fileExtension || 'tsx'}`;

    return {
      displayName: cleanName,
      routePath,
      fileName
    };
  }

  /**
   * 🔥 ENHANCED: ANALYZE NAVIGATION WITH SMART ROUTE DETECTION & IN-PAGE UPGRADE
   */
  private async analyzeNavigation(
    projectFiles: Map<string, ProjectFile>,
    targetRoutePath: string,
    cleanDisplayName: string
  ): Promise<NavigationAnalysis> {
    const navigationFiles: NavigationFileInfo[] = [];
    const allExistingLinks: string[] = [];
    const existingPageRoutes: string[] = [];
    
    let hasHeader = false;
    let hasFooter = false;
    let hasNavbar = false;
    let headerCanAddPages = true;
    let shouldUpdateAppOnly = false;
    let routeAlreadyExists = false;
    let matchingNavigationFile: string | undefined;
    let hasInPageNavigation = false;
    let inPageNavigationFiles: string[] = [];

    // Navigation file patterns with their types and priorities
    const navPatterns = [
      { 
        patterns: [
          'src/components/Header.tsx', 'src/components/Header.jsx', 
          'src/components/layout/Header.tsx', 'src/layout/Header.tsx', 
          'Header.tsx', 'src/Header.tsx'
        ], 
        type: 'header' as const, 
        priority: 1 
      },
      { 
        patterns: [
          'src/components/Navbar.tsx', 'src/components/Navbar.jsx', 
          'src/components/layout/Navbar.tsx', 'src/layout/Navbar.tsx', 
          'Navbar.tsx'
        ], 
        type: 'navbar' as const, 
        priority: 2 
      },
      { 
        patterns: [
          'src/components/Navigation.tsx', 'src/components/Navigation.jsx', 
          'src/components/ui/navigation.tsx', 'Navigation.tsx'
        ], 
        type: 'custom' as const, 
        priority: 3 
      },
      { 
        patterns: [
          'src/components/Footer.tsx', 'src/components/Footer.jsx', 
          'src/components/layout/Footer.tsx', 'src/components/ui/footer.tsx', 
          'src/layout/Footer.tsx', 'Footer.tsx'
        ], 
        type: 'footer' as const, 
        priority: 4 
      },
      { 
        patterns: ['src/components/Sidebar.tsx', 'src/components/Sidebar.jsx'], 
        type: 'sidebar' as const, 
        priority: 5 
      },
      { 
        patterns: ['src/components/Menu.tsx', 'src/components/Menu.jsx'], 
        type: 'menu' as const, 
        priority: 6 
      }
    ];

    // Check each pattern group
    for (const patternGroup of navPatterns) {
      for (const pattern of patternGroup.patterns) {
        if (projectFiles.has(pattern)) {
          const file = projectFiles.get(pattern);
          if (file?.content) {
            const hasNavLinks = this.hasNavigationLinks(file.content);
            
            if (hasNavLinks) {
              const existingLinks = this.extractNavigationLinks(file.content);
              
              // 🔥 ENHANCED: Analyze each link with route detection
              const linkAnalysis = this.analyzeNavigationLinks(file.content, existingLinks);
              const pageRouteCount = linkAnalysis.filter(l => l.isPageRoute).length;
              const inPageSectionCount = linkAnalysis.filter(l => l.isInPageSection).length;
              
              // 🔥 NEW: Extract all normalized routes from this nav file
              const existingRoutes = linkAnalysis
                .filter(l => l.isPageRoute && l.normalizedPath)
                .map(l => l.normalizedPath!);
              
              // 🔥 NEW: Check if target route already exists in this nav file
              const hasMatchingRoute = existingRoutes.includes(targetRoutePath) || 
                                     existingRoutes.some(route => 
                                       route.includes(targetRoutePath) || 
                                       targetRoutePath.includes(route)
                                     );
              
              if (hasMatchingRoute) {
                routeAlreadyExists = true;
                matchingNavigationFile = pattern;
              }
              
              // Add to global route list
              existingRoutes.forEach(route => {
                if (!existingPageRoutes.includes(route)) {
                  existingPageRoutes.push(route);
                }
              });
              
              const canAddMorePages = pageRouteCount < 6 && !hasMatchingRoute;
              const needsRouteUpdate = canAddMorePages && !hasMatchingRoute;
              
              const navFileInfo: NavigationFileInfo = {
                filePath: pattern,
                type: patternGroup.type,
                priority: patternGroup.priority,
                existingLinks,
                linkAnalysis,
                pageRouteCount,
                inPageSectionCount,
                canAddMorePages,
                needsRouteUpdate,
                existingRoutes,
                hasMatchingRoute
              };
              
              navigationFiles.push(navFileInfo);

              if (patternGroup.type === 'header') {
                hasHeader = true;
                headerCanAddPages = canAddMorePages;
                shouldUpdateAppOnly = !canAddMorePages || hasMatchingRoute;
              }
              if (patternGroup.type === 'footer') hasFooter = true;
              if (patternGroup.type === 'navbar') hasNavbar = true;

              existingLinks.forEach(link => {
                if (!allExistingLinks.includes(link)) {
                  allExistingLinks.push(link);
                }
              });

              break; // Only take the first match from each pattern group
            }
          }
        }
      }
    }

    navigationFiles.sort((a, b) => a.priority - b.priority);

    return {
      hasNavigation: navigationFiles.length > 0,
      navigationFiles,
      hasHeader,
      hasFooter,
      hasNavbar,
      existingLinks: allExistingLinks,
      headerCanAddPages,
      shouldUpdateAppOnly,
      existingPageRoutes,
      routeAlreadyExists,
      matchingNavigationFile
    };
  }

  /**
   * 🔥 ENHANCED: ANALYZE NAVIGATION LINKS WITH BETTER ROUTE DETECTION
   */
  private analyzeNavigationLinks(fileContent: string, links: string[]): NavigationLinkAnalysis[] {
    return links.map(link => {
      const analysis: NavigationLinkAnalysis = {
        link,
        type: 'unknown',
        isPageRoute: false,
        isInPageSection: false
      };

      // 1. Check if it's an external link
      if (link.startsWith('http://') || link.startsWith('https://')) {
        analysis.type = 'external';
        return analysis;
      }

      // 2. Hash links are ALWAYS in-page sections
      if (link.startsWith('#')) {
        analysis.type = 'in-page-section';
        analysis.isInPageSection = true;
        return analysis;
      }

      // 3. Check if it's a page route pattern
      const pageRoutePatterns = [
        /^\/[a-zA-Z][a-zA-Z0-9-_]*$/, // /about, /contact, /services
        /^\/[a-zA-Z][a-zA-Z0-9-_]*\/[a-zA-Z0-9-_]*$/, // /products/laptop
        /^\.\//,  // ./about
        /^\/pages\//  // /pages/about
      ];

      const isPageRoute = pageRoutePatterns.some(pattern => pattern.test(link));
      
      if (isPageRoute) {
        analysis.type = 'page-route';
        analysis.isPageRoute = true;
        
        // 🔥 NEW: Generate normalized path for comparison
        analysis.normalizedPath = this.normalizeRoutePath(link);
        
        // 🔥 NEW: Extract display name from navigation context
        analysis.displayName = this.extractDisplayNameFromNavigation(fileContent, link);
        
        return analysis;
      }

      // 4. Additional context analysis
      const linkUsageContext = this.getLinkUsageContext(fileContent, link);
      
      if (linkUsageContext.hasScrollBehavior || linkUsageContext.hasScrollIntoView) {
        analysis.type = 'in-page-section';
        analysis.isInPageSection = true;
        return analysis;
      }

      if (linkUsageContext.hasRouterContext || linkUsageContext.hasNavigateFunction) {
        analysis.type = 'page-route';
        analysis.isPageRoute = true;
        analysis.normalizedPath = this.normalizeRoutePath(link);
        analysis.displayName = this.extractDisplayNameFromNavigation(fileContent, link);
        return analysis;
      }

      // 5. Default classification
      if (link.startsWith('/') && !link.includes('#')) {
        analysis.type = 'page-route';
        analysis.isPageRoute = true;
        analysis.normalizedPath = this.normalizeRoutePath(link);
        analysis.displayName = this.extractDisplayNameFromNavigation(fileContent, link);
      } else {
        analysis.type = 'in-page-section';
        analysis.isInPageSection = true;
      }

      return analysis;
    });
  }

  /**
   * 🔥 NEW: NORMALIZE ROUTE PATH FOR COMPARISON
   */
  private normalizeRoutePath(path: string): string {
    return path
      .replace(/^\/+/, '')  // Remove leading slashes
      .replace(/\/+$/, '')  // Remove trailing slashes
      .replace(/^\.\//, '') // Remove relative path prefix
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ''); // Remove special chars for comparison
  }

  /**
   * 🔥 NEW: EXTRACT DISPLAY NAME FROM NAVIGATION CONTEXT
   */
  private extractDisplayNameFromNavigation(fileContent: string, link: string): string {
    // Look for the text content associated with this link
    const lines = fileContent.split('\n');
    
    for (const line of lines) {
      if (line.includes(link)) {
        // Try to extract text content from JSX
        const textMatch = line.match(/>([^<]+)</);
        if (textMatch && textMatch[1].trim().length > 0) {
          return textMatch[1].trim();
        }
        
        // Try to extract from attributes like aria-label or title
        const ariaMatch = line.match(/aria-label=["']([^"']+)["']/);
        if (ariaMatch) {
          return ariaMatch[1];
        }
        
        const titleMatch = line.match(/title=["']([^"']+)["']/);
        if (titleMatch) {
          return titleMatch[1];
        }
      }
    }
    
    // Fallback: generate from path
    return link
      .replace(/^\/+/, '')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * GET CONTEXT AROUND HOW A LINK IS USED
   */
  private getLinkUsageContext(fileContent: string, link: string): {
    hasScrollBehavior: boolean;
    hasScrollIntoView: boolean;
    hasRouterContext: boolean;
    hasNavigateFunction: boolean;
  } {
    const lines = fileContent.split('\n');
    const linkLines = lines.filter(line => line.includes(link));
    
    let hasScrollBehavior = false;
    let hasScrollIntoView = false;
    let hasRouterContext = false;
    let hasNavigateFunction = false;

    linkLines.forEach(line => {
      if (line.includes('scroll') || line.includes('Scroll')) {
        hasScrollBehavior = true;
      }
      if (line.includes('scrollIntoView')) {
        hasScrollIntoView = true;
      }
      if (line.includes('navigate') || line.includes('Navigate')) {
        hasNavigateFunction = true;
      }
    });

    if (fileContent.includes('react-router') || 
        fileContent.includes('useNavigate') || 
        fileContent.includes('Link from') ||
        fileContent.includes('NavLink')) {
      hasRouterContext = true;
    }

    return {
      hasScrollBehavior,
      hasScrollIntoView,
      hasRouterContext,
      hasNavigateFunction
    };
  }

  /**
   * 🔥 ENHANCED: CREATE INTEGRATION PLAN WITH SMART NAMING AND ROUTE DETECTION
   */
  private async createIntegrationPlan(generationResult: GenerationResult, userPrompt: string = ''): Promise<IntegrationAnalysis> {
    const { componentType, projectPatterns, existingRoutes, componentMap, projectFiles } = generationResult;

    // 🔥 NEW: Generate clean naming
    const cleanNaming = this.generateCleanNaming(componentType, userPrompt);
    
    this.streamUpdate(`🎨 Clean naming generated:`);
    this.streamUpdate(`   Original: ${componentType.name} -> Clean: ${cleanNaming.displayName}`);
    this.streamUpdate(`   Route: /${cleanNaming.routePath}`);
    this.streamUpdate(`   File: ${cleanNaming.fileName}`);

    // Determine if this is truly a page or component
    const isPageComponent = componentType.type === 'page';

    // Always include tailwind config
    const integrationFiles: IntegrationPlan[] = [
      {
        filePath: 'tailwind.config.js',
        exists: this.fileExists('tailwind.config.js', projectFiles),
        purpose: 'Styling configuration',
        required: true,
        priority: 2,
        integrationType: 'config'
      }
    ];

    const warnings: string[] = [];

    if (isPageComponent) {
      // 🔥 ENHANCED: PAGE INTEGRATION WITH ROUTE DETECTION
      this.streamUpdate('   🎯 PAGE Integration: Checking existing routes...');
      
      // 🔥 NEW: Analyze navigation with route detection
      const navigationAnalysis = await this.analyzeNavigation(projectFiles, cleanNaming.routePath, cleanNaming.displayName);
      
      if (navigationAnalysis.routeAlreadyExists) {
        this.streamUpdate(`   ⚠️  Route /${cleanNaming.routePath} already exists in ${navigationAnalysis.matchingNavigationFile}`);
        this.streamUpdate(`   🎯 Strategy: Create component only, skip navigation updates`);
        warnings.push(`Route /${cleanNaming.routePath} already exists in navigation - component will be created but navigation won't be modified`);
        
        // Only add App.tsx routing if needed
        if (projectPatterns.appFilePath && !existingRoutes.includes(`/${cleanNaming.routePath}`)) {
          integrationFiles.push({
            filePath: projectPatterns.appFilePath,
            exists: true,
            purpose: 'Add routing for new page (route exists in nav but missing from router)',
            required: true,
            priority: 3,
            integrationType: 'routing'
          });
        } else {
          integrationFiles.push({
            filePath: projectPatterns.appFilePath || 'App.tsx',
            exists: false,
            purpose: 'Route already exists in navigation',
            required: false,
            priority: 999,
            integrationType: 'routing',
            skipReason: 'Route already exists in navigation and routing'
          });
        }
      } else {
        // Normal page integration
        if (projectPatterns.appFilePath) {
          integrationFiles.push({
            filePath: projectPatterns.appFilePath,
            exists: true,
            purpose: 'Add routing for new page',
            required: true,
            priority: 3,
            integrationType: 'routing'
          });
        }

        // Add navigation integration based on capacity
        if (navigationAnalysis.hasNavigation && !navigationAnalysis.shouldUpdateAppOnly) {
          navigationAnalysis.navigationFiles.forEach((navFile, index) => {
            if (navFile.needsRouteUpdate) {
              integrationFiles.push({
                filePath: navFile.filePath,
                exists: true,
                purpose: `Add navigation link in ${navFile.type} component`,
                required: navFile.type === 'header' || navFile.type === 'footer',
                priority: 4 + index,
                integrationType: 'navigation',
                navigationFileType: navFile.type
              });
            }
          });
        } else if (navigationAnalysis.shouldUpdateAppOnly) {
          this.streamUpdate('   🛑 Header is full (6+ routes) - Skipping navigation updates, App.tsx only');
        }
      }

      return {
        mainComponentFile: {
          filePath: `${componentType.targetDirectory}/${cleanNaming.fileName}`,
          exists: false,
          purpose: `Main ${componentType.type} file`,
          required: true,
          priority: 1,
          integrationType: 'creation'
        },
        integrationFiles,
        navigationAnalysis,
        usageAnalysis: { hasPages: false, pageFiles: [], targetPages: [] },
        projectPatterns,
        existingRoutes,
        componentMap,
        isPageComponent: true,
        componentDisplayName: cleanNaming.displayName,
        componentRoutePath: cleanNaming.routePath
      };

    } else {
      // Component integration remains the same but with clean naming
      this.streamUpdate('   🎯 COMPONENT Integration: Using AI to find best integration targets...');
      
      const usageAnalysis = await this.analyzeUsageTargets(projectFiles, componentType, userPrompt);
      
      if (usageAnalysis.hasPages) {
        usageAnalysis.pageFiles.forEach((pageFile, index) => {
          integrationFiles.push({
            filePath: pageFile.filePath,
            exists: true,
            purpose: `Add ${cleanNaming.displayName} component usage example`,
            required: pageFile.isMainPage,
            priority: 4 + index,
            integrationType: 'usage'
          });
        });
      }

      return {
        mainComponentFile: {
          filePath: `${componentType.targetDirectory}/${cleanNaming.fileName}`,
          exists: false,
          purpose: `Main ${componentType.type} file`,
          required: true,
          priority: 1,
          integrationType: 'creation'
        },
        integrationFiles,
        navigationAnalysis: { 
          hasNavigation: false, 
          navigationFiles: [], 
          hasHeader: false, 
          hasFooter: false, 
          hasNavbar: false, 
          existingLinks: [],
          headerCanAddPages: true,
          shouldUpdateAppOnly: false,
          existingPageRoutes: [],
          routeAlreadyExists: false
        },
        usageAnalysis,
        projectPatterns,
        existingRoutes,
        componentMap,
        isPageComponent: false,
        componentDisplayName: cleanNaming.displayName,
        componentRoutePath: cleanNaming.routePath
      };
    }
  }

  /**
   * COMPLETE INTEGRATION WITH PROPER TYPE DISTINCTION
   */
  async integrateComponent(generationResult: GenerationResult, userPrompt: string = ''): Promise<IntegrationResult> {
    this.streamUpdate('🔗 STEP 2: Starting Enhanced Integration with Smart Naming...');

    try {
      // 2.1: Create integration plan with proper naming and route detection
      this.streamUpdate('📋 2.1: Creating integration plan with smart naming and route detection...');
      const integrationAnalysis = await this.createIntegrationPlan(generationResult, userPrompt);

      // Clear logging of component type and strategy
      const typeIcon = integrationAnalysis.isPageComponent ? '📄' : '🧩';
      const typeLabel = integrationAnalysis.isPageComponent ? 'PAGE' : 'COMPONENT';
      
      this.streamUpdate(`${typeIcon} Type: ${typeLabel} - ${integrationAnalysis.componentDisplayName}`);
      this.streamUpdate(`📋 Integration Strategy:`);
      this.streamUpdate(`   Main File: ${integrationAnalysis.mainComponentFile.filePath}`);
      this.streamUpdate(`   Route Path: /${integrationAnalysis.componentRoutePath}`);

      if (integrationAnalysis.isPageComponent) {
        // Enhanced page integration logging
        const navAnalysis = integrationAnalysis.navigationAnalysis;
        
        if (navAnalysis.routeAlreadyExists) {
          this.streamUpdate(`   ⚠️  Route already exists in: ${navAnalysis.matchingNavigationFile}`);
          this.streamUpdate(`   🎯 Strategy: Component creation only, skip navigation`);
        } else {
          this.streamUpdate(`   🛣️  Routing: ${integrationAnalysis.projectPatterns.appFilePath ? '✅ Required' : '❌ No App File'}`);
          this.streamUpdate(`   🧭 Navigation: ${navAnalysis.hasNavigation ? '✅ Available' : '❌ None'}`);
        }
        
        if (navAnalysis.hasNavigation && !navAnalysis.routeAlreadyExists) {
          this.streamUpdate(`   📊 Navigation Files Analysis:`);
          navAnalysis.navigationFiles.forEach(navFile => {
            const status = navFile.hasMatchingRoute ? '❌ Route exists' : 
                          navFile.needsRouteUpdate ? '✅ Will update' : 
                          '⚠️  Full/Skip';
            this.streamUpdate(`      ${navFile.type.toUpperCase()}: ${status} (${navFile.pageRouteCount}/6 routes)`);
          });
        }
      } else {
        // Component integration logging
        this.streamUpdate(`   📄 Usage Integration: ${integrationAnalysis.usageAnalysis.hasPages ? '✅ Available' : '❌ No Pages Found'}`);
        
        if (integrationAnalysis.usageAnalysis.hasPages) {
          this.streamUpdate(`   🤖 AI Analysis: ${integrationAnalysis.usageAnalysis.aiAnalysis || 'Smart targeting applied'}`);
          this.streamUpdate(`   📊 AI-Recommended Pages for Component Usage:`);
          integrationAnalysis.usageAnalysis.pageFiles.forEach(pageFile => {
            const priority = pageFile.isMainPage ? ' (PRIMARY)' : '';
            const reason = pageFile.aiReason ? ` - ${pageFile.aiReason}` : '';
            this.streamUpdate(`      ${pageFile.type.toUpperCase()}: ${pageFile.filePath}${priority}${reason}`);
          });
        }
      }

      // Show all integration files
      integrationAnalysis.integrationFiles.forEach(plan => {
        if (plan.skipReason) {
          this.streamUpdate(`   ⏭️  SKIP ${plan.filePath} - ${plan.skipReason}`);
          return;
        }

        const status = plan.exists ? '✅ MODIFY' : '🆕 CREATE';
        let icon = '📄';
        if (plan.integrationType === 'navigation') {
          icon = plan.navigationFileType === 'header' ? '🔝' : 
                 plan.navigationFileType === 'footer' ? '🔻' : '🧭';
        } else if (plan.integrationType === 'usage') {
          icon = '🔗';
        } else if (plan.integrationType === 'routing') {
          icon = '🛣️';
        }
        this.streamUpdate(`   ${status} ${icon} ${plan.filePath} - ${plan.purpose}`);
      });

      // 2.2: Execute integration
      this.streamUpdate('🎯 2.2: Executing integration...');
      const result = await this.executeIntegration(generationResult, integrationAnalysis);

      this.streamUpdate('✅ STEP 2 Complete: Enhanced Integration with Smart Naming finished!');
      return result;

    } catch (error) {
      this.streamUpdate(`❌ STEP 2 Failed: ${error}`);
      return {
        success: false,
        createdFiles: [],
        modifiedFiles: [],
        skippedFiles: [],
        integrationResults: {
          routingUpdated: false,
          appFileUpdated: false,
          navigationUpdated: false,
          headerUpdated: false,
          footerUpdated: false,
          dependenciesResolved: false,
          usageExampleAdded: false,
          pagesUpdated: [],
          routeAlreadyExisted: false,
          navigationAlreadyExists: false
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 🔥 ENHANCED: EXECUTE INTEGRATION WITH SMART SKIPPING
   */
  private async executeIntegration(
    generationResult: GenerationResult,
    integrationAnalysis: IntegrationAnalysis
  ): Promise<IntegrationResult> {
    const createdFiles: string[] = [];
    const modifiedFiles: string[] = [];
    const skippedFiles: string[] = [];
    const warnings: string[] = [];
    const integrationResults = {
      routingUpdated: false,
      appFileUpdated: false,
      navigationUpdated: false,
      headerUpdated: false,
      footerUpdated: false,
      dependenciesResolved: false,
      usageExampleAdded: false,
      pagesUpdated: [] as string[],
      routeAlreadyExisted: integrationAnalysis.navigationAnalysis.routeAlreadyExists,
      navigationAlreadyExists: integrationAnalysis.navigationAnalysis.routeAlreadyExists
    };

    // Filter out skipped files
    const activeFiles = [integrationAnalysis.mainComponentFile, ...integrationAnalysis.integrationFiles]
      .filter(plan => !plan.skipReason);
    
    const skippedPlans = [integrationAnalysis.mainComponentFile, ...integrationAnalysis.integrationFiles]
      .filter(plan => plan.skipReason);

    // Log skipped files
    skippedPlans.forEach(plan => {
      skippedFiles.push(`${plan.filePath}: ${plan.skipReason}`);
      this.streamUpdate(`   ⏭️  Skipped: ${plan.filePath} - ${plan.skipReason}`);
    });

    const sortedPlans = activeFiles.sort((a, b) => a.priority - b.priority);

    if (sortedPlans.length === 0) {
      this.streamUpdate('   ⚠️  No files to process after filtering');
      return {
        success: true,
        createdFiles,
        modifiedFiles,
        skippedFiles,
        integrationResults,
        warnings
      };
    }

    // Prepare context for batch integration
    const contextFiles = sortedPlans
      .filter(plan => plan.exists)
      .map(plan => {
        const fileData = generationResult.projectFiles.get(plan.filePath);
        if (!fileData) return null;
        
        return {
          path: plan.filePath,
          content: fileData.content,
          purpose: plan.purpose,
          integrationType: plan.integrationType,
          navigationFileType: plan.navigationFileType,
          contentLength: fileData.content.length,
          isLargeFile: fileData.content.length > 5000
        };
      })
      .filter(Boolean);

    this.streamUpdate('🎨 2.2.1: Generating files with smart integration...');
    
    // Create appropriate integration prompt based on type
    const batchIntegrationPrompt = integrationAnalysis.isPageComponent 
      ? this.createPageIntegrationPrompt(generationResult, integrationAnalysis, contextFiles as any[])
      : this.createComponentIntegrationPrompt(generationResult, integrationAnalysis, contextFiles as any[]);

    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20240620',
      max_tokens: 8000,
      temperature: 0.1,
      messages: [{ role: 'user', content: batchIntegrationPrompt }]
    });

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
    
    // Parse generated files
    const results = this.parseGeneratedFiles(text, sortedPlans);

    this.streamUpdate('💾 2.2.2: Writing files...');

    // Write files and track results
    for (const [filePath, content] of results.entries()) {
      try {
        const plan = sortedPlans.find(p => p.filePath === filePath);
        if (!plan) continue;

        await this.writeFile(filePath, content);

        if (plan.exists) {
          modifiedFiles.push(filePath);
          this.streamUpdate(`   ✅ Modified: ${filePath}`);
          
          // Track specific integration types
          if (plan.integrationType === 'routing') {
            integrationResults.routingUpdated = true;
            integrationResults.appFileUpdated = true;
          }
          if (plan.integrationType === 'navigation') {
            integrationResults.navigationUpdated = true;
            if (plan.navigationFileType === 'header') integrationResults.headerUpdated = true;
            if (plan.navigationFileType === 'footer') integrationResults.footerUpdated = true;
          }
          if (plan.integrationType === 'usage') {
            integrationResults.usageExampleAdded = true;
            integrationResults.pagesUpdated.push(filePath);
          }
        } else {
          createdFiles.push(filePath);
          this.streamUpdate(`   ✅ Created: ${filePath}`);
        }
      } catch (error) {
        this.streamUpdate(`   ❌ Failed to write ${filePath}: ${error}`);
        warnings.push(`Failed to write ${filePath}: ${error}`);
      }
    }

    integrationResults.dependenciesResolved = createdFiles.length > 0 || modifiedFiles.length > 0;

    return {
      success: createdFiles.length > 0 || modifiedFiles.length > 0,
      createdFiles,
      modifiedFiles,
      skippedFiles,
      integrationResults,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * 🔥 ENHANCED: PAGE INTEGRATION PROMPT WITH CLEAN NAMING
   */
  private createPageIntegrationPrompt(
    generationResult: GenerationResult,
    integrationAnalysis: IntegrationAnalysis,
    contextFiles: Array<{
      path: string, 
      content: string, 
      purpose: string, 
      integrationType: string, 
      navigationFileType?: string,
      contentLength: number, 
      isLargeFile: boolean
    }>
  ): string {
    const { componentType, generatedContent } = generationResult;
    
    // Use clean naming from integration analysis
    const cleanDisplayName = integrationAnalysis.componentDisplayName;
    const cleanRoutePath = integrationAnalysis.componentRoutePath;
    
    // Generate proper import path with @/ alias for pages
    const importPath = `./pages/${cleanDisplayName}`;
    
    const contextContent = contextFiles.map(f => {
      const truncationWarning = f.isLargeFile ? '\n⚠️  LARGE FILE - INCLUDE ALL CONTENT IN OUTPUT' : '';
      const navTypeInfo = f.navigationFileType ? `\nNAVIGATION TYPE: ${f.navigationFileType.toUpperCase()}` : '';
      return `FILE: ${f.path}\nPURPOSE: ${f.purpose}\nTYPE: ${f.integrationType}${navTypeInfo}\nSIZE: ${f.contentLength} chars${truncationWarning}\nCONTENT:\n${f.content}`;
    }).join('\n\n---\n\n');

    const filesToGenerate = [integrationAnalysis.mainComponentFile, ...integrationAnalysis.integrationFiles]
      .filter(plan => !plan.skipReason)
      .map(plan => {
        const navType = plan.navigationFileType ? ` (${plan.navigationFileType.toUpperCase()})` : '';
        return `- ${plan.exists ? 'MODIFY' : 'CREATE'} ${plan.filePath}${navType} (${plan.purpose})`;
      })
      .join('\n');

    // Smart navigation context based on route analysis
    const navigationContext = integrationAnalysis.navigationAnalysis.routeAlreadyExists ? `
🚨 ROUTE ALREADY EXISTS - COMPONENT CREATION ONLY:
- Route /${cleanRoutePath} already exists in navigation: ${integrationAnalysis.navigationAnalysis.matchingNavigationFile}
- Existing routes detected: ${integrationAnalysis.navigationAnalysis.existingPageRoutes.join(', ')}
- Strategy: Create component file only, NO navigation modifications needed
- This prevents duplicate routes and maintains existing navigation structure

NAVIGATION ANALYSIS:
${integrationAnalysis.navigationAnalysis.navigationFiles.map(navFile => `
- File: ${navFile.filePath} (${navFile.type.toUpperCase()})
- Has matching route: ${navFile.hasMatchingRoute ? 'YES' : 'NO'}
- Page routes: ${navFile.pageRouteCount}/6
- Existing routes: ${navFile.existingRoutes.join(', ') || 'None'}
`).join('')}
` : integrationAnalysis.navigationAnalysis.hasNavigation ? `
✅ NEW ROUTE INTEGRATION - FULL NAVIGATION UPDATE:
- Route /${cleanRoutePath} is NEW and can be added to navigation
- Display name: ${cleanDisplayName}
- MUST add navigation link in appropriate navigation files
- Maintain existing navigation structure and styling

${integrationAnalysis.navigationAnalysis.shouldUpdateAppOnly ? `
🛑 HEADER IS FULL (6+ PAGE ROUTES) - APP.TSX ONLY UPDATE:
- Header already has maximum recommended page routes
- DO NOT modify header or other navigation files
- ONLY update App.tsx with new route

HEADER ANALYSIS:
${integrationAnalysis.navigationAnalysis.navigationFiles
  .filter(f => f.type === 'header')
  .map(headerFile => `
- File: ${headerFile.filePath}
- Page Routes: ${headerFile.pageRouteCount}/6 (FULL)
- Strategy: SKIP navigation update, APP.TSX ONLY
`).join('')}
` : `
✅ HEADER CAN ACCEPT NEW PAGES - FULL INTEGRATION:
- Header has space for new page routes (< 6 routes)
- MUST add navigation link in files marked for update
- Use clean path: /${cleanRoutePath}
- Use clean display name: ${cleanDisplayName}

NAVIGATION FILES TO UPDATE:
${integrationAnalysis.navigationAnalysis.navigationFiles.map(navFile => `
- ${navFile.filePath} (${navFile.type.toUpperCase()}):
  * Page Routes: ${navFile.pageRouteCount}/6 ${navFile.canAddMorePages ? '(CAN ADD)' : '(FULL)'}
  * Update Required: ${navFile.needsRouteUpdate ? 'YES' : 'NO'}
  * Style: ${navFile.type === 'footer' ? 'Simple footer link' : 'Full navigation with hover effects'}
`).join('')}
`}
` : 'NAVIGATION: None found in project';

    return `
TASK: SMART PAGE Integration for ${cleanDisplayName} with intelligent naming and route detection

COMPONENT DETAILS:
- Type: PAGE
- Clean Name: ${cleanDisplayName} (was: ${componentType.name})
- Clean Route: /${cleanRoutePath}
- File: ${integrationAnalysis.mainComponentFile.filePath}
- Import Path: ${importPath}

GENERATED PAGE CODE (UPDATE THE EXPORT NAME TO USE CLEAN NAME):
\`\`\`tsx
${generatedContent.replace(new RegExp(`export default ${componentType.name}`, 'g'), `export default ${cleanDisplayName}`)}
\`\`\`

PROJECT PATTERNS:
- Export: ${integrationAnalysis.projectPatterns.exportPattern}
- Import: ${integrationAnalysis.projectPatterns.importPattern}
- Routing: ${integrationAnalysis.projectPatterns.routingPattern}
- App File: ${integrationAnalysis.projectPatterns.appFilePath || 'NONE'}

${navigationContext}

FILES TO PROCESS:
${filesToGenerate}

EXISTING FILES CONTEXT:
${contextContent}

EXISTING ROUTES: ${integrationAnalysis.existingRoutes.join(', ') || 'NONE'}

🚨 CRITICAL NAMING RULES:
1. Component name MUST be: ${cleanDisplayName} (clean, no "Page" suffix)
2. Route path MUST be: /${cleanRoutePath} (clean, lowercase)
3. Display text in navigation MUST be: ${cleanDisplayName}
4. File export MUST be: export default ${cleanDisplayName}

🚨 CRITICAL NAVIGATION RULES:
${integrationAnalysis.navigationAnalysis.routeAlreadyExists ? `
1. DO NOT MODIFY ANY NAVIGATION FILES (Route already exists)
2. Route /${cleanRoutePath} already exists in: ${integrationAnalysis.navigationAnalysis.matchingNavigationFile}
3. Only create the component file, skip all navigation updates
4. This prevents duplicate routes and navigation conflicts
` : integrationAnalysis.navigationAnalysis.shouldUpdateAppOnly ? `
1. DO NOT MODIFY HEADER OR OTHER NAVIGATION FILES (Header is full)
2. ONLY UPDATE App.tsx with new route
3. New route: <Route path="/${cleanRoutePath}" element={<${cleanDisplayName} />} />
4. Import: import ${cleanDisplayName} from "${importPath}"
` : `
1. ADD navigation link to files that need updates (< 6 page routes)
2. PRESERVE all existing navigation links and structure  
3. Add new link at logical position (usually end of page routes)
4. Use clean format: path="/${cleanRoutePath}" and text="${cleanDisplayName}"
5. Maintain consistent styling with existing navigation
`}

🚨 CRITICAL CONTENT PRESERVATION RULES:
1. NEVER use placeholder comments like "// ... (content remains unchanged)"
2. NEVER truncate or omit existing file content
3. For EXISTING files: Include COMPLETE file content with modifications
4. For NEW files: Generate complete, functional code with clean naming
5. Preserve ALL imports, ALL functions, ALL JSX content
6. Only ADD new content, never remove existing content

🚨 CRITICAL IMPORT PATH REQUIREMENTS:
- Pages use relative paths: import ${cleanDisplayName} from "${importPath}"
- NO src/ paths: avoid "src/pages/" or "src/components/"
- Use clean relative imports: "./pages/CleanName"

PAGE INTEGRATION REQUIREMENTS:
1. Use clean component name: export default ${cleanDisplayName}
2. Use relative path imports: import ${cleanDisplayName} from "${importPath}"
3. Add route to App.tsx: <Route path="/${cleanRoutePath}" element={<${cleanDisplayName} />} />
4. Navigation links use clean display name: ${cleanDisplayName}
5. Preserve ALL existing routes and imports
6. Maintain existing file structures completely

RESPONSE FORMAT:
=== FILE: path/to/file.tsx ===
\`\`\`tsx
[COMPLETE FILE CONTENT WITH ALL EXISTING CONTENT PRESERVED AND CLEAN NAMING]
\`\`\`

Generate ALL files with COMPLETE content preservation and SMART naming now:
`;
  }

  /**
   * 🔥 ENHANCED: COMPONENT INTEGRATION PROMPT WITH CLEAN NAMING
   */
  private createComponentIntegrationPrompt(
    generationResult: GenerationResult,
    integrationAnalysis: IntegrationAnalysis,
    contextFiles: Array<{
      path: string, 
      content: string, 
      purpose: string, 
      integrationType: string, 
      contentLength: number, 
      isLargeFile: boolean
    }>
  ): string {
    const { componentType, generatedContent } = generationResult;
    
    // Use clean naming from integration analysis
    const cleanDisplayName = integrationAnalysis.componentDisplayName;
    
    // Generate proper import path with @/ alias for components
    const importPath = `@/components/${cleanDisplayName}`;
    
    const contextContent = contextFiles.map(f => {
      const truncationWarning = f.isLargeFile ? '\n⚠️  LARGE FILE - INCLUDE ALL CONTENT IN OUTPUT' : '';
      return `FILE: ${f.path}\nPURPOSE: ${f.purpose}\nTYPE: ${f.integrationType}\nSIZE: ${f.contentLength} chars${truncationWarning}\nCONTENT:\n${f.content}`;
    }).join('\n\n---\n\n');

    const filesToGenerate = [integrationAnalysis.mainComponentFile, ...integrationAnalysis.integrationFiles]
      .filter(plan => !plan.skipReason)
      .map(plan => `- ${plan.exists ? 'MODIFY' : 'CREATE'} ${plan.filePath} (${plan.purpose})`)
      .join('\n');

    const usageContext = integrationAnalysis.usageAnalysis.hasPages ? `
🎯 COMPONENT USAGE INTEGRATION:
- Clean component name: ${cleanDisplayName}
- Show practical usage examples with realistic props
- Add import statements and component usage
- Preserve ALL existing page content

TARGET PAGES FOR COMPONENT USAGE:
${integrationAnalysis.usageAnalysis.pageFiles.map(pageFile => `
- ${pageFile.filePath} (${pageFile.type.toUpperCase()}):
  * Priority: ${pageFile.isMainPage ? 'HIGH (Main Page)' : 'NORMAL'}
  * AI Reason: ${pageFile.aiReason || 'Smart targeting applied'}
  * Existing imports: ${pageFile.componentImports.join(', ') || 'None'}
  * Strategy: Add ${cleanDisplayName} usage example in appropriate section
`).join('')}

🚨 CRITICAL: NO NAVIGATION LINKS for components - only usage examples!
` : 'USAGE: No suitable pages found for component integration';

    return `
TASK: COMPONENT Integration for ${cleanDisplayName} with clean naming and usage examples

COMPONENT DETAILS:
- Type: COMPONENT
- Clean Name: ${cleanDisplayName} (was: ${componentType.name})
- File: ${integrationAnalysis.mainComponentFile.filePath}
- Import Path: ${importPath}
- Integration Strategy: Usage examples in existing pages

GENERATED COMPONENT CODE (UPDATE EXPORT NAME TO USE CLEAN NAME):
\`\`\`tsx
${generatedContent.replace(new RegExp(`export default ${componentType.name}`, 'g'), `export default ${cleanDisplayName}`)}
\`\`\`

PROJECT PATTERNS:
- Export: ${integrationAnalysis.projectPatterns.exportPattern}
- Import: ${integrationAnalysis.projectPatterns.importPattern}

${usageContext}

FILES TO PROCESS:
${filesToGenerate}

EXISTING FILES CONTEXT:
${contextContent}

🚨 CRITICAL NAMING RULES:
1. Component name MUST be: ${cleanDisplayName} (clean, no redundant suffixes)
2. File export MUST be: export default ${cleanDisplayName}
3. Import statement MUST use: import ${cleanDisplayName} from "${importPath}"
4. Usage examples MUST use: <${cleanDisplayName} prop="value" />

🚨 CRITICAL CONTENT PRESERVATION RULES:
1. NEVER use placeholder comments like "// ... (content remains unchanged)"
2. NEVER truncate or omit existing file content
3. For EXISTING files: Include COMPLETE file content with modifications
4. For NEW files: Generate complete, functional code with clean naming
5. Preserve ALL imports, ALL functions, ALL JSX content
6. Only ADD new content, never remove existing content

🚨 CRITICAL IMPORT PATH REQUIREMENTS:
- Components use @/ alias: import ${cleanDisplayName} from "${importPath}"
- NO src/ paths: avoid "src/components/" completely
- Use clean @/ imports: "@/components/CleanName"

COMPONENT INTEGRATION REQUIREMENTS:
1. Use clean component name: export default ${cleanDisplayName}
2. Use @/ alias imports: import ${cleanDisplayName} from "${importPath}"
3. Add import statement at top with other imports
4. Demonstrate component usage with realistic props
5. Preserve ALL existing page functionality and content
6. Only ADD the new component usage, don't modify existing content
7. NO NAVIGATION LINKS - components don't get navigation entries
8. Show component in logical sections of existing pages

COMPONENT USAGE EXAMPLES:
- Add import: import ${cleanDisplayName} from "${importPath}"
- Show usage: <${cleanDisplayName} prop1="value1" prop2="value2" />
- Use in appropriate sections of existing pages
- Provide realistic, meaningful props based on component design

RESPONSE FORMAT:
=== FILE: path/to/file.tsx ===
\`\`\`tsx
[COMPLETE FILE CONTENT WITH ALL EXISTING CONTENT PRESERVED AND CLEAN NAMING]
\`\`\`

Generate ALL files with COMPLETE content preservation and clean naming now:
`;
  }

  // Keep existing methods for usage analysis, file detection, etc...
  // (The rest of the methods remain the same as in the original code)

  /**
   * ANALYZE USAGE TARGETS (FOR COMPONENTS ONLY) - AI-DRIVEN
   */
  private async analyzeUsageTargets(
    projectFiles: Map<string, ProjectFile>, 
    componentType: ComponentTypeAnalysis,
    userPrompt: string
  ): Promise<UsageAnalysis> {
    this.streamUpdate('🤖 Using AI to analyze best integration targets...');
    
    const allPageFiles = this.findAllPageFiles(projectFiles);
    const allLayoutComponents = this.findAllLayoutComponents(projectFiles);
    
    const allTargets = [
      ...allPageFiles.map(p => ({ ...p, targetType: 'page' as const })),
      ...allLayoutComponents.map(l => ({ ...l, targetType: 'layout-component' as const }))
    ];
    
    if (allTargets.length === 0) {
      return {
        hasPages: false,
        pageFiles: [],
        targetPages: []
      };
    }

    const aiAnalysis = await this.getAIIntegrationAnalysis(
      userPrompt,
      componentType,
      allTargets
    );

    const pageFiles: PageFileInfo[] = aiAnalysis.recommendedPages.map((rec, index) => {
      const file = projectFiles.get(rec.filePath);
      return {
        filePath: rec.filePath,
        type: rec.targetType === 'layout-component' ? 'layout' : 'page',
        priority: rec.priority,
        isMainPage: rec.isMainPage,
        componentImports: file ? this.extractComponentImports(file.content) : [],
        aiReason: rec.reason
      };
    });

    return {
      hasPages: pageFiles.length > 0,
      pageFiles: pageFiles.slice(0, 3),
      targetPages: pageFiles.map(p => p.filePath),
      aiAnalysis: aiAnalysis.reasoning
    };
  }

  private findAllLayoutComponents(projectFiles: Map<string, ProjectFile>): Array<{filePath: string, fileName: string}> {
    const layoutComponents: Array<{filePath: string, fileName: string}> = [];
    
    const layoutPatterns = [
      /header/i, /navbar/i, /navigation/i, /layout/i, /menu/i, /sidebar/i, /footer/i
    ];
    
    for (const [filePath, file] of projectFiles) {
      if (filePath.includes('/components/') || filePath.includes('\\components\\')) {
        const fileName = filePath.split('/').pop() || filePath;
        const fileNameClean = fileName.replace(/\.(tsx|jsx|ts|js)$/, '');
        
        if (layoutPatterns.some(pattern => pattern.test(fileName) || pattern.test(filePath))) {
          layoutComponents.push({
            filePath,
            fileName: fileNameClean
          });
        }
      }
    }
    
    return layoutComponents;
  }

  private findAllPageFiles(projectFiles: Map<string, ProjectFile>): Array<{filePath: string, fileName: string}> {
    const pageFiles: Array<{filePath: string, fileName: string}> = [];
    
    for (const [filePath, file] of projectFiles) {
      if (this.looksLikePage(filePath, file)) {
        const fileName = filePath.split('/').pop() || filePath;
        pageFiles.push({
          filePath,
          fileName: fileName.replace(/\.(tsx|jsx|ts|js)$/, '')
        });
      }
    }
    
    return pageFiles;
  }

  private looksLikePage(filePath: string, file: ProjectFile): boolean {
    if (file.isAppFile || file.isRouteFile) return false;
    if (filePath.includes('/components/') && !filePath.includes('/pages/')) return false;
    if (filePath.includes('/utils/') || filePath.includes('/hooks/')) return false;
    
    if (filePath.includes('/pages/')) return true;
    if (file.mainComponent && file.content.includes('export default')) return true;
    
    return false;
  }

  private async getAIIntegrationAnalysis(
    userPrompt: string,
    componentType: ComponentTypeAnalysis,
    availableTargets: Array<{filePath: string, fileName: string, targetType: 'page' | 'layout-component'}>
  ): Promise<{
    recommendedPages: Array<{
      filePath: string,
      priority: number,
      isMainPage: boolean,
      reason: string,
      targetType: 'page' | 'layout-component'
    }>,
    reasoning: string
  }> {
    const pageTargets = availableTargets.filter(t => t.targetType === 'page');
    const layoutTargets = availableTargets.filter(t => t.targetType === 'layout-component');
    
    const isNavigationComponent = this.isNavigationComponent(componentType, userPrompt);
    
    const analysisPrompt = `
TASK: Analyze where to integrate the "${componentType.name}" component

USER REQUEST: "${userPrompt}"

COMPONENT DETAILS:
- Name: ${componentType.name}
- Type: ${componentType.type}
- Category: ${componentType.category}
- Description: ${componentType.description || 'N/A'}
- Likely Navigation/Layout Component: ${isNavigationComponent ? 'YES' : 'NO'}

AVAILABLE INTEGRATION TARGETS:

LAYOUT COMPONENTS (Header, Navbar, etc.):
${layoutTargets.length > 0 ? layoutTargets.map((target, index) => `${index + 1}. ${target.fileName} (${target.filePath}) - Layout Component`).join('\n') : 'None found'}

PAGES:
${pageTargets.length > 0 ? pageTargets.map((target, index) => `${index + 1}. ${target.fileName} (${target.filePath}) - Page`).join('\n') : 'None found'}

RESPONSE FORMAT (JSON):
{
  "reasoning": "Overall analysis of integration strategy and target choices...",
  "recommendedPages": [
    {
      "filePath": "exact/file/path",
      "priority": 1,
      "isMainPage": false,
      "targetType": "layout-component",
      "reason": "Specific reason why this target is perfect for the component"
    }
  ]
}

Analyze and recommend the best integration targets:
`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 1500,
        temperature: 0.3,
        messages: [{ role: 'user', content: analysisPrompt }]
      });

      const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        
        const validRecommendations = analysis.recommendedPages.filter((rec: any) => 
          availableTargets.some(target => target.filePath === rec.filePath)
        );

        return {
          recommendedPages: validRecommendations,
          reasoning: analysis.reasoning
        };
      }
    } catch (error) {
      this.streamUpdate(`⚠️ AI analysis failed, using fallback: ${error}`);
    }

    const fallbackRecommendations = this.getFallbackRecommendations(availableTargets, componentType);
    
    return {
      recommendedPages: fallbackRecommendations.map(page => ({
        ...page,
        targetType: 'page' as const
      })),
      reasoning: 'Using fallback analysis due to AI parsing issues'
    };
  }

  private isNavigationComponent(componentType: ComponentTypeAnalysis, userPrompt: string): boolean {
    const navigationPatterns = [
      /sidebar/i, /navbar/i, /navigation/i, /menu/i, /drawer/i, /panel/i, 
      /header/i, /footer/i, /layout/i, /nav/i
    ];
    
    if (navigationPatterns.some(pattern => pattern.test(componentType.name))) {
      return true;
    }
    
    if (navigationPatterns.some(pattern => pattern.test(userPrompt))) {
      return true;
    }
    
    if (navigationPatterns.some(pattern => pattern.test(componentType.description ?? ''))) {
      return true;
    }
    
    return false;
  }

  private getFallbackRecommendations(
    availablePages: Array<{filePath: string, fileName: string}>,
    componentType: ComponentTypeAnalysis
  ): Array<{filePath: string, priority: number, isMainPage: boolean, reason: string}> {
    const recommendations: Array<{filePath: string, priority: number, isMainPage: boolean, reason: string}> = [];
    
    const priorityPatterns = [
      { patterns: [/home/i, /index/i, /dashboard/i], isMain: true, reason: 'Main landing page - good for showcasing new components' },
      { patterns: [/app/i, /main/i], isMain: true, reason: 'Main application page' },
      { patterns: [/about/i, /profile/i], isMain: false, reason: 'Content page suitable for component demonstration' }
    ];

    for (const pattern of priorityPatterns) {
      const matchingPage = availablePages.find(page => 
        pattern.patterns.some(p => p.test(page.fileName) || p.test(page.filePath))
      );
      
      if (matchingPage && !recommendations.some(r => r.filePath === matchingPage.filePath)) {
        recommendations.push({
          filePath: matchingPage.filePath,
          priority: recommendations.length + 1,
          isMainPage: pattern.isMain,
          reason: pattern.reason
        });
      }
    }

    if (recommendations.length === 0 && availablePages.length > 0) {
      recommendations.push({
        filePath: availablePages[0].filePath,
        priority: 1,
        isMainPage: true,
        reason: 'First available page in project'
      });
    }

    return recommendations.slice(0, 2);
  }

  // Keep existing utility methods...
  private hasNavigationLinks(content: string): boolean {
    const navPatterns = [
      /href=["'][^"']*["']/g,
      /to=["'][^"']*["']/g,
      /<Link\s+to=/g,
      /<NavLink\s+to=/g,
      /navigate\(/g,
      /<a\s+href=/g,
      /<nav\s/g,
      /className=["'][^"']*nav[^"']*["']/g
    ];

    const contentPatterns = [
      /navigation/i,
      /menu/i,
      /navbar/i,
      /header/i,
      /footer/i
    ];

    const hasNavPatterns = navPatterns.some(pattern => pattern.test(content));
    const hasNavContent = contentPatterns.some(pattern => pattern.test(content));
    
    return hasNavPatterns || hasNavContent;
  }

  private extractNavigationLinks(content: string): string[] {
    const links: string[] = [];
    
    // Extract href attributes (including hash links)
    const hrefMatches = content.match(/href=["']([^"']+)["']/g) || [];
    hrefMatches.forEach(match => {
      const link = match.replace(/href=["']([^"']+)["']/, '$1');
      if (!links.includes(link)) {
        links.push(link);
      }
    });

    // Extract 'to' attributes from React Router Links
    const linkMatches = content.match(/to=["']([^"']+)["']/g) || [];
    linkMatches.forEach(match => {
      const link = match.replace(/to=["']([^"']+)["']/, '$1');
      if (!links.includes(link)) {
        links.push(link);
      }
    });

    return links;
  }

  private extractComponentImports(content: string): string[] {
    const imports: string[] = [];
    
    // Extract component imports (starting with capital letter)
    const importMatches = content.match(/import\s+(\w+)\s+from\s+['"][^'"]*['"]/g) || [];
    importMatches.forEach(match => {
      const nameMatch = match.match(/import\s+(\w+)\s+from/);
      if (nameMatch && /^[A-Z]/.test(nameMatch[1])) {
        imports.push(nameMatch[1]);
      }
    });

    // Extract named component imports
    const namedImportMatches = content.match(/import\s*\{([^}]+)\}\s*from\s*['"][^'"]*['"]/g) || [];
    namedImportMatches.forEach(match => {
      const namesMatch = match.match(/\{([^}]+)\}/);
      if (namesMatch) {
        const names = namesMatch[1].split(',').map(n => n.trim());
        names.forEach(name => {
          if (/^[A-Z]/.test(name)) {
            imports.push(name);
          }
        });
      }
    });

    return imports;
  }

  /**
   * PARSE GENERATED FILES FROM RESPONSE
   */
  private parseGeneratedFiles(
    responseText: string,
    plans: IntegrationPlan[]
  ): Map<string, string> {
    const results = new Map<string, string>();

    // Match file sections using the exact format
    const filePattern = /=== FILE: (.+?) ===\s*```(?:tsx|typescript|jsx|javascript)\s*([\s\S]*?)```/g;
    let match;

    while ((match = filePattern.exec(responseText)) !== null) {
      const filePath = match[1].trim();
      const content = match[2].trim();
      
      if (content && content.length > 0) {
        results.set(filePath, content);
        this.streamUpdate(`   📄 Parsed: ${filePath} (${content.length} chars)`);
      }
    }

    // If no files found with exact format, try alternative parsing
    if (results.size === 0) {
      this.streamUpdate('   ⚠️  Exact format not found, trying alternative parsing...');
      
      const codeBlocks = responseText.match(/```(?:tsx|typescript|jsx|javascript)\s*([\s\S]*?)```/g);
      if (codeBlocks && plans.length > 0) {
        codeBlocks.forEach((block, index) => {
          const content = block.replace(/```(?:tsx|typescript|jsx|javascript)\s*/, '').replace(/```$/, '').trim();
          if (content && index < plans.length) {
            const plan = plans[index];
            results.set(plan.filePath, content);
            this.streamUpdate(`   📄 Alt parsed: ${plan.filePath} (${content.length} chars)`);
          }
        });
      }
    }

    this.streamUpdate(`   📊 Total files parsed: ${results.size}`);
    return results;
  }

  /**
   * UTILITY METHODS
   */
  private async writeFile(filePath: string, content: string): Promise<void> {
    const fullPath = join(this.reactBasePath, filePath);
    const dir = dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, content, 'utf8');
  }

  private fileExists(filePath: string, projectFiles: Map<string, ProjectFile>): boolean {
    if (projectFiles.has(filePath)) return true;
    
    // Check variations
    const variations = [
      filePath.replace(/^src\//, ''),
      filePath.replace('.js', '.ts'),
      filePath.replace('.js', '.tsx'),
      filePath.replace('.jsx', '.tsx')
    ];
    
    return variations.some(variation => projectFiles.has(variation));
  }

  /**
   * 🔥 ENHANCED: GENERATE PROPER IMPORT PATH WITH CLEAN NAMING
   */
  private generateImportPath(componentType: ComponentTypeAnalysis, cleanName: string): string {
    if (componentType.type === 'component') {
      // Components use @/ alias: @/components/CleanName
      return `@/components/${cleanName}`;
    } else {
      // Pages use relative paths: ./pages/CleanName
      return `./pages/${cleanName}`;
    }
  }

  /**
   * 🔥 ENHANCED: GET INTEGRATION SUMMARY WITH SMART FEATURES
   */
  getIntegrationSummary(result: IntegrationResult): string {
    const summary = `
ENHANCED INTEGRATION ENGINE - SMART SUMMARY
==========================================
✅ Success: ${result.success}
📁 Created Files: ${result.createdFiles.length}
📝 Modified Files: ${result.modifiedFiles.length}
⏭️  Skipped Files: ${result.skippedFiles.length}

SMART FEATURES APPLIED:
🎨 Clean Naming: Removed redundant suffixes (Page, Component)
🔍 Route Detection: Checked existing navigation for duplicates
🧠 AI Integration: Smart targeting for component usage
🚫 Conflict Prevention: Skipped files to avoid duplicates

INTEGRATION RESULTS:
🛣️  Routing Updated: ${result.integrationResults.routingUpdated}
📱 App File Updated: ${result.integrationResults.appFileUpdated}
🧭 Navigation Updated: ${result.integrationResults.navigationUpdated}
🔝 Header Updated: ${result.integrationResults.headerUpdated}
🔻 Footer Updated: ${result.integrationResults.footerUpdated}
🔗 Dependencies Resolved: ${result.integrationResults.dependenciesResolved}
🎯 Usage Examples Added: ${result.integrationResults.usageExampleAdded}
📄 Pages Updated: ${result.integrationResults.pagesUpdated.length}

SMART DETECTION RESULTS:
🔄 Route Already Existed: ${result.integrationResults.routeAlreadyExisted ? 'YES - Skipped nav updates' : 'NO - Full integration'}
🧭 Navigation Already Exists: ${result.integrationResults.navigationAlreadyExists ? 'YES - Avoided duplicates' : 'NO - Added new links'}

CREATED FILES:
${result.createdFiles.map(f => `   🆕 ${f}`).join('\n') || '   None'}

MODIFIED FILES:
${result.modifiedFiles.map(f => `   ✏️  ${f}`).join('\n') || '   None'}

SKIPPED FILES (Smart Prevention):
${result.skippedFiles.map(f => `   ⏭️  ${f}`).join('\n') || '   None'}

${result.integrationResults.pagesUpdated.length > 0 ? `
PAGES WITH COMPONENT USAGE:
${result.integrationResults.pagesUpdated.map(f => `   🎯 ${f}`).join('\n')}
` : ''}

${result.warnings && result.warnings.length > 0 ? `
⚠️  WARNINGS:
${result.warnings.map(w => `   ⚠️  ${w}`).join('\n')}
` : ''}

${result.error ? `❌ ERROR: ${result.error}` : '✅ Smart Integration completed successfully!'}

KEY IMPROVEMENTS:
✨ Clean component/page names without redundant suffixes
🎯 Smart route detection prevents navigation conflicts  
🤖 AI-driven integration targeting for optimal placement
📋 Comprehensive skipping logic prevents file conflicts
🔗 Context-aware import path generation
`;

    return summary;
  }
}