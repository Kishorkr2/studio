'use server';

/**
 * @fileOverview Optimizes operator assignments to machines based on skills, shift times, and absenteeism.
 *
 * - optimizeOperatorAssignment - A function that suggests the optimal operator assignments.
 * - OptimizeOperatorAssignmentInput - The input type for the optimizeOperatorAssignment function.
 * - OptimizeOperatorAssignmentOutput - The return type for the optimizeOperatorAssignment function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const OperatorSkillSchema = z.object({
  operatorId: z.string().describe('Unique identifier for the operator.'),
  skillRating: z
    .number()
    .int()
    .min(1)
    .max(5)
    .describe('Skill rating of the operator (1-5).'),
});

const MachineAvailabilitySchema = z.object({
  machineId: z.string().describe('Unique identifier for the machine.'),
  isAvailable: z
    .boolean()
    .describe('Whether the machine is available for the shift.'),
});

const ShiftTimeSchema = z.object({
  startTime: z.string().describe('The shift start time, formatted as HH:mm.'),
  endTime: z.string().describe('The shift end time, formatted as HH:mm.'),
});

const OperatorAbsenteeismSchema = z.object({
  operatorId: z.string().describe('Unique identifier for the operator.'),
  isAbsent: z
    .boolean()
    .describe('Whether the operator is absent for the shift.'),
});

const OptimizeOperatorAssignmentInputSchema = z.object({
  operators: z
    .array(OperatorSkillSchema)
    .describe('List of operators and their skill ratings.'),
  machines: z
    .array(MachineAvailabilitySchema)
    .describe('List of machines and their availability.'),
  shiftTimes: ShiftTimeSchema.describe('Shift start and end times.'),
  absenteeism: z
    .array(OperatorAbsenteeismSchema)
    .describe('List of operators and their absenteeism status.'),
});
export type OptimizeOperatorAssignmentInput = z.infer<
  typeof OptimizeOperatorAssignmentInputSchema
>;

const AssignmentSchema = z.object({
  operatorId: z.string().describe('The ID of the assigned operator.'),
  machineId: z
    .string()
    .describe('The ID of the machine the operator is assigned to.'),
  reason: z
    .string()
    .optional()
    .describe('Reasoning for the assignment, if available.'),
});

const OptimizeOperatorAssignmentOutputSchema = z.object({
  assignments: z
    .array(AssignmentSchema)
    .describe('Recommended assignments of operators to machines.'),
  summary: z
    .string()
    .describe('A summary of the assignment optimization process.'),
});
export type OptimizeOperatorAssignmentOutput = z.infer<
  typeof OptimizeOperatorAssignmentOutputSchema
>;

export async function optimizeOperatorAssignment(
  input: OptimizeOperatorAssignmentInput
): Promise<OptimizeOperatorAssignmentOutput> {
  return optimizeOperatorAssignmentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'optimizeOperatorAssignmentPrompt',
  input: {schema: OptimizeOperatorAssignmentInputSchema},
  output: {schema: OptimizeOperatorAssignmentOutputSchema},
  prompt: `You are an AI assistant that suggests the best possible operator assignments to machines in a factory setting.

  Consider the following factors to make optimal assignments:
  - Operator skill ratings: Higher skill ratings should be prioritized for more complex machines.
  - Machine availability: Only assign operators to available machines.
  - Shift times: Ensure that the assignments are valid for the given shift times.
  - Operator absenteeism: Do not assign absent operators to any machines.

  Input Data:
  Operators: {{{json operators}}}
  Machines: {{{json machines}}}
  Shift Times: {{{json shiftTimes}}}
  Absenteeism: {{{json absenteeism}}}

  Provide the assignments in JSON format, along with a summary of the optimization process.
  Explain the reasoning for each assignment in the output when possible.
  `,
});

const optimizeOperatorAssignmentFlow = ai.defineFlow(
  {
    name: 'optimizeOperatorAssignmentFlow',
    inputSchema: OptimizeOperatorAssignmentInputSchema,
    outputSchema: OptimizeOperatorAssignmentOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
