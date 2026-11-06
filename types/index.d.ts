export type Limit = { kind: string; percentUsed: number; resetsAt?: string }
export type TaskItem = { id: string; title: string; status: 'pending' | 'in_progress' | 'completed' }

declare module 'claude-code' {
  interface PluginState {
    'usage-ribbon': { limits: Limit[]; tasks: TaskItem[]; isWorking: boolean }
  }
}
