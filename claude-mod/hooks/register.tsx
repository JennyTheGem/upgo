import type { EngineInterface, Register } from 'claude-code'

const PANE = 'upgo-goals'
const FILE = 'goals.json'
const PHASES: Record<string, string> = { now: 'Now', next: 'Next', later: 'Later', wayLater: 'Way later', maybe: 'Maybe' }
const QUIET = new Set(['later', 'wayLater', 'maybe'])
const ACCENT = '#cc1aec'
const OPEN = (status: string) => status !== 'done' && status !== 'dropped'
// How often to look for goals.json changes (ms).
const POLL_MS = 3000

type Item = { id: string; title: string; phase: string; status: string; size?: string }
type Goals = { project?: string; items?: Item[] } | null

// Nearest goals.json at or above the session root, as upgo finds it. A shell cd moves cwd, not the root.
async function locate($: EngineInterface): Promise<string> {
  for (let dir = await $.session.root(); ; ) {
    const path = `${dir}/${FILE}`
    if (await $.fs.exists(path)) return path
    const up = dir.replace(/[\\/][^\\/]*$/, '')
    if (!up || up === dir) throw new Error(`no ${FILE}`)
    dir = up
  }
}

export const register: Register = on => {
  let seen = ''

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'goals', description: 'Show all open upgo goals in a side pane' })
    $.clock.every(POLL_MS, async () => {
      const now = await locate($).then(async p => p + (await $.fs.stat(p)).mtimeMs).catch(() => '')
      if (now !== seen) {
        seen = now
        $.ui.invalidate('ui.render')
      }
    })
    return next(e)
  })

  on('command.run', { command: 'goals' }, async $ => {
    const opened = await $.ui.open({ id: PANE, title: 'Goals' })
    return { text: opened.isPlaced ? 'Goals pane opened.' : `Goals pane waits: ${opened.reason}` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    let goals: Goals
    try {
      goals = JSON.parse(await $.fs.read(await locate($)))
    } catch {
      return <Text dimColor>No goals.json here. Run `upgo init` to start.</Text>
    }
    // A Button without a title is refused and blanks the whole pane.
    const items = Array.isArray(goals?.items) ? goals.items : []
    const open = items.filter(i => typeof i?.title === 'string' && OPEN(i.status))

    return (
      <Box flexDirection="column">
        <Text>
          <Text bold color={ACCENT}>{goals?.project ?? 'Goals'}</Text>
          <Text dimColor>  {open.length} open</Text>
        </Text>
        {open.length === 0 && <Text dimColor>Nothing open. Add one with `upgo add`.</Text>}
        {Object.entries(PHASES).map(([phase, label]) => {
          // In-progress first, then the file's own order.
          const items = open
            .filter(i => i.phase === phase)
            .sort((a, b) => Number(b.status === 'partial') - Number(a.status === 'partial'))
          const quiet = QUIET.has(phase)
          return items.length > 0 && (
            <Box flexDirection="column" marginTop={1}>
              <Text>
                <Text bold dimColor={quiet} color={phase === 'now' ? ACCENT : undefined}>{label}</Text>
                <Text dimColor>  {items.length}</Text>
              </Text>
              {items.map(i => (
                <Box flexDirection="row" gap={1}>
                  <Text color={i.status === 'partial' ? ACCENT : undefined} dimColor={i.status !== 'partial'}>
                    {i.status === 'partial' ? '◐' : '○'}
                  </Text>
                  <Box flexGrow={1} flexShrink={1}>
                    <Button
                      key={i.id}
                      plain
                      dimColor={quiet}
                      onPress={() => void $.prompt.fill({ text: `Work on upgo goal ${i.id}: ${i.title}`, mode: 'insert' })}
                    >
                      {i.title}
                    </Button>
                  </Box>
                  {i.size && <Text dimColor>{i.size}</Text>}
                </Box>
              ))}
            </Box>
          )
        })}
      </Box>
    )
  })
}
