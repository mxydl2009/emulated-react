import { resolvePkgPath, getPkgJson, getCommonPlugins } from '../utils';
// 定制产物的package.json，而非直接复制源码中的package.json
import generatePkg from 'rollup-plugin-generate-package-json';
import alias from '@rollup/plugin-alias';

const { name, module, peerDependencies } = getPkgJson('react-dom');

const sourcePkgPath = resolvePkgPath(name);

const distPkgPath = resolvePkgPath(name, true);

console.log('react-dom ', name, module, sourcePkgPath);

// 打包构建react包，生成在dist/node_modules/react目录下
export default [
	{
		input: `${sourcePkgPath}/${module}`,
		// 产物有两个，一个是index.js，一个是client.js(为了兼容react18，因为react18导出的是client.js)
		output: [
			{
				// 打包产物chunk写入的文件名，chunk只有一个时用file字段，两个以上的chunks要使用dir字段
				file: `${distPkgPath}/index.js`,
				// 指定打包产物运行时对外暴露的全局变量名（针对iife和umd）
				name: 'eReactDOM',
				format: 'umd'
			},
			{
				// 打包产物chunk写入的文件名，chunk只有一个时用file字段，两个以上的chunks要使用dir字段
				file: `${distPkgPath}/client.js`,
				// 指定打包产物运行时对外暴露的全局变量名（针对iife和umd）
				name: 'eReactDOM',
				format: 'umd'
			}
		],
		plugins: [
			...getCommonPlugins(),
			alias({
				entries: {
					hostConfig: `${sourcePkgPath}/src/hostConfig.ts`
				}
			}),
			generatePkg({
				inputFolder: sourcePkgPath,
				outputFolder: distPkgPath,
				baseContents: ({ name, description, version }) => ({
					name,
					description,
					version,
					peerDependencies: {
						react: version
					},
					main: 'index.js'
				})
			})
		],
		// 不参与打包的外部依赖，这里指定了react
		external: [...Object.keys(peerDependencies)]
	}
];
