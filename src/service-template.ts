// Generation of the sysvinit service script and its logrotate config.
//
// Kept free of Vue so it can be tested as a pure function: the output is a
// program that runs as root, so it is validated by unit tests plus `shellcheck`
// and `dash -n` (see src/__tests__/service-template.spec.ts).

/**
 * Characters permitted in a service name or username.
 *
 * These values reach unquoted path contexts in the generated script
 * (`/run/$NAME.pid`, `update-rc.d`), so the set is restricted rather than
 * relying on quoting alone. Keep in sync with the `pattern` attribute on the
 * corresponding inputs in App.vue.
 */
export const SAFE_NAME = /^[A-Za-z0-9_.-]+$/

/**
 * Quote a value for POSIX sh: wrap in single quotes, closing and reopening the
 * quote around each embedded `'`. No metacharacter survives into the script.
 */
export const shq = (value: string): string => "'" + value.replace(/'/g, "'\\''") + "'"

/** Collapse newlines: the description is emitted inside a `#` comment block. */
export const oneLine = (value: string): string => value.replace(/[\r\n]+/g, ' ').trim()

export interface ServiceOptions {
  service: string
  description: string
  username: string
  command: string
}

const serviceTemplateString = `#!/usr/bin/env sh
### BEGIN INIT INFO
# Provides:          <NAME>
# Required-Start:    $local_fs $network $named $time $syslog
# Required-Stop:     $local_fs $network $named $time $syslog
# Default-Start:     2 3 4 5
# Default-Stop:      0 1 6
# Short-Description: <DESCRIPTION>
# Description:       <DESCRIPTION>
### END INIT INFO

NAME=<NAME_Q>
SCRIPT=<COMMAND_Q>
RUNAS=<USERNAME_Q>

PIDFILE=/run/$NAME.pid
LOGFILE=/var/log/$NAME.log

start() {
  if [ -f "$PIDFILE" ] && [ -s "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
    echo "Service already running" >&2
    return 1
  fi
  echo 'Starting service...' >&2

  # Create the log as root and hand it to RUNAS: /var/log is root-owned, so the
  # redirection below runs after privileges drop and would otherwise fail.
  if ! touch "$LOGFILE" || ! chown "$RUNAS" "$LOGFILE"; then
    echo "Error! Could not prepare $LOGFILE" >&2
    return 1
  fi

  CMD="$SCRIPT >> \\"$LOGFILE\\" 2>&1 & echo \\$!"
  su -s /bin/sh -c "$CMD" "$RUNAS" > "$PIDFILE"

  sleep 2
  PID="$(cat "$PIDFILE")"
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    echo "$NAME is now running, the PID is $PID"
  else
    echo ''
    echo "Error! Could not start $NAME!"
    rm -f "$PIDFILE"
    return 1
  fi
}

stop() {
  if [ ! -f "$PIDFILE" ] || ! kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
    echo 'Service not running' >&2
    return 1
  fi
  echo 'Stopping service...' >&2
  kill -15 "$(cat "$PIDFILE")" && rm -f "$PIDFILE"
  echo 'Service stopped' >&2
}

uninstall() {
  printf '%s' "Are you really sure you want to uninstall this service? That cannot be undone. [yes|No] "
  read -r SURE
  if [ "$SURE" = "yes" ]; then
    stop
    rm -f "$PIDFILE"
    echo "Notice: log file was not removed: $LOGFILE" >&2
    update-rc.d -f "$NAME" remove
    rm -fv "$0"
  else
    echo "Abort!"
  fi
}

status() {
  printf "%-50s" "Checking $NAME..."
  if [ -f "$PIDFILE" ] && [ -s "$PIDFILE" ]; then
    PID="$(cat "$PIDFILE")"
    if kill -0 "$PID" 2>/dev/null; then
      echo "Running, the PID is $PID"
    else
      printf "%s\\n" "The process appears to be dead but pidfile still exists"
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
    # LSB reserves exit code 2 for invalid or excess arguments.
    exit 2
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

/**
 * Reject options that cannot be safely interpolated.
 *
 * The generators are the trust boundary, not the UI. `shq()` protects the shell
 * assignments, but the bare `<NAME>` form also reaches contexts that cannot be
 * quoted at all — the LSB header comment and the logrotate stanza path — so a
 * form-level check in App.vue is not sufficient for a direct caller.
 */
export const assertValidOptions = (options: ServiceOptions): void => {
  if (!SAFE_NAME.test(options.service)) {
    throw new Error(`Invalid service name: ${JSON.stringify(options.service)}`)
  }
  if (!SAFE_NAME.test(options.username)) {
    throw new Error(`Invalid username: ${JSON.stringify(options.username)}`)
  }
  if (options.command.trim() === '') {
    throw new Error('Command cannot be empty')
  }
}

/**
 * Substitute the placeholders in `template`.
 *
 * `<*_Q>` placeholders are shell-quoted; the bare `<NAME>` and `<DESCRIPTION>`
 * forms appear in comment and path contexts. Order matters: `<NAME_Q>` must be
 * replaced before `<NAME>`, or the `<NAME>` pass would rewrite its prefix.
 *
 * Deliberately not exported: every caller must go through a generator so the
 * validation above cannot be bypassed.
 */
const fill = (template: string, options: ServiceOptions): string =>
  template
    .replace(/<NAME_Q>/g, shq(options.service))
    .replace(/<COMMAND_Q>/g, shq(options.command))
    .replace(/<USERNAME_Q>/g, shq(options.username))
    .replace(/<NAME>/g, options.service)
    .replace(/<DESCRIPTION>/g, oneLine(options.description))

export const generateService = (options: ServiceOptions): string => {
  assertValidOptions(options)
  return fill(serviceTemplateString, options)
}

export const generateLogRotate = (options: ServiceOptions): string => {
  assertValidOptions(options)
  return fill(logRotateString, options)
}
