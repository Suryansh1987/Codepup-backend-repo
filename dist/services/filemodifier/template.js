"use strict";
// template.ts - Enhanced templates with improved layout change handling
// This replaces your existing template.ts file
Object.defineProperty(exports, "__esModule", { value: true });
exports.appPrompt = exports.pagePrompt = exports.componentPrompt = exports.targetedNodesPrompt = exports.fullFilePrompt = void 0;
exports.replaceTemplateVariables = replaceTemplateVariables;
exports.getEnhancedPromptForApproach = getEnhancedPromptForApproach;
exports.getComponentPrompt = getComponentPrompt;
exports.prepareFullFileVariables = prepareFullFileVariables;
exports.prepareLayoutChangeVariables = prepareLayoutChangeVariables;
exports.prepareTargetedNodesVariables = prepareTargetedNodesVariables;
exports.prepareComponentVariables = prepareComponentVariables;
exports.createLayoutRepairFunction = createLayoutRepairFunction;
exports.fullFilePrompt = `
**USER REQUEST:** "{userRequest}"

**CURRENT FILE ({filePath}):**
\`\`\`jsx
{fileContent}
\`\`\`

**FILE ANALYSIS:**
- Component: {componentName}
- Lines: {lineCount}
- Type: {fileType}
- Purpose: {filePurpose}

**PROJECT CONTEXT:**
{projectSummary}

**MODIFICATION CONTEXT:**
{modificationSummary}

**🚨 CRITICAL STRUCTURE PRESERVATION RULES - ABSOLUTE REQUIREMENTS:**

**1. IMPORT PRESERVATION - ZERO TOLERANCE FOR CHANGES:**
{preservationPrompt}

**IMPORT RULES (BREAKING THESE WILL CAUSE VALIDATION FAILURE):**
- ❌ NEVER modify, remove, or change ANY existing import statement
- ❌ NEVER change import paths (keep @/components/ui/button exactly as @/components/ui/button)
- ❌ NEVER change package names (keep 'react' as 'react', not React)
- ❌ NEVER remove imports even if they appear unused
- ❌ NEVER reorder existing imports
- ✅ ONLY ADD new imports if absolutely necessary (Lucide React icons only)
- ✅ Place NEW imports immediately after existing imports, never mixed in

**EXACT IMPORT COPYING REQUIREMENT:**
Copy every single existing import character-for-character, including:
- Exact spacing and formatting
- Exact package names and paths
- Exact import syntax and punctuation
- Exact line breaks and positioning

**2. EXPORT PRESERVATION - ZERO TOLERANCE FOR CHANGES:**
- ❌ NEVER modify ANY existing export statement
- ❌ NEVER change component names in exports
- ❌ NEVER change export syntax or structure
- ✅ Copy export statements exactly as they appear

**3. COMPONENT STRUCTURE PRESERVATION:**
- ❌ NEVER change the main component function/const name
- ❌ NEVER change function parameters or props interface names
- ❌ NEVER change the component's export structure
- ✅ Only modify the INTERNAL JSX and styling content

**4. LAYOUT CHANGE IMPLEMENTATION GUIDELINES:**

**For Color Scheme Changes:**
-changes in hero section means homepage
-change ui or layout means comprehensive changes in all pages and make it look different than it was looking
- Update className values with new Tailwind color utilities
- Maintain existing class structure, only change color values
- Example: "bg-blue-600" → "bg-yellow-500" (keep same structure)
- Ensure color consistency across all elements
- Use complementary colors for text, backgrounds, and accents

**For Layout Restructuring:**
- Keep existing component hierarchy and structure
- Only modify Tailwind layout classes (grid, flex, spacing)
- Maintain responsive breakpoints (sm:, md:, lg:, xl:)
- Preserve accessibility classes and ARIA attributes
- Keep existing functionality and event handlers
-layout changes try to generate new layout under these constraints

**For Theme Changes:**
- Update gradient backgrounds with new color schemes
- Maintain shadow and border radius consistency
- Keep hover and focus states with new color scheme
- Ensure proper contrast ratios for accessibility
- Update icons to match new theme if needed

**5. CONTENT AND DATA PRESERVATION:**
- ❌ NEVER remove or modify existing mock data unless specifically requested
- ❌ NEVER change text content unless explicitly asked
- ❌ NEVER remove existing functionality or business logic
- ✅ Keep all existing content, just update visual presentation
- ✅ Preserve all existing user data, examples, and placeholder information

**6. VALIDATION-SAFE MODIFICATION APPROACH:**

**Step 1: Copy Structure Exactly**
\`\`\`
[EXACT COPY OF ALL IMPORTS - CHARACTER FOR CHARACTER]

[EXACT COPY OF COMPONENT DECLARATION]
\`\`\`

**Step 2: Modify Only Internal Content**
- Update only className values for layout/color changes
- Keep all existing JSX structure and hierarchy
- Maintain all existing props and event handlers

**Step 3: Copy Exports Exactly**
\`\`\`
[EXACT COPY OF ALL EXPORTS - CHARACTER FOR CHARACTER]
\`\`\`

**7. LAYOUT CHANGE PATTERNS:**

**Golden/Yellow Theme Implementation:**
- Primary: bg-yellow-500, bg-amber-500, bg-orange-500
- Backgrounds: bg-gradient-to-br from-yellow-50 to-amber-100
- Text: text-yellow-800, text-amber-900 for contrast
- Accents: border-yellow-400, ring-yellow-300
- Buttons: bg-yellow-600 hover:bg-yellow-700

**White/Clean Theme Elements:**
- Backgrounds: bg-white, bg-gray-50, bg-slate-50
- Cards: bg-white shadow-lg border border-gray-100
- Text: text-gray-900, text-slate-800 for readability
- Subtle accents: border-gray-200, bg-gray-100

**Responsive Layout Classes:**
- Grid: grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Flex: flex flex-col sm:flex-row items-center
- Spacing: space-y-4 md:space-y-6 lg:space-y-8
- Padding: p-4 md:p-6 lg:p-8

**8. COMMON LAYOUT CHANGE EXAMPLES:**

**Color Scheme Update:**
\`\`\`jsx
// BEFORE: className="bg-blue-600 text-white"
// AFTER:  className="bg-yellow-600 text-white"
\`\`\`

**Layout Restructuring:**
\`\`\`jsx
// BEFORE: className="flex flex-col space-y-4"
// AFTER:  className="grid grid-cols-1 md:grid-cols-2 gap-4"
\`\`\`

**Theme Gradient Update:**
\`\`\`jsx
// BEFORE: className="bg-gradient-to-r from-blue-600 to-purple-600"
// AFTER:  className="bg-gradient-to-r from-yellow-400 to-orange-500"
\`\`\`

**RESPONSE FORMAT - FOLLOW THIS EXACTLY:**

\`\`\`jsx
[EXACT COPY OF ALL ORIGINAL IMPORTS - DO NOT MODIFY ANYTHING]
[NEW LUCIDE IMPORTS ONLY IF NEEDED - PLACED AFTER EXISTING IMPORTS]

[COMPONENT DECLARATION - EXACT SAME NAME AND STRUCTURE]
  [ENHANCED JSX CONTENT WITH LAYOUT CHANGES]
  [UPDATED TAILWIND CLASSES FOR NEW THEME/LAYOUT]
  [PRESERVED FUNCTIONALITY AND CONTENT]
[CLOSING COMPONENT BRACE]

[EXACT COPY OF ALL ORIGINAL EXPORTS - DO NOT MODIFY ANYTHING]
\`\`\`

**FINAL VALIDATION CHECKLIST:**
Before returning code, verify:
✅ Every original import copied exactly (character-for-character)
✅ Every original export copied exactly (character-for-character)
✅ Component name unchanged from original
✅ Only className values modified for layout/theme changes
✅ All existing content and functionality preserved
✅ No new packages imported (except Lucide React if needed)
✅ Responsive design maintained with proper breakpoints
✅ Color scheme applied consistently throughout component

**CRITICAL REMINDER:**
- This is a LAYOUT/THEME modification, NOT a component rewrite
- PRESERVE structure, ENHANCE visual presentation
- Copy imports/exports EXACTLY to pass validation
- Focus on className changes for visual updates
- When in doubt, preserve existing code structure
`;
exports.targetedNodesPrompt = `
**USER REQUEST:** "{prompt}"

**TARGET NODES TO MODIFY:**
{targetNodes}

**FILE CONTEXT:**
**File:** {filePath}
**Component:** {componentName}
**Purpose:** {componentPurpose}

**PROJECT CONTEXT:**
{projectSummary}

**PRECISION MODIFICATION GUIDELINES:**

**1. SURGICAL PRECISION:**
- Modify ONLY the specified target nodes/elements
- Preserve ALL surrounding code structure exactly
- Maintain existing functionality and mock data unless explicitly requested
- Keep the overall component architecture completely intact
- Do NOT modify imports, exports, or component structure

**2. CONTENT PRESERVATION:**
- PRESERVE all existing mock data, sample content, placeholder text
- Keep existing user data, product information, content examples
- Maintain the semantic meaning and purpose of elements
- Only change content if explicitly requested in the user prompt

**3. ICON HANDLING (IF NEEDED):**
- If adding icons to target nodes, note the required import: import { IconName } from 'lucide-react'
- Use semantic icon names that match the element's function
- Common icons: ChevronRight, Home, User, Settings, Search, Menu, X, Plus, Edit, etc.
- Include import information in your response for the calling system to handle

**4. STYLING ENHANCEMENTS:**
- Apply modern Tailwind CSS classes to target elements
- Maintain consistency with surrounding elements
- Use appropriate hover effects and transitions
- Ensure responsive design for modified elements

**5. CONTEXT AWARENESS:**
- Consider the element's role within the larger component
- Maintain visual harmony with surrounding elements
- Preserve accessibility attributes and semantic structure
- Keep consistent with the overall design pattern

**RESPONSE FORMAT:**
Return ONLY a JSON object with the modified code for each target node:

\`\`\`json
{
  "node_1_id": {
    "modifiedCode": "<enhanced JSX code for this specific element>",
    "requiredImports": ["IconName", "AnotherIcon"]
  },
  "node_2_id": {
    "modifiedCode": "<enhanced JSX code maintaining context>",
    "requiredImports": []
  }
}
\`\`\`

**IMPORTANT NOTES:**
- modifiedCode should contain ONLY the JSX for that specific node/element
- requiredImports should list any new Lucide React icons needed
- Preserve all existing classes, attributes, and content unless specifically changing them
- Focus on precise, targeted improvements while maintaining overall consistency

Remember: Return ONLY the JSON with modified nodes and any required imports. No explanations.
`;
exports.componentPrompt = `
**USER REQUEST:** "{userRequest}"

Generate a PRODUCTION-READY React TypeScript component with exceptional design quality.

**COMPONENT SPECIFICATIONS:**
- Name: {componentName}
- Type: {componentType}
- Purpose: {componentPurpose}
- Design Theme: Modern, professional, contemporary

**DESIGN REQUIREMENTS:**

**1. VISUAL EXCELLENCE:**
- Stunning modern design with contemporary aesthetics
- Beautiful gradient backgrounds and sophisticated color schemes
- Professional shadows, depth, and layering effects
- Smooth animations and micro-interactions with Tailwind CSS
- Fully responsive design that works perfectly on all devices
- Consistent spacing and typography hierarchy

**2. ICON INTEGRATION:**
- Use ONLY Lucide React icons with proper imports
- Choose semantic icons that enhance functionality and user experience
- Consistent icon sizing (w-4 h-4, w-5 h-5, w-6 h-6) and styling throughout
- Common useful icons: Home, User, Settings, Search, Menu, X, ChevronRight, Plus, Edit, Trash2, Star, Heart, ArrowRight

**3. MOCK DATA INTEGRATION:**
- Include realistic, comprehensive mock data relevant to the component
- Ensure data demonstrates the component's full functionality
- Use varied, realistic examples that show real-world usage
- Structure data properly with TypeScript interfaces

**4. MODERN UI PATTERNS:**
- Implement card-based layouts with proper shadows and borders
- Use modern color schemes with Tailwind utilities
- Include hover effects, transitions, and interactive states
- Implement proper loading states and error handling where appropriate
- Use contemporary spacing patterns and visual hierarchy

**RESPONSE FORMAT:**
Return ONLY the TypeScript component code:

\`\`\`tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { IconName, AnotherIcon, ThirdIcon } from 'lucide-react';

interface {componentName}Props {
  className?: string;
  // Additional props with proper TypeScript types
}

interface DataInterface {
  // Proper TypeScript interfaces for mock data
}

export const {componentName}: React.FC<{componentName}Props> = ({ 
  className = '' 
}) => {
  const [activeState, setActiveState] = useState(false);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  
  // Comprehensive mock data
  const mockData: DataInterface[] = [
    // Realistic, varied mock data examples
  ];
  
  return (
    <div className={\`min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100 \${className}\`}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Beautiful, functional component content with modern design */}
        
        {/* Header Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Component Title
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Descriptive subtitle that explains the component purpose
          </p>
        </div>
        
        {/* Main Content Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockData.map((item, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow duration-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconName className="w-5 h-5 text-blue-600" />
                  {item.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Dynamic content based on mock data */}
              </CardContent>
            </Card>
          ))}
        </div>
        
        {/* Interactive Elements */}
        <div className="mt-12 text-center">
          <Button 
            onClick={() => setActiveState(!activeState)}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105"
          >
            <Plus className="w-5 h-5 mr-2" />
            Interactive Action
          </Button>
        </div>
      </div>
    </div>
  );
};

export default {componentName};
\`\`\`

Create a component that sets the standard for modern web development with exceptional design quality.
`;
exports.pagePrompt = `
**USER REQUEST:** "{userRequest}"

Generate a PRODUCTION-READY React TypeScript page with multiple sections and stunning design.

**PAGE SPECIFICATIONS:**
- Name: {pageName}
- Sections: Hero, Features, Content, CTA sections
- Description: {pageDescription}
- Theme: Modern, professional, engaging

**PAGE REQUIREMENTS:**
- Multiple distinct, well-designed content sections
- Beautiful hero section with gradients and modern styling
- Professional layout with proper spacing and responsive design
- Interactive elements with hover effects and animations
- Mobile-responsive design with Tailwind breakpoints
- Engaging content with comprehensive mock data
- Strategic use of Lucide React icons throughout

**RESPONSE FORMAT:**
Return ONLY the TypeScript page code:

\`\`\`tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, Star, ArrowRight, CheckCircle, Users, Target, Zap } from 'lucide-react';

export const {pageName}: React.FC = () => {
  const [activeSection, setActiveSection] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    setIsVisible(true);
  }, []);
  
  // Comprehensive mock data for the page
  const features = [
    {
      icon: <Zap className="w-8 h-8 text-blue-600" />,
      title: "Feature One",
      description: "Detailed description of this amazing feature"
    },
    // More feature objects...
  ];
   
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100">
      {/* Hero Section */}
      <section className="relative py-20 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700"></div>
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative max-w-7xl mx-auto text-center text-white">
          <div className={\`transform transition-all duration-1000 \${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}\`}>
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              Page Title
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-300">
                Compelling Subtitle
              </span>
            </h1>
            <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto leading-relaxed opacity-90">
              Engaging description that captures the essence of this page and motivates users to take action.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-4 text-lg font-semibold rounded-lg transition-all duration-300 transform hover:scale-105">
                Primary CTA
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button variant="outline" className="border-white text-white hover:bg-white hover:text-blue-600 px-8 py-4 text-lg font-semibold rounded-lg transition-all duration-300">
                Secondary CTA
              </Button>
            </div>
          </div>
        </div>
      </section>
       
      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Key Features
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Discover the powerful features that make this page exceptional
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border-0 bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      {feature.icon}
                    </div>
                    <CardTitle className="text-xl text-gray-900">
                      {feature.title}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
      
      {/* Content Section */}
      <section className="py-20 px-4 bg-white/50">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 mb-6">
                Content Section Title
              </h2>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                Detailed content that provides value to users and explains key concepts or benefits.
              </p>
              
              <div className="space-y-4 mb-8">
                {['Benefit One', 'Benefit Two', 'Benefit Three'].map((benefit, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700 font-medium">{benefit}</span>
                  </div>
                ))}
              </div>
              
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-300">
                Learn More
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
            
            <div className="relative">
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl p-8 text-white">
                <div className="grid grid-cols-2 gap-6">
                  <div className="text-center">
                    <Users className="w-12 h-12 mx-auto mb-4" />
                    <div className="text-3xl font-bold">10K+</div>
                    <div className="text-blue-100">Users</div>
                  </div>
                  <div className="text-center">
                    <Target className="w-12 h-12 mx-auto mb-4" />
                    <div className="text-3xl font-bold">99%</div>
                    <div className="text-blue-100">Success Rate</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 className="text-4xl font-bold mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Join thousands of satisfied users and experience the difference today.
          </p>
          <Button className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-4 text-lg font-semibold rounded-lg transition-all duration-300 transform hover:scale-105">
            Get Started Now
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>
    </div>
  );
};

export default {pageName};
\`\`\`
`;
exports.appPrompt = `
**USER REQUEST:** "{userRequest}"

Generate the complete App.tsx file with professional navigation and routing.

**APP SPECIFICATIONS:**
- Pages: {pagesList}
- Navigation: Professional header with mobile responsiveness
- Theme: Modern, clean, professional design
- Routing: React Router with smooth navigation

**REQUIREMENTS:**
- Beautiful sticky navigation header with gradient background
- Smooth routing between pages with React Router
-import will be like as every page or component will be default export
- Mobile hamburger menu with animations
- Professional design with consistent theme
- Responsive navigation that works on all devices
- Modern UI patterns with Tailwind CSS

**RESPONSE FORMAT:**
Return ONLY the TypeScript App code:

\`\`\`tsx
import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menu, X, Home, User, Settings, Mail, Info } from 'lucide-react';

// Import your page components here
// import HomePage from './pages/HomePage';
// import AboutPage from './pages/AboutPage';
// etc.

function Navigation() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  
  const navigation = [
    { name: 'Home', href: '/', icon: Home },
    { name: 'About', href: '/about', icon: Info },
    { name: 'Services', href: '/services', icon: Settings },
    { name: 'Contact', href: '/contact', icon: Mail },
  ];
  
  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-lg border-b border-gray-200/20 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Your Logo
            </Link>
          </div>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-8">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={\`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-all duration-200 \${
                    isActive 
                      ? 'text-blue-600 bg-blue-50' 
                      : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
                  }\`}
                >
                  <Icon className="w-4 h-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
          
          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-4">
            <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white">
              Get Started
            </Button>
          </div>
          
          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </Button>
          </div>
        </div>
      </div>
      
      {/* Mobile Navigation */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white/95 backdrop-blur-lg">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={\`flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-all duration-200 \${
                    isActive 
                      ? 'text-blue-600 bg-blue-50' 
                      : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
                  }\`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Icon className="w-5 h-5" />
                  {item.name}
                </Link>
              );
            })}
            <div className="pt-4 mt-4 border-t border-gray-200">
              <Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white">
                Get Started
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <Navigation />
        
        {/* Main Content */}
        <main className="flex-1">
          <Routes>
            {/* Replace these with your actual page components */}
            <Route path="/" element={
              <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                  <h1 className="text-4xl font-bold text-gray-900 mb-4">Welcome to Your App</h1>
                  <p className="text-lg text-gray-600">Replace this with your HomePage component</p>
                </div>
              </div>
            } />
            <Route path="/about" element={
              <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                  <h1 className="text-4xl font-bold text-gray-900 mb-4">About Page</h1>
                  <p className="text-lg text-gray-600">Replace this with your AboutPage component</p>
                </div>
              </div>
            } />
            <Route path="/services" element={
              <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                  <h1 className="text-4xl font-bold text-gray-900 mb-4">Services Page</h1>
                  <p className="text-lg text-gray-600">Replace this with your ServicesPage component</p>
                </div>
              </div>
            } />
            <Route path="/contact" element={
              <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                  <h1 className="text-4xl font-bold text-gray-900 mb-4">Contact Page</h1>
                  <p className="text-lg text-gray-600">Replace this with your ContactPage component</p>
                </div>
              </div>
            } />
          </Routes>
        </main>
        
        {/* Footer */}
        <footer className="bg-gray-900 text-white py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <p className="text-gray-400">
                © 2024 Your Company. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;
\`\`\`
`;
// Template utility functions
function replaceTemplateVariables(template, variables) {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{${key}}`, 'g');
        result = result.replace(regex, value);
    }
    return result;
}
// Enhanced prompt selection with context awareness
function getEnhancedPromptForApproach(approach) {
    switch (approach) {
        case 'FULL_FILE':
            return exports.fullFilePrompt;
        case 'TARGETED_NODES':
            return exports.targetedNodesPrompt;
        case 'COMPONENT_ADDITION':
            return exports.componentPrompt;
        default:
            return exports.fullFilePrompt;
    }
}
// Component-specific prompt selection
function getComponentPrompt(componentType) {
    switch (componentType) {
        case 'component':
            return exports.componentPrompt;
        case 'page':
            return exports.pagePrompt;
        case 'app':
            return exports.appPrompt;
        default:
            return exports.componentPrompt;
    }
}
// Enhanced template variable preparation for full file modifications
function prepareFullFileVariables(userRequest, filePath, fileContent, projectSummary, fileAnalysis, preservationPrompt, modificationSummary = '') {
    return {
        userRequest,
        filePath,
        fileContent,
        projectSummary: projectSummary.substring(0, 2000), // Limit for context
        componentName: fileAnalysis.componentName || 'Unknown',
        lineCount: fileAnalysis.lineCount.toString(),
        fileType: fileAnalysis.fileType,
        filePurpose: fileAnalysis.filePurpose,
        preservationPrompt,
        modificationSummary
    };
}
// Enhanced template variable preparation for layout changes
function prepareLayoutChangeVariables(userRequest, filePath, fileContent, projectSummary, fileAnalysis, preservationPrompt, modificationSummary = '') {
    // Enhanced preservation prompt for layout changes
    const enhancedPreservationPrompt = `
**CRITICAL IMPORT/EXPORT PRESERVATION FOR LAYOUT CHANGES:**

**ALL IMPORTS MUST BE COPIED EXACTLY:**
${extractImportsFromContent(fileContent).map(imp => `✓ REQUIRED: ${imp}`).join('\n')}

**ALL EXPORTS MUST BE COPIED EXACTLY:**
${extractExportsFromContent(fileContent).map(exp => `✓ REQUIRED: ${exp}`).join('\n')}

**COMPONENT STRUCTURE REQUIREMENTS:**
✓ Component name: ${fileAnalysis.componentName || 'PRESERVE ORIGINAL NAME'}
✓ Function/const declaration: PRESERVE EXACTLY
✓ Props interface: PRESERVE EXACTLY
✓ Export syntax: PRESERVE EXACTLY

**LAYOUT CHANGE FOCUS:**
✓ This is a visual/layout modification only
✓ Update className values for theme/layout changes
✓ Keep all existing JSX structure and hierarchy
✓ Preserve all existing functionality and content
✓ DO NOT rewrite the component, just enhance its appearance
  `;
    return {
        userRequest,
        filePath,
        fileContent,
        projectSummary: projectSummary.substring(0, 1500), // Limit for context
        componentName: fileAnalysis.componentName || 'Component',
        lineCount: fileAnalysis.lineCount.toString(),
        fileType: fileAnalysis.fileType,
        filePurpose: fileAnalysis.filePurpose,
        preservationPrompt: enhancedPreservationPrompt,
        modificationSummary
    };
}
// Enhanced template variable preparation for targeted nodes
function prepareTargetedNodesVariables(prompt, filePath, componentName, componentPurpose, targetNodes, projectSummary) {
    return {
        prompt,
        filePath,
        componentName,
        componentPurpose,
        targetNodes,
        projectSummary: projectSummary.substring(0, 1500) // Limit for context
    };
}
// Enhanced template variable preparation for component generation
function prepareComponentVariables(userRequest, componentName, componentType, componentPurpose, designTheme = 'modern') {
    return {
        userRequest,
        componentName,
        componentType,
        componentPurpose,
        designTheme
    };
}
// Helper function to extract imports more reliably
function extractImportsFromContent(content) {
    const imports = [];
    const lines = content.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('import ') && !trimmed.includes('//')) {
            imports.push(line); // Keep original formatting including indentation
        }
    }
    return imports;
}
// Helper function to extract exports more reliably
function extractExportsFromContent(content) {
    const exports = [];
    const lines = content.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('export ') && !trimmed.includes('//')) {
            exports.push(line); // Keep original formatting including indentation
        }
    }
    return exports;
}
// Enhanced repair function for layout changes
function createLayoutRepairFunction() {
    return function repairFileStructureForLayout(brokenContent, originalContent, componentName) {
        try {
            console.log('🔧 Attempting enhanced layout repair...');
            const originalLines = originalContent.split('\n');
            const brokenLines = brokenContent.split('\n');
            // Extract original structure
            const originalImports = originalLines.filter(line => line.trim().startsWith('import '));
            const originalExports = originalLines.filter(line => line.trim().startsWith('export '));
            // Find component content start/end
            let componentStart = -1;
            let componentEnd = -1;
            for (let i = 0; i < originalLines.length; i++) {
                const line = originalLines[i].trim();
                if ((line.includes('function ') || line.includes('const ')) &&
                    (line.includes('=') || line.includes('('))) {
                    componentStart = i;
                    break;
                }
            }
            for (let i = originalLines.length - 1; i >= 0; i--) {
                const line = originalLines[i].trim();
                if (line.startsWith('export ')) {
                    componentEnd = i;
                    break;
                }
            }
            // Find modified content (between imports and exports)
            const brokenImports = brokenLines.filter(line => line.trim().startsWith('import '));
            const brokenExports = brokenLines.filter(line => line.trim().startsWith('export '));
            // Get the component content from broken version
            let modifiedComponentContent = [];
            let inComponentSection = false;
            for (const line of brokenLines) {
                const trimmed = line.trim();
                // Skip import/export lines
                if (trimmed.startsWith('import ') || trimmed.startsWith('export ')) {
                    continue;
                }
                // Skip empty lines at start
                if (!inComponentSection && trimmed === '') {
                    continue;
                }
                if (!inComponentSection && trimmed !== '') {
                    inComponentSection = true;
                }
                if (inComponentSection) {
                    modifiedComponentContent.push(line);
                }
            }
            // Remove trailing empty lines and export statements from component content
            while (modifiedComponentContent.length > 0) {
                const lastLine = modifiedComponentContent[modifiedComponentContent.length - 1].trim();
                if (lastLine === '' || lastLine.startsWith('export ')) {
                    modifiedComponentContent.pop();
                }
                else {
                    break;
                }
            }
            // Reconstruct the file
            const repairedLines = [];
            // Add original imports exactly
            repairedLines.push(...originalImports);
            // Add empty line after imports if there were imports
            if (originalImports.length > 0) {
                repairedLines.push('');
            }
            // Add modified component content
            repairedLines.push(...modifiedComponentContent);
            // Add empty line before exports if there are exports
            if (originalExports.length > 0) {
                repairedLines.push('');
            }
            // Add original exports exactly
            repairedLines.push(...originalExports);
            const repairedContent = repairedLines.join('\n');
            console.log('✅ Enhanced layout repair completed');
            return repairedContent;
        }
        catch (error) {
            console.error('❌ Enhanced layout repair failed:', error);
            return null;
        }
    };
}
//# sourceMappingURL=template.js.map