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

### mount

生成fiber树
标记flag副作用

#### beginWork

对子节点进行fiber生成
标记两类副作用

- Placement： 节点插入或者移动
- childDeletion: 节点的删除
  不包含属性变化的flag，即Update类副作用

beginWork

## React-DOM

React-DOM是reconciler与hostConfig打包构建的产物
reconciler在构建时，不能包含React的内部数据共享层的代码(即reconciler导入的shared的internals文件，因为
shared的internals同样导入自React)

## hooks

问题1: hooks需要在函数的顶级作用域执行, 否则应该报错. 而且, 对于mount流程和update流程, hooks的逻辑也不尽相同. 因此, 对于hooks来说, 怎么能做到感知执行上下文呢? 或者说, hooks在执行的过程中, 是如何得知执行上下文?

解答1: 在不同的上下文中, 执行的hook不是同一个函数. 在不同的上下文, 要实现不同的hook函数, 也就是说, 不同的上下文对应了不同的hooks集合. 如下图所示. reconciler可以获悉当前是mount还是update，因此具体的Hook实现是在reconciler中. Hook函数在reconciler中具体实现（会与fiber相关）。
Hooks会在react中导入，React提供一个中间层用来存储当前使用的hooks集合, React中的Hook只是定义了一个很简单的函数，最核心的就是`resolveDispatcher`用来解析出到底使用哪个hooks集合，然后再调用解析后的Hook函数。

![hooks集合映射图](imags/hooks集合映射图.png)
hooks集合映射图

问题2： Hook如何记录自身的数据
解答2： hook是一种数据结构，每个Hook数据结构会与use...的函数进行对应（链表结构顺序对应），Hook将自身的数据记录在当前组件(fiber节点的memoizedState)上。

### mount阶段

在函数式组件调用前，将当前Hooks集合赋值为正确的Hooks集合(`currentDispatcher.current = dispatcher`);
在函数组件调用内部，Hook函数调用时，获取对应的Hook数据结构(如果没有就会创建Hook，将Hook记录在fiber节点上，构建Hook链表，返回对应的Hook，这样记录在Hook上的数据就会保存下来，方便update阶段或者其他时候使用)

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

##### rollup相关

`@rollup/plugin-replace`: 在打包构建过程中替换目标字符串
`@rollup/plugin-alias`： 打包构建时，将导入路径的包的别名替换为真实的包路径
