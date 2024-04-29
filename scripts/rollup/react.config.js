import { resolvePkgPath, getPkgJson, getCommonPlugins } from '../utils';
// 定制产物的package.json，而非直接复制源码中的package.json
import generatePkg from 'rollup-plugin-generate-package-json';

const { name } = getPkgJson('react');

const sourcePkgPath = resolvePkgPath(name);

const distPkgPath = resolvePkgPath(name, true);

// 打包构建react包，生成在dist/node_modules/react目录下
export default [
	{
		input: `${sourcePkgPath}/index.ts`,
		output: {
			// 打包产物chunk写入的文件名，chunk只有一个时用file字段，两个以上的chunks要使用dir字段
			file: `${distPkgPath}/index.js`,
			// 指定打包产物运行时对外暴露的全局变量名（针对iife和umd）
			name: 'eReact',
			format: 'umd'
		},
		plugins: [
			...getCommonPlugins(),
			generatePkg({
				inputFolder: sourcePkgPath,
				outputFolder: distPkgPath,
				baseContents: ({ name, description, version }) => ({
					name,
					description,
					version,
					main: 'index.js'
				})
			})
		]
	},
	{
		input: `${sourcePkgPath}/src/jsx.ts`,
		output: [
			{
				file: `${distPkgPath}/jsx-runtime.js`,
				// 指定打包产物运行时对外暴露的全局变量名（针对iife和umd）
				name: 'jsxRuntime',
				format: 'umd'
			},
			{
				file: `${distPkgPath}/jsx-dev-runtime.js`,
				// 指定打包产物运行时对外暴露的全局变量名（针对iife和umd）
				name: 'jsxDevRuntime',
				format: 'umd'
			}
		],
		plugins: [...getCommonPlugins()]
	}
];
