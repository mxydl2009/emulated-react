import { ReactContext } from 'shared/ReactTypes';

// 每个context都对应着自己的prevContextValue和prevContextValueStack
let prevContextValue = null;
const prevContextValueStack = [];

export function pushProvider<T>(context: ReactContext<T>, newValue: T) {
	prevContextValueStack.push(prevContextValue);
	prevContextValue = context._currentValue;
	context._currentValue = newValue;
}

export function popProvider<T>(context: ReactContext<T>) {
	context._currentValue = prevContextValue;
	prevContextValue = prevContextValueStack.pop();
}
