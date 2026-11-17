// The page's behaviour. index.html holds the markup; this module only moves
// values between the inputs and the outputs. Validation and escaping live in
// service-template.ts, the trust boundary, so no rule is re-implemented here.
import './assets/main.css'

import { fieldValidity, generateLogRotate, generateService } from './service-template'

/**
 * Return the element index.html must provide, checked against its type.
 *
 * A missing or mistyped element is drift between the markup and this module;
 * failing at load names it, where a `null` would surface later as a TypeError
 * on the first keystroke.
 */
const byId = <T extends HTMLElement>(id: string, type: new () => T): T => {
  const element = document.getElementById(id)
  if (!(element instanceof type)) {
    throw new Error(`index.html has no <${type.name}> with id "${id}"`)
  }
  return element
}

const fields = {
  service: byId('service', HTMLInputElement),
  description: byId('description', HTMLInputElement),
  username: byId('username', HTMLInputElement),
  command: byId('command', HTMLInputElement)
}
const checked = ['service', 'username', 'command'] as const
const summary = byId('summary', HTMLElement)
const output = byId('output', HTMLElement)
const servicePath = byId('service-path', HTMLElement)
const logRotatePath = byId('logrotate-path', HTMLElement)
const serviceScript = byId('service-script', HTMLTextAreaElement)
const logRotate = byId('logrotate', HTMLTextAreaElement)
const shellCommands = byId('shell-commands', HTMLTextAreaElement)

/** Re-derive every output from the inputs; runs on load and on each edit. */
const update = (): void => {
  const options = {
    service: fields.service.value,
    description: fields.description.value,
    username: fields.username.value,
    command: fields.command.value
  }
  const validity = fieldValidity(options)
  for (const name of checked) {
    fields[name].setAttribute('aria-invalid', String(!validity[name]))
    byId(`${name}-error`, HTMLElement).hidden = validity[name]
  }

  // The generators throw on invalid options. Hiding the outputs, rather than
  // leaving the last valid script up, keeps a stale script from being copied.
  const valid = checked.every((name) => validity[name])
  output.hidden = !valid
  summary.textContent = valid ? '' : 'Fix the highlighted fields to generate a service script.'
  if (!valid) return

  const { service } = options
  servicePath.textContent = `/etc/init.d/${service}`
  logRotatePath.textContent = `/etc/logrotate.d/${service}`
  serviceScript.value = generateService(options)
  logRotate.value = generateLogRotate(options)
  shellCommands.value = `sudo chmod +x /etc/init.d/${service} && sudo update-rc.d ${service} defaults`
}

/**
 * Copy an output to the clipboard, or select it for a manual copy on failure.
 *
 * A silent failure would leave whatever the clipboard held before to be pasted
 * into a script that runs as root. Calling `writeText` inside `then` routes a
 * missing `navigator.clipboard` (an insecure context) through the same
 * fallback as a rejected write.
 */
const copy = (source: HTMLTextAreaElement): void => {
  Promise.resolve()
    .then(() => navigator.clipboard.writeText(source.value))
    .catch(() => {
      source.focus()
      source.select()
    })
}

for (const input of Object.values(fields)) input.addEventListener('input', update)
byId('copy-service', HTMLButtonElement).addEventListener('click', () => copy(serviceScript))
byId('copy-logrotate', HTMLButtonElement).addEventListener('click', () => copy(logRotate))
byId('copy-shell', HTMLButtonElement).addEventListener('click', () => copy(shellCommands))
update()
