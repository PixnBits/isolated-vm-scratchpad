const ivm = require('isolated-vm');

(async function main() {
  try {
    const snapshot = ivm.Isolate.createSnapshot([
        { code: 'const thing = 101134;', filename: 'file:///thing.js' },
        { code: 'function render() { log("rendered!"); }', filename: 'file:///render.js' },
        { code: 'function ohno() { throw new Error("ohnoez!"); }', filename: 'file:///error.js' },
    ]);
    const isolate = new ivm.Isolate({ memoryLimit: 32, snapshot });

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
    await context.eval('log(typeof thing)');
    await context.eval('render()');
    await context.eval('ohno()');
    // > hello world
  } catch (error) {
    process.exitCode = 1;
    console.error("we have an error:", error);
  }
}(...process.argv));