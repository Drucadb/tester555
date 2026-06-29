// /api/verify-cookie/index.js

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

    const cleanCookie = cookie.trim();

    // Verificar formato básico
    if (!cleanCookie.startsWith('_|WARNING:-DO-NOT-SHARE') && !cleanCookie.match(/^[a-zA-Z0-9_-]+$/)) {
        return res.status(400).json({ 
            valid: false, 
            error: 'Formato de cookie inválido' 
        });
    }

    try {
        // ===== MÉTODO 1: API de Autenticação do Roblox (MAIS CONFIÁVEL) =====
        const authResponse = await fetch('https://auth.roblox.com/v2/logout', {
            method: 'POST',
            headers: {
                'Cookie': `.ROBLOSECURITY=${cleanCookie}`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        // Se o cookie for válido, a resposta será 200, 429 ou 403
        // 429 = Too Many Requests (mas cookie válido)
        // 200 = Logout bem sucedido (cookie válido)
        if (authResponse.status === 200 || authResponse.status === 429) {
            // Cookie válido! Vamos pegar os dados do usuário
            try {
                // Tentar pegar informações do usuário
                const userResponse = await fetch('https://users.roblox.com/v1/users/authenticated', {
                    headers: {
                        'Cookie': `.ROBLOSECURITY=${cleanCookie}`,
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                });

                if (userResponse.ok) {
                    const userData = await userResponse.json();
                    return res.status(200).json({
                        valid: true,
                        user: {
                            id: userData.id,
                            name: userData.name,
                            displayName: userData.displayName || userData.name
                        }
                    });
                }
            } catch (e) {}

            // Se não conseguir pegar os dados, mas o cookie é válido
            return res.status(200).json({
                valid: true,
                user: {
                    id: 'Verificado',
                    name: 'Usuário Roblox',
                    displayName: 'Usuário Roblox'
                }
            });
        }

        // Se for 403, cookie inválido ou expirado
        if (authResponse.status === 403) {
            return res.status(200).json({
                valid: false,
                error: 'Cookie inválido ou expirado'
            });
        }

        // ===== MÉTODO 2: Tentar com a API de economia (fallback) =====
        try {
            const ecoResponse = await fetch('https://economy.roblox.com/v1/user/currency', {
                headers: {
                    'Cookie': `.ROBLOSECURITY=${cleanCookie}`,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            if (ecoResponse.status === 200) {
                const data = await ecoResponse.json();
                return res.status(200).json({
                    valid: true,
                    user: {
                        id: 'Verificado',
                        name: 'Usuário Roblox',
                        displayName: 'Usuário Roblox'
                    }
                });
            }

            if (ecoResponse.status === 403) {
                return res.status(200).json({
                    valid: false,
                    error: 'Cookie inválido ou expirado'
                });
            }
        } catch (e) {}

        // ===== MÉTODO 3: Tentar com API de perfil (último fallback) =====
        try {
            const profileResponse = await fetch('https://www.roblox.com/mobileapi/userinfo', {
                headers: {
                    'Cookie': `.ROBLOSECURITY=${cleanCookie}`,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            if (profileResponse.status === 200) {
                const userData = await profileResponse.json();
                return res.status(200).json({
                    valid: true,
                    user: {
                        id: userData.UserID || userData.id,
                        name: userData.UserName || userData.name,
                        displayName: userData.DisplayName || userData.displayName || userData.UserName
                    }
                });
            }
        } catch (e) {}

        // Todos os métodos falharam
        return res.status(200).json({
            valid: false,
            error: 'Cookie inválido ou expirado'
        });

    } catch (error) {
        console.error('Erro ao verificar cookie:', error);
        return res.status(500).json({
            valid: false,
            error: 'Erro interno ao verificar cookie'
        });
    }
}
