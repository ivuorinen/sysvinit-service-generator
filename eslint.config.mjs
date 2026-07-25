import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import prettier from '@vue/eslint-config-prettier'
import { includeIgnoreFile } from '@eslint/compat'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const gitignorePath = path.resolve(__dirname, '.gitignore')

// `vueTsConfigs.recommendedTypeChecked` enables typescript-eslint's
// `projectService`, which resolves the right tsconfig per file. Do not add a
// `parserOptions.project` block here: the combination is a fatal parser error
// that silently reduces the whole run to parse failures.
export default defineConfigWithVueTs([
  includeIgnoreFile(gitignorePath),
  ...pluginVue.configs['flat/essential'],
  vueTsConfigs.recommendedTypeChecked,
  prettier
])
