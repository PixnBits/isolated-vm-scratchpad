'use strict';
const ivm = require('isolated-vm');

(async function main() {
  var isolate;
  try {
    isolate = new ivm.Isolate();

    const scripts = await Promise.all(
      [
        { code: 'var thing = 101134;', filename: 'file:///thing.js' },
        { code: 'function render() { log("rendered!"); }', filename: 'file:///render.js' },
        { code: 'const deep = { a: 1, b: 2 };', filename: 'file:///deep.js' },
      ]
        .map(({ code, ...fileInfo }) => isolate.compileScript(code, fileInfo))
    );

    const contextA = await isolate.createContext();
    const jailA = contextA.global;
    await jailA.set('global', jailA.derefInto());
    await jailA.set('log', function (...args) { console.log(...args); });
    scripts.forEach(script => script.run(contextA));
    
    const contextB = await isolate.createContext();
    const jailB = contextB.global;
    await jailB.set('global', jailB.derefInto());
    await jailB.set('log', function (...args) { console.log(...args); });
    scripts.forEach(script => script.run(contextB));

    async function runAStuff() {
      console.log('context A');
      // await contextA.eval('log(Object.keys(global))');
      await contextA.eval('log("thing:", typeof thing, thing)');
      await contextA.eval('thing = "why hello there";');
      await contextA.eval('log("thing after edits:", typeof thing, thing)');
      await contextA.eval('log("deep after edits:", typeof deep, deep)');
      await contextA.eval('deep.c = 3; delete deep.b; deep.a = "one";');
      await contextA.eval('log("deep:", typeof deep, deep)');
      await contextA.eval('render()');
    }
    
    async function runBStuff() {
      console.log('context B');
      // await contextB.eval('log(Object.keys(global))');
      await contextB.eval('log("thing:", typeof thing, thing)');
      await contextB.eval('log("deep:", typeof deep, deep)');
      await contextB.eval('render()');
    }

    //*
    await runAStuff();
    await runBStuff();
    /*/
    await Promise.all([runAStuff(), runBStuff()]);
    //*/
  } catch (error) {
    process.exitCode = 1;
    console.error("we have an error:", error);
  } finally {
    isolate.dispose();
  }
}(...process.argv));