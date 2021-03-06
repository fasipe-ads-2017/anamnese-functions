require('dotenv').config();

const MongoClient = require('mongodb').MongoClient;

const dbName = 'fisio';

const collectionName = 'formulario';

const connectMongoDB = () => MongoClient.connect(process.env.MONGODB, { useNewUrlParser: true });

const uuidv4 = require('uuid/v4');

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
        } else if (isIdPaciente(req)) {
            return findByIdPaciente(req, res);
        }

        res.status(400).send({ message: 'Operação GET inválida' });
    } else {
        res.status(400).send({ message: 'Operação inválida' });
    }
};

const isIdQuery = (req) => {
    return req.query._id !== undefined;
}

const isIdPaciente = (req) => {
    return req.query._idPaciente !== undefined;
}

const salvar = (req, res) => {
    return autenticar(req, res)
        .then((usuario) => {
            let insert = req.method == 'POST';

            let formulario = req.body;

            formulario._id = insert ? uuidv4() : formulario._id;
            formulario.data = insert ? new Date() : formulario.data;
            formulario.usuario = { nome: usuario.nome, email: usuario.email };

            return connectMongoDB()
                .then(client =>
                    client
                        .db(dbName)
                        .collection(collectionName)
                        .updateOne({ _id: formulario._id }, { $set: formulario }, { upsert: true })
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
                        .then(formularios => ({ db: client, formularios: formularios }))
                        .then(({ db, formularios }) => {
                            db.close();
                            return formularios
                        })
                        .then(formularios => formularios.length > 0 ? formularios[0] : undefined)
                        .then(formularios => formularios ? res.json(formularios) : res.status(404).send({ message: `Formulário não encontrado com o id ${req.query._id}` })))
                .catch(err => res.status(400).send({ message: err.toString() }));
        }).catch((err) => {
            console.log(`Erro ao buscar usuário: ${err.toString()}`);
            res.status(403).send({ message: 'Acesso negado' });
        });
}

const findByIdPaciente = (req, res) => {
    return autenticar(req, res)
        .then((usuario) => {
            return connectMongoDB()
                .then(client =>
                    client
                        .db(dbName)
                        .collection(collectionName)
                        .find({ _idPaciente: req.query._idPaciente })
                        .toArray()
                        .then(formularios => ({ db: client, formularios: formularios }))
                        .then(({ db, formularios }) => {
                            db.close();
                            return formularios;
                        })
                        .then((formularios) => res.json(formularios)))
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