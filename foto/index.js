require('dotenv').config();

const MongoClient = require('mongodb').MongoClient;

const dbName = 'fisio';

const collectionName = 'foto';

const connectMongoDB = () => MongoClient.connect(process.env.MONGODB, { useNewUrlParser: true });

exports.handler = (req, res) => {

    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET,PUT,DELETE,POST,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');

    if (req.method === 'OPTIONS') {

        res.status(200).send('');

    } else if (req.method === 'POST' || req.method == 'PUT') {

        salvar(req, res);

    } else if (req.method === 'DELETE') {

        res.status(400).send({ message: 'Operação inválida' });

    } else if (req.method === 'GET') {

        return findById(req, res);

    } else {
        res.status(400).send({ message: 'Operação inválida' });
    }
};

const salvar = (req, res) => {
    let foto = req.body;

    return connectMongoDB()
        .then(client =>
            client
                .db(dbName)
                .collection(collectionName)
                .updateOne({ _id: foto._id }, { $set: { foto: foto.foto, _id: foto._id } }, { upsert: true })
                .then(result => client)
        )
        .then(db => db.close())
        .then(() => res.json({ result: 'ok' }))
        .catch(err => res.status(400).send({ message: err.toString() }));
}

const isIdQuery = (req) => {
    return req.query._id !== undefined;
}

const findById = (req, res) => {
    return connectMongoDB()
        .then(client =>
            client
                .db(dbName)
                .collection(collectionName)
                .find({ _id: req.query._id })
                .toArray()
                .then(pacientes => ({ db: client, pacientes: pacientes }))
                .then(({ db, pacientes }) => {
                    db.close();
                    return pacientes
                })
                .then(pacientes => pacientes.length > 0 ? pacientes[0] : undefined)
                .then(paciente => paciente ? res.json(paciente) : res.status(404).send({ message: `Paciente não encontrado com o id ${req.query._id}` })))
        .catch(err => res.status(400).send({ message: err.toString() }));
}