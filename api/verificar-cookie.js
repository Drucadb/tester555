// api/verificar-cookie.js
const RobloxAPI = require('./utils/roblox-api');
const { validarFormatoCookie } = require('./utils/validadores');

module.exports = async (req, res) => {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ erro: 'Método não permitido' });
    }

    const { cookie } = req.body;

    if (!cookie) {
        return res.status(400).json({ 
            valido: false, 
            erro: 'Cookie não fornecido' 
        });
    }

    // Validar formato básico
    const validacaoFormato = validarFormatoCookie(cookie);
    if (!validacaoFormato.valido) {
        return res.status(400).json({
            valido: false,
            erro: validacaoFormato.motivo,
            formatoInvalido: true
        });
    }

    try {
        // Criar instância da API Roblox
        const roblox = new RobloxAPI(validacaoFormato.cookieLimpo);
        
        // Verificar cookie e obter informações
        const infoConta = await roblox.getInfoConta();

        if (!infoConta.valido) {
            return res.status(401).json({
                valido: false,
                erro: infoConta.erro || 'Cookie inválido ou expirado',
                cookieExpirado: true
            });
        }

        // Verificar se a conta é recente (menos de 30 dias)
        const contaRecente = infoConta.ehRecente === true;

        return res.status(200).json({
            valido: true,
            username: infoConta.username,
            userId: infoConta.userId,
            idadeConta: infoConta.idadeConta,
            diasConta: infoConta.diasConta,
            contaRecente: contaRecente,
            created: infoConta.created,
            regras: {
                contaRecente: contaRecente
            }
        });

    } catch (error) {
        console.error('Erro ao verificar cookie:', error);
        
        return res.status(500).json({
            valido: false,
            erro: 'Erro interno ao verificar cookie'
        });
    }
};