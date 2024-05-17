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
			// thenable通常情况下是Promise，所以可以给Promise实例添加catch方法来捕获错误，返回想要在错误下使用的值;
			// 如果没有catch，则继续抛出错误，此时需要ErrorBoundary来捕获并展示其他UI;
			// 如果添加了catch，而catch的onRejected函数未出错, 则为thenable会为fulfilled状态, onRejected的返回值为value
			throw (thenable as RejectedThenable<T, void, any>).reason;
		default:
			if (typeof thenable.status === 'string') {
				// 此时说明开发者传进来的thenable已经被包装过了，所以有了status属性
				thenable.then(noop, noop);
			} else {
				// untrack
				const pending = thenable as unknown as PendingThenable<T, void, any>;
				pending.status = 'pending';
				pending.value = undefined;
				pending.reason = undefined;
				pending.then(
					(val) => {
						if (pending.status === 'pending') {
							const fulfilled: FulfilledThenable<T, void, any> = pending;
							fulfilled.status = 'fulfilled';
							fulfilled.value = val;
						}
					},
					(err) => {
						if (pending.status === 'pending') {
							const rejected: RejectedThenable<T, void, any> = pending;
							rejected.status = 'rejected';
							rejected.reason = err;
						}
					}
				);
			}
			break;
	}
	suspendedThenable = thenable;

	throw SuspenseException;
}
