# sysvinit service generator

This Vue 3 app generates templates for sysvinit services.

## Usage

Throughout these steps, `<service-name>` is the "Service name" you entered — the
app shows the exact destination path above each output.

1. Fill in the form with the desired values.
2. Copy the generated service script.
3. Save it as `/etc/init.d/<service-name>`.
4. Run the commands from the "Shell commands to run" panel.
5. Start the service with `service <service-name> start`.
6. Optionally save the "Logrotate" output to `/etc/logrotate.d/<service-name>`.

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

`npm test` validates the generated script with `shellcheck` and `dash`. Both are
mandatory in CI. Locally, a missing binary skips that check and prints a
`[skipped] … validation is INCOMPLETE` warning, so install both if you are
changing the template.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Vue.js](https://vuejs.org/)
- [yunginnanet/sysvinit-service-generator](https://github.com/yunginnanet/sysvinit-service-generator/)
