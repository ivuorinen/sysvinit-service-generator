# sysvinit service generator

This Vue 3 app generates templates for sysvinit services.

## Usage

1. Fill in the form with the desired values.
2. Copy the generated template.
3. Paste it into a new file in `/etc/init.d/`.
4. Make the file executable with `chmod +x /etc/init.d/<filename>`.
5. Register the service with `update-rc.d <filename> defaults` on Ubuntu.
6. Start the service with `service <filename> start`.
7. ???
8. Profit!

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Vue.js](https://vuejs.org/)
- [yunginnanet/sysvinit-service-generator](https://github.com/yunginnanet/sysvinit-service-generator/)
