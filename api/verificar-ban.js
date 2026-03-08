// api/verificar-ban.js

// Lista simples de IPs banidos (em produção, use um banco de dados)
const BANNED_IPS = new Set([
    // Exemplos: '192.168.1.100', '10.0.0.50'
]);

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Método não permitido' });
    }

    const { ip } = req.query;

    if (!ip) {
        return res.status(400).json({ error: 'IP não fornecido' });
    }

    try {
        // Verificar se IP está banido
        const banned = BANNED_IPS.has(ip);
        
        return res.status(200).json({
            banned: banned,
            message: banned ? 'IP banido por violação dos termos' : 'IP não está banido'
        });

    } catch (error) {
        console.error('Erro ao verificar ban:', error);
        return res.status(500).json({ 
            error: 'Erro interno do servidor',
            banned: false 
        });
    }
};