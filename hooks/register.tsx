import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Limit, TaskItem } from '../types'

const limits = atom({ plugin: 'usage-ribbon', key: 'limits' } as const, [] as Limit[])
const tasks = atom({ plugin: 'usage-ribbon', key: 'tasks' } as const, [] as TaskItem[])
const isWorking = atom({ plugin: 'usage-ribbon', key: 'isWorking' } as const, false)

const bar = (pct: number, width = 10) => {
  const filled = Math.max(0, Math.min(width, Math.round((pct / 100) * width)))
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

const tone = (pct: number) => (pct >= 90 ? 'error' : pct >= 70 ? 'warning' : 'success')

const resetIn = (iso: string | undefined, now: number) => {
  if (!iso) return ''
  const mins = Math.max(0, Math.round((Date.parse(iso) - now) / 60000))
  if (mins >= 1440) return ` ↻${Math.floor(mins / 1440)}d${Math.floor((mins % 1440) / 60)}h`
  if (mins >= 60) return ` ↻${Math.floor(mins / 60)}h${mins % 60}m`
  return ` ↻${mins}m`
}

export const register: Register = on => {
  // Seed limits once so the ribbon has numbers right away.
  on('session.start', async ($, e, next) => {
    const r = await next(e)
    const u = await $.session.usage()
    if (u.rateLimits.length) await update($, limits, () => u.rateLimits.map(l => ({ ...l })))
    return r
  })

  // Pushed by the engine whenever a limit window moves.
  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) {
      await update($, limits, () => e.rateLimits.map(l => ({ ...l })))
    }
    return next(e)
  })

  // Task tracking: TodoWrite sends the whole list.
  on('tool.call', { tool: 'TodoWrite' }, async ($, e, next) => {
    const r = await next(e)
    if (r.deny === undefined && !r.isError) {
      await update($, tasks, () =>
        e.todos.map((t, i): TaskItem => ({ id: String(i), title: t.status === 'in_progress' ? t.activeForm : t.content, status: t.status })),
      )
    }
    return r
  })

  // Task tracking: TaskCreate / TaskUpdate are incremental.
  on('tool.call', { tool: 'TaskCreate' }, async ($, e, next) => {
    const r = await next(e)
    if (r.deny === undefined && !r.isError && r.result) {
      const task = r.result.task
      await update($, tasks, (ts): TaskItem[] => [...ts, { id: task.id, title: task.subject, status: 'pending' }])
    }
    return r
  })

  on('tool.call', { tool: 'TaskUpdate' }, async ($, e, next) => {
    const r = await next(e)
    if (r.deny === undefined && !r.isError) {
      const next_ = e.status === 'deleted' ? undefined : e.status
      await update($, tasks, (ts): TaskItem[] =>
        e.status === 'deleted'
          ? ts.filter(t => t.id !== e.taskId)
          : ts.map(t =>
              t.id !== e.taskId
                ? t
                : {
                    ...t,
                    title: e.status === 'in_progress' && e.activeForm ? e.activeForm : (e.subject ?? t.title),
                    status: next_ ?? t.status,
                  },
            ),
      )
    }
    return r
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) await update($, isWorking, () => true)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      await update($, isWorking, () => false)
      // Clear a finished list so the next task starts fresh.
      const ts = await read($, tasks)
      if (ts.length && ts.every(t => t.status === 'completed')) await update($, tasks, () => [])
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const ls = await read($, limits)
    const ts = await read($, tasks)
    const working = await read($, isWorking)
    const now = await $.clock.now()
    const { Box, Text } = $.ui.resolve(e)

    const five = ls.find(l => l.kind === 'five_hour')
    const week = ls.find(l => l.kind === 'seven_day')
    const done = ts.filter(t => t.status === 'completed').length
    const current = ts.find(t => t.status === 'in_progress')
    const taskPct = ts.length ? Math.round((done / ts.length) * 100) : 0

    const limitCell = (label: string, l: Limit | undefined) => (
      <Text>
        <Text dimColor>{label} </Text>
        {l ? (
          <Text>
            <Text color={tone(l.percentUsed)}>{bar(l.percentUsed, 8)}</Text> {Math.round(l.percentUsed)}%
            <Text dimColor>{resetIn(l.resetsAt, now)}</Text>
          </Text>
        ) : (
          <Text dimColor>—</Text>
        )}
      </Text>
    )

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" gap={3}>
          {limitCell('5h', five)}
          {limitCell('Week', week)}
        </Box>
        {ts.length > 0 ? (
          <Text>
            <Text dimColor>Task </Text>
            <Text color="claude">{bar(taskPct, 16)}</Text> {done}/{ts.length}
            {current ? <Text dimColor> · {current.title}</Text> : null}
          </Text>
        ) : working ? (
          <Text dimColor>Task  working…</Text>
        ) : null}
      </Box>
    )
  })
}
