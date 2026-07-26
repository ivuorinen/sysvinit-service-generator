<script setup lang="ts">
import { computed, ref } from 'vue'
import { SAFE_NAME, generateLogRotate, generateService } from './service-template'

const service = ref('my-service')
const description = ref('This command does something')
const username = ref('root')
const command = ref('/usr/local/bin/command')

const serviceValid = computed(() => SAFE_NAME.test(service.value))
const usernameValid = computed(() => SAFE_NAME.test(username.value))
const commandValid = computed(() => command.value.trim().length > 0)
const valid = computed(() => serviceValid.value && usernameValid.value && commandValid.value)

const options = computed(() => ({
  service: service.value,
  description: description.value,
  username: username.value,
  command: command.value
}))

const servicePath = computed(() => '/etc/init.d/' + service.value)
const logRotatePath = computed(() => '/etc/logrotate.d/' + service.value)
// The generators reject invalid options rather than emit a broken script, so
// guard on validity here instead of relying on the template's v-else branch.
const serviceTemplate = computed(() => (valid.value ? generateService(options.value) : ''))
const logRotate = computed(() => (valid.value ? generateLogRotate(options.value) : ''))
const shellCommands = computed(
  () => `sudo chmod +x ${servicePath.value} && sudo update-rc.d ${service.value} defaults`
)

const copy = (text: string) => void navigator.clipboard.writeText(text)
</script>

<template>
  <header>
    <h1 class="accent">sysvinit service generator</h1>

    <form @submit.prevent>
      <label>
        Service name:
        <input type="text" required pattern="[A-Za-z0-9_.-]+" v-model="service" />
        <small v-if="!serviceValid" class="error">
          Use only letters, digits, dot, dash or underscore.
        </small>
      </label>

      <label>
        Description:
        <input type="text" v-model="description" />
      </label>

      <label>
        Run as user:
        <input type="text" required pattern="[A-Za-z0-9_.-]+" v-model="username" />
        <small v-if="!usernameValid" class="error">
          Use only letters, digits, dot, dash or underscore.
        </small>
      </label>

      <label>
        Command:
        <input type="text" required minlength="1" v-model="command" />
        <small v-if="!commandValid" class="error">Command cannot be empty.</small>
      </label>
    </form>
  </header>

  <main>
    <p v-if="!valid" class="error">Fix the highlighted fields to generate a service script.</p>

    <template v-else>
      <h3 id="service-label">Generated service script:</h3>
      <div id="service-path">
        Save as: <code>{{ servicePath }}</code>
      </div>
      <textarea
        readonly
        aria-labelledby="service-label"
        aria-describedby="service-path"
        style="height: 400px"
        :value="serviceTemplate"
      ></textarea>
      <button type="button" @click="copy(serviceTemplate)">Copy service script</button>

      <details>
        <summary id="logrotate-label">Logrotate</summary>
        <div id="logrotate-path">
          Save as: <code>{{ logRotatePath }}</code>
        </div>
        <textarea
          readonly
          aria-labelledby="logrotate-label"
          aria-describedby="logrotate-path"
          class="just-right noresize"
          :value="logRotate"
        ></textarea>
        <button type="button" @click="copy(logRotate)">Copy logrotate config</button>
      </details>

      <details>
        <summary id="shell-label">Shell commands to run</summary>
        <textarea
          readonly
          aria-labelledby="shell-label"
          class="just-right noresize"
          :value="shellCommands"
        ></textarea>
        <button type="button" @click="copy(shellCommands)">Copy shell commands</button>
      </details>
    </template>
  </main>

  <footer>
    <p>Created by <a href="https://github.com/ivuorinen">@ivuorinen</a> from Tampere, Finland</p>
  </footer>
</template>
