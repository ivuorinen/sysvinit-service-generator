# sysvinit service generator

This web app generates templates for sysvinit services.

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
underscore, and may not start with a dot or dash, because both are interpolated
into shell and path contexts in the generated script.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, checks and tests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file
for details.

## Acknowledgments

- [yunginnanet/sysvinit-service-generator](https://github.com/yunginnanet/sysvinit-service-generator/)
