import { REACT_FRAGMENT_TYPE } from './ReactSymbols';

export type Type = ElementType;
export type Key = string;
export type Ref = { current: any } | ((instance: any) => void);
export type REACT_FRAGMENT_TYPE = typeof REACT_FRAGMENT_TYPE;
export interface Props {
	children?: Array<ReactElementType> | undefined | ReactElementType;
	content?: string | number;
	value?: any;
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
