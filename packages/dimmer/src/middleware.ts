export type Next = () => void;

export type Middleware<T> = (context: T, next: Next) => void;

export type Pipeline<T> = {
    push: (...middlewares: Middleware<T>[]) => void
    execute: (context: T, ...middlewares: Middleware<T>[]) => void
};

export function createPipeline<T>(...middlewares: Middleware<T>[]): Pipeline<T> {
    const stack: Middleware<T>[] = middlewares;

    const push: Pipeline<T>['push'] = (...middlewares) => {
        stack.push(...middlewares);
    };

    const execute: Pipeline<T>['execute'] = (context, ...dynamicMiddlewares: Middleware<T>[]) => {
        let prevIndex = -1;

        const runner = (stack: Middleware<T>[], index: number) => {
            if (index === prevIndex) {
                throw new Error('next() called multiple times');
            }

            prevIndex = index;

            const middleware = stack[index];

            if (middleware) {
                middleware(context, () => {
                    return runner(stack, index + 1);
                });
            }
        };

        runner([...stack, ...dynamicMiddlewares], 0);
    };

    return { push, execute };
}