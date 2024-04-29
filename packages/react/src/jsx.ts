import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols';
import {
	Type,
	Key,
	Ref,
	Props,
	ReactElementType,
	ElementType
} from 'shared/ReactTypes';
const ReactElement = function (
	type: Type,
	key: Key,
	ref: Ref,
	props: Props
): ReactElementType {
	const element = {
		/**
		 * $$typeof 用于区分该对象是否是一个React Element, 这主要是用于防范XSS攻击
		 * 参考：https://juejin.cn/post/6844904137348349960?from=search-suggest
		 * 如果一个对象不包含$$typeof属性，则该对象不会被转换为React Element
		 * 用Symbol的原因在于，如果是一个JSON字符串(由于服务端漏洞，传给客户端)，在转为JavaScript对象时，会丢失Symbol类型的值
		 * 不支持Symbol时，用0xeac7的number类型，纯属于eac7长得像react，但不能有效防范XSS，只是保证定义的一致性
		 * */
		$$typeof: REACT_ELEMENT_TYPE,
		type,
		key,
		ref,
		props,
		// 区分模拟的React和真实的React
		__mark: 'emulated-react'
	};
	return element;
};

/**
 * react 17之前直接使用React.createElement转换jsx，但总是需要在文件顶部导入React
 * react 17之后使用jsx函数转换jsx，不需要手动导入React
 * 参考：https://www.51cto.com/article/749628.html
 * 主要是提取key, ref，并对config中的children进行处理，交给props
 * @param type host component的类型，如div
 * @param config props和children
 * @param maybeChildren 剩下的参数统一作为children处理，可能会传，也可能不传
 * @returns ReactElement
 */
export const jsx = (
	type: ElementType,
	config: any,
	...maybeChildren: any
): ReactElementType => {
	let key: Key = null;
	const props: Props = {};
	let ref: Ref = null;

	for (const propName in config) {
		const val = config[propName];
		if (propName === 'key') {
			if (val !== undefined) {
				key = '' + val;
			}
			continue;
		}
		if (propName === 'ref') {
			if (val !== undefined) {
				ref = val;
			}
			continue;
		}
		if (Object.prototype.hasOwnProperty.call(config, propName)) {
			props[propName] = val;
		}
	}

	const maybeChildrenLength = maybeChildren.length;
	if (maybeChildrenLength) {
		if (maybeChildrenLength === 1) {
			props.children = maybeChildren[0];
		} else {
			props.children = maybeChildren;
		}
	}

	return ReactElement(type, key, ref, props);
};

// 开发环境jsx函数，只是将children放在了config中传入，不作为第三个参数
export const jsxDEV = (type: ElementType, config: any): ReactElementType => {
	let key: Key = null;
	const props: Props = {};
	let ref: Ref = null;

	for (const propName in config) {
		const val = config[propName];
		if (propName === 'key') {
			if (val !== undefined) {
				key = '' + val;
			}
			continue;
		}
		if (propName === 'ref') {
			if (val !== undefined) {
				ref = val;
			}
			continue;
		}
		if (Object.prototype.hasOwnProperty.call(config, propName)) {
			props[propName] = val;
		}
	}

	return ReactElement(type, key, ref, props);
};
