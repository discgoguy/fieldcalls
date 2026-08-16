// Type shim for the untyped tabs.jsx implementation (loose props by design;
// the .jsx file remains the runtime module — do not convert it).
import * as React from 'react';

type LooseProps = React.PropsWithChildren<Record<string, unknown>>;

export declare const Tabs: React.ComponentType<LooseProps>;
export declare const TabsList: React.ComponentType<LooseProps>;
export declare const TabsTrigger: React.ComponentType<LooseProps>;
export declare const TabsContent: React.ComponentType<LooseProps>;
