import { jsxDEV, Fragment as _Fragment } from './src/jsx';
import {
	Dispatcher,
	resolveDispatcher,
	currentDispatcher
} from './src/currentDispatcher';
import { currentBatchConfig } from './src/currentBatchConfig';
import { ReactContext } from 'shared/ReactTypes';

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

export const useTransition: Dispatcher['useTransition'] = () => {
	const dispatcher = resolveDispatcher();
	return dispatcher.useTransition();
};

export const useRef: Dispatcher['useRef'] = (initialValue: any) => {
	const dispatcher = resolveDispatcher();
	return dispatcher.useRef(initialValue);
};

export const useContext: Dispatcher['useContext'] = <T>(
	context: ReactContext<T>
): T => {
	const dispatcher = resolveDispatcher();
	return dispatcher.useContext(context);
};

export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = {
	currentDispatcher,
	currentBatchConfig
};

export const version = '18.1.0';
export const createElement = jsxDEV;
export const Fragment = _Fragment;
