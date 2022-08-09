import { createPipeline, Next } from './middleware';

describe('Pipeline', () => {
    it('executes fixed middleware', async () => {
        const state = { value: 1 };
        type State = typeof state;

        const m0 = jest.fn((x: State, next: Next) => {
            next();
        });
        const pipeline = createPipeline<State>(
            m0
        );

        pipeline.execute(state);

        expect(m0.mock.calls.length).toBe(1);
        expect(m0.mock.calls[0][0]).toBe(state);
    });

    it('executes multiple middleware', async () => {
        const state = { value: 1 };
        type State = typeof state;

        const m0 = jest.fn((x: State, next: Next) => {
            x.value += 2;
            next();
        });

        const m1 = jest.fn((x: State, next: Next) => {
            x.value += 4;
            next();
        });

        const pipeline = createPipeline<State>(
            m0,
            m1
        );

        pipeline.execute(state);

        expect(m0.mock.calls.length).toBe(1);
        expect(m0.mock.calls[0][0]).toBe(state);
        expect(m1.mock.calls.length).toBe(1);
        expect(m1.mock.calls[0][0]).toBe(state);

        expect(state.value).toBe(7);
    });

    it('executes middleware in correct order', async () => {
        const state = { calls: [] } as { calls: number[] };
        type State = typeof state;

        const m0 = jest.fn((x: State, next: Next) => {
            x.calls.push(0);
            next();
            x.calls.push(3);
        });

        const m1 = jest.fn((x: State, next: Next) => {
            x.calls.push(1);
            next();
            x.calls.push(2);
        });

        const pipeline = createPipeline<State>(
            m0,
            m1
        );

        pipeline.execute(state);
        expect(state.calls).toEqual([0, 1, 2, 3]);
    });

    it('supports dynamic middleware when no fixed middleware', async () => {
        const state = { value: 1 };
        type State = typeof state;

        const pipeline = createPipeline<State>();

        const d0 = jest.fn((x: State, next: Next) => {
            next();
        });

        pipeline.execute(state, d0);

        expect(d0.mock.calls.length).toBe(1);
        expect(d0.mock.calls[0][0]).toBe(state);
    });

    it('supports dynamic middleware', async () => {
        const state = { value: 1 };
        type State = typeof state;

        const m0 = jest.fn((x: State, next: Next) => {
            next();
        });

        const pipeline = createPipeline<State>(
            m0
        );

        const d0 = jest.fn((x: State, next: Next) => {
            next();
        });

        
        const d1 = jest.fn((x: State, next: Next) => {
            next();
        });

        pipeline.execute(state, d0, d1);

        expect(m0.mock.calls.length).toBe(1);
        expect(m0.mock.calls[0][0]).toBe(state);
        
        expect(d0.mock.calls.length).toBe(1);
        expect(d0.mock.calls[0][0]).toBe(state);

        expect(d1.mock.calls.length).toBe(1);
        expect(d1.mock.calls[0][0]).toBe(state);
    });
});

