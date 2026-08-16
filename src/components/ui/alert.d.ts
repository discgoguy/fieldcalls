// Type shim for the untyped alert.jsx implementation (loose props by design;
// the .jsx file remains the runtime module — do not convert it).
import * as React from 'react';

export declare const Alert: React.ComponentType<any>;
export declare const AlertTitle: React.ComponentType<any>;
export declare const AlertDescription: React.ComponentType<any>;
