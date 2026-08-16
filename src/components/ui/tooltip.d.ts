// Type shim for the untyped tooltip.jsx implementation (loose props by design;
// the .jsx file remains the runtime module — do not convert it).
import * as React from 'react';

type LooseProps = React.PropsWithChildren<Record<string, unknown>>;

export declare const TooltipProvider: React.ComponentType<LooseProps>;
export declare const Tooltip: React.ComponentType<LooseProps>;
export declare const TooltipTrigger: React.ComponentType<LooseProps>;
export declare const TooltipContent: React.ComponentType<LooseProps>;
