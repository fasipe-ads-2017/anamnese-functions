require('dotenv').config();
const crypto = require('crypto')

const MongoClient = require('mongodb').MongoClient;

const dbName = 'fisio';

const collectionName = 'usuario';

const connectMongoDB = () => MongoClient.connect(process.env.MONGODB, { useNewUrlParser: true });

const uuidv4 = require('uuid/v4');

const pageSize = 5;

exports.handler = (req, res) => {

    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET,PUT,DELETE,POST,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Access-Control-Max-Age', '3600');

    if (req.method === 'OPTIONS') {
        res.status(200).send('');
    } else if (req.method === 'PUT') {
        authenticate(req, res);
    } else if (req.method === 'POST') {
        if (validarUsuario(req, res)) {
            salvar(req, res);
        }
    } else if (req.method === 'DELETE') {
        res.status(400).send({ message: 'Operação inválida' });
    } else if (req.method === 'GET') {
        if (isTokenQuery(req)) {
            return findUsuarioByTokenInQuery(req, res);
        } else {
            return showAll(req, res);
        }
        //res.status(400).send({ message: 'Operação GET inválida' });
    } else {
        res.status(400).send({ message: 'Operação inválida' });
    }
};

const validarUsuario = (req, res) => {
    let resultadoValidacao = {
        errors: [],
        success: true
    };

    let usuario = req.body;

    let insert = usuario._id ? false : true;

    if (!usuario) {
        resultadoValidacao.errors.push('Dados do usuário não enviados!');
    }

    if (!usuario.nome || !usuario.nome.trim()) {
        resultadoValidacao.errors.push('Nome do usuário não informado!');
    }

    if (!usuario.email || !usuario.email.trim()) {
        resultadoValidacao.errors.push('Email do usuário não informado!');
    }

    if (insert) {
        if (!usuario.senha || !usuario.senha.trim()) {
            resultadoValidacao.errors.push('Senha do usuário não informada!');
        }
    }

    if (usuario.senha) {
        if (usuario.senha != usuario.confSenha) {
            resultadoValidacao.errors.push('Senha e confirmação da senha não são iguais!');
        }
    }

    if (resultadoValidacao.errors.length > 0) {
        resultadoValidacao.message = 'Falha ao salvar os dados do paciente!';
        res.status(400).send(resultadoValidacao);
        return false;
    }

    return true;
}

const salvar = (req, res) => {
    return autenticar(req, res)
        .then((u) => {

            let usuario = req.body;

            usuario._id = usuario._id || uuidv4();

            if (usuario.senha)
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

const showAll = (req, res) => {
    return autenticar(req, res)
        .then((usuario) => {
            if (!usuario.administrador) {
                res.status(403).send({ message: 'Acesso negado' });
                return;
            }

            let page = req.query.page ? parseInt(req.query.page) : 1;

            page = page >= 1 ? page : 1;

            let skip = (page - 1) * pageSize;

            return connectMongoDB()
                .then(client =>
                    client
                        .db(dbName)
                        .collection(collectionName)
                        // .find()
                        .find({ nome: { $regex: `.*${req.query.nome}.*`, $options: 'si' } })
                        .sort({ nome: 1 })
                        .limit(pageSize)
                        .skip(skip)
                        .toArray()
                        .then(usuarios => ({ db: client, usuarios: usuarios }))
                        .then(({ db, usuarios: usuarios }) => {
                            db.close();
                            return usuarios;
                        })
                        .then(usuarios => usuarios.map(usuario => { return { _id: usuario._id, nome: usuario.nome, email: usuario.email, administrador: usuario.administrador, ativo: usuario.ativo } }))
                        .then(usuarios => res.json(usuarios)))
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
                    .then((usuario) =>
                        usuario && usuario.ativo
                            ?
                            res.json({ token: usuario.token, nome: usuario.nome, email: usuario.email, administrador: usuario.administrador, ativo: usuario.ativo }).status(200)
                            :
                            res.status(403).json({ message: 'Usuário / senha inválidos!' }))
                    .catch((error) => {
                        res.status(403).json({ message: 'Usuário / senha inválidos!' });
                    })
                ).catch(err => res.status(404).send({ message: err.toString(), error: true }))
        }).catch(err => res.status(500).send({ message: err.toString() }));
}

const validateUserAndPassword = (usuario, req, res) => {
    return new Promise((resolve, reject) => {

        if (!usuario || !usuario.email || !usuario.senha || !usuario.ativo) {
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

const findUsuarioByTokenInQuery = (req, res) => {
    return connectMongoDB()
        .then(client =>
            client
                .db(dbName)
                .collection(collectionName)
                .findOne({ token: req.query.token })
                .then((usuario) => usuario && usuario.ativo ? res.json({ email: usuario.email, nome: usuario.nome, administrador: usuario.administrador, ativo: usuario.ativo }) : res.status(404).send({ message: 'Usuário não encontrado' }))
                .catch((err) => res.status(404).send({ message: err.toString() }))
        ).catch(err => res.status(400).send({ message: err.toString() }));
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