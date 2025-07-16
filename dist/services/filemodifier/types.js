"use strict";
// ============================================================================
// TYPES: filemodifier/types.ts - Complete Type Definitions with TAILWIND_CHANGE
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_TAILWIND_COLORS = exports.COMPONENT_TYPES = exports.MODIFICATION_APPROACHES = void 0;
exports.isTailwindChangeScope = isTailwindChangeScope;
exports.isComponentAdditionScope = isComponentAdditionScope;
exports.hasColorChanges = hasColorChanges;
exports.hasTailwindModification = hasTailwindModification;
// Constants for modification approaches
exports.MODIFICATION_APPROACHES = [
    'TAILWIND_CHANGE',
    'TARGETED_NODES',
    'COMPONENT_ADDITION',
    'FULL_FILE'
];
exports.COMPONENT_TYPES = ['component', 'page', 'app'];
// Default color configurations for different industries
exports.DEFAULT_TAILWIND_COLORS = {
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
};
// ============================================================================
// TYPE GUARDS AND HELPER FUNCTIONS
// ============================================================================
function isTailwindChangeScope(scope) {
    return scope.scope === 'TAILWIND_CHANGE';
}
function isComponentAdditionScope(scope) {
    return scope.scope === 'COMPONENT_ADDITION';
}
function hasColorChanges(scope) {
    return scope.scope === 'TAILWIND_CHANGE' && !!scope.colorChanges;
}
function hasTailwindModification(result) {
    return result.approach === 'TAILWIND_CHANGE' && !!result.tailwindModification;
}
//# sourceMappingURL=types.js.map