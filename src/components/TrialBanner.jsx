import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, Crown } from 'lucide-react';
import { createPageUrl } from '@/utils';

export default function TrialBanner() {
    // Trial system disabled - don't show banner
    return null;
}