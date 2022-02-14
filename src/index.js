const deasync = require('deasync')

function main(uri){

    let mod;

    import(uri)
        .then(res => mod = res.default)
        .catch(err => console.error(mod = err))

    while (!mod) deasync.sleep(100);

    return mod
    }

module.exports = main;
