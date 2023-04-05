const ivm = require('isolated-vm');

(async function main() {
  try {
    // Create a new isolate limited to 128MB
    const isolate = new ivm.Isolate({ memoryLimit: 128 });

    // Create a new context within this isolate. Each context has its own copy of all the builtin
    // Objects. So for instance if one context does Object.prototype.foo = 1 this would not affect any
    // other contexts.
    const context = await isolate.createContext();

    // Get a Reference{} to the global object within the context.
    const jail = context.global;

    // This makes the global object available in the context as `global`. We use `derefInto()` here
    // because otherwise `global` would actually be a Reference{} object in the new isolate.
    await jail.set('global', jail.derefInto());

    // We will create a basic `log` function for the new isolate to use.
    await jail.set('log', function (...args) {
      console.log(...args);
    });

    // And let's test it out:
    await context.eval('log("hello world")');
    // > hello world

    // Let's see what happens when we try to blow the isolate's memory
    const hostile = await isolate.compileScript(`
    const storage = [];
    const twoMegabytes = 1024 * 1024 * 2;
    while (true) {
      const array = new Uint8Array(twoMegabytes);
      for (let ii = 0; ii < twoMegabytes; ii += 4096) {
        array[ii] = 1; // we have to put something in the array to flush to real memory
      }
      storage.push(array);
      log('I\\'ve wasted '+ (storage.length * 2)+ 'MB');
    }
  `);

    // Using the async version of `run` so that calls to `log` will get to the main node isolate
    await hostile.run(context);
    // I've wasted 2MB
    // I've wasted 4MB
    // ...
    // I've wasted 130MB
    // I've wasted 132MB
    // RangeError: Array buffer allocation failed
  } catch (error) {
    process.exitCode = 1;
    console.error(error);
  }
}(...process.argv));