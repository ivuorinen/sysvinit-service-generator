// Generation of the sysvinit service script and its logrotate config.
//
// Kept free of the DOM so it can be tested as a pure function: the output is a
// program that runs as root, so it is validated by unit tests plus `shellcheck`
// and `dash -n` (see src/__tests__/service-template.spec.ts).

/**
 * Characters permitted in a service name or username.
 *
 * These values reach unquoted path contexts in the generated script
 * (`/run/$NAME.pid`, `update-rc.d`), so the set is restricted rather than
 * relying on quoting alone. The first character may not be `.` or `-`: `..`
 * made the save path `/etc/init.d/..` (that is, `/etc`), and a leading dash is
 * parsed as an option by `update-rc.d` and `chown`.
 */
export const SAFE_NAME = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/

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

# Exit codes follow LSB: start on a running service and stop on a stopped one
# succeed; status returns 0 running, 1 dead with a pidfile, 3 not running.

start() {
  if [ -f "$PIDFILE" ] && [ -s "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
    echo "Service already running" >&2
    return 0
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
    echo "Error! Could not start $NAME!" >&2
    rm -f "$PIDFILE"
    return 1
  fi
}

stop() {
  if [ ! -f "$PIDFILE" ] || ! kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
    echo 'Service not running' >&2
    return 0
  fi
  PID="$(cat "$PIDFILE")"
  echo 'Stopping service...' >&2
  kill -15 "$PID"

  # Wait for the exit: removing the pidfile at once let restart start a second
  # instance while the first still held its port.
  WAITED=0
  while kill -0 "$PID" 2>/dev/null; do
    if [ "$WAITED" -ge 10 ]; then
      echo "Error! $NAME did not stop within 10 seconds" >&2
      return 1
    fi
    WAITED=$((WAITED + 1))
    sleep 1
  done
  rm -f "$PIDFILE"
  echo 'Service stopped' >&2
}

uninstall() {
  printf '%s' "Are you really sure you want to uninstall this service? That cannot be undone. [yes|No] "
  read -r SURE
  if [ "$SURE" = "yes" ]; then
    stop || return 1
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
      return 1
    fi
  else
    printf "%s\\n" "Service not running"
    return 3
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
    stop && start
    ;;
  *)
    echo "Usage: $0 {start|stop|status|restart|uninstall}" >&2
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
    copytruncate
}`

/**
 * Per-field validity, the single definition of what the generators accept.
 *
 * The UI marks fields from this rather than re-implementing the rules, so the
 * form cannot accept input that `generateService()` then throws on. The
 * description is absent on purpose: it is free text, sanitised by `oneLine()`
 * rather than rejected.
 */
export const fieldValidity = (
  options: ServiceOptions
): Record<'service' | 'username' | 'command', boolean> => ({
  service: SAFE_NAME.test(options.service),
  username: SAFE_NAME.test(options.username),
  command: options.command.trim() !== ''
})

/**
 * Reject options that cannot be safely interpolated.
 *
 * The generators are the trust boundary, not the UI. `shq()` protects the shell
 * assignments, but the bare `<NAME>` form also reaches contexts that cannot be
 * quoted at all — the LSB header comment and the logrotate stanza path — so a
 * check in the UI alone would not protect a direct caller.
 */
const assertValidOptions = (options: ServiceOptions): void => {
  const valid = fieldValidity(options)
  if (!valid.service) {
    throw new Error(`Invalid service name: ${JSON.stringify(options.service)}`)
  }
  if (!valid.username) {
    throw new Error(`Invalid username: ${JSON.stringify(options.username)}`)
  }
  if (!valid.command) {
    throw new Error('Command cannot be empty')
  }
}

/**
 * Substitute the placeholders in `template`.
 *
 * `<*_Q>` placeholders are shell-quoted; the bare `<NAME>` and `<DESCRIPTION>`
 * forms appear in comment and path contexts that cannot carry quotes.
 *
 * Deliberately not exported: every caller must go through a generator so the
 * validation above cannot be bypassed.
 *
 * Two properties this implementation must keep, both of which had already gone
 * wrong once:
 *
 *  - **One pass.** Chained `.replace()` calls re-scan text that an earlier call
 *    substituted, so a command containing the literal `<NAME>` was rewritten
 *    into the service name by the later pass. A single regex with an
 *    alternation never re-examines what it just inserted.
 *  - **Callback, not string.** In a string replacement `$$`, `$&`, `` $` ``,
 *    `$'` and `$1` are special, so `--pid $$` (the shell's PID, entirely
 *    ordinary) emitted a single `$`, and `$&` emitted the placeholder itself
 *    back into the script. A callback's return value is inserted verbatim.
 */
const PLACEHOLDER = /<(NAME_Q|COMMAND_Q|USERNAME_Q|NAME|DESCRIPTION)>/g

const fill = (template: string, options: ServiceOptions): string => {
  const values: Record<string, string> = {
    NAME_Q: shq(options.service),
    COMMAND_Q: shq(options.command),
    USERNAME_Q: shq(options.username),
    NAME: options.service,
    DESCRIPTION: oneLine(options.description)
  }
  return template.replace(PLACEHOLDER, (_match, key: string) => values[key])
}

export const generateService = (options: ServiceOptions): string => {
  assertValidOptions(options)
  return fill(serviceTemplateString, options)
}

export const generateLogRotate = (options: ServiceOptions): string => {
  assertValidOptions(options)
  return fill(logRotateString, options)
}
