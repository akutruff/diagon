/* eslint-disable @typescript-eslint/ban-types */
import { deproxify, MapKeys, map_get, recordPath, elements } from './pathRecorder';

describe('pathRecorder', () => {
    it('records property accesses', () => {
        const address = { value: '87473 Main St.' };
        const bobPerson = { name: 'bob', address };
        const state = {
            person: bobPerson,
        };

        type State = typeof state;

        const path = recordPath((state: State) => state.person);

        const pathRecord = deproxify(path);
        expect(pathRecord).toEqual({ person: {} });
    });

    it('records deep property accesses', () => {
        const address = { value: '87473 Main St.' };
        const bobPerson = { name: 'bob', address };
        const state = {
            person: bobPerson,
        };

        type State = typeof state;

        const path = recordPath((state: State) => state.person.address);

        const pathRecord = deproxify(path);
        expect(pathRecord).toEqual({ person: { address: {} } });
    });

    it('records branched property access', () => {
        const address = { value: '87473 Main St.' };
        const bobPerson = { name: 'bob', address };
        const state = {
            person: bobPerson,
        };

        type State = typeof state;

        const path = recordPath((state: State) => [state.person.name, state.person.address.value]);

        const pathRecord = deproxify(path);
        expect(pathRecord).toEqual({ person: { name: {}, address: { value: {} } } });
    });

    it('records iterators', () => {
        const bobPerson = { name: 'bob' };
        const alicePerson = { name: 'bob' };

        const state = {
            people: [bobPerson, alicePerson],
        };

        type State = typeof state;

        const path = recordPath((state: State) => [...state.people]);

        const pathRecord = deproxify(path);

        expect(Array.from(pathRecord.people)).toEqual([{}]);
    });
});

describe('map_get', () => {
    it('records map gets accesses', () => {

        const bobPerson = { name: 'bob' };
        const state = {
            person: bobPerson,
            people: new Map([['bob', bobPerson]]),
        };

        type State = typeof state;

        const path = recordPath((state: State) => [map_get(state.people, 'bob')]);

        const pathRecord = deproxify(path);
        expect(pathRecord).toHaveProperty('people');
        expect(pathRecord.people[MapKeys]).toEqual(new Map([
            ['bob', {}],
        ]));
    });

    it('records properties fetched after map_get', () => {

        const bobPerson = { name: 'bob' };
        const state = {
            person: bobPerson,
            people: new Map([['bob', bobPerson]]),
        };

        type State = typeof state;

        const path = recordPath((state: State) => [map_get(state.people, 'bob')?.name]);

        const pathRecord = deproxify(path);
        expect(pathRecord).toHaveProperty('people');
        expect(pathRecord.people[MapKeys]).toEqual(new Map([
            ['bob', { name: {} }],
        ]));
    });

    it('records multipe map gets accesses', () => {

        const bobPerson = { name: 'bob' };
        type Person = typeof bobPerson;
        const person2: Person = { name: 'person2' };
        const state = {
            person: bobPerson,
            people: new Map([['bob', bobPerson], ['person2', person2]]),
        };

        type State = typeof state;

        const path = recordPath((state: State) => [map_get(state.people, 'bob')?.name, map_get(state.people, 'person2')]);

        const pathRecord = deproxify(path);
        expect(pathRecord).toHaveProperty('people');
        expect(pathRecord.people[MapKeys]).toEqual(new Map([
            ['bob', { name: {} }],
            ['person2', {}]
        ]));
    });
});

describe('withContentChanges', () => {
    it('returns the collection passed to it when called outside a recording context', () => {

        const state = {
            people: [{ name: 'bob' }],
        };

        const result = elements(state.people);
        expect(result).toBe(state.people);
    });

    it('records iterations', () => {
        const state = {
            people: [{ name: 'bob' }],
        };

        type State = typeof state;

        const path = recordPath((state: State) => [elements(state.people)]);

        const pathRecord = deproxify(path);
        expect(pathRecord).toHaveProperty('people');

        let count = 0;
        for (const _element of pathRecord.people) {
            count++;
        }

        expect(count).toEqual(1);
    });
});
