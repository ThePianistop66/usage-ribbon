# usage-ribbon

A Claude Code mod that adds a ribbon above the prompt box showing:

- **5-hour limit**: a bar with the percentage used and time until reset
- **Weekly limit**: the same for the 7-day window
- **Task progress**: a bar of completed vs. total steps in Claude's current task list, with the step it's working on

Bars turn yellow at 70% and red at 90%. The usage bars need a Claude subscription (Pro/Max) and fill in after the first message of a session. The ribbon draws in the Claude Code terminal and desktop app.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install usage-ribbon --marketplace ThePianistop66/usage-ribbon
```

Answer `y` to add the marketplace, then pick a scope (user scope loads it in every session).

From a shell:

```bash
claude plugin install usage-ribbon --marketplace ThePianistop66/usage-ribbon
```

In the desktop app: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `ThePianistop66/usage-ribbon`, then **Add plugin**.
