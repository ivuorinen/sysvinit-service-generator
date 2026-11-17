import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'

// Type-aware rules resolve each file's tsconfig through `projectService`. Do not
// add a `parserOptions.project` block as well: the combination is a fatal parser
// error that silently reduces the whole run to parse failures.
//
// Formatting is not linted here; `npm run format:check` runs Prettier itself.
export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    }
  }
])
