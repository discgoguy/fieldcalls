// Type shim for the untyped popover.jsx implementation (loose props by design;
// the .jsx file remains the runtime module - do not convert it).
import * as React from 'react';

type LooseProps = React.PropsWithChildren<Record<string, unknown>>;

export declare const Popover: React.ComponentType<LooseProps>;
export declare const PopoverTrigger: React.ComponentType<LooseProps>;
export declare const PopoverContent: React.ComponentType<LooseProps>;
export declare const PopoverAnchor: React.ComponentType<LooseProps>;
