import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-plugin-prettier';

export default [
	{
		languageOptions: {
			globals: globals.browser
		}
	},
	pluginJs.configs.recommended,
	...tseslint.configs.recommended,

	{
		plugins: {
			prettier: prettier
		},
		rules: {
			'prettier/prettier': 'error',
			'no-case-declarations': 'error',
			'no-constant-condition': 'off',
			'typescript-eslint/ban-ts-comment': 'off'
		}
	}
];
