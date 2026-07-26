import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it } from 'vitest'

import App from '../App.vue'

const render = () => renderToString(createSSRApp(App))

describe('App', () => {
  it('renders the generated script for the default inputs', async () => {
    const html = await render()
    expect(html).toContain('sysvinit service generator')
    expect(html).toContain('/etc/init.d/my-service')
    // Entity-encoded in HTML: NAME='my-service'
    expect(html).toContain('NAME=&#39;my-service&#39;')
  })

  it('gives every output textarea an accessible name', async () => {
    const html = await render()
    for (const id of ['service-label', 'logrotate-label', 'shell-label']) {
      expect(html).toContain(`aria-labelledby="${id}"`)
    }
    // Outputs are readonly, so a re-render cannot silently discard user edits.
    expect(html.match(/<textarea[^>]*readonly/g)).toHaveLength(3)
  })

  it('constrains the shell-bearing inputs at the boundary', async () => {
    const html = await render()
    // Two fields reach shell/path contexts and must carry a pattern; a bare
    // minlength would not be enforced without the surrounding form.
    expect(html).toContain('<form')
    // Must read identically to SAFE_NAME in src/service-template.ts.
    expect(html.match(/pattern="\[A-Za-z0-9_\.-\]\+"/g)).toHaveLength(2)
  })
})
