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
            console.log(`\t${i + 1}. ${nextFastest.name}`);
            for (let j = resultsInOrder.length - 1; j >= 0; j--) {
                if (i === j) continue;
                const benchmark = resultsInOrder[j];
                const speedUpAmount = benchmark.stats.mean / nextFastest.stats.mean;

                const rounded = parseFloat(speedUpAmount.toFixed(1));
                if (rounded >= 1) {
                    const description = rounded > 1 ? 'faster than' : 'same as';

                    // const percent slowerThan `${(percentOfRuntime * 100).toFixed(2)}%
                    console.log(`\t\t` + `${speedUpAmount.toFixed(1)}x`.padEnd(9) + `${description}`.padEnd(15) + `${benchmark.name}`);
                }
            }
            if (i < resultsInOrder.length - 1) {
                console.log();
            }
        }

        console.log('--------\n');
    },
};