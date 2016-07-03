'use strict';

const Hapi = require('hapi');
const Datastore = require('nedb');

const server = new Hapi.Server();
server.connection({
    port: 8000
});

const db = new Datastore({
    filename: 'sayings.db',
    autoload: true
});

const random = (low, high) => { // [low, high)
    return Math.floor(Math.random() * (high - low) + low);
};

const getHalves = (str) => {
    const commas = str.split(',');
    if (commas.length == 2) {
        return commas;
    } else {
        const words = str.split(' ');
        const part1 = words.slice(0, words.length / 2);
        const part2 = words.slice(words.length / 2);
        return [part1.join(' '), part2.join(' ')];
    }
};

const getRandomSaying = (cb) => {
    db.count({}, (err, count) => {
        if (err) throw err;

        const rand1 = random(0, count);
        var rand2 = 0;
        do {
            rand2 = random(0, count);
        } while (rand1 == rand2);

        db.find({
            $or: [{
                id: rand1
            }, {
                id: rand2
            }]
        }, (err, docs) => {
            if (err) throw err;

            const part1 = getHalves(docs[0].text)[0];
            const part2 = getHalves(docs[1].text)[1];

            console.log('"' + docs[0].text + '" + "' + docs[1].text +
                '" = "' + part1 + '" + "' + part2 + '"');

            cb(part1, part2);
        });
    });
}

const buildDb = () => {
    return new Promise((fullfill, reject) => {
        db.count({}, (err, count) => {

            if (err) {
                reject(err);
            }

            if (count == 0) { // first start
                const rl = require('readline').createInterface({
                    input: require('fs').createReadStream('sayings.txt')
                });

                var count = 0;
                rl.on('line', (line) => {
                    db.insert({
                        id: count,
                        text: line
                    });
                    count++;
                });

                rl.on('end', () => {
                    fullfill(count);
                });
            } else {
                fullfill(count);
            }
        });
    });
};

buildDb().then((count) => {
    console.log('Loaded ' + count + ' sayings.');

    server.register([require('vision'), require('inert')], (err) => {

        if (err) {
            throw err;
        }

        server.views({
            engines: {
                html: require('handlebars')
            },
            path: __dirname + '/templates'
        });

        server.route({
            method: 'GET',
            path: '/',
            handler: (request, reply) => {
                getRandomSaying((part1, part2) => {
                    reply.view('index', {
                        part1: part1,
                        part2: part2
                    })
                });
            }
        });

        server.route({
            method: 'GET',
            path: '/rand',
            handler: (request, reply) => {
                getRandomSaying((part1, part2) => {
                    reply({ part1: part1, part2: part2 });
                });
            }
        });

        server.route({
            method: 'GET',
            path: '/{param*}',
            handler: {
                directory: {
                    path: 'public'
                }
            }
        });

        server.start((err) => {

            if (err) {
                throw err;
            }

            console.log('Server is listening at ' + server.info.uri);
        });
    });

});
