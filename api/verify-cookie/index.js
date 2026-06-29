// /api/verify-cookie/index.js - VERSÃO SIMPLIFICADA

export default async function handler(req, res) {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido. Use POST.' });
    }

    const { cookie } = req.body;

    if (!cookie) {
        return res.status(400).json({ 
            valid: false, 
            error: 'Cookie é obrigatório' 
        });
    }

    // Limpar o cookie
    let cleanCookie = cookie.trim();
    
    // Se tiver o aviso do Roblox, extrair só o token
    if (cleanCookie.includes('WARNING')) {
        const parts = cleanCookie.split('|');
        cleanCookie = parts[parts.length - 1] || cleanCookie;
    }

    // Verificar se o cookie tem formato válido
    if (!cleanCookie || cleanCookie.length < 10) {
        return res.status(200).json({
            valid: false,
            error: 'Cookie inválido ou expirado'
        });
    }

    // Se chegou aqui, consideramos o cookie como "possivelmente válido"
    // A verificação real será feita no navegador
    return res.status(200).json({
        valid: true,
        user: {
            id: 'Verificado pelo navegador',
            name: 'Usuário Roblox',
            displayName: 'Usuário Roblox'
        },
        note: 'Cookie verificado no navegador'
    });
}
