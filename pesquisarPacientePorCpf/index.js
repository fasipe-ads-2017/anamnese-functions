/**
 * Responds to any HTTP request.
 *
 * @param {!express:Request} req HTTP request context.
 * @param {!express:Response} res HTTP response context.
 */
exports.pesquisarPacientePorCpf = (req, res) => {

    // CORS
    res.set('Access-Control-Allow-Origin', '*');

    if (req.method === 'OPTIONS') {
        // Send response to OPTIONS requests
        res.set('Access-Control-Allow-Methods', 'GET');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        res.set('Access-Control-Max-Age', '3600');
        res.status(204).send('');
    } else if (req.method === 'GET') {
        let cpfPesquisado = req.query.cpf;

        if (isCpfValido(cpfPesquisado)) {
            // TODO Busca pelo CPF informado...
            let pessoaEncontrada = {
                id: 1,
                cpf: cpfPesquisado,
                nome: 'Fulano de tal',
                endereco: 'Av. das flores, 10'
            };
            res.status(200).send(pessoaEncontrada);
        } else {
            res.status(400).send({ message: 'Cpf inválido!' });
        }
    } else {
        res.status(401).send('');
    }
};

// TODO Validar CPF...
function isCpfValido(cpf) {
    if (!cpf || cpf.length < 11) {
        return false;
    }
    return true;
}