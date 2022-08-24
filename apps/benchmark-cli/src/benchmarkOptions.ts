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

        console.log('\nFastest to slowest: ');
        resultsInOrder.sort((a, b) => a.stats.mean < b.stats.mean ? -1 : 1);

        for (let i = 0; i < resultsInOrder.length; i++) {
            const nextFastest = resultsInOrder[i];
            console.log(`\t${nextFastest.name}`);
            for (let j = resultsInOrder.length - 1; j >= 0; j--) {
                const benchmark = resultsInOrder[j];
                const percentOfRuntime = nextFastest.stats.mean / benchmark.stats.mean;
                console.log(`\t\t${(1 / percentOfRuntime).toFixed(1)}x / ${(percentOfRuntime * 100).toFixed(2)}% - ${benchmark.name}`);
            }
        }

        console.log('--------\n');
    },
};