// Type shim for the untyped button.jsx implementation (loose props by design;
// the .jsx file remains the runtime module — do not convert it).
import * as React from 'react';

export declare const Button: React.ComponentType<any>;
export declare const buttonVariants: (...args: any[]) => string;
