import path from 'path';
import fs from 'fs';
import ts from 'rollup-plugin-typescript2';
import cjs from '@rollup/plugin-commonjs';

const sourcePkgPath = path.resolve(__dirname, '../../packages');

const distPkgPath = path.resolve(__dirname, '../../dist/node_modules');

/**
 *
 * @param {*} pkgName 包名
 * @param {*} isDist 是否是产物
 * @returns 源包路径或者产物路径
 */
export function resolvePkgPath(pkgName, isDist) {
	if (isDist) {
		return path.resolve(distPkgPath, pkgName);
	}
	return path.resolve(sourcePkgPath, pkgName);
}

// 获取包的package.json路径, 从而从package.json中获取name字段
export function getPkgJson(pkgName) {
	const pkgJsonPath = resolvePkgPath(pkgName) + '/package.json';
	const str = fs.readFileSync(pkgJsonPath, 'utf-8');
	return JSON.parse(str);
}

// 没有commonjs的插件，会报错：在shared/ReactTypes.ts中没有导出ReactElementType，但实际上是导出的，很奇怪
// 源码中暂时没有任何的commonjs模块啊
export function getCommonPlugins(tsconfig = {}) {
	return [cjs(), ts(tsconfig)];
}
