require('dotenv').config();
const crypto = require('crypto')

const MongoClient = require('mongodb').MongoClient;

const dbName = 'fisio';

const collectionName = 'usuario';

const connectMongoDB = () => MongoClient.connect(process.env.MONGODB, { useNewUrlParser: true });

const uuidv4 = require('uuid/v4');

exports.handler = (req, res) => {

    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET,PUT,DELETE,POST,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');

    if (req.method === 'OPTIONS') {
        res.status(200).send('');
    } else if (req.method === 'PUT') {
        authenticate(req, res);
    } else if (req.method === 'POST') {
        salvar(req, res);
    } else if (req.method === 'DELETE') {
        res.status(400).send({ message: 'Operação inválida' });
    } else if (req.method === 'GET') {
        if (isTokenQuery(req)) {
            return findByToken(req, res);
        }
        res.status(400).send({ message: 'Operação GET inválida' });
    } else {
        res.status(400).send({ message: 'Operação inválida' });
    }
};

const salvar = (req, res) => {
    return autenticar(req, res)
        .then((usuario) => {
            let insert = req.method == 'POST';

            let usuario = req.body;

            usuario._id = insert ? uuidv4() : usuario._id;

            usuario.senha = crypto
                .createHash('md5')
                .update(usuario.senha)
                .digest("hex");

            return connectMongoDB()
                .then(client =>
                    client
                        .db(dbName)
                        .collection(collectionName)
                        .updateOne({ _id: usuario._id }, { $set: usuario }, { upsert: true })
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

const authenticate = (req, res) => {
    return connectMongoDB()
        .then(client => {
            client
                .db(dbName)
                .collection(collectionName)
                .findOne({ email: req.body.email })
                .then((usuario) => validateUserAndPassword(usuario, req, res)
                    .then((usuario) => {
                        client
                            .db(dbName)
                            .collection(collectionName)
                            .updateOne({ _id: usuario._id }, { $set: usuario })
                            .then((result) => console.log(result));
                        return usuario;
                    })
                    .then((usuario) => res.json({ token: usuario.token, nome: usuario.nome, email: usuario.email }).status(200))
                    .catch((error) => {
                        res.status(403).json({ message: 'Usuário / senha inválidos!' });
                    })
                ).catch(err => res.status(404).send({ message: err.toString(), error: true }))
        }).catch(err => res.status(500).send({ message: err.toString() }));
}

const validateUserAndPassword = (usuario, req, res) => {
    return new Promise((resolve, reject) => {

        if (!usuario || !usuario.email || !usuario.senha) {
            reject('Usuário / senha inválidos!');
            return;
        }

        let senhaMd5 = crypto.createHash('md5').update(req.body.senha).digest("hex");

        if (usuario.email == req.body.email && usuario.senha == senhaMd5) {
            // Gera um novo token
            usuario.token = uuidv4();
            resolve(usuario);
        } else {
            reject('Usuário / senha inválidos!');
        }
    });
}

const isTokenQuery = (req) => {
    return req.query.token !== undefined;
}

const autenticar = (req, res) => {
    if (req.headers && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        const token = req.headers.authorization.substr(7);
        return findUsuarioByToken(token);
    } else {
        res.status(403).send({ message: 'Token não informado na requisição!' });
    }
}

const findByToken = (req, res) => {
    return connectMongoDB()
        .then(client =>
            client
                .db(dbName)
                .collection(collectionName)
                .findOne({ token: req.query.token })
                .then((usuario) => usuario ? res.json({ email: usuario.email, nome: usuario.nome }) : res.status(404).send({ message: 'Usuário não encontrado' }))
                .catch((err) => res.status(404).send({ message: err.toString() }))
        ).catch(err => res.status(400).send({ message: err.toString() }));
}