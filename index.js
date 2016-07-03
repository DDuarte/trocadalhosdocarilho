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

const getSaying = (id1, id2, cb) => {
    db.find({
        $or: [{
            id: parseInt(id1)
        }, {
            id: parseInt(id2)
        }]
    }, (err, docs) => {
        if (err) throw err;

        if (docs[0].id != id1) {
            const copy = docs[0];
            docs[0] = docs[1];
            docs[1] = copy;
        }

        const part1 = getHalves(docs[0].text)[0];
        const part2 = getHalves(docs[1].text)[1];

        console.log('"' + docs[0].text + '" + "' + docs[1].text +
            '" = "' + part1 + '" + "' + part2 + '"');

        cb({
            part1: {
                text: part1,
                id: docs[0].id
            },
            part2: {
                text: part2,
                id: docs[1].id
            }
        });
    });
};

const getRandomSaying = (cb) => {
    db.count({}, (err, count) => {
        if (err) throw err;

        const rand1 = random(0, count);
        var rand2 = 0;
        do {
            rand2 = random(0, count);
        } while (rand1 == rand2);

        getSaying(rand1, rand2, cb);
    });
};

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
                if (request.query.id1 && request.query.id2) {
                    getSaying(request.query.id1, request.query.id2, parts => {
                        reply.view('index', parts);
                    });
                } else {
                    getRandomSaying(parts => {
                        parts.first = true;
                        reply.view('index', parts);
                    });
                }
            }
        });

        server.route({
            method: 'GET',
            path: '/rand',
            handler: (request, reply) => {
                getRandomSaying(parts => {
                    reply(parts);
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
