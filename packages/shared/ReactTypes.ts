import { REACT_FRAGMENT_TYPE } from './ReactSymbols';

export type Type = ElementType;
export type Key = string;
export type Ref = { current: any } | ((instance: any) => void);
export type REACT_FRAGMENT_TYPE = typeof REACT_FRAGMENT_TYPE;
export interface Props {
	children?: Array<ReactElementType> | undefined | ReactElementType;
	content?: string | number;
	value?: any;
	fallback?: ReactElementType;
}
export type ElementType = string | REACT_FRAGMENT_TYPE | ReactProviderType<any>;

export interface ReactElementType {
	$$typeof: symbol | number;
	type: Type;
	key: Key;
	ref: Ref;
	props: Props;
	__mark: string;
}
export type ReactProviderType<T> = {
	$$typeof: symbol | number;
	// 指向创建的context实例
	_context: ReactContext<T> | null;
};

export type ReactContext<T> = {
	$$typeof: symbol | number;
	Provider: ReactProviderType<T> | null;
	_currentValue: T;
};

export type Action<State> = State | ((prevState: State) => State);

export type Usable<T> = Thenable<T> | ReactContext<T>;

// Thenable 内部status： untracked -> pending -> fulfilled -> rejected
// export type Thenable<T>
export interface ThenableImpl<T, Result, Err> {
	then(
		onFulfilled: (value: T) => Result,
		onRejected?: (reason: Err) => Result
	): void | Weakable<Result>;
}

export interface UntrackedThenable<T, Result, Err>
	extends ThenableImpl<T, Result, Err> {
	status?: string;
}

export interface PendingThenable<T, Result, Err>
	extends ThenableImpl<T, Result, Err> {
	status?: string;
}

export interface FulfilledThenable<T, Result, Err>
	extends ThenableImpl<T, Result, Err> {
	status?: string;
	value: T;
}
export interface RejectedThenable<T, Result, Err>
	extends ThenableImpl<T, Result, Err> {
	status?: string;
	reason: Err;
}

export type Thenable<T, Result = void, Err = any> =
	| UntrackedThenable<T, Result, Err>
	| PendingThenable<T, Result, Err>
	| FulfilledThenable<T, Result, Err>
	| RejectedThenable<T, Result, Err>;

// Thenable 内部status： untracked -> pending -> fulfilled -> rejected
// export type Thenable<T>
export interface Weakable<Result> {
	then(
		onFulfilled: () => Result,
		onRejected?: () => Result
	): void | Weakable<Result>;
}
