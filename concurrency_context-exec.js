const ivm = require('isolated-vm');

(async function main() {
  try {
    const isolate = new ivm.Isolate();

    const contextA = await isolate.createContext();
    const jailA = contextA.global;
    await jailA.set('global', jailA.derefInto());
    await jailA.set('log', function (...args) { console.log(...args); });

    const contextB = await isolate.createContext();
    const jailB = contextB.global;
    await jailB.set('global', jailB.derefInto());
    await jailB.set('log', function (...args) { console.log(...args); });

    const intensiveModule = await isolate.compileModule(`
      // https://stackoverflow.com/a/40200710
      export default function isPrime(num) {
          for(let i = 2, s = Math.sqrt(num); i <= s; i++) {
              if(num % i === 0) return false;
          }
          return num > 1;
      };
    `);
    await intensiveModule.instantiate(contextA, () => { throw new Error('should not have any dependencies needing resolution'); });
    // await intensiveModule.instantiate(contextB, () => { throw new Error('should not have any dependencies needing resolution'); });
    await intensiveModule.evaluate();

    const aModule = await isolate.compileModule(`
      import isPrime from './isPrime.js';
      const primes = [];
      log('a starting');
      for (let i=0; i<=10_000_000; i++) {
        if (i===45) { log('a saw i = 45'); }
        if (!isPrime(i)) {
          continue;
        }
        primes.push(i);
      }
      log('a', primes)
    `);
    await aModule.instantiate(contextA, (specifier, referrer) => {
      if (specifier === './isPrime.js') {
        return intensiveModule;
      }
      throw new Error(`could not resolve "${specifier}" for ${referrer}`);
    });

    const bModule = await isolate.compileModule(`
      import isPrime from './isPrime.js';
      const primes = [];
      log('b starting');
      for (let i=0; i<=10_000_000; i++) {
        if (i===45) { log('b saw i = 45'); }
        if (!isPrime(i)) {
          continue;
        }
        primes.push(i);
      }
      log('b', primes)
    `);
    await bModule.instantiate(contextB, (specifier, referrer) => {
      if (specifier === './isPrime.js') {
        return intensiveModule;
      }
      throw new Error(`could not resolve "${specifier}" for ${referrer}`);
    });

    const aStart = process.hrtime.bigint();
    let aEnd;
    console.log('starting a', aStart);
    const a = aModule.evaluate().then(
      (result) => {
        aEnd = process.hrtime.bigint();
        console.log('a resolved', aEnd); return result;
      },
      (error) => {
        aEnd = process.hrtime.bigint();
        console.error('a rejected', aEnd); throw error;
      }
    );

    const bStart = process.hrtime.bigint();
    let bEnd;
    console.log('starting b', bStart);
    const b = bModule.evaluate().then(
      (result) => {
        bEnd = process.hrtime.bigint();
        console.log('b resolved', bEnd); return result;
      },
      (error) => {
        bEnd = process.hrtime.bigint();
        console.error('b rejected', bEnd); throw error;
      }
    );

    await Promise.all([a, b]);

    console.log('\nnanoseconds')
    console.log('-----------')
    console.log('diff in start times: ', bStart - aStart);
    const aDuration = aEnd - aStart;
    const bDuration = bEnd - bStart;
    console.log('durations: ', { a: aDuration, b: bDuration });
    const durationDiff = Math.abs(Number(bDuration) - Number(aDuration));
    console.log(
      'diff in run times: ',
      durationDiff,
      {
        a: `${(100 * durationDiff / Number(aDuration)).toFixed(1)}%`,
        b: `${(100 * durationDiff / Number(bDuration)).toFixed(1)}%`,
      },
      {
        a: `${(100 * Number(aDuration) / durationDiff).toFixed(1)}%`,
        b: `${(100 * Number(bDuration) / durationDiff).toFixed(1)}%`,
      }
    );
    console.log('from previous runs this appears to show that modules do not run concurrently in separate contexts');
  } catch (error) {
    process.exitCode = 1;
    console.error(error);
  }
}(...process.argv));