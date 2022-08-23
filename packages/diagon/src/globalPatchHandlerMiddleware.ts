import { Next, ensureProxy, Patch } from '.';
import { clearModified } from './diagon';
import { endRecording } from './diagon';
import { DispatchContext } from './recorder';

export class GlobalPatchHandlerMiddleware<TPatchHandlerState extends object, TState extends object> {
    patchHandlerState?: TPatchHandlerState;
    constructor(public patchHandler: (patchHandlerState: TPatchHandlerState, patches: Patch[], state: TState) => void) {
    }

    setPatchHandlerState(patchHandlerState: TPatchHandlerState) {
        this.patchHandlerState = patchHandlerState;
    }

    middleware = (context: DispatchContext, next: Next) => {
        next();

        if (context.pipelineStackDepth === 0 && context.patches && this.patchHandlerState) {
            try {
                clearModified();
                const patchHandlerStateProxy = ensureProxy(this.patchHandlerState);
                const stateProxy = ensureProxy(context.state as TState);
                this.patchHandler(patchHandlerStateProxy, context.patches, stateProxy);

                context.allPatchSetsFromPipeline.push(endRecording());
            }
            finally {
                clearModified();
            }
        }
    };
}