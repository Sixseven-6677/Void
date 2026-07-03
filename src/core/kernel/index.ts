/**
 * @file kernel/index.ts
 * @description Barrel export for the Void Application Kernel.
 *
 * The Kernel is the heart of Void — it manages the lifecycle of every subsystem
 * through a uniform module interface, without knowing what those subsystems do.
 *
 * Import pattern:
 *   import { Kernel, type IKernelModule, KernelPriority } from '@void/core/kernel';
 */

export { Kernel, type KernelOptions }              from './Kernel.js';
export type { IKernelModule }                       from './IKernelModule.js';
export type { IKernelContext }                      from './IKernelContext.js';
export {
  KernelPriority,
  type KernelPhase,
  type KernelHealth,
  type ModuleHealth,
  type ModuleHealthStatus,
  type ShutdownReason,
  type PhaseChangeEvent,
  type PhaseChangeHandler,
  type KernelPriorityBand,
} from './kernel.types.js';
