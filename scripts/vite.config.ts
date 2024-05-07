import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolvePkgPath } from './utils';
import path from 'path';
import replace from '@rollup/plugin-replace';

// https://vitejs.dev/config/
export default defineConfig({
	server: {
		fs: {
			cachedChecks: false
		}
	},
	plugins: [
		react({
			jsxRuntime: 'automatic'
		}),
		replace({
			values: {
				__DEV__: true
			},
			preventAssignment: true
		})
	],
	resolve: {
		alias: [
			{
				find: 'react',
				replacement: resolvePkgPath('react')
			},
			{
				find: 'react-dom',
				replacement: resolvePkgPath('react-dom')
			},
			{
				find: 'hostConfig',
				replacement: path.resolve(
					resolvePkgPath('react-dom'),
					'./src/hostConfig.ts'
				)
			}
		]
	}
});
