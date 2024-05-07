import { ReactElementType } from 'shared/ReactTypes';
// @ts-expect-error: 这里需要使用react-dom来导入，而且只是做一个标记，实际上react-dom是外部依赖，运行时肯定会有
// react和react-dom都是test-utils的外部依赖，不需要参与打包流程，所以这里不使用import { createRoot } from './src/root.ts'
import { createRoot } from 'react-dom';

export function renderIntoDocument(element: ReactElementType) {
	const div = document.createElement('div');
	return createRoot(div).render(element);
}
