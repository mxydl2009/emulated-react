import { jsxDEV, Fragment as _Fragment } from './src/jsx';
import {
	Dispatcher,
	resolveDispatcher,
	currentDispatcher
} from './src/currentDispatcher';

export const useState: Dispatcher['useState'] = (initialState: any) => {
	// 获取当前的Dispatcher.useState, 需要去resolveDispatcher
	const dispatcher = resolveDispatcher();
	return dispatcher.useState(initialState);
};

export const useEffect: Dispatcher['useEffect'] = (
	create: () => void,
	deps: any[] | undefined
) => {
	// 获取当前的Dispatcher.useState, 需要去resolveDispatcher
	const dispatcher = resolveDispatcher();
	return dispatcher.useEffect(create, deps);
};

export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = {
	currentDispatcher
};

export const version = '18.1.0';
export const createElement = jsxDEV;
export const Fragment = _Fragment;
