export type Type = ElementType;
export type Key = string;
export type Ref = string;
export interface Props {
	children?: Array<ReactElementType> | undefined | ReactElementType;
	content?: string | number;
}
export type ElementType = string;

export interface ReactElementType {
	$$typeof: symbol | number;
	type: Type;
	key: Key;
	ref: Ref;
	props: Props;
	__mark: string;
}

export type Action<State> = State | ((prevState: State) => State);
