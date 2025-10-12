
'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from 'next/link';
import { ArrowRight, Flame, LayoutDashboard, Spline, ListPlus, ClipboardList, AreaChart } from "lucide-react";

const featureCards = [
    {
        title: "Dashboard",
        description: "View real-time overview of production and manpower.",
        href: "/dashboard",
        icon: <AreaChart className="w-8 h-8 text-purple-500" />
    },
    {
        title: "GT Production Entry",
        description: "Log and track Green Tyre production entries in real-time.",
        href: "/gt-production-entry",
        icon: <LayoutDashboard className="w-8 h-8 text-blue-500" />
    },
    {
        title: "Curing",
        description: "Manage curing press operations and production data.",
        href: "/curing-entry",
        icon: <Flame className="w-8 h-8 text-red-500" />
    },
    {
        title: "Tread Extrusion",
        description: "Manage tread stock and opening balances.",
        href: "/tread-extrusion",
        icon: <ClipboardList className="w-8 h-8 text-orange-500" />
    },
    {
        title: "Tread Production Entry",
        description: "Log tread production quantities per SKU.",
        href: "/tread-production-entry",
        icon: <ListPlus className="w-8 h-8 text-indigo-500" />
    },
    {
        title: "Planning",
        description: "Access GT and Tread production planning modules.",
        href: "/planning/gt",
        icon: <Spline className="w-8 h-8 text-green-500" />
    },
];

export default function AutoTyrePage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-100 to-slate-200 p-4 md:p-8">
            <div className="max-w-5xl mx-auto">
                <div className="text-center py-12">
                    <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-gray-800">
                        Auto Tyre Production
                    </h1>
                    <p className="mt-4 text-lg text-muted-foreground">
                        A centralized dashboard for all tyre manufacturing modules.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {featureCards.map((feature) => (
                        <Card key={feature.href} className="hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                            <CardHeader className="flex flex-row items-start gap-4">
                                <div className="p-3 bg-muted rounded-lg">
                                    {feature.icon}
                                </div>
                                <div>
                                    <CardTitle>{feature.title}</CardTitle>
                                    <CardDescription className="mt-1">{feature.description}</CardDescription>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <Button asChild className="w-full">
                                    <Link href={feature.href}>
                                        Go to Section <ArrowRight className="ml-2 h-4 w-4" />
                                    </Link>
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
}
