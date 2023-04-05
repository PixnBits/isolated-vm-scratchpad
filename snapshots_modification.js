const ivm = require('isolated-vm');

(async function main() {
  var isolateA;
  var isolateB;
  try {
    const snapshot = ivm.Isolate.createSnapshot([
      { code: 'var thing = 101134;', filename: 'file:///thing.js' },
      { code: 'function render() { log("rendered!"); }', filename: 'file:///render.js' },
      { code: 'const deep = { a: 1, b: 2 };', filename: 'file:///deep.js' },
    ]);
    isolateA = new ivm.Isolate({ memoryLimit: 32, snapshot });

    const contextA = await isolateA.createContext();
    const jailA = contextA.global;
    await jailA.set('global', jailA.derefInto());
    await jailA.set('log', function (...args) { console.log(...args); });
    
    const contextB = await isolateA.createContext();
    const jailB = contextB.global;
    await jailB.set('global', jailB.derefInto());
    await jailB.set('log', function (...args) { console.log(...args); });

    isolateB = new ivm.Isolate({ memoryLimit: 32, snapshot });
    const contextC = await isolateB.createContext();
    const jailC = contextC.global;
    await jailC.set('global', jailC.derefInto());
    await jailC.set('log', function (...args) { console.log(...args); });

    async function runAStuff() {
      console.log('context A');
      await contextA.eval('log(Object.keys(global))');
      await contextA.eval('log("thing", typeof thing, thing)');
      await contextA.eval('thing = "why hello there";');
      await contextA.eval('log("thing", typeof thing, thing)');
      await contextA.eval('log("deep", typeof deep, deep)');
      await contextA.eval('deep.c = 3; delete deep.b; deep.a = "one";');
      await contextA.eval('log("deep", typeof deep, deep)');
      await contextA.eval('log(thing)');
      await contextA.eval('render()');
    }
    
    async function runBStuff() {
      console.log('context B');
      await contextB.eval('log(Object.keys(global))');
      await contextB.eval('log("thing", typeof thing, thing)');
      await contextB.eval('log("deep", typeof deep, deep)');
      await contextB.eval('render()');
    }

    async function runCStuff() {
      console.log('context C');
      await contextC.eval('log(Object.keys(global))');
      await contextC.eval('log("thing", typeof thing, thing)');
      await contextC.eval('log("deep", typeof deep, deep)');
      await contextC.eval('render()');
    }

    //*
    await runAStuff();
    await runBStuff();
    await runCStuff();
    /*/
    await Promise.all([runAStuff(), runBStuff(), runCStuff()]);
    //*/
  } catch (error) {
    process.exitCode = 1;
    console.error("we have an error:", error);
  } finally {
    isolateA.dispose();
    isolateB.dispose();
  }
}(...process.argv));