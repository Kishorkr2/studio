
'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Spline, Circle, ToyBrick, Layers } from 'lucide-react';

const planningSections = [
  {
    value: 'tread',
    title: 'Tread Planning',
    description: 'Plan and manage tread production requirements.',
    icon: Spline,
    content: (
      <div className="text-center text-muted-foreground p-8">
        <p>Tread planning features will be implemented here.</p>
      </div>
    ),
  },
  {
    value: 'bead',
    title: 'Bead Planning',
    description: 'Schedule and track bead manufacturing.',
    icon: Circle,
    content: (
      <div className="text-center text-muted-foreground p-8">
        <p>Bead planning features will be implemented here.</p>
      </div>
    ),
  },
  {
    value: 'gt',
    title: 'GT (Green Tyre) Planning',
    description: 'Coordinate Green Tyre building schedules.',
    icon: ToyBrick,
     content: (
      <div className="text-center text-muted-foreground p-8">
        <p>GT planning features will be implemented here.</p>
      </div>
    ),
  },
  {
    value: 'fabric',
    title: 'Fabric Planning',
    description: 'Manage fabric cutting and allocation.',
    icon: Layers,
     content: (
      <div className="text-center text-muted-foreground p-8">
        <p>Fabric planning features will be implemented here.</p>
      </div>
    ),
  },
];

export default function PlanningPage() {
  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">
          Production Planning
        </h1>
        <p className="text-muted-foreground">
          A centralized hub for all production planning activities.
        </p>
      </div>

      <Accordion
        type="multiple"
        className="w-full space-y-4"
        defaultValue={['tread']}
      >
        {planningSections.map(section => {
          const Icon = section.icon;
          return (
            <AccordionItem
              key={section.value}
              value={section.value}
              className="border rounded-lg bg-card"
            >
              <AccordionTrigger className="hover:no-underline p-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                    <Icon className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-left">
                      {section.title}
                    </h3>
                    <p className="text-sm text-muted-foreground text-left">
                      {section.description}
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-6 pt-0">
                {section.content}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
