import {
  type PermissionTier,
  type PermissionPolicy,
  type CheckPermissionResult,
  GitButlerError,
} from '@git-butler/core';
import { type OperationName, OPERATION_TIERS, TIER_LEVELS } from './operations.js';

export interface PermissionContext {
  targetBranch?: string;
  isForce?: boolean;
  agentId?: string;
  taskId?: string;
  metadata?: Record<string, unknown>;
}

export class PermissionGuard {
  public canExecute(
    operation: OperationName,
    policy: PermissionPolicy,
    context?: PermissionContext
  ): CheckPermissionResult {
    const requiredTier = OPERATION_TIERS[operation] ?? 'DANGEROUS';
    const activeTier = policy.tier;

    // 1. Protected Branch Rules (Evaluated first for safety)
    if (context?.targetBranch) {
      const isProtected = policy.protectedBranches.some(
        (b) => b.toLowerCase() === context.targetBranch?.toLowerCase()
      );

      if (isProtected) {
        // Direct commit to protected branch
        if (operation === 'git:commit' && !policy.allowDirectMainCommit) {
          return {
            allowed: false,
            requiredTier,
            activeTier,
            reason: `Direct commits to protected branch "${context.targetBranch}" are blocked by policy.`,
          };
        }

        // Deletion of protected branch
        if (operation === 'git:branch_delete_safe' || operation === 'git:branch_delete_force') {
          return {
            allowed: false,
            requiredTier,
            activeTier,
            reason: `Deletion of protected branch "${context.targetBranch}" is blocked by policy.`,
          };
        }

        // Force push to protected branch
        if (operation === 'git:push_force' || (operation === 'git:push' && context.isForce)) {
          return {
            allowed: false,
            requiredTier,
            activeTier,
            reason: `Force pushing to protected branch "${context.targetBranch}" is strictly blocked.`,
          };
        }
      }
    }

    // 2. Tier Level Check
    if (TIER_LEVELS[activeTier] < TIER_LEVELS[requiredTier]) {
      return {
        allowed: false,
        requiredTier,
        activeTier,
        reason: `Operation "${operation}" requires tier ${requiredTier}, but active policy tier is ${activeTier}.`,
      };
    }

    // 3. Force Push Global Policy Check
    if ((operation === 'git:push_force' || (operation === 'git:push' && context?.isForce)) && !policy.allowForcePush) {
      if (activeTier !== 'DANGEROUS') {
        return {
          allowed: false,
          requiredTier: 'DANGEROUS',
          activeTier,
          reason: `Force push is blocked by policy (requires DANGEROUS tier or allowForcePush: true).`,
        };
      }
    }

    return {
      allowed: true,
      requiredTier,
      activeTier,
    };
  }

  public assertAllowed(
    operation: OperationName,
    policy: PermissionPolicy,
    context?: PermissionContext
  ): void {
    const result = this.canExecute(operation, policy, context);
    if (!result.allowed) {
      throw new GitButlerError(
        result.reason || `Permission denied for operation "${operation}".`,
        'PERMISSION_DENIED',
        {
          operation,
          requiredTier: result.requiredTier,
          activeTier: result.activeTier,
          targetBranch: context?.targetBranch,
        }
      );
    }
  }
}

export const defaultPermissionGuard = new PermissionGuard();
