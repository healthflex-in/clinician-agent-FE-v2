import React from 'react';
import { RefreshCw } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';

export const PermissionLoadingState: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-primary/5 to-background">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Checking microphone permissions...</p>
        </CardContent>
      </Card>
    </div>
  );
};