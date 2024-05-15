## 更新

更新是从根节点开始
触发更新可以是根节点`createRoot(root).render(<App />)`，也可以是任意组件节点`this.setState; dispatchSetState`，不管从哪里触发更新，都抽象统一到由根节点开始执行更新

## hostRootFiber和fiberRoot

fiber树的结构是由return属性、child属性和sibling属性组成，所以fiberRoot不属于fiber树；

每次fiber树都会从hostRootFiber的构建开始，所以构建过程需要从fiberRoot开始，通过`fiberRoot.current`找到当前hostRoot，新的fiber节点的构建，都是从alternate属性中找到之前的fiber节点，复用该fiber开始构建新的fiber节点。所以`markUpdateFromFiberToRoot`方法要返回fiberRoot；

fiber树根节点hostRootFiber是由root节点(即hostRoot)产生，`hostRootFiber.stateNode`指向fiberRootNode节点，而fiberRootNode节点用于双缓存技术切换当前UI对应的fiber树，因此，`fiberRootNode.current`指向当前的hostRootFiber节点

## workInProgress

reconciler的全局变量，用来指向当前待构建的fiber节点，while循环通过不断消费更新workInProgress来推进，直到workInProgress为null停止循环。while循环内部调用performUnitOfWork方法

### performUnitOfWork和CompleteUnitOfWork

通过beginWork消费workInProgress，并生成wip的子节点，直到workInProgress为null，到达左子树叶子节点，完成递的过程。
再通过completeUnitOfWork向上归，归的过程调用completeWork对子fiber节点生成实例并添加到父节点实例上，再不断更新workInProgress（先更新为兄弟节点，兄弟节点消费完，更新为父节点），从而又推进performUnitOfWork的调用。
总之，performUnitOfWork负责向下递，由beginWork来消费更新WorkInProgress，到达叶子节点后，由completeUnitOfWork负责平铺或者向上归，由completeWork对子节点进行实例化(appendAllChildren)，然后消费更新workInProgress（兄弟节点，父节点）。由while循环推动performUnitOfWork完成fiber树的生成。

### mount流程

生成fiber树
标记flag副作用

#### beginWork

对子节点进行fiber生成
标记两类副作用

- Placement： 节点插入或者移动
- childDeletion: 节点的删除
  不包含属性变化的flag，即Update类副作用

beginWork

### update流程

#### beginWork

同样是生成fiber树，标记副作用，但是生成fiber树的时候，需要根据key和type考虑是否可以复用原fiber节点

- key和type都相同，可复用
- key不同或者type不同，不可复用
- 不可复用的节点，则要删除，然后创建新的节点

#### hooks

**更新阶段的Hook结构从哪里查找？**
mount阶段的Hook都是新建的，由fiber节点的memoizedState保存Hook链表。而更新阶段需要重建fiber树，所以
新fiber上肯定找不到Hook数据，因此Hook数据要到currentFiber上找。

触发更新的情况

- 交互时触发
- render方法执行时触发（该情况需要阻止无限循环render）

## React-DOM

React-DOM是reconciler与hostConfig打包构建的产物
reconciler在构建时，不能包含React的内部数据共享层的代码(即reconciler导入的shared的internals文件，因为
shared的internals同样导入自React)

## hooks

hook函数的执行流程：寻找对应的Hook数据 -> 根据hook数据计算出新数据 -> 返回新数据和dispatch

Q1: hooks需要在函数的顶级作用域执行, 否则应该报错. 而且, 对于mount流程和update流程, hooks的逻辑也不尽相同. 因此, 对于hooks来说, 怎么能做到感知执行上下文呢? 或者说, hooks在执行的过程中, 是如何得知执行上下文?

A1: 在不同的上下文中, 执行的hook不是同一个函数. 在不同的上下文, 要实现不同的hook函数, 也就是说, 不同的上下文对应了不同的hooks集合. 如下图所示. reconciler可以获悉当前是mount还是update，因此具体的Hook实现是在reconciler中. Hook函数在reconciler中具体实现（会与fiber相关）。
Hooks会在react中导入，React提供一个中间层用来存储当前使用的hooks集合, React中的Hook只是定义了一个很简单的函数，最核心的就是`resolveDispatcher`用来解析出到底使用哪个hooks集合，然后再调用解析后的Hook函数。

![hooks集合映射图](imags/hooks集合映射图.png)
hooks集合映射图

Q2： Hook如何记录自身的数据

A2： hook是一种数据结构，每个Hook数据结构会与use...的函数进行对应（链表结构顺序对应），Hook将自身的数据记录在当前组件(fiber节点的memoizedState)上。

Q3: 如何获取Hook数据

A3: mount流程中，Hook数据是需要进行创建的。而在更新流程中，函数组件在调用Hook函数时，会查找对应的Hook数据。查找Hook数据的过程，是根据当前组件的fiber节点的alternate找到该节点对应的旧节点，从旧节点上找到对应的Hook数据。找到对应的Hook后，在根据之前的Hook，重新创建Hook数据。

### useEffect

useEffect: commit阶段完成后异步执行, 即浏览器重绘后执行

useLayoutEffect: commit阶段完成后同步执行，此时浏览器还未重绘

useInsertionEffect: commit阶段完成后同步执行， 获取不到DOM的引用，主要是为css-in-js的库使用

- 不同effect共用同一个机制, 通过effectTag来区分
- 保存依赖
- 保存create回调和destroy回调
- 区分是否需要触发create回调（mount、依赖变化）

useEffect除了Hook公共数据结构外，有其独特的Effect数据结构如下：

```js
export interface Effect {
	// 区分是哪种类型的副作用: Passive | Layout
	tag: EffectTag;
	// 回调函数
	create: EffectCallback;
	destroy: EffectCallback | void;
	// 依赖数组
	deps: EffectDeps;
	// 指向下一个Effect
	next: Effect;
}
```

并且组件内部的useEffect除了与其他Hook函数形成链表外，多个useEffect会形成Effect环状链表（即多个Effect数据结构形成环状链表），Effect数据保存在fiber节点的updateQueue里

```js
fiber.updateQueue.lastEffect = effect;
```

#### useEffect副作用执行

- render阶段，发现fiber节点上有副作用（mount、依赖变化）
- commit阶段，**调度副作用函数**，收集副作用Effect数据，执行副作用函数
  - 在fiberRootNode上收集Effect，将每个有effect副作用的fiber节点上的updateQueue上的effect环状链表收集到fiberRootNode上。
  - 执行副作用：先执行所有的destroy，再执行create

#### 调度器的使用

调度副作用使用的是React官方的scheduler包

```bash
pnpm i -w scheduler
pnpm i -D -w @types/scheduler
```

### mount阶段

在函数式组件调用前，将当前Hooks集合赋值为正确的Hooks集合(`currentDispatcher.current = dispatcher`);
在函数组件调用内部，Hook函数调用时，获取对应的Hook数据结构(如果没有就会创建Hook，将Hook记录在fiber节点上，构建Hook链表，返回对应的Hook，这样记录在Hook上的数据就会保存下来，方便update阶段或者其他时候使用)

## 事件系统

事件系统与宿主环境有关，所以实现事件系统应该在react-dom中，与reconciler无关；

- 模拟浏览器的捕获、冒泡
- 实现合成事件对象
- 方便扩展：实现事件优先级等等

事件回调函数保存在组件props上（reconciler包），为了0侵入reconciler，在react-dom中，将事件回调保存在
DOM对象的自定义属性上，所以需要一个方法将组件props上的事件回调保存到DOM对象上。

- 在创建instance时保存到instance上
- 在更新时更新事件回调保存到instance上

## diff算法

复用的意义：节点可复用，主要是指DOM节点的复用性

- 通过提供一个key，用来标识更新前后是否有变化，没有变化则表示没有对该节点进行删除操作，那么该节点在更新前后一直存在，是可复用的。再使用type来判断元素前后是否一致（实际上，key相同一般就代表了可复用了）

虚拟DOM在映射真实DOM时，只要判断key，就可以获知是否可复用该DOM节点，省去了删除DOM节点、创建DOM节点并插入到文档的性能。因此，**可复用节点的属性变化不在是否可复用的讨论范围内**

### 单一节点diff

单一节点指的是更新后是一个节点

#### 单对单 多对单

多对单的情况兼顾mount和update，都是只创建一个节点然后mount，只是update流程需要进行删除节点操作

1. 先查找是否可复用: key相同, type相同
   可复用意味着该DOM节点没有变化(属性可能有变化), 如果可复用, 那么其他兄弟节点都标记为删除
2. 没有可复用的节点: 标记所有节点删除, 创建新节点
   - 2.1 key相同, type不同:
   - 2.2 key不同, type相同:
   - 2.3 key不同, type不同;

### 多节点diff

只要是包含插值表达式，就会被处理为Array
如

```jsx
<div>hello {name}</div>
```

会被babel转为

```js
_jsx('div', {
	children: ['hello ', name]
});
```

再如

```jsx
function App() {
	const [arr, setArr] = useState(arrInit);
	const [num, setNum] = useState(0);
	return (
		<div
			onClick={() => {
				setNum((num) => num + 1);
			}}
		>
			<ul>
				{arr.map((item) => (
					<li key={item.id}>{item.name}</li>
				))}
				{num % 2 === 1 && <p>{num}</p>}
			</ul>
		</div>
	);
}
```

会被转为

```js
function App() {
	const [arr, setArr] = useState(arrInit);
	const [num, setNum] = useState(0);
	return /*#__PURE__*/ _jsx('div', {
		onClick: () => {
			setNum((num) => num + 1);
		},
		children: /*#__PURE__*/ _jsxs('ul', {
			children: [
				arr.map((item) =>
					/*#__PURE__*/ _jsx(
						'li',
						{
							children: item.name
						},
						item.id
					)
				),
				num % 2 === 1 &&
					/*#__PURE__*/ _jsx('p', {
						children: num
					})
			]
		})
	});
}
```

多节点指的是更新后是多个节点

#### 单对多 多对多

查找是否有可复用节点，除了可复用节点外，老节点都是要删除的节点，新节点都是要创建的节点
复用，就代表着要进行移动操作
不能复用，就代表这要进行创建和插入操作

1. 创建一个Map结构，将老节点存储起来（`Map<key: FiberNode.key | index, value: FiberNode>`），以便于
   查找是否有可复用节点；使用index作为key虽然不够准确，但配合type也可以省去创建DOM元素的性能。
2. 遍历新的element数组，根据key来查找是否有可复用节点，如果可复用，则复用，并将其从Map结构中删除；
3. 标记副作用：
   - 判断可复用节点是否需要标记移动；
   - 新创建的节点标记插入；
4. Map中剩下的就是应该删除的节点；

## Fragment

### unKeyedTopLevelFragment

指的是组件根节点是Fragment类型，如

```jsx
// App组件
function App() {
	return (
		<>
			<div>hello</div>
			<div>world</div>
		</>
	);
}
```

### 非顶层Fragment

Fragment不是根节点，而是子节点，如

```jsx
// App组件
function App() {
	return (
		<div>
			<>
				<p>app</p>
			</>
			<div>hello</div>
			<div>world</div>
		</div>
	);
}
```

### 插值数组也作为Fragment处理

如下

```jsx
arr = [<li>1</li>, <li>2</li>]

<ul>
	<li>11</li>
	<li>122</li>
	{arr}
</ul>
```

编译结果

```js
const arr = [
	/*#__PURE__*/ _jsx('li', {
		children: '1'
	}),
	/*#__PURE__*/ _jsx('li', {
		children: '2'
	})
];
return /*#__PURE__*/ _jsxs('ul', {
	children: [
		/*#__PURE__*/ _jsx('li', {
			children: '11'
		}),
		/*#__PURE__*/ _jsx('li', {
			children: '122'
		}),
		arr
	]
});
```

需要将插值表达式的arr也作为Fragment节点处理, 因为children中出现了嵌套数组的情况，嵌套数组时，内层
数组添加一个无意义的Fragment作为根节点

### React对外暴露Fragment

Fragment需要作为组件的一种类型对外暴露。
jsx对Fragment编译结果为

```js
_jsx(Fragment, {
	children: /*#__PURE__*/ _jsx('p', {
		children: 'para'
	})
});
```

React需要对外暴露Fragment，才不会导致Fragment变量找不到的错误。而Fragment只是作为类似于函数名、HTML标签名等等这样的ReactElement的一个标识；

```js
export const Fragment = REACT_FRAGMENT_TYPE;
```

### 删除Fragment节点

在DOM删除操作的情形，面对删除Fragment节点，可能会存在多个根host节点，比如下面的jsx，div和p都是根host节点，所以要找到所有根host节点，然后删除

```jsx
<>
	<div>ddd</div>
	<p>ppp</p>
</>
```

## 调试方法

### 打包构建为production产物，在真实环境下调试

这种方式可以最大程度模拟源码项目与真实react的对比，但不够灵活，每次有更改都需要重新打包构建。

1. 构建
   使用Rollup将项目打包构建为production产物，例如构建目录为`dist/node_modules/{package_name}`，react构建在`dist/node_modules/react`, react-dom构建在`dist/node_modules/react-dom`。
2. 创建项目
   使用create-react-app创建一个真实项目.

3. link项目，替代真实的react

- 3.1 在源码项目的`dist/node_modules/react`和`dist/node_modules/react-dom`下，分别`pnpm link --global`，将当前链接软链到全局；
- 3.2 在真实项目下，使用`pnpm link react --global`和`pnpm link react-dom --global`将真实项目的react依赖指向全局的react软链接，此时真实项目使用的react即为源码项目的构建产物；

### 使用vite进行非打包构建的实时调试

vite在开发环境下不再进行打包构建，所以调试时速度很快。
vite的插件体系与Rollup的插件体系是兼容的，也方便直接复用Rollup的插件；
使用vite即可在源码目录下创建vite项目，直接导入react和react-dom进行调试；但是需要配置一下react和react-dom的解析路径，替换为源码项目的react和react-dom，包括hostConfig

一直报错: 服务端错误，从main.ts中`import { jsxDEV } from 'react/jsx-dev-rumtime`，文件找不到

### 使用React官方测试用例进行测试

#### 实现官方的测试工具test-utils

官方的是ReactTestUtils.js文件：使用ReactDOM作为宿主环境，因此自己实现的测试工具也放在react-dom包里
test-utils.ts文件是我们自己的测试工具，对外暴露一个renderIntoDocument的方法

#### 实现测试环境

安装依赖: `pnpm i -D -w jest jest-config jest-environment-jsdom`

#### 实现ReactElement测试用例

在react的包下添加`__tests__`，添加ReactElement-test.js的测试用例文件

## rollup相关

`@rollup/plugin-replace`: 在打包构建过程中替换目标字符串

`@rollup/plugin-alias`： 打包构建时，将导入路径的包的别名替换为真实的包路径

## 调度系统

### 更新是同步还是异步

这个问题的核心在于，更新UI的JavaScript代码相对于触发更新之后的代码是同步执行还是异步执行？或者说，DOM操作是在当前宏任务执行还是异步任务执行？例如

```js
// 代码是在某个用户交互的回调中执行
setState((num) => num + 1);
console.log('同步还是异步');
```

- 如果是同步执行，那么在执行setState的过程中，更新UI的代码会被压栈执行，执行完更新后，再执行打印语句；
- 如果是异步执行，那么在执行setState的过程中，并不会执行更新UI的代码，而是将更新UI的代码调度到异步队列中，然后执行打印语句，最后在调度系统安排的合适时机执行更新UI的代码；

### 异步更新的时机

不同的框架对于异步更新的时机可能会不同，大部分框架都会选择将更新调度在本次宏任务的微任务队列中执行。微任务是一个执行UI更新的适当时机。
但是微任务有个缺点，就是微任务是在浏览器启动渲染线程重绘界面之前执行，如果微任务性能开销大，就会造成阻塞页面。
react的调度系统，优先使用messageChannel API来调度任务。messageChannel调度的任务是宏任务，在渲染线程重绘界面之后立刻执行，不耽误帧时间。而setTimeout(fn, 0)最小延迟时间是4ms，会浪费4ms的帧时间。

### 批处理与优先级

批处理是将一次宏任务里的多次更新合并为一次更新流程来处理。
多次更新会创建多个更新任务，将这些更新任务存储起来（React内部使用环形链表），在一次更新流程中统一处理。只是在处理过程中，React可以按照优先级对这些更新任务排序，优先处理高优先级的任务，多个更新任务先处理优先级一致的一批任务。

```typescript
// 环状链表的形成
/**
 * 入队, pending指向最后入队的update元素，要形成一个环状链表
 * @param updateQueue 队列
 * @param update 更新
 */
export const enqueueUpdate = <State>(
	updateQueue: UpdateQueue<State>,
	update: Update<State>
) => {
	const pending = updateQueue.shared.pending;
	if (pending === null) {
		update.next = update;
	} else {
		// pending.next指向的是第一个元素，而update需要插入到最后，所以这里将第一个元素赋值到update.next,
		// 这样update在入队后，update.next就会指向第一个元素, 这样保存了pending.next不至于丢掉;
		update.next = pending.next;
		// 保存了pending.next后，pending此时作为倒数第二个，需要用next指向update
		pending.next = update;
	}
	// 将update插入到最后
	updateQueue.shared.pending = update;
};
```

#### 优先级Lane模型

使用Lane模型来记录更新的优先级。
Lane模型

- 使用二进制记录优先级；
- 用集合的形式来表示批次；
  **优先级的产生**：
  优先级的产生与触发更新的上下文有关，不同的上下文产出的优先级不同，例如用户交互的上下文优先级较高，挂载应用时的优先级最高（同步），使用setTransition产出的优先级较低等等
  **优先级的消费**：
  触发更新后，由scheduler将优先级记录在FiberRootNode上，在所有优先级中选出一批优先级，消费（render，commit），然后将已消费的优先级从FiberRootNode里删除，再继续选出优先级消费，直到没有更新任务。
  - 在render阶段消费lane，即将lane在构造fiber树时传递下去，在fiber节点计算更新时会用到
  - 在commit阶段，移除已经消费的lane

### 并发更新

交互 -> 根据交互上下文（事件类型）确定调度器的优先级schedulerPriority -> 按该优先级调度交互的回调函数 -> 回调函数产生更新以及更新对应的Lane（这个lane是由schedulerPriority对应转换而来）

并发更新与之前的同步/异步更新最大的区别就是更新可被打断，可被高优先级更新插队，从而导致同一时间，组件内有多个更新待计算执行，而且是非顺序性的。

而不同/异步更新是不可被打断，是严格按照顺序计算更新，消费完更新后渲染，然后才能再接收更新

#### 组件Hook的更新队列计算state

在考虑并发更新的情况下，组件Hook根据更新队列计算state的方式会有变化。

1. 产生更新的优先级相同时，与同步更新是一致的。

- 同一个Hook在同一上下文下产生相同的更新优先级，计算state: 因为优先级相同，该Hook的state计算跟同步更新相同；
- 多个Hook在同一上下文产生相同的更新优先级，计算state: 因为优先级相同，多个Hook分别计算自己的state计算，跟同步更新相同；

2. 产生不同优先级时，计算state方式需要改变

- 同一个Hook在不同上下文下产生不同的更新优先级: 后产生的高优先级可以打断先产生的低优先级，最终计算结果与更新产生的顺序有关;

- 不同Hook在不同上下文产生不同的更新优先级: Hook各自根据上一条计算各自的state

##### 产生不同优先级时，计算state方式需要改变

比如先在低优先级的上下文产生更新，在未完成渲染时，又在高优先级的上下文产生更新，从而打断低优先级的更新;

- 原来的方式没有优先级的概念，所有的更新都会被按照顺序依次参与计算，最终由baseState -> update -> update -> ... -> memoizedState得到memoizedState来显示在UI上。
- 更新的顺序不能变化，因为该顺序保证了更新之间的依赖性.
  ```js
  updateNum((num) => num + 1);
  updateNum((num) => num + 2); // 这一步的更新依赖于上一步更新的计算结果;
  ```
- 考虑并发更新时，更新是具有优先级的
  - 先计算高优先级更新: 只有优先级属于本次渲染的优先级这一批次的更新才会参与计算得到memoizedState, old memoizeState -> update -> update -> ...(有的update会因为优先级非本批次而跳过) -> new memoizedState，将new memoizedState记录在fiber的memoizedState上来显示在UI。
  - 再计算低优先级更新（消耗完更新）: 高优先级的更新渲染到页面（可以说该状态是所有更新消耗完前的中间态，但由于是高优先级，需要更早展示在页面），然后计算低优先级的更新。按照更新的顺序计算，由baseState -> update -> update -> ...(update无跳过，包括上一步的高优先级更新) -> memoizedState得到memoizedState显示在UI上。此时，更新被消耗完，计算得到的memoizedState被记录在fiber节点上，作为下一次渲染的baseState(用于消耗完更新的计算过程)和memoizedState(用于高优先级更新的计算过程)

因此，并发更新情形下，对于更新队列，baseState用于消耗完更新队列得到最终state（保证更新的顺序依赖），而memoizedState用于消耗高优先级得到中间state（保证优先展示）。

在这一基本思路基础上，可以做一些优化：实际上，在消耗高优先级更新时，也是按照顺序消耗，只是遇到第一个要跳过的更新时，将此时计算得到的state值赋予baseState，并且将该更新保存到baseQueue。下一次消耗低优先级的更新时，就可以从第一个要跳过的更新baseQueue和此时的baseState开始计算，节省了计算成本。

### useTransition

```js
// isPending标识本次更新任务是否完成，setTransition改变更新的优先级
const [isPending, setTransition] = useTransition();
```

通过setTransition将本次更新的上下文优先级改为TransitionLane，让更新变为优先级低的更新，从而可以使得用户交互的优先级打断TransitionLane的更新任务，保证用户交互的响应性。

从useTransition的返回值可以看到包含一个状态和一个方法, 说明内部使用了useState来更新状态, 在setTransition方法执行时，先更改全局优先级上下文变量，让setTransition方法内的回调函数产生的更新优先级降低为TransitionLane，调用后，再恢复全局优先级上下文变量。

mount阶段: mountState -> isPending为false -> 创建hook -> startTransition存储在hook 。memoizedState -> startTransition返回为setTransition;
update阶段: dispatchSetState -> isPending为true -> 从hook.memoizedState获取并调用startTransition -> 更改优先级 -> (调用callback函数, dispatchSetState -> isPending为false) --> 恢复优先级

### useRef

useRef就是在Hook上记录一个对象，在适当的时候会给current属性赋值;

不管是mount还是update，都是获取当前的Hook，然后返回存储在hook.memoizedState上的对象;

#### 给ref赋值

ref对象拿到后，有两种处理方式:

- ref对象不作为prop传到HostComponent上时，只是作为函数组件在多次执行之间保存数据。
- ref对象作为prop传到HostComponent上时，React需要在组件挂载和更新后给ref对象重新赋值为当前的DOM节点，在组件卸载时，将ref对象赋值为null，防止内存泄漏

1. 在Mutation阶段，解绑之前的ref: 将ref置空
2. 在layout阶段，绑定新的ref: 将ref赋值

### useContext

Context使用的方式

1. 创建Context，传入默认值
2. 将消费节点作为Provider节点的子孙节点, 在Provider中可以给context重新赋值
3. 子孙消费节点使用useContext订阅数据
4. 非子孙节点订阅的数据为默认值

useContext的核心逻辑就是context对象按照Provider组件层级维护着一系列Provider提供的值和创建context传递的默认值，在每个Provider开始beginWork构建时，把Provider的value压栈，在Provider的completeWork时将value出栈，这样子孙节点在构建自己时，使用useContext获取到的就是最近的Provider上的value了;

由于每个context对象维护着自己的一系列值，所以不同的context.Provider嵌套也没关系，不会相互干扰。

#### useContext没有使用Hook保存数据

useContext没有使用Hook保存数据，因此可以在条件语句中调用，也不存在与其他Hook的相对顺序问题。

#### bailout优化策略与Context

bailout优化策略：如果组件的shouldComponentUpdate返回true，表示组件没有更新，那么组件会跳过beginWork，复用上一次的渲染结果。
当命中bailout策略的组件的子孙节点有订阅Context时，就会出问题。这些子孙节点由于复用了之前的渲染结果，所以无法获知Context是否有变化，从而可能会导致非预期的渲染发生。

##### 解决办法

React内部组件命中bailout策略时，仍然会进一步遍历子孙节点，检查是否有订阅Context。如果有订阅，那么就会沿父节点依次递归返回并标记沿途父节点为有Context订阅，这样即便命中bailout策略时，也会beginWork去渲染，从而避免非预期的渲染发生。

## 性能优化

减少不必要的render函数执行，提高性能。

### bailout策略

命中bailout策略的组件不需要重新render，其子节点结构用上一次render的子节点结构即可。

通过命中bailout策略，可以减少子节点的diff算法。

组件通过render函数的执行，获得其children子节点结构。减少render函数的执行，子节点们都复用原来的子节点。但是子节点的渲染函数可能还会调用，因为子节点需要获得子孙节点。

如何命中bailout策略

- props不变: 通过全等比较(直接比较props的引用)，除非用了React.memo后用浅比较
- state不变: 1. 没有state 2. 存在update更新，但更新前后state值不变
- context不变
- type不变

对开发者的启示:

- 分离状态: render函数中能抽离状态就抽离状态，将动与静分离.

#### 相关API

React.memo: 高阶组件，包裹传入的组件，将props的全等比较转换为浅比较，从而让传入的组件可以命中bailout策略

useCallback: 缓存函数的引用，从而在多次渲染中对函数保持同一个引用，有利于命中bailout策略

useMemo: 缓存函数调用的结果的引用，从而在多次渲染中对函数调用结果保持同一个引用，有利于命中bailout策略

### eagerState策略

触发的更新经过计算后状态前后一致，没必要调度新的更新。

产生更新后，在调度之前计算state。

eagerState策略的前提是当前fiber没有其他更新，只有刚产生的更新，这样才会尝试eagerState策略

### React.lazy使用

```js
React.lazy(load: () => Promise<{default: () => ReactElementType}>)
```

load函数: load函数调用的返回值是一个Promise(或者Thenable对象), 其resolve的值要有一个**default属性**，属性值应该是一个**返回jsx的函数**

- webpack提供的动态导入import()函数resolve的值就是一个包含了default属性的对象。

返回值: LazyComponent

```js
  const lazyType: LazyComponent<T, Payload<T>> = {
    $$typeof: REACT_LAZY_TYPE,
		// payload即为要解析的组件
    _payload: payload,
		// 解析payload
    _init: lazyInitializer,
  };
```

#### lazy用法

```js
function Child(props) {
	return <Comp {...props} />;
}

// 用法1
const ChildCom = lazy(() => {
	return getSomeData().then((data) => {
		return { default: Child };
	});
});

// 用法2
const ChildCom = lazy(() => {
	return getSomeData().then((data) => {
		return { default: () => <Child data={data} /> };
	});
});

// 用法3
const ChildCom = lazy(() => import(`${Child}的引用地址`));

function App() {
	return (
		<div>
			<Comp />
		</div>
	);
}
```

#### 与Suspense配合的原理

1. 首次渲染过程中，当解析到LazyComponent时，会调用lazyInitializer函数（内部会调用load函数，此时payload状态为pending，result为load函数的返回值（Promise），并为该Promise调度了微任务），最后lazyInitializer函数抛出错误。

2. React catch到错误后，由Suspense处理，显示fallback;

3. 当Promise resolve后，调度的微任务会给payload状态置为Resolved, 并将结果存储与payload的result中;

4. Suspense接着处理: pingSuspendedRoot函数会再次调度渲染工作，再次解析到LazyComponent时，调用lazyInitializer函数会返回payload的result结果的default属性，即一个返回jsx的函数（即函数组件），然后按照函数组件的渲染方式继续即可。

## 常见问题记录

Q: React是可以获知哪个fiber发生了更新(`scheduleUpdateOnFiber(fiber)`), 为什么不直接从该fiber重建fiber树呢？这样不是性能更高吗？

A: 的确如此，从某个fiber树重建子树，比从root节点重建性能更高。但是忽略了一点，React内部是有更新任务优先级的，从某个fiber节点产生的更新任务，未必会立刻调度更新，因为该更新任务优先级并不一定更高，也许某处有更高优先级任务产生，所以不能从该fiber节点重建，而是必须从root处重建，这样逻辑更加简单。像Vue、svelte没有更新优先级的概念，所以不必从根节点开始diff，直接从发生更新的节点开始diff即可。

Q: React为什么使用环状链表保存更新、hooks？

A: 主要是因为既要保存对第一个数据的引用，又要考虑插入新数据到链表尾部的性能。普通链表如果只保存首节点的指针，则每次插入时需要先进行一次遍历找到尾节点，再进行插入。如果想插入链表尾部性能高，那就需要保存首和尾两个节点的指针。而环形链表的尾节点的下一个节点就是首节点，因此只需要保存一个尾节点指针就可以做到既方便插入又方便访问首节点。

Q: React并发更新下，开发者如何优化代码?

A: **首先，一定不要编写耗时的组件!!!** 组件一旦耗时(比如超过5ms)，即便是在并发更新下，也会有卡顿发生。因为并发更新下，时间切片的颗粒度是指fiber节点的reconcileChildren，组件在执行完reconcileChildren才会交出执行权给浏览器，因此一旦组件的耗时长了，势必会导致掉帧。因此，如果组件复杂耗时，那么一定要拆分成低耗时、多节点的情况;

Q: concurrency和parallelism的区别

A: concurrency的意思是当前应用在同一时间段执行多项工作。如果CPU核数是1，严格意义上，多项工作不可能在同一时刻执行，但是可以在同一时间段内交替执行，而不是完成一项工作后才开始另一项工作。**concurrency意味着在同一时间执行多项任务，但不是连续地执行一个任务**。parallelism是针对多核CPU，**严格意义上的同一时刻在执行多项任务，任务是连续性执行**。
