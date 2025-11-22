import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Sparkles } from 'lucide-react';
import { createPageUrl } from '@/utils';

export default function TrialCheck({ children }) {
    // Trial system disabled - always render children
    return <>{children}</>;
}