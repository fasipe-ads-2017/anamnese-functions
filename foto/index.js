require('dotenv').config();

const MongoClient = require('mongodb').MongoClient;

const dbName = 'fisio';

const collectionName = 'foto';

const connectMongoDB = () => MongoClient.connect(process.env.MONGODB, { useNewUrlParser: true });

exports.handler = (req, res) => {

    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET,PUT,DELETE,POST,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Access-Control-Max-Age', '3600');

    if (req.method === 'OPTIONS') {

        res.status(200).send('');

    } else if (req.method === 'POST' || req.method == 'PUT') {

        salvar(req, res);

    } else if (req.method === 'DELETE') {

        res.status(400).send({ message: 'Operação inválida' });

    } else if (req.method === 'GET') {

        if (isIdQuery(req)) {
            return findById(req, res);
        }

        res.status(400).send({ message: 'Operação inválida' });
    } else {
        res.status(400).send({ message: 'Operação inválida' });
    }
};

const isIdQuery = (req) => {
    return req.query._id !== undefined;
}

const salvar = (req, res) => {
    return autenticar(req, res)
        .then((usuario) => {
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
        }).catch((err) => {
            console.log(`Erro ao buscar usuário: ${err.toString()}`);
            res.status(403).send({ message: 'Acesso negado' });
        });
}

const findById = (req, res) => {
    return autenticar(req, res)
        .then((usuario) => {
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
        }).catch((err) => {
            console.log(`Erro ao buscar usuário: ${err.toString()}`);
            res.status(403).send({ message: 'Acesso negado' });
        });
}

const autenticar = (req, res) => {
    if (req.headers && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        const token = req.headers.authorization.substr(7);
        return findUsuarioByToken(token);
    } else {
        res.status(403).send({ message: 'Token não informado na requisição!' });
    }
}

const findUsuarioByToken = (token) => {
    return new Promise((resolve, reject) => {
        connectMongoDB()
            .then(client =>
                client
                    .db(dbName)
                    .collection('usuario')
                    .findOne({ token: token })
                    .then((usuario) => usuario && usuario.ativo ? resolve(usuario) : reject(`Usuário não encontrado com o token ${token}`))
                    .catch((err) => reject(err))
            ).catch(err => reject(err));
    });
}