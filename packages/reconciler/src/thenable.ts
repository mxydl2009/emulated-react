import {
	FulfilledThenable,
	PendingThenable,
	RejectedThenable,
	Thenable
} from 'shared/ReactTypes';

function noop() {}

export const SuspenseException = new Error(
	'Suspense工作中的自定义异常，不是真的错误，而是用来控制渲染流程的异常'
);

let suspendedThenable = null;

export function getSuspendedThenable() {
	if (suspendedThenable === null) {
		throw new Error('suspendedThenable不应该为null');
	}
	const thenable = suspendedThenable;
	suspendedThenable = null;
	return thenable;
}
// 追踪用户传入的thenable参数
export function trackUsedThenable<T>(thenable: Thenable<T, void, any>) {
	switch (thenable.status) {
		case 'fulfilled':
			return (thenable as FulfilledThenable<T, void, any>).value;
		case 'rejected':
			throw (thenable as RejectedThenable<T, void, any>).reason;
		default:
			if (typeof thenable.status === 'string') {
				// 此时说明开发者传进来的thenable已经被包装过了，所以有了status属性
				thenable.then(noop, noop);
			} else {
				// untrack
				const pending = thenable as unknown as PendingThenable<T, void, any>;
				pending.status = 'pending';
				// pending.value = undefined;
				pending.then(
					(val) => {
						if (pending.status === 'pending') {
							const fulfilled: FulfilledThenable<T, void, any> = {
								...pending,
								value: val
							};
							fulfilled.status = 'fulfilled';
						}
					},
					(err) => {
						if (pending.status === 'pending') {
							const rejected: RejectedThenable<T, void, any> = {
								...pending,
								reason: err
							};
							rejected.status = 'rejected';
						}
					}
				);
			}
			break;
	}
	suspendedThenable = thenable;

	throw SuspenseException;
}
