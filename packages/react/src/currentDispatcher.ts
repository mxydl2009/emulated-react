import { Action, ReactContext } from 'shared/ReactTypes';

// Dispatcher是所有的Hooks集合，在源码里，hook都是dispatch函数
export interface Dispatcher {
	useState: <T>(initialState: T | (() => T)) => [T, Dispatch<T>];
	useEffect: (callback: () => void, deps: any[] | undefined) => void;
	useTransition: () => [boolean, () => void];
	useRef: <T>(initialValue: T) => { current: T };
	useContext: <T>(context: ReactContext<T>) => T;
}

export type Dispatch<T> = (action: Action<T>) => void;

// 当前使用的Hooks集合， 用current属性指向当前Hooks集合
export const currentDispatcher: { current: Dispatcher | null } = {
	current: null
};

export function resolveDispatcher() {
	const dispatcher = currentDispatcher.current;
	if (dispatcher === null) {
		throw new Error('Invalid hook call, hook only call in function component');
	}
	return dispatcher;
}
