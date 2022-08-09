import Benchmark from 'benchmark';

export const suiteOptions: Benchmark.Options = {
    onStart: (event: any) => {
        const suite = event.currentTarget;
        console.log(suite.name);
    },
    onCycle: (event: any) => {
        console.log(`\t${String(event.target)}`);
    },
    onComplete: (event: any) => {
        const suite = event.currentTarget as Benchmark.Suite;

        const resultsInOrder: Benchmark[] = [];

        suite.forEach((x: Benchmark) => resultsInOrder.push(x));

        console.log('\nSlowest to fastest: ');
        resultsInOrder.sort((a, b) => a.stats.mean > b.stats.mean ? -1 : 1);

        for (let i = 0; i < resultsInOrder.length; i++) {
            const nextSlowest = resultsInOrder[i];
            console.log(`\t${nextSlowest.name}`);
            for (let j = resultsInOrder.length - 1; j >= 0; j--) {
                const benchmark = resultsInOrder[j];
                const percentOfRuntime = nextSlowest.stats.mean / benchmark.stats.mean;
                console.log(`\t\t${(1 / percentOfRuntime).toFixed(1)}x / ${(percentOfRuntime * 100).toFixed(2)}% - ${benchmark.name}`);
            }
        }

        console.log('--------\n');
    },
};