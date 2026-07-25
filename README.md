# sysvinit service generator

This Vue 3 app generates templates for sysvinit services.

## Usage

1. Fill in the form with the desired values.
2. Copy the generated service script.
3. Paste it into a new file in `/etc/init.d/`.
4. Run the commands from the "Shell commands to run" panel — they `chmod +x` the
   script and register it with `update-rc.d`.
5. Start the service with `service <filename> start`.
6. Optionally save the "Logrotate" output to `/etc/logrotate.d/<filename>` to
   rotate the service's log.

The service name and username accept only letters, digits, dot, dash and
underscore, because both are interpolated into shell and path contexts in the
generated script.

## Development

Install dependencies and run the dev server with npm:

```bash
npm ci
npm run dev

# check code before committing
npm run lint
npm run type-check
npm test

# build the app
npm run build
```

`npm test` validates the generated script with `shellcheck` and `dash` when those
binaries are available.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Vue.js](https://vuejs.org/)
- [yunginnanet/sysvinit-service-generator](https://github.com/yunginnanet/sysvinit-service-generator/)
