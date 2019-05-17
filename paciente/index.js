require('dotenv').config();

const MongoClient = require('mongodb').MongoClient;

const dbName = 'fisio';

const collectionName = 'paciente';

const connectMongoDB = () => MongoClient.connect(process.env.MONGODB, { useNewUrlParser: true });

const uuidv4 = require('uuid/v4');

const pageSize = 5;

exports.handler = (req, res) => {

    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET,PUT,DELETE,POST,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');

    if (req.method === 'OPTIONS') {
        res.status(200).send('');
    } else if (req.method === 'POST') {

        if (validarPaciente(req, res)) {
            return createPaciente(req, res);
        }

    } else if (req.method === 'PUT') {

        if (validarPaciente(req, res)) {
            return updatePaciente(req, res);
        }

    } else if (req.method === 'DELETE') {

        res.status(400).send({ message: 'Operação inválida' });

    } else if (req.method === 'GET') {

        if (isCpfQuery(req, res)) {
            return findByCpf(req, res);
        } else if (isIdQuery(req)) {
            return findById(req, res);
        } else if (isNomeQuery(req)) {
            return findByNome(req, res);
        }

        res.status(400).send({ message: 'Operação inválida' });

    } else {
        res.status(400).send({ message: 'Operação inválida' });
    }
};

const validarPaciente = (req, res) => {
    let resultadoValidacao = {
        errors: [],
        success: true
    };

    let insert = req.method == 'POST';

    let paciente = req.body;

    paciente._id = insert ? uuidv4() : paciente._id;

    if (!paciente) {
        resultadoValidacao.errors.push({ 'geral': 'Dados do paciente não enviados!' });
    }

    if (!paciente.nome || !paciente.nome.trim()) {
        resultadoValidacao.errors.push({ 'nome': 'Nome do paciente não informado!' });
    }

    // TODO Validar se é um insert, e se o CPF já existe
    if (insert) {
        // Check CPF
    }

    if (resultadoValidacao.errors.length > 0) {
        res.status(400).send(resultadoValidacao);
        return false;
    }

    return true;
}

const createPaciente = (req, res) => {
    let paciente = req.body;

    // TODO Checar se o CPF já existe

    return connectMongoDB()
        .then(client => client
            .db(dbName)
            .collection(collectionName)
            .insertOne(paciente)
            .then(result => client)
        )
        .then(db => db.close())
        .then(() => res.json({ result: 'ok', _id: paciente._id }))
        .catch(err => res.status(400).send({ message: err.toString() }));
}

const updatePaciente = (req, res) => {
    let paciente = req.body;

    return connectMongoDB()
        .then(client =>
            client
                .db(dbName)
                .collection(collectionName)
                .updateOne({ _id: paciente._id }, { $set: paciente }, { upsert: true })
                .then(result => client)
        )
        .then(db => db.close())
        .then(() => res.json({ result: 'ok' }))
        .catch(err => res.status(400).send({ message: err.toString() }));
}

const isCpfQuery = (req) => {
    return req.query.cpf !== undefined;
}

const isIdQuery = (req) => {
    return req.query._id !== undefined;
}

const isNomeQuery = (req) => {
    return req.query.nome !== undefined;
}

const findByCpf = (req, res) => {
    return connectMongoDB()
        .then(client =>
            client
                .db(dbName)
                .collection(collectionName)
                .find({ cpf: req.query.cpf })
                .toArray()
                .then(pacientes => ({ db: client, pacientes: pacientes }))
                .then(({ db, pacientes }) => {
                    db.close();
                    return pacientes
                })
                .then(pacientes => pacientes.length > 0 ? pacientes[0] : undefined)
                .then(paciente => paciente ? res.json(paciente) : res.status(404).send({ message: `Paciente não encontrado com o CPF ${req.query.cpf}` })))
        .catch(err => res.status(400).send({ message: err.toString() }));
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

const findByNome = (req, res) => {
    let page = req.query.page ? parseInt(req.query.page) : 1;

    page = page >= 1 ? page : 1;

    let skip = (page - 1) * pageSize;

    return connectMongoDB()
        .then(client =>
            client
                .db(dbName)
                .collection(collectionName)
                .find({ nome: { $regex: `.*${req.query.nome}.*`, $options: 'si' } })
                .limit(pageSize)
                .skip(skip)
                .toArray()
                .then(pacientes => ({ db: client, pacientes: pacientes }))
                .then(({ db, pacientes }) => {
                    db.close();
                    return pacientes;
                })
                .then(pacientes => res.json(pacientes)))
        .catch(err => res.status(400).send({ message: err.toString() }));
}