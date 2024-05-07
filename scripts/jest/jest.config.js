const { defaults } = require('jest-config');

module.exports = {
	...defaults,
	// jest命令执行的目录作为根目录
	rootDir: process.cwd(),
	testEnvironment: 'jsdom',
	// 在查找测试用例文件时要忽略的文件
	modulePathIgnorePatterns: ['<rootDir>/.history'],
	// 解析依赖的目录
	moduleDirectories: [
		// 针对我们自己的react，react-dom的目录
		'dist/node_modules',
		...defaults.moduleDirectories
	]
};
