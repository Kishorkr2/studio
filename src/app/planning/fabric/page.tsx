'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Layers } from 'lucide-react';

export default function FabricPlanningPage() {
    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tight">
                    Fabric Planning
                </h1>
                <p className="text-muted-foreground">
                    Manage fabric cutting and allocation.
                </p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Coming Soon</CardTitle>
                    <CardDescription>
                        This section is under development.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center text-center text-muted-foreground h-64">
                    <Layers className="w-12 h-12 mb-4" />
                    <p>Fabric planning features will be implemented here.</p>
                </CardContent>
            </Card>
        </div>
    );
}
