// /api/verify-cookie/index.js

export default async function handler(req, res) {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Responder preflight
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Aceitar apenas POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido. Use POST.' });
    }

    const { cookie } = req.body;

    // Verificar se o cookie foi enviado
    if (!cookie) {
        return res.status(400).json({ 
            valid: false, 
            error: 'Cookie é obrigatório' 
        });
    }

    // Remover espaços extras
    const cleanCookie = cookie.trim();

    // Verificar se o cookie tem o formato correto
    if (!cleanCookie.startsWith('_|WARNING:-DO-NOT-SHARE') && !cleanCookie.match(/^[a-zA-Z0-9_-]+$/)) {
        return res.status(400).json({ 
            valid: false, 
            error: 'Formato de cookie inválido' 
        });
    }

    try {
        // ===== MÉTODO 1: Tentar verificar com a API oficial do Roblox =====
        const response = await fetch('https://www.roblox.com/mobileapi/userinfo', {
            headers: {
                'Cookie': `.ROBLOSECURITY=${cleanCookie}`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            }
        });

        // Se a resposta for 200, o cookie é válido
        if (response.ok) {
            const userData = await response.json();
            
            return res.status(200).json({
                valid: true,
                user: {
                    id: userData.UserID || userData.id,
                    name: userData.UserName || userData.name,
                    displayName: userData.DisplayName || userData.displayName || userData.UserName,
                    avatar: userData.AvatarUri || userData.avatarUri || null,
                    created: userData.Created || userData.created || null
                }
            });
        }

        // Se a resposta for 403, o cookie é inválido
        if (response.status === 403) {
            return res.status(200).json({
                valid: false,
                error: 'Cookie inválido ou expirado'
            });
        }

        // Se for 404, tentar método alternativo
        if (response.status === 404) {
            // ===== MÉTODO 2: Tentar com a API de autenticação =====
            try {
                const authResponse = await fetch('https://auth.roblox.com/v2/login', {
                    method: 'POST',
                    headers: {
                        'Cookie': `.ROBLOSECURITY=${cleanCookie}`,
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Content-Type': 'application/json'
                    }
                });

                // Se o cookie for válido, a resposta não será 401/403
                if (authResponse.status === 200 || authResponse.status === 429) {
                    // 429 = muitas requisições, mas cookie válido
                    return res.status(200).json({
                        valid: true,
                        user: {
                            id: 'Verificado com sucesso',
                            name: 'Usuário Roblox',
                            displayName: 'Usuário Roblox',
                            avatar: null,
                            created: null
                        }
                    });
                }

                return res.status(200).json({
                    valid: false,
                    error: 'Cookie inválido ou expirado'
                });
            } catch (authError) {
                console.error('Erro na autenticação alternativa:', authError);
            }
        }

        // Outros erros
        return res.status(200).json({
            valid: false,
            error: `Erro ao verificar cookie: ${response.status}`
        });

    } catch (error) {
        console.error('Erro ao verificar cookie:', error);
        return res.status(500).json({
            valid: false,
            error: 'Erro interno ao verificar cookie'
        });
    }
}
