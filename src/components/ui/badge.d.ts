// Type shim for the untyped badge.jsx implementation (loose props by design;
// the .jsx file remains the runtime module — do not convert it).
import * as React from 'react';

export declare const Badge: React.ComponentType<any>;
export declare const badgeVariants: (...args: any[]) => string;
