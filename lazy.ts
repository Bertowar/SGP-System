import React from 'react';

/**
 * Helper to simplify React.lazy with typed imports
 * @param importFn The dynamic import function
 * @returns A lazy loaded component
 */
export const lazy = (importFn: () => Promise<{ default: React.ComponentType<any> }>) =>
    React.lazy(importFn);
