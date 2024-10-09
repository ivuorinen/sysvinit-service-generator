<script setup lang="ts">
import { ref, watch } from 'vue'

const service = defineModel('service', { default: 'my-service' })
const description = defineModel('description', { default: 'This command does something' })
const username = defineModel('username', { default: 'root' })
const command = defineModel('command', { default: '/usr/local/bin/command' })
const servicePath = ref('/etc/init.d/' + service.value)
const logRotatePath = ref('/etc/logrotate.d/' + service.value)

const shellCommands = ref(
  `sudo chmod +x ${servicePath.value} && sudo update-rc.d ${service.value} defaults`
)

const serviceTemplateString = `#!/usr/bin/env sh
### BEGIN INIT INFO
# Provides:          <NAME>
# Required-Start:    $local_fs $network $named $time $syslog
# Required-Stop:     $local_fs $network $named $time $syslog
# Default-Start:     2 3 4 5
# Default-Stop:      0 1 6
# Description:       <DESCRIPTION>
### END INIT INFO

SCRIPT="<COMMAND>"
RUNAS=<USERNAME>

PIDFILE=/var/run/<NAME>.pid
LOGFILE=/var/log/<NAME>.log

start() {
  if [ -f $PIDFILE ] && [ -s $PIDFILE ] && kill -0 $(cat $PIDFILE); then
    echo "Service already running" >&2
    return 1
  fi
  echo 'Starting service...' >&2
  local CMD="$SCRIPT &> \\"$LOGFILE\\" & echo \\$!"
  su -c "$CMD" $RUNAS > "$PIDFILE"
 # Try with this command instead if above does not work
 # su -s /bin/sh $RUNAS -c "$CMD" > "$PIDFILE"

  sleep 2
  PID=$(cat $PIDFILE)
    if pgrep -u $RUNAS -f $NAME > /dev/null
    then
      echo "$NAME is now running, the PID is $PID"
    else
      echo ''
      echo "Error! Could not start $NAME!"
    fi
}

stop() {
  if [ ! -f "$PIDFILE" ] || ! kill -0 $(cat "$PIDFILE"); then
    echo 'Service not running' >&2
    return 1
  fi
  echo 'Stopping service...' >&2
  kill -15 $(cat "$PIDFILE") && rm -f "$PIDFILE"
  echo 'Service stopped' >&2
}

uninstall() {
  echo -n "Are you really sure you want to uninstall this service? That cannot be undone. [yes|No] "
  local SURE
  read SURE
  if [ "$SURE" = "yes" ]; then
    stop
    rm -f "$PIDFILE"
    echo "Notice: log file was not removed: $LOGFILE" >&2
    update-rc.d -f $NAME remove
    rm -fv "$0"
  else
    echo "Abort!"
  fi
}

status() {
    printf "%-50s" "Checking <NAME>..."
    if [ -f $PIDFILE ] && [ -s $PIDFILE ]; then
        PID=$(cat $PIDFILE)
            if [ -z "$(ps axf | grep \${PID} | grep -v grep)" ]; then
                printf "%s\\n" "The process appears to be dead but pidfile still exists"
            else
                echo "Running, the PID is $PID"
            fi
    else
        printf "%s\\n" "Service not running"
    fi
}


case "$1" in
  start)
    start
    ;;
  stop)
    stop
    ;;
  status)
    status
    ;;
  uninstall)
    uninstall
    ;;
  restart)
    stop
    start
    ;;
  *)
    echo "Usage: $0 {start|stop|status|restart|uninstall}"
esac
`

const logRotateString = `/var/log/<NAME>.log {
    rotate 4
    weekly
    missingok
    notifempty
    compress
    delaycompress
}`

const serviceTemplate = serviceTemplateString
  .replace(/<NAME>/g, service.value)
  .replace(/<DESCRIPTION>/g, description.value)
  .replace(/<USERNAME>/g, username.value)
  .replace(/<COMMAND>/g, command.value)

const logRotate = logRotateString.replace(/<NAME>/g, service.value)

watch(
  [service, description, username, command],
  ([newService, newDescription, newUsername, newCommand]) => {
    serviceTemplate = serviceTemplateString
      .replace(/<NAME>/g, newService)
      .replace(/<DESCRIPTION>/g, newDescription)
      .replace(/<USERNAME>/g, newUsername)
      .replace(/<COMMAND>/g, newCommand)
    servicePath.value = '/etc/init.d/' + newService
    logRotate = logRotateString.replace(/<NAME>/g, newService)
    logRotatePath.value = '/etc/logrotate.d/' + newService
    shellCommands.value = `sudo chmod +x ${servicePath.value} && sudo update-rc.d ${newService} defaults`
  }
)
</script>

<template>
  <header>
    <h1 class="green">sysvinit service generator</h1>

    <label>
      Service name:
      <input type="text" minlength="1" v-model="service" />
    </label>

    <label>
      Description:
      <input type="text" minlength="1" v-model="description" />
    </label>

    <label>
      Run as user:
      <input type="text" minlength="1" v-model="username" />
    </label>

    <label>
      Command:
      <input type="text" minlength="1" v-model="command" />
    </label>
  </header>

  <main>
    <h3>Generated service script:</h3>
    <div>
      Save as: <code>{{ servicePath }}</code>
    </div>
    <textarea style="height: 400px" v-text="serviceTemplate"></textarea>
    <details>
      <summary>Logrotate</summary>
      <div>
        Save as: <code>{{ logRotatePath }}</code>
      </div>
      <textarea class="just-right noresize" v-text="logRotate"></textarea>
    </details>
    <details>
      <summary>Shell commands to run</summary>
      <textarea class="just-right noresize" v-text="shellCommands"></textarea>
    </details>
  </main>

  <footer>
    <p>Created by <a href="https://github.com/ivuorinen">@ivuorinen</a> from Tampere, Finland</p>
  </footer>
</template>
