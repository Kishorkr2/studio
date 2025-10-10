
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Wrench } from 'lucide-react';

export default function AutoTubePage() {
    return (
        <div className="space-y-6 p-4 md:p-8">
            <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tight">
                    Auto Tube
                </h1>
                <p className="text-muted-foreground">
                    Manage and track auto tube production.
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
                    <Wrench className="w-12 h-12 mb-4" />
                    <p>Auto Tube management features will be implemented here.</p>
                </CardContent>
            </Card>
        </div>
    );
}
