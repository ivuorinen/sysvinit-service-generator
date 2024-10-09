import pluginVue from 'eslint-plugin-vue'
import vueTsEslintConfig from '@vue/eslint-config-typescript'
import { includeIgnoreFile } from '@eslint/compat'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const gitignorePath = path.resolve(__dirname, '.gitignore')

export default [
  includeIgnoreFile(gitignorePath),
  {
    // your overrides
  },
  ...pluginVue.configs['flat/essential'],
  ...vueTsEslintConfig({
    extends: ['recommended']
  }),
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script'
    }
  }
]
