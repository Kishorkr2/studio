"use server";

import { optimizeOperatorAssignment as optimize } from "@/ai/flows/optimize-operator-assignment";
import type { OptimizeOperatorAssignmentInput, OptimizeOperatorAssignmentOutput } from "@/ai/flows/optimize-operator-assignment";

export async function optimizeOperatorAssignment(
  input: OptimizeOperatorAssignmentInput
): Promise<OptimizeOperatorAssignmentOutput> {
  return optimize(input);
}
