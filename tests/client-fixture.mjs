import { readFileSync } from 'node:fs'

export function mountClient() {
  let hooks
  let hookIndex
  let dirty
  let effects
  let nextId = 0
  const React = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children: children.flat() } }),
    useState(initial) {
      const slot = hookIndex++
      const values = hooks
      if (!(slot in values)) values[slot] = initial
      return [values[slot], (next) => { values[slot] = typeof next === 'function' ? next(values[slot]) : next; dirty = true }]
    },
    useEffect(effect, dependencies) {
      const slot = hookIndex++
      const previous = hooks[slot]
      if (!previous || dependencies.some((value, index) => !Object.is(value, previous[index]))) {
        hooks[slot] = dependencies
        effects.push(effect)
      }
    },
    useRef(initial) {
      const slot = hookIndex++
      return hooks[slot] ??= { current: initial }
    },
    useId() {
      const slot = hookIndex++
      return hooks[slot] ??= `fixture-${nextId++}`
    },
    useCallback(callback, dependencies) {
      const slot = hookIndex++
      const previous = hooks[slot]
      if (!previous || dependencies.some((value, index) => !Object.is(value, previous.dependencies[index]))) {
        hooks[slot] = { callback, dependencies }
      }
      return hooks[slot].callback
    },
  }
  const { createElement: h } = React
  const primitives = {
    Button: ({ children, ...props }) => h('button', props, children),
    Pill: ({ children, ...props }) => h('button', props, children),
    Switch: ({ checked, onChange, label, disabled }) => h('button', {
      role: 'switch',
      'aria-checked': checked,
      'aria-label': label,
      disabled,
      onClick: () => onChange(!checked),
    }),
    StateDot: () => h('span'),
    IconRefreshOutlineRegular: () => h('span'),
  }

  let entry
  const window = { __ModuleLoader__: { load: (value) => { entry = value } } }
  new Function('window', readFileSync(new URL('../client.js', import.meta.url), 'utf8'))(window)
  const plugin = entry.factory((id) => {
    if (id === 'react') return React
    if (id === '@deepseek-ai/dsh-client-ui-primitives') return primitives
    throw new Error(`Unexpected client module: ${id}`)
  })
  const slots = new Map()
  plugin.apply({ slots: {
    inject: (_name, callback) => callback(),
    register: (options, component) => { slots.set(options.name, { options, component }) },
  } })

  const instances = new Map()
  function resolve(node, path) {
    if (Array.isArray(node)) return node.map((child, index) => resolve(child, `${path}/${child?.props?.key ?? index}`))
    if (!node || typeof node !== 'object') return node
    if (typeof node.type === 'function') {
      const identity = `${path}/${node.props.key ?? ''}:${node.type.name}`
      if (!instances.has(identity)) instances.set(identity, [])
      hooks = instances.get(identity)
      hookIndex = 0
      return resolve(node.type(node.props), identity)
    }
    return { ...node, props: { ...node.props, children: resolve(node.props.children, path) } }
  }

  async function render(name, props) {
    for (let pass = 0; pass < 20; pass += 1) {
      dirty = false
      effects = []
      const tree = resolve(h(slots.get(name).component, props), name)
      for (const effect of effects) await effect()
      await new Promise((resolve) => setImmediate(resolve))
      if (!dirty) return tree
    }
    throw new Error(`Render did not settle: ${name}`)
  }

  return { slots, render }
}

export function text(node) {
  if (Array.isArray(node)) return node.map(text).filter(Boolean).join(' ')
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  return node?.props && node.type !== 'style' ? text(node.props.children) : ''
}

export function findButton(node, label) {
  if (Array.isArray(node)) return node.map((child) => findButton(child, label)).find(Boolean)
  if (node?.props?.hidden) return undefined
  if (node?.type === 'button' && (node.props['aria-label'] ?? text(node.props.children)).includes(label)) return node
  return node?.props && findButton(node.props.children, label)
}

export function findElement(node, match) {
  if (Array.isArray(node)) return node.map((child) => findElement(child, match)).find(Boolean)
  if (!node?.props) return undefined
  return match(node) ? node : findElement(node.props.children, match)
}
