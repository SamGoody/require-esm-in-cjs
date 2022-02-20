# Require ( ESM ) in CJS

## Objective.

Include a ES Module directly within the root of a CommonJS package.

## Usage

    const req = require('require-esm-in-cjs');
    const esm = req('esm-pkg'); // require of a ESM package!!

## The itch:
1. I would like to require('esm-pkg') and use some other ESM module in my CJS package.

2. EcmaScript modules are the future - it is supported by all browsers, by Deno, and NodeJS is moving over to it step by step.
   But all old projects are written in CommonJS, and if you want your code to be play nice, you need to export it for both CJS and ESM.
   You can use a build tool like Parcel or ESBuild to export multiple versions but they each have their own cans of worms...

   Wait! Why not just write in ESM, and have a CJS module that imports the ESM module and exports it as CJM?!

## The problem

It is not possible to include ES Modules directly into a CJS script.

    // Error [ERR_REQUIRE_ESM]: require() of ES Module esm-pkg not supported.
    const esm = require('esm-pkg');

Nor can you use await with dynamic imports to load it, as top level await is not supported by CommonJS.

    // Error:
    const esm = await import('esm-pkg');

Even though it _is_ possible to include CJS modules directly in a ESM script, which doesn't help us.

    // Works!!
    import cjs from 'cjs-pkg';

## The solution

Use [require-esm-in-cjs](https://www.npmjs.com/package/require-esm-in-cjs)!

    a. require() in a CJS module:
    // tailwind.config.js - all plugins need to be in CJS, but tailwind-children was ESM!
    const req = require('require-esm-in-cjs');
    module.exports = {
        ...
        plugins:[
            req('tailwind-children')
            ],
        }

    b. Export a CJS module from a ESM module
    // export.cjs - in package.json add `{ "main": "export.cjs" }`
    const path = require('path')
    const req = require('require-esm-in-cjs');
    module.exports = req(path.resolve(__dirname, './index.mjs'));

    c. Start a new discussion to tell me how else you use this!

## How it works - the problem described
It is actually easy to include ESM in CJS, using ["dynamic imports"](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import#dynamic_imports)

Either using then/error as follows:
    import('esm-pkg')
        .then(esm => console.log(esm))
        .error(err => console.log(err))

Or with async/await - as long as it is not in the root:

    async function handleESM(pkg){
        try {
            const esm = await import(pkg);
            console.log( esm );
            }
        error (err){
            console.log(err);
            }
        }
    const esm = handleESM('esm-pkg');

The problem with both of these techniques is that they are async, and return a promise.

So if you include it another project, it will be a unusable promise

    plugins:[ req('tailwind-children') ],
    // === plugins:[ Promise ], not very useful!

Similarly, if you try to module.exports the ESM module, it exports a promise,

    module.exports = handleESM('cjs-pkg');
    // module.exports = Promise, also not useful!

If there was just some way to hold off resolution of the page until the promise could be resolved, there would be no issue.

### naive attempt 1
Node natively supports [setTimeout](https://nodejs.org/api/timers.html#setintervalcallback-delay-args) and [setInterval](https://nodejs.org/api/timers.html#setintervalcallback-delay-args).

One would think that we could just add a setTimeout to hold the thread till the require is resolved...
But, setTimeout is ALSO async. So the call to setTimeout is sent into the ether, and the script charges ahead to the end holding a promise.




### attempt 2
So, we need a way to block the page until the Promise is resolved.

Actually, not hard at all.
The simplest way is using execSync, which runs a arbitrary exec command in a synchronous fashion.
Opening up for us two possible lines of attack:

    1. Load the module using execSync and something like curl.
    2. Run a loop that stops the page until the Promise is resolved.

The second method depends on creating a blocking sleep function, which is [pretty straightforward](https://masteringjs.io/tutorials/node/sleep).

    const {execSync} = require('child_process');
    let esm = false;
    import('esm-pkg').then(res => esm = res)
    while (esm === false) execSync('sleep 1');
    module.exports = esm;

This works!!
However, it's got a pretty serious downside. It doesn't just block our innocent little page from loading, it stops the whole node process.
Which means that if you have 100,000 people logged in and using websockets, they will all have to wait till your page is loaded and processed to do _anything_.
Aside from inconvenience, this could lock up your whole process and cause bad things.

To be fair, in many cases it's not so bad to block everything.
For example, in the case of the tailwind-plugin I used above, the loading is done once during build time, and it is done from a local cache.
This is unlikely to take more than a few ms, and is never run with simultaneous threads.

However, it would be better if we could do the same thing but WITHOUT blocking the whole Node process, no?!

### Solution!

As it turns out there are two wonderful libraries for Node that are written specifically to allow you to run code synchronously without blocking the process:
    - [deasync](https://github.com/abbr/deasync)
    - [node-sync](https://github.com/ybogdanov/node-sync)

node-sync has not had an update in ten years, so it sure seems abandoned.
But deasync is alive and kicking, and has quite a few projects that use it, so we went with that.

Using deasync, we could do the require asynchronously, but I have not quite figured that out yet.
Meanwhile, I setup a non blocking syncronous sleep to wait till the Promise is resolved.

And Viola!

require( ESM ) in CommonJS modules.
Isn't life wonderful? Go buy yourself a beer.


# Contribute

We need tests, ideas, improvements - please open issues, discussions and pull requests!
