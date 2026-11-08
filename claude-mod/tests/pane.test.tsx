import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const PANE = {
  plugin: 'upgo-goals',
  component: 'Pane',
  requestId: 'upgo-goals',
  props: {
    title: 'Goals',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

const GOALS = {
  project: 'demo',
  items: [
    { id: 'a', title: 'Ship it', phase: 'now', status: 'planned' },
    { id: 'b', title: 'Old', phase: 'now', status: 'done' },
    { id: 'c', title: 'Later thing', phase: 'later', status: 'planned' },
    { id: 'd', title: 'Half done', phase: 'now', status: 'partial' },
  ],
}

// The session root is /p/sub, goals.json sits one level up at /p.
function serve(on: On, disk: { text?: string; mtimeMs?: number }, reads = { n: 0 }) {
  // The engine hands paths on absolute and OS-native.
  const at = (path: string) => path.replace(/\\/g, '/').endsWith('/p/goals.json')
  on('session.root', () => ({ value: '/p/sub' }))
  on('fs.exists', (_, e) => ({ value: at(e.path) && disk.text !== undefined }))
  on('fs.read', (_, e) => {
    if (!at(e.path) || disk.text === undefined) throw new Error('ENOENT')
    reads.n++
    return { value: disk.text }
  })
  on('fs.stat', () => ({ value: { kind: 'file', size: 0, mtimeMs: disk.mtimeMs ?? 0, isLink: false } }))
  return reads
}

test('finds goals.json above the root, lists open goals, partial first', async ($, on) => {
  serve(on, { text: JSON.stringify(GOALS) })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.findAll({ type: 'Button' })).map(b => b.key)).toEqual(['d', 'a', 'c'])
    await ui.unmount()
  }
})

test('clicking a goal fills the prompt', async ($, on) => {
  let filled = ''
  serve(on, { text: JSON.stringify(GOALS) })
  on('prompt.fill', (_, e) => {
    filled = e.text
    return { isFilled: true }
  })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'a' })
  expect(filled).toBe('Work on upgo goal a: Ship it')
  await ui.unmount()
})

test('no goals.json shows a hint', async ($, on) => {
  serve(on, {})
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /No goals.json/ })).toBeTruthy()
  await ui.unmount()
})

test('a malformed goals.json still draws the pane', async ($, on) => {
  const disk: { text?: string } = {}
  serve(on, disk)
  const good = { id: 'a', title: 'Ship it', phase: 'now', status: 'planned' }
  for (const text of ['null', '{"items":{}}', JSON.stringify({ items: [null, { id: 'x', phase: 'now' }, good] })]) {
    disk.text = text
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
    expect(await ui.find({ type: 'Text', text: /open/ })).toBeTruthy()
    await ui.unmount()
  }
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.findAll({ type: 'Button' })).map(b => b.key)).toEqual(['a'])
  await ui.unmount()
})

test('the pane redraws when goals.json changes, not before', async ($, on) => {
  const disk = { text: JSON.stringify(GOALS), mtimeMs: 1 }
  const reads = serve(on, disk)
  const clock = mock.clock(on)
  on('command.register', () => ({ value: { command: 'goals' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/p/sub', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await clock.advance(3000)
  const before = reads.n
  await clock.advance(3000)
  expect(reads.n).toBe(before)

  disk.text = JSON.stringify({ items: [{ id: 'z', title: 'New', phase: 'next', status: 'planned' }] })
  disk.mtimeMs = 2
  await clock.advance(3000)
  expect(await ui.find({ type: 'Button', key: 'z' })).toBeTruthy()
  await ui.unmount()
})
